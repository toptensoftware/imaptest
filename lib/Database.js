const MongoClient = require('mongodb').MongoClient;

class TransactionCollection
{
    constructor(owner, coll)
    {
        this._owner = owner;
        this._coll = coll;
    }
    
    mergeSession(options)
    {
        if (typeof(options) === 'function')
            throw new Error("unsupported");

        if (!options)
            return { session: this._owner.session };
        else
            return Object.assign({}, { session: this._owner.session }, options);
    }

    countDocuments(filter, options)
    {
        return this._coll.countDocuments(filter, this.mergeSession(options));
    }

    updateOne(filter, update, options)
    {
        return this._coll.updateOne(filter, update, this.mergeSession(options));
    }

    find(filter, options)
    {
        return this._coll.find(filter, this.mergeSession(options));
    }

    insertOne(doc, options)
    {
        return this._coll.insertOne(doc, this.mergeSession(options));
    }

    insertMany(docs, options)
    {
        return this._coll.insertMany(docs, this.mergeSession(options));
    }

    deleteOne(filter, options)
    {   
        return this._coll.deleteMany(filter, this.mergeSession(options));
    }

    deleteMany(filter, options)
    {   
        return this._coll.deleteMany(filter, this.mergeSession(options));
    }

    bulkWrite(operations, options)
    {
        return this._coll.bulkWrite(operations, this.mergeSession(options));
    }
}

class TransactionDatabase
{
    constructor(db, session)
    {
        this.db = db;
        this.session = session;
    }

    collection(name)
    {
        return new TransactionCollection(this, this.db.collection(name));
    }
}

class Database
{
    async open(config)
    {
        this._client = await MongoClient.connect(config.dbserver);
        this._db = this._client.db(config.dbname);
    }

    get db()
    {
        return this._db;
    }

    get client()
    {
        return this._client;
    }

    async close()
    {
        if (this._client != null)
        {
            await this._client.close();
            this._client = null;
            this._db = null;
        }
    }

    async transaction(callback)
    {
        const transactionOptions = {
            readPreference: 'primary',
            readConcern: { level: 'local' },
            writeConcern: { w: 'majority' }
        };

        const session = this._client.startSession();
        try
        {
            await session.withTransaction(() => { 
                return callback(new TransactionDatabase(this.db, session));
            }, transactionOptions);
        }
        finally
        {
            await session.endSession();
        }

    }
}

module.exports = new Database();