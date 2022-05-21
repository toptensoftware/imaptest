const Imap = require('./IMapPromise');
const Mailbox = require('./Mailbox');
const Database = require('./Database');
const ConversationBuilder = require('./ConversationBuilder');
const ConversationTrimmer = require('./ConversationTrimmer');

/**
 * Manages the mailboxes for a particular user on an IMAP server and handles
 * indexing and construction of conversations
 */
class Account
{
    /**
     * Constructs a new User instance
     * @constructor
     * @param {Object} config The IMAP configuration passed to node-imap
     */
    constructor(config)
    {
        // Create IMAP connection
        this._imap = new Imap(config);

        this.config = config;
        this._isOpen = false;
        this.mailboxes = new Map();
    }

    async load()
    {
        await this.#load_mailboxes();
        await this.#create_indicies();
    }

    async #create_indicies()
    {
        // Find by message id (in any folder)
        let mcoll = Database.db.collection(this.collection_name("messages"));
        await mcoll.createIndex({
            message_id: 1,
        });

        // Find by uid in folder
        await mcoll.createIndex({
            mailbox: 1, 
            uid: 1,
        });

        // Find in references
        await mcoll.createIndex({
            references: 1,
        });

        // Unread flag
        await mcoll.createIndex({
            mailbox: 1,
            unread: 1,
        });

        // Date flag
        await mcoll.createIndex({
            mailbox: 1,
            date: 1,
        });

        let ccoll = Database.db.collection(this.collection_name("messages"));
        await ccoll.createIndex({
            message_ids: 1 
        });

    }

    async #load_mailboxes()
    {
        let boxes = await Database.db.collection(this.collection_name("mailboxes")).find({}).toArray();

        this.mailboxes = new Map();
        for (let i=0; i<boxes.length; i++)
        {
            let mb = new Mailbox(this, boxes[i].name);
            mb.initFromDb(boxes[i]);
            this.mailboxes.set(mb.name, mb);
        }
    }

    collection_name(coll)
    {
        return `${this.config.host} ${this.config.user} ${coll}`;
    }


    /**
     * Open connection to the IMAP server and synchronizes all mailboxes
     * @async
     * @returns {Promise<void>}
     */
    async open()
    {
        if (this._isOpen)
            return;
        this._isOpen = true;

        // Open connection
        await this._imap.connect();
    }

    async sync()
    {
        console.log(`Syncing ${this.collection_name("messages")}`);

        // Get list of IMAP boxes 
        let boxes = await this._imap.getBoxes();

        // Sync each mailbox
        for (let [k,v] of Object.entries(boxes))
        {
            // Get the mailbox entry
            let mb = this.mailboxes.get(k);
            if (!mb)
            {
                // Create new mailbox
                mb = new Mailbox(this, k);
                this.mailboxes.set(mb.name, mb);
                await mb.initNew(v);
            }

            // Sync the mailbox
            await mb.sync();
        }

        // Drop all mailboxes that no longer exist
        for (let mbname of this.mailboxes.keys())
        {
            if (!boxes.hasOwnProperty(mbname))
            {
                await Database.transaction(async (tx) => {

                    // Get the collections
                    let messages_collection = tx.collection(this.collection_name("messages"));
                    let mailboxes_collection = tx.collection(this.collection_name("mailboxes"));

                    // Mark all the messages as deleted
                    await messages_collection.updateMany(
                        { mailbox: mbname },
                        { $set: { state: -1 } }
                    );

                    // Delete the mailbox entry
                    await mailboxes_collection.deleteOne(
                        { name: mbname, }
                    );

                    // Remove mailbox from collection
                    this.mailboxes.delete(mbname);
                });
            }
        }

        //await this.trimConversations();
    }

    async status_mailboxes()
    {
        let mailboxes_collection = Database.db.collection(this.collection_name("mailboxes"));
        let result = {};
        await mailboxes_collection.find({}).forEach((mb) =>
        {
            result[mb.name] = mb;
        });
        return result;
    }

    async status_messages()
    {
        let messages_collection = Database.db.collection(this.collection_name("messages"));

        let result = {};
        let counts = await messages_collection.aggregate([

            { $group: {
                "_id": "$mailbox",
                "messages": { $count: {} },
                "unread": { $sum: { $cond: [ "$unread", 1, 0 ] } },
                "important": { $sum: { $cond: [ "$important", 1, 0 ] } }
            } }

        ]).forEach(x => {
            result[x._id] = x;
            delete x._id;
        });

        return result;
    }

    async status()
    {
        let mailboxes_collection = Database.db.collection(this.collection_name("mailboxes"));
        let messages_collection = Database.db.collection(this.collection_name("messages"));
        let conversations_collection = Database.db.collection(this.collection_name("conversations"));

        return {
            totalMailboxes: await mailboxes_collection.countDocuments({}),
            totalMessages: await messages_collection.countDocuments({}),
            addedMessages: await messages_collection.countDocuments({ state: { $gt: 0} } ),
            deletedMessages: await messages_collection.countDocuments({ state: { $lt: 0} } ),
            cleanMessages: await messages_collection.countDocuments({ state: { $eq: 0} } ),
            totalConversations: await conversations_collection.countDocuments({}),
        }

    }

    async dropEverything()
    {
        await Database.transaction(async (tx) => {

            let mailboxes_collection = tx.collection(this.collection_name("mailboxes")); 
            let messages_collection = tx.collection(this.collection_name("messages"));
            let conversations_collection = tx.collection(this.collection_name("conversations"));

            // Delete all mailboxes
            let r = await mailboxes_collection.deleteMany({});
            console.log(`Deleted ${r.deletedCount} mailboxes`);
            
            // Delete all messages
            r = await messages_collection.deleteMany({});
            console.log(`Deleted ${r.deletedCount} messages`);
            
            // Delete all conversations
            r = await conversations_collection.deleteMany({});
            console.log(`Deleted ${r.deletedCount} conversations`);
        });

    }

    async dropAllConversations()
    {
        await Database.transaction(async (tx) => {

            let messages_collection = tx.collection(this.collection_name("messages"));
            let conversations_collection = tx.collection(this.collection_name("conversations"));

            // Delete all conversations
            let r = await conversations_collection.deleteMany({});
            console.log(`Deleted ${r.deletedCount} conversations`);

            // Purge deleted messages
            r = await messages_collection.deleteMany({ state: { $lt: 0 } } );
            console.log(`Purged ${r.deletedCount} deleted messages`);

            // Mark all messages as modified
            r = await messages_collection.updateMany({}, {$set: { state: 0 } } );
            console.log(`Cleaned ${r.modifiedCount} added messages`);
        });

    }

    getConversations(messages)
    {
        return ConversationBuilder.getConversations(this, messages);
    }

    trimConversations()
    {
        return ConversationTrimmer.trimConversations(this);
    }

    /**
     * Closes the connection to the IMAP server
     * @async
     * @returns {Promise<void>}
     */
    close()
    {
        if (!this._isOpen)
            return;
        this._isOpen = false;

        // Already disconnected?
        if (this._imap.state == 'disconnected')
            return Promise.resolve();

        // Close connection
        return this._imap.end();
    }
}



module.exports = Account;