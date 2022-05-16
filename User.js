const Imap = require('node-imap');
const Mailbox = require('./Mailbox');
const jsonfile = require('jsonfile');

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
        this._imap = new Imap(config)

        this.config = config;
        this._isOpen = false;
        this._boxes = new Map();
    }

    /**
     * Load the mailbox cache into memory.  If this method isn't called before
     * opening or syncing the user then the cache won't be loaded and is similar
     * to discarding the cache
     * @async
     * @returns {Promise<void>}
     */
    async load()
    {
        this._boxes = new Map();
        try
        {
            // Read json file
            let file = await jsonfile.readFile(this.storage);

            // Create and load mailboxes
            for (let i=0; i<file.boxes.length; i++)
            {
                let box = new Mailbox(this, file.boxes[i]);
                this._boxes.set(file.boxes[i], box);
                await box.load();
            }
        }
        catch (err) { /* don't care */}
    }

    /**
     * Saves the current state of this user
     */
    async save()
    {
        await jsonfile.writeFile(this.storage, {
            boxes: Array.from(this._boxes.keys())
        });
    }

    /**
     * Builds various indicies for fast look up of messages-ids and references
     * @returns {void}
     */
    buildIndicies()
    {
        // Already created?
        if (this._mapMessageId !== undefined)
            return;

        // A map of message id to an array of { mailbox, message }
        this._mapMessageId = new Map();

        // A map where the value is a array of messages-id of messages
        // that reference to the key message-id.  This is the inverse
        // of message.references
        this._referencedBy = new Map();

        // Make conversation map now, will use later
        this._mapMessageToConversation = new Map();

        // Keep track of how many messages have no message-id
        let noMessageIdCount = 0;

        // For all boxes
        for (let b of this._boxes.values())
        {
            // Iterate all messages
            let messages = b.messages;
            let length = messages.length;
            for (let i=0; i<length; i++)
            {
                // Get the message its Id
                let m = messages[i];
                let msg_id = m.message_id;
                if (!msg_id)
                {
                    noMessageIdCount++;
                    continue;
                }

                // Add it to the map
                let e = this._mapMessageId.get(msg_id);
                if (e === undefined)
                {
                    e = [];
                    this._mapMessageId.set(msg_id, e);
                }
                e.push({ message: m, mailbox: b});

                // Also make a map of the messages which messages
                // reference which
                if (m.references)
                {
                    for (let j=0; j<m.references.length; j++)
                    {
                        let e = this._referencedBy.get(m.references[j]);
                        if (e === undefined)
                        {
                            e = new Set();
                            this._referencedBy.set(m.references[j], e);
                        }
                        e.add(msg_id);
                    }
                }
            }
        }

        console.log(`unique messages: ${this._mapMessageId.size}`);
        console.log(`referenced messages: ${this._referencedBy.size}`);
        console.log(`messages without id: ${noMessageIdCount}`);
    }

    /**
     * Given a message ID get its conversation
     * @param {string} msg_id The ID of the message
     * @returns {{messages: string[]}}
     */
    getConversation(msg_id)
    {
        // Already created?
        let conv = this._mapMessageToConversation.get(msg_id);
        if (conv)
            return conv;

        // Get all referenced messages
        let messages = new Set();
        this.#getAllReferences(msg_id, messages);
        messages = [...messages];

        // Sort messages by date
        messages.sort((a, b) => {
            let msga = this._mapMessageId.get(a);
            let msgb = this._mapMessageId.get(b);
            if (!msga || !msgb)
                debugger;
            return msga.date - msgb.date;
        });

        // Create a new conversation with those messages
        conv = {
            messages: messages,
        };

        // Associate this conversation with all the messages in the conversation
        for (let i=0; i<messages.length; i++)
            this._mapMessageToConversation.set(messages[i], conv);

        // Done, return the conversation
        return conv;
    }

    /**
     * Recursively find all other messages associated with a message
     * @private
     * @param {string} msg_id The message id to get references for
     * @param {Set<string>} result 
     * @returns {void}
     */
    #getAllReferences(msg_id, result)
    {
        // Quit if we've already processed this message
        if (result.has(msg_id))
            return;

        // Look up the message
        let msgs = this._mapMessageId.get(msg_id);
        if (!msgs)
            return;

        // Add this message to the set
        result.add(msg_id);

        // Recursively add all the referenced messages
        if (msgs)
        {
            for (let i=0; i<msgs.length; i++)
            {
                let refs = msgs[i].message.references;
                if (refs)
                {
                    for (let j=0; j<refs.length; j++)
                    {
                        this.#getAllReferences(refs[j], result);
                    }
                }
            }
        }

        // Also add all the messages that reference this one
        let refs = this._referencedBy.get(msg_id);
        if (refs)
        {
            for (let m of refs)
            {
                this.#getAllReferences(m, result);
            }
        }
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
        await new Promise((resolve, reject) => {

            // Connect ok
            this._imap.once('ready', function() {
                resolve();
            });

            // Connect fail
            this._imap.once('error', function(err) {
                reject(err);
            })

            this._imap.connect();
        });

        // Get list of boxes
        let boxes = await new Promise((resolve, reject) => {
            this._imap.getBoxes((err, boxes) => {
                if (err)
                    reject(resolve)
                else
                    resolve(boxes);
            });
        });

        // Wrap imap box objects with our Mailbox class
        for (let e of Object.entries(boxes))
        {
            let mb = this._boxes.get(e[0]);
            if (!mb)
                this._boxes.set(e[0], new Mailbox(this, e[0]));
        }

        // Remove deleted boxes
        for (var b of this._boxes.keys())
        {
            if (!boxes.hasOwnProperty(b))
            {
                this._boxes.delete(b);
            }
        }

        // Save list of boxes
        await this.save();

        //await this._boxes.get('INBOX').sync();
        // Sync all boxes
        await this.sync();
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
        this._imap.end();
            
        // Wait for it
        return new Promise((resolve, reject) => {
            this._imap.once('close', resolve);
            this._imap.once('error', reject);
        });
    
    }

    /**
     * Synchronizes all mailboxes with the server
     */
    async sync()
    {
        if (!this._isOpen)
        {
            // If not open, just open/close the connection which will
            // call back here once open to do the sync
            await this.open();
            await this.close();
            return;
        }

        // Sync all folders
        for (var b of this._boxes.values())
        {
            await b.sync();
        }
    }

    /**
     * Gets the total number of messsages in all mailboxes
     * @type {Number}
     */
    get totalMessageCount()
    {
        let sum = 0;
        for (var b of this._boxes.values())
        {
            sum += b.messages.length;
        }
        return sum;
    }

    /**
     * Gets the collection of Mailboxes for this user
     * @type {Map<string, Mailbox>}
     */
    get boxes() { return this._boxes }

    /**
     * Gets the base file name for storage files for the user
     * @type {string}
     */
    get storageBase() 
    {
        return `data/${this.config.host}-${this.config.user}`;
    }

    /**
     * Gets the storage file name for the user info
     * @type {string}
     */
    get storage()
    {
        return `${this.storageBase}.json`;
    }


}



module.exports = User;