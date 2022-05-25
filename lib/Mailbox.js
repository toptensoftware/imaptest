const Utils = require('./Utils');
const Database = require('./Database');
const SQL = require('./SQL');

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
        this.account = account;
        this.name = name;
        this.data = {};
        this.data.highestuid = 0;
    }

    initFromDb(data)
    {
        this.data = data;
    }

    async initNew(mailbox)
    {
        // Update new data
        Object.assign(this.data, mailbox);
    }

 
    /**
     * Synchronise the local cache for the mailbox with the IMAP server
     * @async
     * @returns {Promise<void>}
     */
    async sync()
    {
        let db = this.account.db;
        await db.transactionAsync(async () => {

            // Setup sync info
            let sync_info = 
            {
                box: await this.#imap.openBox(this.name),
                insert_ops: [],
                delete_ops: [],
                flag_ops: [],
                old_highest_uid: this.data.highestuid,
            }
            
            // Log it
            this.account.info && this.account.info(` - syncing ${this.name} ${sync_info.box.messages.total} messages...`)

            // If uid validity has changed, clear everything
            if (sync_info.box.uidvalidity != this.data.uidvalidity)
            {
                // Mark  all messages as deleted
                db.update("messages", 
                    { state: -1 },
                    { mailbox: this.name, state: { $ne: -1 } }
                );
                
                // Fetch everything
                await this.#fetchAll(sync_info);
            }    
            else
            {
                // Fetch any new messages
                if (this.data.uidnext != sync_info.box.uidnext)
                {
                    await this.#fetch(sync_info, `${this.data.highestuid + 1}:*`, true);
                }
                
                // Are there any deleted messages?
                let current_message_count = db.pluck(new SQL()
                    .select("COUNT(*)")
                    .from("messages")
                    .where({ mailbox: this.name })
                );
                current_message_count += sync_info.insert_ops.length;
                if (current_message_count != sync_info.box.messages.total)
                {
                    await this.#trimDeletedMessages(sync_info);
                }

                // Any flags changed?
                if (parseInt(this.data.highestmodseq) < parseInt(sync_info.box.highestmodseq))
                {
                    await this.#syncFlags(sync_info);
                }
            }

            // Insert new messages
            if (sync_info.insert_ops.length)
            {
                let s_insert_message = db.prepareCached(new SQL()
                    .insert("messages")
                    .values('date,subject,message_id,mailbox,state,uid,flags'.split(','))
                );
                let s_insert_reference = db.prepareCached(new SQL()
                    .insert("message_references")
                    .values(['message_rid', 'reference'])
                );

                for (let i of sync_info.insert_ops)
                {
                    let rid = s_insert_message.run(i.date, i.subject, i.message_id, this.name, 1, i.uid, i.flags).lastInsertRowid;
                    for (let r of i.references)
                    {
                        s_insert_reference.run(rid, r);
                    }
                }
            }

            // Mark deleted messages
            if (sync_info.delete_ops.length)
            {

                let s_update = db.prepareCached("UPDATE messages SET state=-1 WHERE uid=? AND state <> -1");

                for (let d of sync_info.delete_ops)
                {
                    s_update.run(d);
                }

                this.account.info && this.account.info(` - deleted: ${sync_info.delete_ops.length}`);
            }

            // Update flags
            if (sync_info.flag_ops.length)
            {
                this.account.info && this.account.info(` - flagged: ${sync_info.flag_ops.length}`);

                let s_update = db.prepareCached("UPDATE messages SET flags=?, state = 2 WHERE mailbox=? AND UID=? AND STATE >= 0");
                for (let f of sync_info.flag_ops)
                {
                    s_update.run(f.flags, this.name, f.uid);
                }
            }

            // Save mailbox state
            this.data.highestmodseq = sync_info.box.highestmodseq;
            this.data.uidnext = sync_info.box.uidnext;
            this.data.uidvalidity = sync_info.box.uidvalidity;
            this.data.name = this.name;

            db.insertOrReplace("mailboxes", {
                name: this.name,
                data: JSON.stringify(this.data),
            });

        });
    }

    /**
     * Gets the IMAP connection from the owning user connection
     * @private
     * @type {IMap}
     */
    get #imap() { return this.account._imap; }

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
                    flags: Utils.message_flags_mask(msg.attributes.flags),
                    message_id: Utils.clean_message_id(msg.headers),
                    references: Utils.clean_references(msg.headers),
                };

                // Update the highest seen uid
                if (m.uid > this.data.highestuid)
                    this.data.highestuid = m.uid;

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
        this.data.highestuid = 0;

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
        for (let m of this.account.db.iterate(new SQL()
            .select("uid, message_id")
            .from("messages")
            .where({ mailbox: this.name, state: { $ne: -1 } })
            .orderBy("uid")))
        {
            // Matching uid?
            if (m.uid == iter_imap.current())
            {
                iter_imap.next();
            }
            else
            {
                sync_info.delete_ops.push(m.uid);
            }
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
                modifiers: { changedsince: this.data.highestmodseq  }
            },
            (msg) => 
            {
                sync_info.flag_ops.push({
                    uid: msg.attributes.uid,
                    flags: Utils.message_flags_mask(msg.attributes.flags),
                });
            }
        );
    }
}

module.exports = Mailbox;