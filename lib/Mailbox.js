const Utils = require('./Utils');
const Database = require('./Database');

/**
 * Manages the local cache of a single mailbox on an IMAP server
 */
class Mailbox
{
    /**
     * Constructs a new Mailbox instance
     * @constructor
     * @param {Account} account A reference to the owning Account object
     * @param {string} name The name of the mailbox
     * @param {Object} mailbox The mailbox object returned from imap
     */
    constructor(account, name)
    {
        this._account = account;
        this._name = name;
        this._data = {};
        this._data.highestuid = 0;
    }

    initFromDb(data)
    {
        this._data = data;
    }

    async initNew(mailbox)
    {
        // Update new data
        Object.assign(this._data, mailbox);
    }

    /**
     * The name of the mailbox on the IMAP server
     */
    get name() { return this._name; }
 
 
    /**
     * Synchronise the local cache for the mailbox with the IMAP server
     * @async
     * @returns {Promise<void>}
     */
    async sync(tx)
    {
        await Database.transaction(async (tx) => {

            // Get the messages collection
            let messages_collection_name = this._account.collection_name("messages");
            let messages_collection = tx.collection(this._account.collection_name("messages"));

            // Setup sync info
            let sync_info = 
            {
                box: await this.#imap.openBox(this._name),
                insert_ops: [],
                delete_ops: [],
                flag_ops: [],
                old_highest_uid: this._data.highestuid,
                messages_collection: messages_collection
            }
            
            // Log it
            console.log(`syncing ${messages_collection_name} ${this.name} ${sync_info.box.messages.total} messages...`)

            // If uid validity has changed, clear everything
            if (sync_info.box.uidvalidity != this._data.uidvalidity)
            {
                // Mark all the messages as deleted
                await messages_collection.updateMany(
                    { mailbox: this._name, state: { $ne: -1 } },
                    { $set: { state: -1 } } 
                );
                
                // Fetch everything
                await this.#fetchAll(sync_info);
            }    
            else
            {
                // Fetch any new messages
                if (this._data.uidnext != sync_info.box.uidnext)
                {
                    await this.#fetch(sync_info, `${this._data.highestuid + 1}:*`, true);
                }
                
                // Are there any deleted messages?
                let current_message_count = await messages_collection.countDocuments({ mailbox: this._name });
                current_message_count += sync_info.insert_ops.length;
                if (current_message_count != sync_info.box.messages.total)
                {
                    await this.#trimDeletedMessages(sync_info);
                }

                // Any flags changed?
                if (parseInt(this._data.highestmodseq) < parseInt(sync_info.box.highestmodseq))
                {
                    await this.#syncFlags(sync_info);
                }
            }

            // Insert new messages
            if (sync_info.insert_ops.length)
            {
                console.log(` - inserted: ${sync_info.insert_ops.length}`);
                await messages_collection.insertMany(sync_info.insert_ops);
            }

            // Mark deleted messages
            if (sync_info.delete_ops.length)
            {
                console.log(` - deleted: ${sync_info.delete_ops.length}`);
                let ops = [];
                Utils.batch_work(sync_info.delete_ops, 1000, (batch) => {
                    ops.push({ 
                        updateMany: {
                            filter: { uid: { $in: batch } },
                            update: { $set: { state: -1 } },
                        }
                    });
                });

                await messages_collection.bulkWrite(ops);
            }

            // Update flags
            if (sync_info.flag_ops.length)
            {
                console.log(` - flagged: ${sync_info.flag_ops.length}`);
                let groups = sync_info.flag_ops.groupByToMap((x) => (x.flags));
                for (let [k,v] of groups)
                {
                    let update = {
                        $set: {
                            unread: k[0] == '1',
                            important: k[1] == '1',
                            state: 1,
                        }
                    };
                    let uids = v.map(x=>x.uid);

                    let ops = []
                    Utils.batch_work(uids, 1000, (batch) => {
                        ops.push({ 
                            updateMany: {
                                filter: { uid: { $in: uids } },
                                update: update,
                            }
                        });
                    });
    
                    await messages_collection.bulkWrite(ops);
                }
            }

            // Save mailbox state
            this._data.highestmodseq = sync_info.box.highestmodseq;
            this._data.uidnext = sync_info.box.uidnext;
            this._data.uidvalidity = sync_info.box.uidvalidity;

            await tx.collection(this._account.collection_name("mailboxes")).updateOne(
                { name: this._name, }, 
                { $set: this._data, },
                { upsert: true }
            );
        });
    }

    /**
     * Gets the IMAP connection from the owning user connection
     * @private
     * @type {IMap}
     */
    get #imap() { return this._account._imap; }

    /**
     * Fetch a range of messages from the IMAP server and append them
     * to the current set of loaded messages
     * 
     * @param {string} range An IMAP range specifier
     * @param {boolean} is_uid_range If true, the range specifies UIDs instead of sequence numebrs
     * @returns {void}
     * @async
     */
     #fetch(sync_info, range, is_uid_range)
     {
         let kind = is_uid_range ? this.#imap : this.#imap.seq;
         return kind.fetchHeaders(range, 
            {
                bodies: 'HEADER.FIELDS (DATE SUBJECT MESSAGE-ID REFERENCES IN-REPLY-TO)',
                seq: !is_uid_range
            }, 
            (msg) => 
            {
                // Create message entry
                let m = {
                    mailbox: this.name,
                    state: 1,
                    date: msg.headers.date ? Math.floor(new Date(msg.headers.date[0]).getTime()/1000) : 0,
                    subject: msg.headers.subject ? msg.headers.subject[0] : null,
                    uid: msg.attributes.uid,
                    unread: msg.attributes.flags.indexOf('\\Seen') < 0,
                    important: msg.attributes.flags.indexOf('\\Flagged') >= 0,
                    message_id: Utils.clean_message_id(msg.headers),
                    references: Utils.clean_references(msg.headers),
                };

                // Update the highest seen uid
                if (m.uid > this._data.highestuid)
                    this._data.highestuid = m.uid;

                // Track new messages (unless in reload)
                sync_info.insert_ops.push(m);
            }
        );
     }

    /**
     * Fetches all messages in the mailbox and resets all other meta data
     * @async
     * @returns {Promise<void>}
     */
    async #fetchAll(sync_info)
    {
        this._data.highestuid = 0;

        if (sync_info.box.messages.total != 0)
        {
            await this.#fetch(sync_info, "1:*", false);
        }
    }
 
    /**
     * Trims deleted messages from the Mailbox by querying the IMAP server for all
     * current UIDs and removing any from our local cache that no longer exist
     * @async
     * @returns {Promise<void>}
     */
    async #trimDeletedMessages(sync_info)
    {
        // Use ESearch if supported
        let isESearch = this.#imap.serverSupports('ESEARCH');
        let search_fn = isESearch ? this.#imap.esearch : this.#imap.search;

        // Get all uids
        let uids = await search_fn.call(this.#imap, [ 'ALL' ]);
        if (isESearch)
        uids = uids.all;

        // Iterate imap messages
        let iter_imap = Utils.iterate_uids(uids, isESearch);

        // Iterate db messages
        let iter_db = sync_info.messages_collection.find(
            { mailbox: this.name, state: { $ne: -1 } },
            { projection: { _id: 0, uid: 1, message_id: 1 } }
        ).sort({uid: 1});

        // Find missing
        await iter_db.forEach(x => {

            // Matching uid?
            if (x.uid == iter_imap.current())
            {
                iter_imap.next();
            }
            else
            {
                sync_info.delete_ops.push(x.uid);
            }
        });
    }
 
    /**
     * Synchronizes modified flags from the server
     * @async
     * @returns {Promise<void>}
     */
    async #syncFlags(sync_info)
    {
        if (sync_info.old_highest_uid == 0)
            return;
            
        await this.#imap.fetchHeaders(`1:${sync_info.old_highest_uid}`, 
            { 
                bodies: 'HEADER.FIELDS (MESSAGE-ID)',
                modifiers: { changedsince: this._data.highestmodseq  }
            },
            (msg) => 
            {
                sync_info.flag_ops.push({
                    uid: msg.attributes.uid,
                    flags: 
                        (msg.attributes.flags.indexOf('\\Seen') < 0  ? '1' : '0') + 
                        (msg.attributes.flags.indexOf('\\Flagged') >= 0 ? '1' : '0')
                });
            }
        );
    }
}

module.exports = Mailbox;