const Imap = require('./IMapPromise');
const Mailbox = require('./Mailbox');
const Database = require('./Database');

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
                    let queue_collection = tx.collection(this.collection_name("queue"));

                    // Get all the messages that are disappearing
                    let deleted_messages = new Set();
                    await messages_collection.find(
                        { mailbox: mbname },
                        { projection: { _id: 0, message_id: 1 } }
                    ).forEach(x => { deleted_messages.add(x.message_id) } );

                    // Add the deleted message ids to ethe queu
                    await queue_collection.insertOne({
                        mailbox: mbname,
                        deleted: [...deleted_messages],
                    })

                    // Delete the messages
                    await messages_collection.deleteMany(
                        { mailbox: mbname }
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