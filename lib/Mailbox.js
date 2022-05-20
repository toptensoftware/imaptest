const Utils = require('./Utils');

/**
 * Manages the local cache of a single mailbox on an IMAP server
 */
class Mailbox
{
    /**
     * Constructs a new Mailbox instance
     * @constructor
     * @param {User} user A reference to the owning User object
     * @param {string} name The name of the mailbox
     * @param {Object} mailbox The mailbox object returned from imap
     */
    constructor(user, name)
    {
        this._user = user;
        this._name = name;
        this._data = {};
        this._data.highestuid = 0;
        this._dirty = false;
    }

    initFromDb(data)
    {
        this._data = data;
    }

    async initNew(mailbox)
    {
        // Update new data
        Object.assign(this._data, mailbox);
        this._dirty = true;
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
    async sync(tx, sync_notify)
    {
        // Setup sync info
        let sync_info = 
        {
            box: await this.#imap.openBox(this._name),
            added_messages: [],
            deleted_messages: [],
            flagged_messages: [],
            old_highest_uid: this._data.highestuid,
            messages_collection: tx.collection(this._user.messages_collection_name),
            sync_notify: sync_notify
        }
        
        
        console.log(`syncing ${this._user.messages_collection_name} ${this.name} ${sync_info.box.messages.total} messages...`)

        // If uid validity has changed, clear everything
        if (sync_info.box.uidvalidity != this._data.uidvalidity)
        {
            // Fetch everything
            await this.#fetchAll(sync_info);
            this._dirty = true;
        }    
        else
        {
            // Fetch any new messages
            if (this._data.uidnext != sync_info.box.uidnext)
            {
                await this.#fetch(sync_info, `${this._data.highestuid + 1}:*`, true);
                this._dirty = true;
            }
            
            // Are there any deleted messages?
            let current_message_count = await sync_info.messages_collection.countDocuments({ mailbox: this._name });
            current_message_count += sync_info.added_messages.length;
            if (current_message_count != sync_info.box.messages.total)
            {
                await this.#trimDeletedMessages(sync_info);
                this._dirty = true;
            }

            // Any flags changed?
            if (parseInt(this._data.highestmodseq) < parseInt(sync_info.box.highestmodseq))
            {
                await this.#syncFlags(sync_info);
                this._dirty = true;
            }
        }

        /*
        // If there was a sync error then do a full reload
        if (sync_info.sync_error)
        {
            await this.#fetchAll();
            isDirty = true;
            sync_info.sync_error = false;
        }
        */

        // Update data
        this._data.highestmodseq = sync_info.box.highestmodseq;
        this._data.uidnext = sync_info.box.uidnext;
        this._data.uidvalidity = sync_info.box.uidvalidity;

        // Save new messages
        if (sync_info.added_messages.length)
        {
            await sync_info.messages_collection.insertMany(
                sync_info.added_messages
            );
        }

        // Delete removed messages
        if (sync_info.deleted_messages.length)
        {
            await sync_info.messages_collection.deleteMany({
                uid: { $in: sync_info.deleted_messages }
            });
        }

        // Update flags
        if (sync_info.flagged_messages.length)
        {
            await sync_info.messages_collection.bulkWrite(
                sync_info.flagged_messages
            );
        }

        // Save changes
        this._dirty = true;
        {
            await this.updateDb(tx);
            this._dirty = false;
        }

        //console.log(`Synced ${this.name}`)
        sync_info.box = null;
    }

    async updateDb(tx)
    {
        await tx.collection(this._user.mailboxes_collection_name).updateOne(
            {
                name: this._name,
            }, 
            {
                $set: this._data,
            },
            {
                upsert: true
            }
        );

    }

    /**
     * Gets the IMAP connection from the owning user connection
     * @private
     * @type {IMap}
     */
    get #imap() { return this._user._imap; }

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
                    date: msg.headers.date ? Math.floor(new Date(msg.headers.date[0]).getTime()/1000) : 0,
                    subject: msg.headers.subject ? msg.headers.subject[0] : null,
                    uid: msg.attributes.uid,
                };

                // Clean id and refs
                let mid = Utils.clean_message_id(msg.headers);
                let refs = Utils.clean_references(msg.headers);

                // Assign optional
                if (mid)
                    m.message_id = mid;
                if (refs)
                    m.references = refs;
                if (msg.attributes.flags.indexOf('\\Seen') < 0)
                    m.unread = true;
                if (msg.attributes.flags.indexOf('\\Flagged') >= 0)
                    m.important = true;

                // Update the highest seen uid
                if (m.uid > this._data.highestuid)
                    this._data.highestuid = m.uid;

                // Track new messages (unless in reload)
                sync_info.added_messages.push(m);
                sync_info.sync_notify.message_added?.(mid)
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
        sync_info.did_reload = true;

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
            { mailbox: this.name },
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
                sync_info.deleted_messages.push(x.uid);
                sync_info.sync_notify?.message_deleted?.(x.message_id);
            }

        });

        // If we finished iterating the uid list then
        // things look ok
        if (!iter_imap.eof())
        {
            // We didn't get to the end of the UID list so something has gone
            // awry.  Refresh everything.
            sync_info.sync_error = true;
            return;
        }
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
                let update = {
                    $set: {},
                    $unset: {},
                };

                let unread = msg.attributes.flags.indexOf('\\Seen') < 0;
                if (unread)
                    update.$set.unread = true;
                else
                    update.$unset.unread = true;
                
                let important = msg.attributes.flags.indexOf('\\Flagged') >= 0;
                if (important)
                    update.$set.important = true;
                else
                    update.$unset.important = true;

                sync_info.flagged_messages.push({
                    updateOne: {
                        filter: { uid: msg.attributes.uid },
                        update: update
                    }
                });
                sync_info.sync_notify.message_flagged?.(Utils.clean_message_id(msg.headers));
            }
        );
    }
}

module.exports = Mailbox;