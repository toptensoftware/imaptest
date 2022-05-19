const Imap = require('./imap_promise');
const utils = require('./utils');
const Mailbox = require('./Mailbox');
const data = require('./data');

/**
 * Manages the mailboxes for a particular user on an IMAP server and handles
 * indexing and construction of conversations
 */
class User
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
        let boxes = await data.db.collection("mailboxes").find({
            user: this.config.user,
            host: this.config.host,
        }).toArray();

        for (let i=0; i<boxes.length; i++)
        {
            let mb = new Mailbox(this, boxes[i].name);
            mb.initFromDb(boxes[i]);
            this.mailboxes.set(mb.name, mb);
        }

        // Find by message id (in any folder)
        let mcoll = data.db.collection(this.messages_collection_name);
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

        // Get list of boxes
        let boxes = await this._imap.getBoxes();

        // Wrap imap box objects with our Mailbox class
        for (let e of Object.entries(boxes))
        {
            let mb = this.mailboxes.get(e[0]);
            if (!mb)
            {
                mb = new Mailbox(this, e[0]);
                this.mailboxes.set(mb.name, mb);
            }

            // Save to db (should check if anything really changed)
            await mb.updateFromImap(e[1]);
        }

        // Drop all mailboxes that no longer exist
        for (let mbname of this.mailboxes.keys())
        {
            if (!boxes.hasOwnProperty(mbname))
            {
                // Drop messages collection
                try
                {
                    let collname = `mailbox ${this.config.host} ${this.config.user} ${mbname}`;
                    let coll = data.db.collection(collname);
                    await coll.drop();
                }
                catch (err) { /* dont care */ }

                // Delete the mailbox entry
                await data.db.collection('mailboxes').deleteOne({
                    _id: this.mailboxes.get(mbname)._data._id,
                });

                // Remove mailbox
                this.mailboxes.delete(mbname);
            }
        }
    }

    async sync()
    {
        console.log(`Syncing ${this.messages_collection_name}`);
        await data.transaction(async (tx) => {

            // Sync all folders
            for (var mb of this.mailboxes.values())
            {
                await mb.sync(tx);
            }
        }); 
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



module.exports = User;