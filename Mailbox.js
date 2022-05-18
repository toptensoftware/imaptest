const Imap = require('node-imap');
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

        // Save
        await this.updateDb();
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
    async sync()
    {
        // Open the box
        this._box = await new Promise((resolve, reject) => 
        {
            this.#imap.openBox(this._name, true, (err, box) => {
                if (err)
                {
                    reject(err);
                }
                else
                {
                    resolve(box);
                }
            });
        })

        console.log(`syncing ${this.name} ${this._box.messages.total} messages...`)

        // Track sync info
        this._sync_info = {
            added_messages: [],
            deleted_messages: [],
            flagged_messages: [],
            did_reload: false,
            sync_error: false,
        }    
        
        if (this.name == "Archive")
            debugger;

        let isDirty = false;
        let old_highest_uid = this._data.highestuid;

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
            let current_message_count = await this._user.messages_collection.count({ mailbox: this._name });
            current_message_count += this._sync_info.added_messages.length;
            if (current_message_count != this._box.messages.total)
            {
                await this.#trimDeletedMessages();
                isDirty = true;
            }

            // Any flags changed?
            if (this._data.highestmodseq < this._box.highestmodseq)
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
            await this._user.messages_collection.insertMany(
                this._sync_info.added_messages
            );
        }

        // Delete removed messages
        if (this._sync_info.deleted_messages.length)
        {
            await this._user.messages_collection.deleteMany({
                uid: { $in: this._sync_info.deleted_messages }
            });
        }

        // Update flags
        if (this._sync_info.flagged_messages.length)
        {
            await this._user.messages_collection.bulkWrite(
                this._sync_info.flagged_messages
            );
        }

        // Save changes
        if (isDirty)
        {
            await this.updateDb();
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

    async updateDb()
    {
        await data.db.collection("mailboxes").updateOne(
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
         return new Promise((resolve, reject) => {
         
             let src = is_uid_range ? this.#imap : this.#imap.seq;
             let fetch = src.fetch(range, {
                 bodies: 'HEADER.FIELDS (DATE SUBJECT MESSAGE-ID REFERENCES IN-REPLY-TO)'
             });
 
             fetch.on('message', (fetch_msg, seqno) => {
                 let msg_hdrs = {};
                 let msg_attrs = {};
                 fetch_msg.on('body', function(stream, info) 
                 {
                     let buffer = "";
                     stream.on('data', (chunk) => {
                         let str = chunk.toString('utf8');
                         buffer += str;
                     });
                     stream.on('end', () => {
                         msg_hdrs = Imap.parseHeader(buffer);
                     });
                 });
                 fetch_msg.once('attributes', (attrs) => {
                     msg_attrs = attrs;
                 })
                 fetch_msg.once('end', () => {
                     // Create message entry
                     let m = {
                         mailbox: this.name,
                         date: msg_hdrs.date ? Math.floor(new Date(msg_hdrs.date[0]).getTime()/1000) : 0,
                         subject: msg_hdrs.subject ? msg_hdrs.subject[0] : null,
                         uid: msg_attrs.uid,
                     };

                     // Clean id and refs
                     let mid = utils.clean_message_id(msg_hdrs);
                     let refs = utils.clean_references(msg_hdrs);

                     // Assign optional
                     if (mid)
                        m.message_id = mid;
                     if (refs)
                        m.references = refs;
                     if (msg_attrs.flags.indexOf('\\Seen') < 0)
                         m.unread = true;
                     if (msg_attrs.flags.indexOf('\\Flagged') >= 0)
                         m.important = true;
 
                     // Update the highest seen uid
                     if (m.uid > this._data.highestuid)
                         this._data.highestuid = m.uid;
 
                     // Track new messages (unless in reload)
                    this._sync_info.added_messages.push(m);
                 });
             });
 
             fetch.once('error', reject);
             fetch.once('end', resolve);
         });
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
     async #trimDeletedMessages()
     {
         // Use ESearch if supported
         let isESearch = this.#imap.serverSupports('ESEARCH');
         let search_fn = isESearch ? this.#imap.esearch : this.#imap.search;
 
         // Get all uids
         let uids = await new Promise((resolve, reject) => {
             search_fn.call(this.#imap, [ 'ALL' ], (err, result) => {
                 if (err)
                     reject(err);
                 else
                     resolve(isESearch ? result.all : result);
             });
         });
 
         // Iterate imap messages
         let iter_imap = utils.iterate_uids(uids, isESearch);

         // Iterate db messages
         let iter_db = this._user.messages_collection.find(
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
             info.sync_error = true;
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
         return new Promise((resolve, reject) => {
         
             let fetch = this.#imap.fetch(`1:${old_highest_uid}`, { 
                 modifiers: {
                     changedsince: this._data.highestmodseq 
                 }
             });
 
             fetch.on('message', (fetch_msg, seqno) => {
                 let msg_attrs = {};
                 fetch_msg.once('attributes', (attrs) => {
                     msg_attrs = attrs;
                    })
                    fetch_msg.once('end', () => {
                        
                        let update = {
                            $set: {},
                            $unset: {},
                        };

                        let unread = msg_attrs.flags.indexOf('\\Seen') < 0;
                        if (unread)
                            update.$set.unread = true;
                        else
                            update.$unset.unread = true;
                        
                        let important = msg_attrs.flags.indexOf('\\Flagged') >= 0;
                        if (important)
                            update.$set.important = true;
                        else
                            update.$unset.important = true;

                        this._sync_info.flagged_messages.push({
                            updateOne: {
                                filter: { uid: msg_attrs.uid },
                                update: update
                            }
                        })
                        
                 });
             });
 
             fetch.once('error', reject);
             fetch.once('end', resolve);
         });
     }
 
 
}

module.exports = Mailbox;