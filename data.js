const MongoClient = require('mongodb').MongoClient;

class Database
{
    async open()
    {
        this._client = await MongoClient.connect("mongodb://localhost:27017/");
        this._db = this._client.db("imapsync");
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
        const session = this._client.startSession();
        try
        {
            await session.withTransaction(callback);
        }
        finally
        {
            await session.endSession();
        }

    }
}

module.exports = new Database();