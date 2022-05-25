"use strict"

/**
 * A simple fluent style query builder that builds an SQL statement and a set of associated parameters
 * 
 * @class SQL
 * @constructor
 * @param {String|SQL} [sql] The text or another SQL instance to append
 * @param {Object[]} [params] The parameters to record with the query
 * 
 * @example
 * 
 *     // Simple query and param
 *     let sql = new SQL("SELECT * FROM Users WHERE id=?", 123)
 *     
 *     // Join multiple parts together
 *     let sql = new SQL("SELECT *" FROM USERS")
 *     			.append("WHERE balance > ?", 1000)
 *     			.append("  AND position = ?", "manager")
 *     
 *     // Handy methods for building a query
 *     let sql = new SQL().select().from("Users")
 *     			.where("balance > ?", 1000)
 *     			.and("position = ?", "manager");
 * 
 */
class SQL
{
	constructor()
	{
		this.sql = "";
		this.params = [];
		this.append.apply(this, arguments)
	}	

	/**
	 * Append text and parameters to this query
	 * 
	 * @example
	 * 
	 * 		// Simple text and parameter
	 * 		SQL.append("WHERE x=?", 10);
	 * 
	 * 		// Multiple parameters
	 * 		SQL.append("WHERE x=? AND y=?", 10, 20);
	 * 
	 * 		// Multiple parameters as an array
	 * 		SQL.append("WHERE x=? AND y=?", [ 10, 20 ]);
	 * 
	 * 		// Append another SQL instance
	 * 		let baseQuery = new SQL("SELECT * FROM Users");
	 * 		let condition = new SQL("WHERE Age > ?", 21);
	 * 		baseQuery.append(condition);
	 * 
	 * @param {String|SQL} [sql] The text or another SQL instance to append
	 * @param {Object[]} [params] The parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method append
	 */
	append(sql, params)
	{
		delete this.hasWhere;

		if (sql===undefined || sql===null)
			return;

		// Append another sql builder?
		if (sql instanceof SQL)
		{
			return this.append(sql.sql, sql.params);
		}

		// First string?
		if (this.sql.length>1)
			this.sql += " " + sql;
		else
			this.sql = sql;

		if (params!==undefined)
		{
			// If params is an array append it, else append all other params
			if (params instanceof Array)
			{
				this.params = this.params.concat(params);
			}
			else if (arguments.length>1)
			{
				this.params = this.params.concat(Array.prototype.slice.call(arguments, 1));
			}
		}

		return this;
	}

	/**
	 * Append a "SELECT" statement
	 * 
	 * @example
	 * 		// "SELECT *"
	 * 		sql.select();
	 * 
	 * 		// "SELECT COUNT(*)"
	 * 		sql.select("COUNT(*)");
	 * 
	 * 		// "SELECT" columns
	 * 		sql.select("firstName, lastName");
	 * 
	 * @param {String|SQL} [sql] Text or another SQL instance to append
	 * @param {Object[]} [params] Parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method select
	 */
	select()
	{
		this.append("SELECT");
		if (arguments.length==0)
			return this.append("*");
		else
			return this.append.apply(this, arguments);
	}

	/**
	 * Append a "INSERT INTO" statement
	 * 
	 * @example
	 * 		// "INSERT INTO Users"
	 * 		sql.insert("Users");
	 * 
	 * @param {String|SQL} [sql] Optionsal text or another SQL instance to append
	 * @param {Object[]} [params] Optionals parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method insert
	 */
	insert()
	{
		this.append("INSERT INTO");
		return this.append.apply(this, arguments)
	}

	/**
	 * Append values to an INSERT statement
	 * 
	 * @example
	 * 		// Insert 
	 * 		new SQL().insert("Users").values({
	 * 			firstName: "Joe",
	 * 			lastName: "Sixpack",
	 * 		});
	 * 
	 * @param {Object} [values] A map of column name to value to insert
	 * @return	{SQL} A reference to this object
	 * @method values
	 */
	values(values)
	{
		let columnNames;
		let params;
		let paramValues = [];
		if (Array.isArray(values))
		{
			columnNames = values;
			params = [];
			for (let i=0; i<columnNames.length; i++)
				params.push('?');
		}
		else
		{
			columnNames = [];
			params = [];
			this.values = { };
			for (let key in values)
			{
				if (key[0]=='$' || key[0]=='.')
					continue;
				if ((values.hasOwnProperty === undefined || values.hasOwnProperty(key)) && !(values[key] instanceof Function) && values[key]!==undefined) 
				{
					this.values[key] = values[key];
					columnNames.push('`' + key + '`');
					params.push('?');
					paramValues.push(values[key]);
				}
			}
		}

		return this.append(`(${columnNames.join()}) VALUES (${params.join()})`, paramValues)
	}

	/**
	 * Append a "DELETE FROM" statement
	 * 
	 * @example
	 * 		// "DELETE FROM Users"
	 * 		sql.delete("Users");
	 * 
	 * @param {String|SQL} [sql] Optionsal text or another SQL instance to append
	 * @param {Object[]} [params] Optionals parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method delete
	 */
	delete()
	{
		this.append("DELETE FROM");
		return this.append.apply(this, arguments)
	}

	/**
	 * Append an "UPDATE" statement
	 * 
	 * @example
	 * 		// "UPDATE Users"
	 * 		sql.update("Users");
	 * 
	 * @param {String|SQL} [sql] Optionsal text or another SQL instance to append
	 * @param {Object[]} [params] Optionals parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method update
	 */
	 update()
	 {
		 this.append("UPDATE");
		 return this.append.apply(this, arguments)
	 }
 
	/**
	 * Append an "INSERT OR REPLACE" statement
	 * 
	 * @example
	 * 		// "INSERT OR REPLACE INTO Users"
	 * 		sql.insertOrReplace("Users");
	 * 
	 * @param {String|SQL} [sql] Optionsal text or another SQL instance to append
	 * @param {Object[]} [params] Optionals parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method insertOrReplace
	 */
	 insertOrReplace()
	 {
		 this.append("INSERT OR REPLACE INTO");
		 return this.append.apply(this, arguments)
	 }
 
	/**
	 * Append an "INSERT OR IGNORE" statement
	 * 
	 * @example
	 * 		// "INSERT OR IGNORE INTO Users"
	 * 		sql.insertOrIgnore("Users");
	 * 
	 * @param {String|SQL} [sql] Optionsal text or another SQL instance to append
	 * @param {Object[]} [params] Optionals parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method insertOrIgnore
	 */
	 insertOrIgnore()
	 {
		 this.append("INSERT OR IGNORE INTO");
		 return this.append.apply(this, arguments)
	 }
 
	  /**
	 * Append a "SET" statement to an UPDATE statement
	 * 
	 * @example
	 * 		// "SET firstName=?, lastName=?", "Joe", "SixPack"
	 * 		sql.update("Users").set({
	 * 			firstName: "Joe",
	 * 			lastName: "SixPack"
	 * 		});
	 * 
	 * @param {String|Object} [values] Either direct string, or object of values
	 * @param {Object} [originalValues] Optional object of original values, only changed values will be included
	 * @return	{SQL} A reference to this object
	 * @method set
	 */
	set(values, originalValues)
	{
		this.append("SET");

		if (typeof(values)==="string")
			return this.append.apply(this, arguments)

		let setExpressions = [];
		let paramValues = [];
		this.values = {};
		for (let key in values)
		{
			if (key[0]=='$' || key[0]=='.')
				continue;
			if ((values.hasOwnProperty === undefined || values.hasOwnProperty(key)) && !(values[key] instanceof Function)) 
			{
				this.values[key] = values[key];

				// Ignore unchanged fields
				if (originalValues && originalValues[key] && originalValues[key] == values[key])
					continue;

				setExpressions.push("`" + key + "` = ?");
				paramValues.push(values[key]);
			}
		}

		return this.append(setExpressions.join(), paramValues);
	}

	/**
	 * Append a "FROM" statement
	 * 
	 * @example
	 * 		// "FROM Users"
	 * 		sql.delete("Users");
	 * 
	 * @param {String|SQL} [sql] Optional text or another SQL instance to append
	 * @param {Object[]} [params] Optional parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method from
	 */
	from()
	{
		this.append("FROM");
		return this.append.apply(this, arguments)
	}

	/**
	 * Append a "WHERE" statement
	 * 
	 * @example
	 * 
	 * 		// "WHERE x=?", 99
	 * 		sql.where({x: 99});
	 * 
	 * 		// "WHERE x=? AND y=?", 10, 20
	 * 		sql.where({x:10, y:20});
	 * 
	 * @param {Object} [condition] 
	 * @return	{SQL} A reference to this object
	 * @method where
	 */
	where()
	{
		if (arguments.length == 0 || (arguments.length == 1 && arguments[0] == undefined))
			return this;

		this.append("WHERE");
		this.append(SQL.buildCondition.apply(undefined, arguments));
		this.hasWhere = true;
		return this;
	}

	/**
	 * Append a "WHERE" or "AND" statement.  
	 * 
	 * If the previous statement was a "WHERE" then appends "AND"
	 * Otherwise appends a "WHERE" 
	 * 
	 * @param {Object} [condition] 
	 * @return	{SQL} A reference to this object
	 * @method andWhere
	 */
	andWhere()
	{
		if (this.hasWhere)
			this.and.apply(this, arguments);
		else
			this.where.apply(this, arguments);
		this.hasWhere = true;
		return this;
	}

	/**
	 * Append a "WHERE" or "OR" statement.  
	 * 
	 * If the previous statement was a "WHERE" then appends "OR"
	 * Otherwise appends an "WHERE" statement
	 * 
	 * @param {Object} [condition] 
	 * @return	{SQL} A reference to this object
	 * @method orWhere
	 */
	orWhere()
	{
		if (this.hasWhere)
			this.or.apply(this, arguments);
		else
			this.where.apply(this, arguments);
		this.hasWhere = true;
		return this;
	}

	/**
	 * Append a "ORDER BY" statement
	 * 
	 * @example
	 * 		// "ORDER BY price ASC"
	 * 		sql.orderBy("price ASC");
	 * 
	 * @param {String|SQL} [sql] Optional text or another SQL instance to append
	 * @param {Object[]} [params] Optional parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method orderBy
	 */
	orderBy()
	{
		this.append("ORDER BY");
		return this.append.apply(this, arguments)
	}

	/**
	 * Append a "GROUP BY" statement
	 * 
	 * @example
	 * 		// "GROUP BY category"
	 * 		sql.orderBy("category");
	 * 
	 * @param {String|SQL} [sql] Optional text or another SQL instance to append
	 * @param {Object[]} [params] Optional parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method groupBy
	 */
	groupBy()
	{
		this.append("GROUP BY");
		return this.append.apply(this, arguments)
	}

	/**
	 * Append a "LEFT JOIN" statement
	 * 
	 * @example
	 * 		// "LEFT JOIN tags"
	 * 		sql.leftJoin("Orders")
	 * 			.on("Users.id = Orders.userId")
	 * 
	 * @param {String|SQL} [sql] Optional text or another SQL instance to append
	 * @param {Object[]} [params] Optional parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method leftJoin
	 */
	leftJoin()
	{
		this.append("LEFT JOIN");
		return this.append.apply(this, arguments)
	}

	/**
	 * Append a "ON" statement
	 * 
	 * @example
	 * 		sql.leftJoin("Orders")
	 * 			.on("Users.id = Orders.userId")
	 * 
	 * @param {String|SQL} [sql] Optional text or another SQL instance to append
	 * @param {Object[]} [params] Optional parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method on
	 */
	on()
	{
		this.append("ON");
		return this.append(SQL.buildCondition.apply(undefined, arguments));
	}

	/**
	 * Append a "IN" statement
	 * 
	 * @example
	 * 		sql.where("id").in([10, 20, 30]);
	 * 
	 * @param {String|SQL} [sql] Optional text or another SQL instance to append
	 * @param {Object[]} [params] Optional parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method in
	 */
	in()
	{
		this.append("IN");
		return this.append.apply(this, arguments)
	}

	/**
	 * Append a "AND" statement
	 * 
	 * @example
	 * 		// SQL
	 * 		sql.where("x=?", 10)
	 * 			.and("y=?", 20);
	 * 
	 * 		// Using an object map
	 * 		sql.where("x=?", 10)
	 * 			.and({ y: 10, z: 20, });
	 * 
	 * 
	 * @param {String|SQL|Object} [sql] Text, condition map or another SQL instance
	 * @param {Object[]} [params] Optional parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method and
	 */
	and()
	{
		this.append("AND");
		return this.append(SQL.buildCondition.apply(undefined, arguments));
	}

	/**
	 * Append a "OR" statement
	 * 
	 * @example
	 * 		// SQL
	 * 		sql.where("x=?", 10)
	 * 			.or("y=?", 20);
	 * 
	 * 		// Using an object map
	 * 		sql.where("x=?", 10)
	 * 			.or({ y: 10, z: 20, });
	 * 
	 * @param {String|SQL|Object} [sql] Text, condition map or another SQL instance
	 * @param {Object[]} [params] Optional parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method or
	 */
	or()
	{
		this.append("OR");
		return this.append(SQL.buildCondition.apply(undefined, arguments));
	}

	/**
	 * Append a "LIMIT" statement to take a particular page of records
	 * 
	 * @example
	 * 		// Take page 5 of 20 rows per page
	 * 		sql.takePage(5, 20);
	 * 
	 * @param {Number} page The zero based page number to take
	 * @param {Number} rowsPerPage The number of rows per page
	 * @return	{SQL} A reference to this object
	 * @method takePage
	 */
	takePage(page, rowsPerPage)
	{
		return this.append("LIMIT ?, ?", [(page - 1) * rowsPerPage, rowsPerPage]);
	}

	/**
	 * Append a "LIMIT" statement to limit query to a number of rows
	 * 
	 * @example
	 * 		// Take just first 10 rows
	 * 		sql.limit(10);
	 * 
	 * @param {Number} rows The number of rows to take
	 * @return	{SQL} A reference to this object
	 * @method limit
	 */
	limit(rows)
	{
		return this.append("LIMIT ?", rows);
	}

	/**
	 * Append a parenthesized sub query (ie: surrounded by '(' and ')')
	 * 
	 * Generally not required but can be handy to append a bunch of sub-queries
	 * ensuring that correct order operation is used.
	 * 
	 * @param {String|SQL|Object} [sql] Text, condition map or another SQL instance
	 * @param {Object[]} [params] Optional parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method parens
	 */
	parens()
	{
		this.append("(");
		this.append.apply(this, arguments);
		this.append(")");
		return this;
	}

	/**
	 * Generates a CREATE TABLE statement.
	 * 
	 * @example
	 * 
	 * 		// Create a table
	 * 		SQL.createTable({
	 * 			columns: {
	 * 				id: "INTEGER PRIMARY KEY AUTOINCREMENT"
	 * 				firstName: "STRING",
	 * 				age: "INTEGER NOT NULL",
	 * 			}
	 * 		});
	 * 
	 * @param {Object} options 
	 * @static
	 * @method createTable
	 */
	static createTable(options)
	{
		let columnDefs = [];
		for (let i=0; i<options.columns.length; i++)
		{
			let nv = namedValue(options.columns[i]);
			columnDefs.push("`" + nv.name + "` " + nv.value);
		}

		return new SQL().append(`CREATE TABLE \`${options.tableName}\` ( ${columnDefs.join()} );`);
	}

	/**
	 * Generates a DROP TABLE statement.
	 * 
	 * @example
	 * 
	 * 		// Create a table with specified columns plus the 
	 * 		// standard columns `id`, `createdAt` and `updatedAt` columns
	 * 		SQL.dropTable("Users");
	 * 
	 * @param {String} name The name of the table to create 
	 * @static
	 * @method dropTable
	 */
	static dropTable(name)
	{
		return new SQL().append(`DROP TABLE \`${name}\``);
	}

	/**
	 * Generates a CREATE INDEX statement.
	 * 
	 * @example
	 * 
	 * 		SQL.createIndex({
	 * 			tableName: "Users",
	 * 			unique: true,								// Optional, default = false
	 * 			indexName: "Users_firstName_lastName",		// Optional, default synthesized from table and column names
	 * 			columns: {
	 * 				lastName: "ASC",
	 * 				firstName: "DESC",
	 * 			},
	 * 		});
	 * 
	 * @param {String} name The name of the table to create 
	 * @static
	 * @method createIndex
	 */
	static createIndex(options)
	{
		let columnDefs = [];
		let columnNames = [];
		for (let i=0; i<options.columns.length; i++)
		{
			let nv = namedValue(options.columns[i]);
			columnDefs.push("`" + nv.name + "` " + nv.value);
			columnNames.push(nv.name);
		}

		let unique = options.unique ? "UNIQUE " : "";
		let indexName = options.indexName;
		if (!indexName)
			indexName = options.tableName + "_" + columnNames.join("_");

		return new SQL().append(`CREATE ${unique}INDEX ${indexName} ON ${options.tableName} ( ${columnDefs.join()} );`);
	}


	/**
	 * Creates a new SQL instance starting with a select statement
	 * @example
	 * 
	 * 		let sql = SQL.select("firstName, lastName").from("Users");
	 * 
	 * @param {String|SQL} [sql] Optionsal text or another SQL instance to append
	 * @param {Object[]} [params] Optionals parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method select
	 * @static
	 */
	static select()
	{
		let sql = new SQL();
		return sql.select.apply(sql, arguments);
	}

	/**
	 * Creates a new SQL instance starting with a delete statement
	 * @example
	 * 
	 * 		let sql = SQL.delete().from(...
	 * 
	 * @param {String|SQL} [sql] Optionsal text or another SQL instance to append
	 * @param {Object[]} [params] Optionals parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method delete
	 * @static
	 */
	static delete()
	{
		let sql = new SQL();
		return sql.delete.apply(sql, arguments);
	}

	/**
	 * Creates a new SQL instance starting with a update statement
	 * @example
	 * 
	 * 		let sql = SQL.update("Users").set(...
	 * 
	 * @param {String|SQL} [sql] Optionsal text or another SQL instance to append
	 * @param {Object[]} [params] Optionals parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method update
	 * @static
	 */
	static update()
	{
		let sql = new SQL();
		return sql.update.apply(sql, arguments);
	}

	/**
	 * Creates a new SQL instance starting with a insert statement
	 * @example
	 * 
	 * 		let sql = SQL.insert("Users").values(...
	 * 
	 * @param {String|SQL} [sql] Optionsal text or another SQL instance to append
	 * @param {Object[]} [params] Optionals parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method insert
	 * @static
	 */
	static insert()
	{
		let sql = new SQL();
		return sql.insert.apply(sql, arguments);
	}

	/**
	 * Creates a new SQL instance starting with a insert or ignore statement
	 * @example
	 * 
	 * 		let sql = SQL.insertOrIgnore("Users").values(...
	 * 
	 * @param {String|SQL} [sql] Optionsal text or another SQL instance to append
	 * @param {Object[]} [params] Optionals parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method insert
	 * @static
	 */
	 static insertOrIgnore()
	 {
		 let sql = new SQL();
		 return sql.insertOrIgnore.apply(sql, arguments);
	 }
 
	/**
	 * Creates a new SQL instance starting with a insert or replace statement
	 * @example
	 * 
	 * 		let sql = SQL.insertOrreplace("Users").values(...
	 * 
	 * @param {String|SQL} [sql] Optionsal text or another SQL instance to append
	 * @param {Object[]} [params] Optionals parameters to record with the query
	 * @return	{SQL} A reference to this object
	 * @method insert
	 * @static
	 */
	 static insertOrReplace()
	 {
		 let sql = new SQL();
		 return sql.insertOrReplace.apply(sql, arguments);
	 }
 
	 static buildCondition(condition)
	{
		// Alredy SQL?
		if (condition instanceof SQL)
			return condition;

		// Plain text
		if (typeof(condition) === "string")
		{
			let sql = new SQL();
			return sql.append.apply(sql, arguments);
		}

		// eg: { firstName: "Joe", lastName: "Sixpack" }
		let sql = [];
		let params = [];
		for (let [key, value] of Object.entries(condition))
		{
			if (key[0]=='$' || key[0]=='.')
				continue;

			build_expression(value);

			function build_expression(v)
			{
				if (v.$ne !== undefined) { sql.push("`" + key + "` <> ?"); params.push(v.$ne); return; }
				if (v.$lt !== undefined) { sql.push("`" + key + "` < ?"); params.push(v.$lt); return; }
				if (v.$gt !== undefined) { sql.push("`" + key + "` > ?"); params.push(v.$gt); return; }
				if (v.$lte !== undefined) { sql.push("`" + key + "` <= ?"); params.push(v.$lte); return; }
				if (v.$gte !== undefined) { sql.push("`" + key + "` >= ?"); params.push(v.$gte); return; }
				if (v.$le !== undefined) { sql.push("`" + key + "` <= ?"); params.push(v.$le); return; }
				if (v.$ge !== undefined) { sql.push("`" + key + "` >= ?"); params.push(v.$ge); return; }
				if (v.$eq !== undefined) { sql.push("`" + key + "` = ?"); params.push(v.$ge); return; }
				if (v.$like !== undefined) { sql.push("`" + key + "` LIKE ?"); params.push(v.$like); return; }
				if (v.$glob !== undefined) { sql.push("`" + key + "` GLOB ?"); params.push(v.$glob); return; }
				if (v.$is === null) { sql.push("`" + key + "` IS NULL"); return; }
				if (v.$isnot === null) { sql.push("`" + key + "` IS NOT NULL"); return; }
				if (v.$in !== undefined)
				{
					sql.push("`" + key + "` IN (" + Array(v.$in.length).fill("?").join(',') + ')');
					for (let e of v.$in)
					{
						params.push(e);
					}
					return;
				}
				if (v.$nin !== undefined)
				{
					sql.push("`" + key + "` NOT IN (" + Array(v.$in.length).fill("?").join(',') + ')');
					for (let e of v.$in)
					{
						params.push(e);
					}
					return;
				}
				if (v.$or !== undefined)
				{
					let saveSQL = sql;
					sql = [];
					for (let sub of v.$or)
					{
						build_expression(sub);
					}
					saveSQL.push("(" + sql.join(" OR ") + ")");
					sql = saveSQL;

					return;
				}
				if (v.$and !== undefined)
				{
					let saveSQL = sql;
					sql = [];
					for (let sub of v.$and)
					{
						build_expression(sub);
					}
					saveSQL.push("(" + sql.join(" AND ") + ")");
					sql = saveSQL;

					return;
				}

				if (v.$not !== undefined)
				{
					if (v.$not.$is === null)
					{
						sql.push("`" + key + "` IS NOT NULL");
					}
					else
					{
						let saveSQL = sql;
						sql = [];
						build_expression(v.$not);
						saveSQL.push("NOT (" + sql + ")");
						sql = saveSQL;
					}
					return;
				}

				sql.push("`" + key + "` = ?");
				params.push(v);
			}
		}

		if (sql.length == 0)
			return "TRUE";

		return new SQL("(" + sql.join(" AND ") + ")", params);
	
		function isObject(value) 
		{
			return !(value instanceof Date) && 
				!Array.isArray(value) && 
				!Object.is(value, null) && 
				!Object.is(value, undefined) && 
				!(value instanceof Function);
		}	
	}

	log(to)
	{
		if (!to)
			to = console.log;
		to(this.sql + "; params" + JSON.stringify(this.params));
		return this;
	}
}


// Picks a single named value from an object
// eg: 
//     { "myname": "somevalue" } 
// returns 
//     { name: "myname", value:"somevalue" }
function namedValue(dict)
{
	for (let key in dict)
	{
		if (key[0]=='$' || key[0]=='.')
			continue;
		if ((dict.hasOwnProperty === undefined || dict.hasOwnProperty(key)) && !(dict[key] instanceof Function)) 
		{
			return {
				name: key,
				value: dict[key]
			}
		}
	}
}

module.exports = SQL;