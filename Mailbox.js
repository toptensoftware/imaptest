const Imap = require('./imap_promise');
const utils = require('./utils');
const data = require('./data');

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
        this._box = null;
        this._data = {};
        this._data.highestuid = 0;
    }

    initFromDb(data)
    {
        this._data = data;
    }

    async updateFromImap(mailbox)
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
        // Open the box
        this._box = await this.#imap.openBox(this._name);

        console.log(`syncing ${this.name} ${this._box.messages.total} messages...`)

        // Track sync info
        this._sync_info = {
            added_messages: [],
            deleted_messages: [],
            flagged_messages: [],
            did_reload: false,
            sync_error: false,
        }    
        
        let isDirty = false;
        let old_highest_uid = this._data.highestuid;

        let mcoll = tx.collection(this._user.messages_collection_name);

        // If uid validity has changed, clear everything
        if (this._box.uidvalidity != this._data.uidvalidity)
        {
            // Fetch everything
            await this.#fetchAll();
            isDirty = true;
        }    
        else
        {
            // Fetch any new messages
            if (this._data.uidnext != this._box.uidnext)
            {
                await this.#fetch(`${this._data.highestuid + 1}:*`, true);
                isDirty = true;
            }

            // Are there any deleted messages?
            let current_message_count = await mcoll.countDocuments({ mailbox: this._name });
            current_message_count += this._sync_info.added_messages.length;
            if (current_message_count != this._box.messages.total)
            {
                await this.#trimDeletedMessages(mcoll);
                isDirty = true;
            }

            // Any flags changed?
            if (parseInt(this._data.highestmodseq) < parseInt(this._box.highestmodseq))
            {
                await this.#syncFlags(old_highest_uid);
                isDirty = true;
            }
        }

        /*
        // If there was a sync error then do a full reload
        if (this._sync_info.sync_error)
        {
            await this.#fetchAll();
            isDirty = true;
            this._sync_info.sync_error = false;
        }
        */

        // Update data
        this._data.highestmodseq = this._box.highestmodseq;
        this._data.uidnext = this._box.uidnext;
        this._data.uidvalidity = this._box.uidvalidity;

        // Save new messages
        if (this._sync_info.added_messages.length)
        {
            await mcoll.insertMany(
                this._sync_info.added_messages
            );
        }

        // Delete removed messages
        if (this._sync_info.deleted_messages.length)
        {
            await mcoll.deleteMany({
                uid: { $in: this._sync_info.deleted_messages }
            });
        }

        // Update flags
        if (this._sync_info.flagged_messages.length)
        {
            await mcoll.bulkWrite(
                this._sync_info.flagged_messages
            );
        }

        // Save changes
        if (isDirty)
        {
            await this.updateDb(tx);
        }

        // Notify changes
        if(this._sync_info.did_reload)
        {
            if (this._sync_info.did_reload)
                console.log("  - reloaded");
            this._sync_info.added_messages = null;
            this._sync_info.deleted_messages = null;
            this._sync_info.flagged_messages = null;
        }
        else
        {
            if (this._sync_info.added_messages.length != 0)
                console.log(`  - added:   ${this._sync_info.added_messages.length}`);
            if (this._sync_info.deleted_messages.length != 0)
                console.log(`  - deleted: ${this._sync_info.deleted_messages.length}`);
            if (this._sync_info.flagged_messages.length != 0)
                console.log(`  - flagged: ${this._sync_info.flagged_messages.length}`);
        }

        //console.log(`Synced ${this.name}`)
        this._box = null;
        this._sync_info = null;
    }

    async updateDb(tx)
    {
        await tx.collection("mailboxes").updateOne(
            {
                user: this._user.config.user,
                host: this._user.config.host,
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
     #fetch(range, is_uid_range)
     {
        return this.#imap.fetch(range, 
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
                let mid = utils.clean_message_id(msg.headers);
                let refs = utils.clean_references(msg.headers);

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
                this._sync_info.added_messages.push(m);
            }
        );
     }
 
     /**
      * Fetches all messages in the mailbox and resets all other meta data
      * @async
      * @returns {Promise<void>}
      */
     async #fetchAll()
     {
         this._sync_info.did_reload = true;
 
         this._data.highestuid = 0;
 
         if (this._box.messages.total != 0)
         {
             await this.#fetch("1:*", false);
         }
     }
 
    /**
     * Trims deleted messages from the Mailbox by querying the IMAP server for all
     * current UIDs and removing any from our local cache that no longer exist
     * @async
     * @returns {Promise<void>}
     */
     async #trimDeletedMessages(mcoll)
     {
         // Use ESearch if supported
         let isESearch = this.#imap.serverSupports('ESEARCH');
         let search_fn = isESearch ? this.#imap.esearch : this.#imap.search;
 
         // Get all uids
         let uids = await search_fn.call(this.#imap, [ 'ALL' ]);
         if (isESearch)
            uids = uids.all;
 
         // Iterate imap messages
         let iter_imap = utils.iterate_uids(uids, isESearch);

         // Iterate db messages
         let iter_db = mcoll.find(
             { mailbox: this.name },
             { projection: { _id: 0, uid: 1 } }
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
                this._sync_info.deleted_messages.push(x.uid);
            }
         });

         // If we finished iterating the uid list then
         // things look ok
         if (!iter_imap.eof())
         {
             // We didn't get to the end of the UID list so something has gone
             // awry.  Refresh everything.
             this._sync_info.sync_error = true;
             return;
         }
     }
 
     /**
      * Synchronizes modified flags from the server
      * @async
      * @returns {Promise<void>}
      */
     async #syncFlags(old_highest_uid)
     {
         await this.#imap.fetch(`1:${old_highest_uid}`, 
            { 
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

                this._sync_info.flagged_messages.push({
                    updateOne: {
                        filter: { uid: msg.attributes.uid },
                        update: update
                    }
                })
            }
         );
     }
 
 
}

module.exports = Mailbox;