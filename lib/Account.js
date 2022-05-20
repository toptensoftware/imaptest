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

        this.sync_notify = {};
    }

    async load()
    {
        await this.#load_mailboxes();
        await this.#create_indicies();
    }

    async #create_indicies()
    {
        // Find by message id (in any folder)
        let mcoll = Database.db.collection(this.messages_collection_name);
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
    }

    async #load_mailboxes()
    {
        let boxes = await Database.db.collection(this.mailboxes_collection_name).find({}).toArray();

        this.mailboxes = new Map();
        for (let i=0; i<boxes.length; i++)
        {
            let mb = new Mailbox(this, boxes[i].name);
            mb.initFromDb(boxes[i]);
            this.mailboxes.set(mb.name, mb);
        }
    }

    get mailboxes_collection_name()
    {
        return `mailboxes ${this.config.host} ${this.config.user}`;
    }

    get messages_collection_name()
    {
        return `messages ${this.config.host} ${this.config.user}`;
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
        let sync_notify = this.sync_notify;

        sync_notify.sync_start?.();

        console.log(`Syncing ${this.messages_collection_name}`);
        try
        {
            await Database.transaction(async (tx) => {

                // Get thet collections
                let messages_collection = tx.collection(this.messages_collection_name);
                let mailboxes_collection = tx.collection(this.mailboxes_collection_name);

                // Get list of IMAP boxes 
                let boxes = await this._imap.getBoxes();

                // Wrap imap box objects with our Mailbox class
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

                        // Notify
                        sync_notify.mailbox_added?.(mb.name);
                    }

                    // Sync the mailbox
                    await mb.sync(tx, sync_notify);
                }

                // Drop all mailboxes that no longer exist
                for (let mbname of this.mailboxes.keys())
                {
                    if (!boxes.hasOwnProperty(mbname))
                    {
                        // Notify of all the removed messages
                        await messages_collection.find(
                            { mailbox: mbname },
                            { projection: { _id: 0, message_id: 1 } }
                        ).forEach(x => sync_notify.message_deleted(x.message_id));

                        // Delete the messages
                        await messages_collection.deleteMany(
                            { mailbox: mbname }
                        );

                        // Delete the mailbox entry
                        await mailboxes_collection.deleteOne(
                            { name: mbname, }
                        );

                        // Notify
                        sync_notify.mailbox_deleted?.(mbname);

                        // Remove mailbox from collection
                        this.mailboxes.delete(mbname);
                    }
                }
            }); 
        }
        catch (err)
        {
            // Failed to commit transaction so we need to reload the mailboxes
            await this.#load_mailboxes();
            sync_notify.sync_fail?.(err);
            throw err;
        }

        sync_notify.sync_finish?.();
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