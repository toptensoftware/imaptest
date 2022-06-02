const fs = require('fs');
const path = require('path');

const Imap = require('./IMapPromise');
const WorkerMailbox = require('./WorkerMailbox');
const Database = require('./Database');
const Utils = require('./Utils');
const GroupBuilder = require('./GroupBuilder');
const Schema = require('./Schema');
const SQL = require('./SQL');
const AsyncLock = require('./AsyncLock');

/**
 * Manages the mailboxes for a particular user on an IMAP server and handles
 * indexing and construction of conversations
 */
class WorkerAccount
{
    /**
     * Constructs a new User instance
     * @constructor
     * @param {Object} config The IMAP configuration passed to node-imap
     */
    constructor(config)
    {
        // Create IMAP connection
        this.info = config.info;

        this.config = config;
        this.mailboxes = new Map();

        // Open database
        if (!config.db_name)
            config.db_name = `${this.config.host} ${this.config.user}`;
        if (!fs.existsSync(config.data_dir))
            fs.mkdirSync(config.data_dir);
        this.db = new Database(path.join(config.data_dir, config.db_name) + ".db");
        Schema.migrate(this.db);

        this.db.aggregate('aggOr', {
            start: 0,
            step: (result, nextValue) => result | nextValue,
          });
          

        this.lock = new AsyncLock();
    }


    openAndSync()
    {
        return this.lock.section(async () => {
            await this.open_nolock();
            await this.sync_nolock();
        });
    }

    open()
    {
        return this.lock.section(() => this.open_nolock());
    }

    sync()
    {
        return this.lock.section(() => this.sync_nolock());
    }

    /**
     * Open this account
     * @async
     * @returns {Promise<void>}
     */
    async open_nolock()
    {
        // Connect imap
        if (this._imap == null)
        {
            this._imap = new Imap(this.config);
            await this._imap.connect();
        }
}

    /**
     * Closes this account
     * @async
     * @returns {Promise<void>}
     */
    close()
    {
        return this.lock.section(async () => 
        {
            // Close connection
            if (this._imap)
            {
                await this._imap.end();
                this._imap = null;
            }

        })
    }


    /**
     * Synchronizes the DB with the IMAP server and rebuilds affected conversations
     */
    async sync_nolock()
    {
        let retryCount = 0;
        while (true)
        {
            try
            {
                return await this.#sync_internal();
            }
            catch (err)
            {
                if (!err.imap_error || retryCount > 2)
                    throw err;
            }
            
            // Close IMAP session and try again
            await this._imap?.end();
            this._imap = null;
            retryCount++;
        }
    }

    async #sync_internal()
    {
        this.info && this.info(`Syncing messages with IMAP`);

        // Connect IMAP session
        if (!this._imap)
        {
            this._imap = new Imap(this.config);
            await this._imap.connect();
        }

        // Get list of DB mailboxes
        let db_boxes = this.db.all(SQL.select("data").from("mailboxes")).map(x => JSON.parse(x.data));
        
        // Get list of IMAP boxes 
        let imap_boxes = await this._imap.getBoxes();

        // Synchronize previously known mailboxes
        let mailboxes = new Map();
        for (let db_box of db_boxes)
        {
            let imap_box = imap_boxes[db_box.name];
            if (!imap_box)
            {
                this.db.transactionSync(() => {

                    // Mark all messages as deleted
                    this.db.update("messages", 
                        { state: -1 },
                        { mailbox: db_box.name }
                    );
                    
                    // Also delete the mailbox
                    this.db.delete("mailboxes",
                        { name: db_box.name }
                    );
                });
            }
            else
            {
                // Sync existing mailbox
                let mb = new WorkerMailbox(this, db_box.name);
                mb.initFromDb(db_box);
                mailboxes.set(mb.name, mb);

                // Sync it
                await mb.sync();
            }
        }

        // Create new mailboxes
        for (let [k,v] of Object.entries(imap_boxes))
        {
            // Get the mailbox entry, ignore if already known
            let mb = mailboxes.get(k);
            if (mb)
                continue;

            // Create new mailbox
            mb = new WorkerMailbox(this, k);
            this.mailboxes.set(mb.name, mb);
            mb.initNew(v);
            mailboxes.set(mb.name, mb);

            // Sync it
            await mb.sync();
        }

        // Attach mailboxes
        this.mailboxes = mailboxes;

        // Build missing conversations()
        this.db.transactionSync(() => {
            this.#buildConversations();
        })
    }

    // Build conversations
    async #buildConversations()
    {
        // Prepare
        let info = this.info;
        info && info("Building conversations");
        let start = Date.now();
        let prev = start;

        function elapsed()
        {
            let now = Date.now();
            let retv = now - prev;
            prev = now;
            return `[${retv}]`;
        }

        // First count the number of conversations
        let conversationCount = this.db.pluck("SELECT COUNT(*) FROM conversations");
        info && info(` - ${elapsed()} ${conversationCount} conversations`);

        
        // --- STEP 1: FIND NEW/DELETED/CHANGED MESSAGES --- 

        let deleted_mids = new Set();
        let added_mids = new Set();
        let modified_mids = new Set();
        for (let m of this.db.iterate("SELECT rid, message_id, state FROM messages WHERE state <> 0"))
        {
            if (m.state < 0)
            {
                deleted_mids.add(m.message_id);
            }
            else if ((m.state & 1) != 0)
            {
                added_mids.add(m.message_id);
            }
            else if ((m.state & 2) != 0)
            {
                modified_mids.add(m.message_id);
            }
        }
        info && info(` - ${elapsed()} ${added_mids.size} added messages ids`);
        info && info(` - ${elapsed()} ${deleted_mids.size} deleted message ids`);
        info && info(` - ${elapsed()} ${modified_mids.size} modified message ids`);

        // --- STEP 2: TRIM REDUNDANT MESSAGE IDS --- 

        // Remove from lists any messages that were both added and
        // removed - ie: the message was moved between folders
        let oldCount = deleted_mids.size;
        for (let mid of deleted_mids)
        {
            if (added_mids.has(mid))
            {
                deleted_mids.delete(mid);
                added_mids.delete(mid);
            }
        }
        if (oldCount != deleted_mids.size)
        {
            info && info(` - ${elapsed()} ignoring ${oldCount - deleted_mids.size} moved messages`);
        }

        // --- FIND THE RELATED MESSAGES TO ANYTHING ADDED --- 

        let related_mids = new Set();
        if (added_mids.size)
        {
            for (let m of added_mids)
            {
                // Find messages that reference this mid
                for (let r of this.db.iterate(new SQL()
                    .select("message_id")
                    .from("message_references")
                    .leftJoin("messages").on("message_references.message_rid = messages.rid")
                    .where({ 
                        state: { $ne: -1 },
                        reference: m
                    })))
                {
                    related_mids.add(r.message_id);
                }

                // Find messages that this message references
                for (let r of this.db.iterate(new SQL()
                    .select("reference")
                    .from("messages")
                    .leftJoin("message_references").on("message_references.message_rid = messages.rid")
                    .where({
                        state: { $ne: -1 },
                        message_id: m
                    })
                ))
                {
                    related_mids.add(r.reference);
                }
            }
        }
        info && info(` - ${elapsed()} found ${related_mids.size} related messages`);

        // Build the full list of affected mids
        let affected_mids = new Set([...deleted_mids, ...added_mids, ...related_mids]);
        info && info(` - ${elapsed()} total affected message_ids: ${affected_mids.size}`);
       
        // --- DELETE AFFECTED CONVERSATIONS --- 

        let rebuild_mids = new Set(affected_mids);
        if (conversationCount > 0)
        {
            let deleted_conversation_count = 0;
            for (let mid of affected_mids)
            {
                // Find conversation with the message id
                let c = this.db.get(new SQL()
                    .select("conversation_rid")
                    .from("conversation_messages")
                    .where({ message_id: mid})
                    );
                if (c)
                {
                    // Delete the conversation
                    this.db.run("DELETE FROM conversations WHERE rid=?", c.conversation_rid);

                    // Get all the message ids that were in this conversation and remove from the list of
                    // affected_mids (we don't need to do a conversation look up on them since we've already 
                    // found its conversation), and... mark the message as requiring a conversation rebuild.
                    for (let cm of this.db.iterate("SELECT message_id FROM conversation_messages WHERE conversation_rid=?", c.conversation_rid))
                    {
                        affected_mids.delete(cm.message_id)
                        rebuild_mids.add(cm.message_id);
                    }

                    deleted_conversation_count++;
                }
            }

            info && info(` - ${elapsed()} deleted ${deleted_conversation_count} affected conversations`);
        }

        // --- UPDATE THE FLAGS ON CONVERSATIONS WHERE MESSAGE FLAGS CHANGED --- 

        // Update conversation flags
        for (let mid of modified_mids)
        {
            // Ignore if we're rebuilding this mid anyway
            if (rebuild_mids.has(mid))
                continue;

            // Calculate the new flags
            let conv = this.db.get(new SQL()
                .select("conversation_rid, flags")
                .from("conversation_messages")
                .leftJoin("conversations").on("conversation_messages.conversation_rid = conversations.rid")
                .where({message_id: mid})
            );
            if (!conv)
                continue;

            // Work out the new conversation flags
            let newflags = this.db.pluck(new SQL()
                .select("aggOr(m.flags) as flags")
                .from("conversations as c")
                .leftJoin("conversation_messages as cm").on("cm.conversation_rid = c.rid")
                .leftJoin("messages as m").on("m.message_id = cm.message_id")
                .where({ "c.rid": conv.conversation_rid })
            );

            // Update it if changed
            if (newflags != conv.flags)
            {
                this.db.update("conversations",
                    { flags: newflags },
                    { rid: conv.conversation_rid }
                );
            }

            // Don't bother with other messages included in this conversation
            for (let r of this.db.iterate(new SQL()
                .select("message_id")
                .from("conversation_messages")
                .where({conversation_rid: conv.conversation_rid})
            ))
            {
                modified_mids.delete(r.message_id);
            }
            
        }

        // --- BUILD CONVERSATIONS FOR AFFECTED MESSAGES ---

        // Build conversations for all affected message ids
        let newConversationCount = this.getConversations(rebuild_mids);

        info && info(` - ${elapsed()} (re)built ${newConversationCount} conversations`);


        // --- STEP 6: CLEAN UP --- 

        // Remove deleted messages
        let r = this.db.run("DELETE FROM messages WHERE state < 0");
        info && info(` - ${elapsed()} purged ${r.changes} deleted messages`);

        // Mark all messages as clean
        r = this.db.run("UPDATE messages SET state = 0 WHERE state > 0");
        info && info(` - ${elapsed()} cleaned ${r.changes} modified messages`);

        // Trim orphaned message references
        r = this.db.run("delete from message_references where not exists (select rid from messages where rid=message_references.message_rid)");
        info && info(` - ${elapsed()} deleted ${r.changes} orphaned messages references`);

        r = this.db.run("delete from conversation_mailboxes where not exists (select rid from conversations where rid=conversation_mailboxes.conversation_rid)");
        info && info(` - ${elapsed()} deleted ${r.changes} orphaned conversation mailbox references`);

        r = this.db.run("delete from conversation_messages where not exists (select rid from conversations where rid=conversation_messages.conversation_rid)");
        info && info(` - ${elapsed()} deleted ${r.changes} orphaned conversation messages references`);

        info && info(` - ${elapsed()} build conversations took ${Date.now() - start} ms`);

    }

    dropEverything()
    {
        this.db.transactionSync(() => {

            this.db.run("DROP TABLE IF EXISTS mailboxes");
            this.db.run("DROP TABLE IF EXISTS messages");
            this.db.run("DROP TABLE IF EXISTS message_references");
            this.db.run("DROP TABLE IF EXISTS conversations");
            this.db.run("DROP TABLE IF EXISTS conversation_messages");
            this.db.run("DROP TABLE IF EXISTS conversation_mailboxes");
            this.db.run("DROP TABLE IF EXISTS tears");
            Schema.migrate(this.db);
        });
    }

    dropAllConversations()
    {
        this.db.transactionSync(() => {
        
            let r;

            // Delete converstaions
            r = this.db.delete("conversation_messages");
            r = this.db.delete("conversation_mailboxes");
            r = this.db.delete("conversations");
            this.info && this.info(` - deleted ${r.changes} conversations`);

            // Purge deleted messages
            r = this.db.delete("messages", {
                state: { $lt: 0 }
            });
            this.info && this.info(` - purged ${r.changes} deleted messages`);

            // Mark remaining messages dirty
            r = this.db.update("messages",
                { state: 1 }
            )
            this.info && this.info(` - marked ${r.changes} messages dirty`);
        });
    }

    getConversations(mids)
    {
        if (mids.size == 0)
            return 0;

        // Setup group builder
        let gb = new GroupBuilder();
        gb.onMergeGroups = function(newGroup, oldGroup)
        {
            // Combine flags
            if (newGroup.flags !== undefined)
                newGroup.flags |= oldGroup.flags;
            else
                newGroup.flags = oldGroup.flags;

            // Combine mailboxes
            if (newGroup.mailboxes === undefined)
                newGroup.mailboxes = oldGroup.mailboxes;
            else
                newGroup.mailboxes = [...newGroup.mailboxes, ...oldGroup.mailboxes];

            // Combine partipants
            if (!newGroup.participants)
                newGroup.participants = oldGroup.participants;
            else
                newGroup.participants = [...newGroup.participants, ...oldGroup.participants]
        }

        // Build conversations for any other messages
        let messageMap = new Map();
        let processedMids = new Set(mids);
        for (let mid of mids)
        {
            // Remember we've processed this message id
            processedMids.add(mid);

            // Process all messages with this mid
            for (let m of this.db.iterate("SELECT * FROM messages WHERE message_id=? AND state <> -1", mid))
            {
                // Store the message for later when we'll need some additional information
                // to build the conversation
                messageMap.set(m.message_id, m);

                // Find all messages that reference this MID
                let references = this.db.all("SELECT reference " + 
                                                "FROM message_references " + 
                                                "WHERE message_rid=?", m.rid).map(x=>x.reference);

                // Build group
                let group = gb.add(mid, references);

                // Track flags
                group.flags |= m.flags;

                // Track mailboxes
                if (!group.mailboxes)
                    group.mailboxes = [];
                group.mailboxes.push(m.mailbox);

                // Track partipants
                if (!group.participants)
                    group.participants = [];
                Utils.split_address_list(m.participants, group.participants);

                // For any reference that we see for the first time, need to recurse
                for (let r of references)
                {
                    if (!processedMids.has(r))
                    {
                        mids.add(r);
                    }
                }
            }
        }

        let s_insert_conv = this.db.prepareCached(new SQL()
            .insert("conversations")
            .values('conversation_id, date, subject, flags, participants, message_count'.split(','))
        );

        let s_insert_conv_message = this.db.prepareCached(new SQL()
            .insert("conversation_messages")
            .values('conversation_rid, message_id'.split(','))
        );

        let s_insert_conv_mailboxes = this.db.prepareCached(new SQL()
            .insert("conversation_mailboxes")
            .values('conversation_rid, date, mailbox'.split(','))
        );

        // Update the result with the new groups
        for (var g of gb.groups)
        {
            // Look up the message for each message id
            let messages = [];
            for (let mid of g)
            {
                // Get the known messages for this id
                let msg = messageMap.get(mid);
                if (msg)
                    messages.push(msg);
            }
            
            // Sort by date
            messages.sort((a,b) => a.date - b.date);

            // Get the last message
            let lastMessage = messages[messages.length-1];

            // Simplify participants set
            let participants = [...new Set(g.participants)];

            // Insert conversation
            // conversation_id, date, subject, flags
            let conv_rid =  s_insert_conv.run(
                messages[0].message_id, 
                lastMessage.date, 
                lastMessage.subject, 
                g.flags,
                participants.join(","),
                messages.length,
                ).lastInsertRowid;

            // Insert message ids
            for (let m of messages)
            {
                // conversation_rid, message_id
                s_insert_conv_message.run(conv_rid, m.message_id);
            }

            // Insert mailboxes
            for (let mb of new Set(g.mailboxes))
            {
                // conversation_rid, date, mailbox
                s_insert_conv_mailboxes.run(conv_rid, lastMessage.date, mb);
            }
        }

        return gb.groups.size;
    }

    status()
    {
        let r = {}

        // Global stats
        r.totals = {
            totalMailboxes: this.db.pluck("SELECT COUNT(*) FROM mailboxes"),
        }

        // Message stats
        let important = 0;
        let unread = 0;
        let total = 0;
        for (let r of this.db.iterate("SELECT flags, count(*) as count FROM messages GROUP BY flags"))
        {
            if (r.flags & 1)
                important += r.count;
            if (r.flags & 2)
                unread += r.count;
            total += r.count;
        }

        r.messages = {
            important, unread, total
        }

        // Conversation stats
        important = 0;
        unread = 0;
        total = 0;
        for (let r of this.db.iterate("SELECT flags, count(*) as count FROM conversations GROUP BY flags"))
        {
            if (r.flags & 1)
                important += r.count;
            if (r.flags & 2)
                unread += r.count;
            total += r.count;
        }

        r.conversations = {
            important, unread, total
        }

        return r;
    }

    status_mailboxes()
    {
        return this.db.all("SELECT data FROM mailboxes").map(x => JSON.parse(x.data));
    }


    get_mailboxes()
    {
        return this.lock.section(() => {

            // Get all mailboxes
            let boxes = this.db.all("SELECT data FROM mailboxes").map(x => JSON.parse(x.data));
            boxes = new Map(boxes.map(x => [ x.name, { 
                name: x.name, 
                count_unread: 0,
                count_total: 0,
                count_important: 0,
            }]));

            
            // Get mailbox message counts
            for (let r of this.db.iterate(new SQL()
                .select("mailbox, aggOr(flags) as flags, count(*) as count")
                .from("conversation_mailboxes")
                .leftJoin("conversations").on("conversation_mailboxes.conversation_rid = conversations.rid")
                .groupBy("mailbox, flags")
                ))
            {
                let box = boxes.get(r.mailbox);
                if (box)
                {
                    if (r.flags & 1)
                        box.count_important += r.count;
                    if (r.flags & 2)
                        box.count_unread += r.count;
                    box.count_total += r.count;
                }
            }
        
        return [...boxes.values()];
        });
    }

    get_conversations(options)
    {
        return this.lock.section(() => {
            
            let queryFetch;
            let queryCount;
            let fields = "conversations.date as date, conversation_id, flags, participants, subject, message_count";
            if (options.mailbox)
            {
                queryFetch = new SQL()
                    .select(fields)
                    .from("conversation_mailboxes")
                    .leftJoin("conversations").on("conversation_mailboxes.conversation_rid = conversations.rid")
                    .where({ mailbox: options.mailbox });

                queryCount = new SQL()
                    .select("COUNT(*)")
                    .from("conversation_mailboxes")
                    .where({ mailbox: options.mailbox });
            }
            else
            {
                queryFetch = new SQL()
                    .select(fields)
                    .from("conversations");

                queryCount = new SQL()
                    .select("COUNT(*)")
                    .from("conversations")
            }

            // Sort        
            queryFetch.orderBy("date DESC");

            // Skip/Take
            let skip = parseInt(options.skip ?? 0);
            let take = parseInt(options.take ?? 25);
            queryFetch.skipTake(skip, take);

            // Get all matching conversations
            let conversations = this.db.all(queryFetch);

            for (let c of conversations)
            {
                c.participants = Utils.clean_participants(c.participants);
            }

            // Done
            return {
                skipped: skip,
                taken: conversations.length,
                count_total: this.db.pluck(queryCount),
                conversations,
            }
        });
    }

    get_conversation(options)
    {
        return this.lock.section(() => {

            if (!options.conversation_id)
                throw new Error("conversation_id missing");

            // get the conversation
            let conv = this.db.get(new SQL()
                .select()
                .from("conversations")
                .where("conversation_id=?", options.conversation_id)
            );
            
            if (!conv)
                throw new Error("Conversation not found");

            let query = new SQL()
                .select("messages.date,messages.participants,messages.subject,messages.message_id,messages.flags,messages.uid,messages.mailbox")
                .from("conversation_messages")
                .leftJoin("messages").on("conversation_messages.message_id = messages.message_id")
                .where("conversation_rid = ?", conv.rid);

            // Clean up duplicate messages and convert UIDs
            let messages = this.db.all(query);
            let message_id_map = new Map();
            for (let i=0; i<messages.length; i++)
            {
                let m = messages[i];

                // setup UID
                m.uid = `${m.mailbox}-${this.mailboxes.get(m.mailbox).data.uidvalidity}-${m.uid}`;

                let prev = message_id_map.get(m.message_id);
                if (prev)
                {
                    // Combine with prior
                    prev.uids.push(m.uid);
                    prev.mailboxes.push(m.mailbox);

                    // Remove this message
                    messages.splice(i, 1);
                    i--;
                }
                else
                {
                    m.uids = [ m.uid ];
                    m.mailboxes = [ m.mailbox ]
                    message_id_map.set(m.message_id, m);
                    delete m.uid;
                    delete m.mailbox;
                }

            }

            return {
                conversation_id: options.conversation_id,
                flags: conv.flags,
                date: conv.date,
                participants: conv.participants,
                subject: conv.subject,
                messages: messages,
            }
        });
    }
}



module.exports = WorkerAccount;


