const SQLiteDatabase = require('better-sqlite3');
const SQL = require('./SQL');

function isPromise(promise) {  
    return !!promise && typeof promise.then === 'function'
}

class Database extends SQLiteDatabase
{
    constructor(filename, mode)
    {
        super(filename, mode);
    }

    prepareCached(sql)
    {
        // SQL?
        if (sql instanceof SQL)
        {
            if (sql.params != 0 && sql.params.filter(x => x !== undefined).length)
            {
                throw new Error("Attempt to prepare SQL with parameter assigned");
            }
            sql = sql.sql;
        }
    
        // Optimization for tight single statment loops
        if (this.last_sql == sql)
            return this.last_stmt;
    
        // Get and cache statement
        if (!this.statement_cache)
            this.statement_cache = new Map();
        let stmt = this.statement_cache.get(sql);
        if (!stmt)
        {
            try
            {
                stmt = this.prepare(sql);
                this.statement_cache.set(sql, stmt);
            }
            catch (err)
            {
                console.error(err.message);
                throw err;
            }
        }
    
        // Cache the most recent
        this.last_stmt = stmt;
        this.last_sql = sql;
    
        return stmt;
    }

    _prep()
    {
        // Create params
        let sql;
        let params;
        if (arguments[0] instanceof SQL)
        {
            sql = arguments[0].sql;
            params = arguments[0].params;
        }
        else
        {
            sql = arguments[0];
            params = Array.prototype.slice.call(arguments, 1);
        }
    
        // Get prepared statement
        let stmt;
        if (this.last_sql == sql)
            stmt = this.last_stmt;
        else
            stmt = this.prepareCached(sql);

        return { stmt, params };
    }

    run()
    {
        let p = this._prep.apply(this, arguments);
        return p.stmt.run.apply(p.stmt, p.params);
    }
    
    get()
    {
        let p = this._prep.apply(this, arguments);
        return p.stmt.get.apply(p.stmt, p.params);
    }

    pluck()
    {
        let p = this._prep.apply(this, arguments);
        p.stmt.pluck(true);
        return p.stmt.get.apply(p.stmt, p.params);
    }
    
    all()
    {
        let p = this._prep.apply(this, arguments);
        p.stmt.pluck(false);
        return p.stmt.all.apply(p.stmt, p.params);
    }
    
    pluckAll()
    {
        let p = this._prep.apply(this, arguments);
        p.stmt.pluck(true);
        return p.stmt.all.apply(p.stmt, p.params);
    }
    
    iterate()
    {
        let p = this._prep.apply(this, arguments);
        return p.stmt.iterate.apply(p.stmt, p.params);
    }

    each()
    {
        let args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
        let callback = arguments[arguments.length - 1];
        let p = this._prep.apply(this, args);
        let iter =  p.stmt.iterate.apply(p.stmt, p.params);
        for (let r of iter)
        {
            if (callback(r))
                break;
        }
    }

    transaction = function()
    {
        throw new Error("transaction() has been deprecated, use transactionSync, transactionAsync or makeTransaction");
    }

    transactionSync(callback)
    {
        this.run("SAVEPOINT tearstx");
        try
        {
            let retv = callback();

            if (isPromise(retv))
                throw new Error("The callback to transactionSync returned a promise.  Use transactionAsync insteaed")

            this.run("RELEASE SAVEPOINT tearstx");
            return retv;
        }
        catch (err)
        {
            this.run("ROLLBACK TO SAVEPOINT tearstx");
            console.error(err.message);
            throw err;
        }
    }

    async transactionAsync(callback)
    {
        this.run("SAVEPOINT tearstx");
        try
        {
            let retv = callback();

            if (isPromise(retv))
                retv = await retv;

            this.run("RELEASE SAVEPOINT tearstx");
            return retv;
        }
        catch (err)
        {
            this.run("ROLLBACK TO SAVEPOINT tearstx");
            console.error(err.message);
            throw err;
        }
    }

	insert(table, values)
	{
		return this.run(SQL
            .insert(table)
            .values(values)
            );
	}

	delete(table, condition)
	{
		return this.run(SQL
            .delete(table)
            .where(condition)
            );
	}

	update(table, values, condition)
	{
		return this.run(SQL
            .update(table)
            .set(values)
            .where(condition)
        );
	}

	insertOrReplace(table, values)
	{
		return this.run(SQL
            .insertOrReplace(table)
            .values(values)
        );
	}

	insertOrIgnore(table, values)
	{
		return this.run(SQL
            .insertOrIgnore(table)
            .values(values)
        );
	}

    findOne(table, condition)
    {
        return this.get(SQL.select().from(table).where(condition));
    }

    findMany(table, condition)
    {
        return this.all(SQL.select().from(table).where(condition));
    }

    createTable(options)
	{
		this.transactionSync(() => {

			// Create the table
			this.run(SQL.createTable(options));

			// Create the indicies
			if (options.indicies)
			{
                for (let indexDef of options.indicies)
                {
					// Use table name if not explicitly set on index definition
					if (!indexDef.tableName)
						indexDef.tableName = options.tableName;
	
					// Run it
					this.run(SQL.createIndex(indexDef));
                }
			}
		});
	}

	createIndex(options)
	{
		return this.run(SQL.createIndex(options));
	}

	getMetaValue(key, defaultValue)
	{
		try
		{
			let value = this.pluck(SQL.select("value")
				.from("tears")
				.where({
					key: key
				}));

			if (value === undefined)
				return defaultValue;

			return value;
		}
		catch (e)
		{
			if (e.message.indexOf("no such table")<0)
				throw e;
			return defaultValue;
		}
	}

	setMetaValue(key, value)
	{
        let self = this;
		return this.transactionSync(() => {
			try
			{
				saveValue();
			}
			catch (err)
			{
				if (err.message.indexOf("no such table") < 0)
					throw err;

				this.run(SQL.createTable({
					tableName: "tears",
					columns:
					[
						{ key: "STRING" },
						{ value: "STRING" },
					],
				}));

				this.run(SQL.createIndex({
					tableName: "tears",
					unique: true,
					columns: [ { key: "ASC" } ]
				}));

				saveValue();
			}

			function saveValue()
			{
				return self.run(SQL
                    .insertOrReplace("tears")
                    .values({ key, value })
				);
			}
		})
	}

    migrate(steps)
	{
		this.transactionSync(() => {

			// Find current step
			let currentStep = parseInt(this.getMetaValue("migrationStep", 0));

			if (currentStep < steps.length)
			{
				// Process steps
				for (let i=currentStep; i < steps.length; i++)
				{
					steps[i]();
				}

				// Stop current step
				this.setMetaValue("migrationStep", steps.length);
			}
		});
	}
}

Database.prototype.makeTransaction = SQLiteDatabase.prototype.transaction;


module.exports = Database;
