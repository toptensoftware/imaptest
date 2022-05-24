const Imap = require('./IMapPromise');
const Mailbox = require('./Mailbox');
const Database = require('./Database');
const AsyncReadersWriter = require('./AsyncReadersWriter');
const Utils = require('./Utils');
const GroupBuilder = require('./GroupBuilder');
const MultiValueMap = require('./MultiValueMap');

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
        this.info = config.info;

        this.config = config;
        this.mailboxes = new Map();
        this.listeners = [];

        if (!this.config.db_base_collection_name)
        {
            this.config.db_base_collection_name = `${this.config.host} ${this.config.user}`;
        }
    }

    /**
     * Gets the qualified name of a mongo-db collection
     * @param {String} coll The collection type ("messages", "mailboxes" or "conversations")
     * @returns The qualified collection name
     */
    collection_name(coll)
    {
        return `${this.config.db_base_collection_name} ${coll}`;
    }


    /**
     * Open this account
     * @async
     * @returns {Promise<void>}
     */
    async open()
    {
        // Ensure DB indicies
        await this.#create_indicies();

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
    async close()
    {
        // Close connection
        if (this._imap)
        {
            await this._imap.end();
            this._imap = null;
        }
    }

    addListener(listener)
    {
        this.listeners.push(listener);
    }

    removeListener(listener)
    {
        let index = this.listeners.findIndex(x => x == listener);
        if (index >= 0)
            this.listeners.splice(index, 1);
    }


    /**
     * Synchronizes the DB with the IMAP server and generates
     * synchronization data about the changes.
     * 
     * sync_info
     * {
     *      added_messages: [ { uid, message_id, mailbox, references, state }, ... ]
     *      deleted_messages: [ { uid, message_id, mailbox, references, state }, ... ]
     *      modified_messages: [ { uid, message_id, mailbox, references, state }, ... ]
     *      affected_conversations: [ conversation_id, ... ]
     * }
     * 
     * @returns {SyncInfo} Information about the changes caused by the sync
     */
    async sync()
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
        let db_boxes = await Database.db.collection(this.collection_name("mailboxes"))
                            .find({}).toArray();
        
        // Get list of IMAP boxes 
        let imap_boxes = await this._imap.getBoxes();

        // Synchronize previously known mailboxes
        let mailboxes = new Map();
        for (let db_box of db_boxes)
        {
            let imap_box = imap_boxes[db_box.name];
            if (!imap_box)
            {
                // Mailbox has been deleted, delete from db too...
                await Database.transaction(async (tx) => {

                    // Get the collections
                    let messages_collection = tx.collection(this.collection_name("messages"));
                    let mailboxes_collection = tx.collection(this.collection_name("mailboxes"));

                    // Mark all the messages as deleted
                    await messages_collection.updateMany(
                        { mailbox: db_box.name },
                        { $set: { state: -1 } }
                    );

                    // Delete the mailbox entry
                    await mailboxes_collection.deleteOne(
                        { name: db_box.name, }
                    );
                });
            }
            else
            {
                // Sync existing mailbox
                let mb = new Mailbox(this, db_box.name);
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
            mb = new Mailbox(this, k);
            this.mailboxes.set(mb.name, mb);
            mb.initNew(v);
            mailboxes.set(mb.name, mb);

            // Sync it
            await mb.sync();
        }

        // Attach mailboxes
        this.mailboxes = mailboxes;

        // Trim affected conversations
        await this.#trimConversations();
    }

    // Trim all conversations that are affected by new, deleted and modified (flagged) messages
    async #trimConversations()
    {
        // Get collections
        let mcoll = Database.db.collection(this.collection_name("messages"));
        let ccoll = Database.db.collection(this.collection_name("conversations"));

        let info = this.info;

        info && info("Trimming conversations");
        let start = Date.now();

        // First count the number of conversations
        let conversationCount = await ccoll.countDocuments({});

        info && info(` - ${conversationCount} conversations`);

        // If there are no conversations
        let r;
        let flagged_mids = new Set();

        // Get all added and deleted message ids
        let added_messages = [];
        let deleted_messages = [];
        let modified_messages = [];
        let affected_conversations = new Set();
        let deleted_mids = new Set();
        let added_mids = new Set();
        await mcoll.find(
            { state: { $ne: 0 } },
            { projection: { _id: 0, uid: 1, mailbox: 1, message_id: 1, references: 1, state: 1 } }
        ).forEach(x =>
        {

            if (x.state < 0)
            {
                deleted_messages.push(x);
                deleted_mids.add(x.message_id);
                x.references?.forEach(x => deleted_mids.add(x));
            }
            else if ((x.state & 1) != 0)
            {
                added_messages.push(x);
                added_mids.add(x.message_id);
                x.references?.forEach(x => added_mids.add(x));
            }
            else if ((x.state & 2) != 0)
            {
                modified_messages.push(x);
                flagged_mids.add(x.message_id);
            }
        });

        info && info(` - ${added_messages.length} added messages ids`);
        info && info(` - ${deleted_messages.length} deleted messages`);
        info && info(` - ${modified_messages.length} modified messages`);
        info && info(` - ${added_mids.size} added messages ids`);
        info && info(` - ${deleted_mids.size} deleted message ids`);

        if (conversationCount != 0)
        {
            let oldCount = deleted_mids.size;

            // Trim out moved messages
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
                info && info(` - ignoring ${oldCount - deleted_mids.size} moved messages`);
            }

            // Ignore any message ids which still exist elsewhere
            if (deleted_mids.size > 0)
            {
                oldCount = deleted_mids.size;

                await Utils.batch_work(Array.from(deleted_mids), 1000, async (batch) =>
                {

                    await mcoll.find(
                        { state: { $ne: -1 }, message_id: { $in: batch } },
                        { projection: { _id: 0, message_id: 1 } }
                    ).forEach(x =>
                        deleted_mids.delete(x.message_id)
                    );

                });

                if (oldCount != deleted_mids.size)
                {
                    info && info(` - ignoring ${oldCount - deleted_mids.size} deleted messages that still exist elsewhere`);
                }
            }

            // Get the final set of affected message ids
            let affected_mids = [...deleted_mids, ...added_mids];
            info && info(` - total affecting message_ids: ${affected_mids.length}`);
            if (affected_mids.length > 0)
            {
                // Find all affected conversations
                let affected_conversations_docids = [];
                await Utils.batch_work(affected_mids, 1000, async (batch) =>
                {

                    await ccoll.find(
                        { message_ids: { $in: batch } },
                        { projection: { _id: 1, conversation_id: 1 } }
                    ).forEach(x => {
                        affected_conversations_docids.push(x._id);
                        affected_conversations.add(x.conversation_id);
                    });

                });

                info && info(` - deleting ${affected_conversations_docids.length} affected conversations`);

                // Delete affected conversations
                Utils.batch_work(affected_conversations_docids, 1000, async (batch) =>
                {

                    await ccoll.deleteMany(
                        { _id: { $in: batch } }
                    );

                });
            }

            // Update conversation flags
            let bulk_updates = [];
            await Utils.batch_work([...flagged_mids], 1000, async (batch) =>
            {
                let r = await ccoll.aggregate([

                    // Find conversations containing message id's that have changed
                    { $match: { message_ids: { $in: batch } } },

                    // Get the associated messages
                    {
                        $lookup: {
                            from: this.collection_name("messages"),
                            localField: "message_ids",
                            foreignField: "message_id",
                            as: "messages",
                        }
                    },
                    { $unwind: "$messages" },

                    // Only want the conversation id and the msssage flags
                    // and also save the old flags for later change test
                    {
                        $project: {
                            _id: 1,
                            conversation_id: 1,
                            old_flags: "$flags",
                            flags: "$messages.flags"
                        }
                    },

                    // Work out the new flags
                    {
                        $group: {
                            _id: "$_id",
                            old_flags: { $first: "$old_flags" },
                            conversation_id: { $first: "$conversation_id" },
                            flags: {
                                $accumulator: {
                                    init: "function() { return 0; }",
                                    accumulate: "function(state, flags) { return state | flags; }",
                                    accumulateArgs: ["$flags"],
                                    merge: "function(s1, s2) { return s1 | s2; }",
                                    finalize: "function(state) { return state; }"
                                }
                            }
                        }
                    },

                    // Ignore conversations where the flags didn't change
                    {
                        $match: {
                            $expr: { $ne: ["$flags", "$old_flags"] }
                        }
                    },
                    
                    /*
                    // Just keep the fields that need to be merged into
                    // the conversation documents
                    {
                        $project: {
                            _id: 1,
                            flags: 1
                        }
                    },

                    // Make changes
                    {
                        $merge: {
                            into: this.collection_name("conversations"),
                            on: '_id',
                            whenMatched: 'merge',
                            whenNotMatched: 'fail',
                        }
                    }
                    */

                ]).forEach(x => {
                    affected_conversations.add(x.conversation_id);
                    bulk_updates.push({
                        updateOne: {
                            filter: { _id: x._id },
                            update: { $set: { flags: x.flags }}
                        }
                    });
                });

                debugger;
            });

            if (bulk_updates.length)
            {
                await ccoll.bulkWrite(bulk_updates);
            }

        }

        // Remove deleted messages
        r = await mcoll.deleteMany({ state: -1 });
        info && info(` - purging ${r.deletedCount} deleted messages`);

        // Mark all messages as clean
        r = await mcoll.updateMany(
            { state: { $ne: 0 } },
            { $set: { state: 0 } }
        );
        info && info(` - cleaned ${r.modifiedCount} modified messages`);

        info && info(` - sync complete (before notifying listeners) in ${Date.now() - start} ms`);

        info && info(` - notifying listeners`);
        let sync_info = {
            added_messages,
            deleted_messages,
            modified_messages,
            affected_conversations: [...affected_conversations],
        };
        for (let l of this.listeners)
        {
            await l.onSynchronize(sync_info);
        }

        info && info(` - sync finished in ${Date.now() - start} ms`);

        return sync_info;
    }

    async status_mailboxes()
    {
        let mailboxes_collection = Database.db.collection(this.collection_name("mailboxes"));
        let result = {};
        await mailboxes_collection.find({}).forEach((mb) =>
        {
            result[mb.name] = mb;
        });
        return result;
    }

    async status_messages()
    {
        let messages_collection = Database.db.collection(this.collection_name("messages"));

        let result = {};
        let counts = await messages_collection.aggregate([

            { $group: {
                "_id": "$mailbox",
                "messages": { $count: {} },
                "unread": { $sum: { $cond: [ "$unread", 1, 0 ] } },
                "important": { $sum: { $cond: [ "$important", 1, 0 ] } }
            } }

        ]).forEach(x => {
            result[x._id] = x;
            delete x._id;
        });

        return result;
    }

    async status()
    {
        let mailboxes_collection = Database.db.collection(this.collection_name("mailboxes"));
        let messages_collection = Database.db.collection(this.collection_name("messages"));
        let conversations_collection = Database.db.collection(this.collection_name("conversations"));

        return {
            totalMailboxes: await mailboxes_collection.countDocuments({}),
            totalMessages: await messages_collection.countDocuments({}),
            addedMessages: await messages_collection.countDocuments({ state: { $eq: 1} } ),
            deletedMessages: await messages_collection.countDocuments({ state: { $eq: -1} } ),
            flaggedMessages: await messages_collection.countDocuments({ state: { $eq: 2} } ),
            cleanMessages: await messages_collection.countDocuments({ state: { $eq: 0} } ),
            totalConversations: await conversations_collection.countDocuments({}),
        }

    }

    async dropEverything()
    {
        await Database.transaction(async (tx) => {

            let mailboxes_collection = tx.collection(this.collection_name("mailboxes")); 
            let messages_collection = tx.collection(this.collection_name("messages"));
            let conversations_collection = tx.collection(this.collection_name("conversations"));

            // Delete all mailboxes
            let r = await mailboxes_collection.deleteMany({});
            this.info && this.info(` - deleted ${r.deletedCount} mailboxes`);
            
            // Delete all messages
            r = await messages_collection.deleteMany({});
            this.info && this.info(` - deleted ${r.deletedCount} messages`);
            
            // Delete all conversations
            r = await conversations_collection.deleteMany({});
            this.info && this.info(` - deleted ${r.deletedCount} conversations`);
        });

    }

    async dropAllConversations()
    {
        await Database.transaction(async (tx) => {
            
            let messages_collection = tx.collection(this.collection_name("messages"));
            let conversations_collection = tx.collection(this.collection_name("conversations"));

            // Delete all conversations
            let r = await conversations_collection.deleteMany({});
            this.info && this.info(`Deleted ${r.deletedCount} conversations`);
            
            // Purge deleted messages
            r = await messages_collection.deleteMany({ state: { $lt: 0 } } );
            this.info && this.info(`Purged ${r.deletedCount} deleted messages`);
            
            // Mark all messages as modified
            r = await messages_collection.updateMany({}, {$set: { state: 0 } } );
            this.info && this.info(`Cleaned ${r.modifiedCount} added messages`);
        });
    }

    async getConversations(messages)
    {
        if (!Array.isArray(messages))
            messages = [ messages ];

        // Get collections
        let mcoll = Database.db.collection(this.collection_name("messages"));
        let ccoll = Database.db.collection(this.collection_name("conversations"));

        // Convert messages to a set for fast removal
        let message_set = new Set(messages);

        // Start by handling all the message ids for which
        // we already have a conversation built
        let found_conversations = new Map();
        await ccoll.find({ message_ids: { $in: messages } }).forEach(c => {

            // Store found
            found_conversations.set(c._id, c);

            // Delete handled message ids
            for (let mid of c.message_ids)
                message_set.delete(mid);

        });

        // Setup found result
        let result = [...found_conversations.values()];

        // All found?
        if (message_set.size == 0)
            return result;

        // Setup group builds
        let gb = new GroupBuilder();
        gb.onMergeGroups = function(newGroup, oldGroup)
        {
            if (newGroup.flags !== undefined)
                newGroup.flags |= oldGroup.flags;
            else
                newGroup.flags = oldGroup.flags;
        }

        // Build conversations for any other messages
        let processedMessages = new Set();
        let messageIdToMailboxMap = new MultiValueMap();
        messages = Array.from(message_set);
        while (messages.length)
        {
            // Keep track of already processed messages
            for (let m of messages)
            {
                processedMessages.add(m);
            }

            // Clear the current message list
            let newMessages = [];

            await mcoll.find({ 
                $or: [
                    { message_id: { $in: messages } },
                    { references: { $in: messages } }
                ]
            }).forEach((m) => {

                // Cache it
                messageIdToMailboxMap.add(m.message_id, m);

                // Add message to the group
                let group = gb.add(m.message_id, m.references);

                // Track group flags
                group.flags |= m.flags;

                // For any reference that we see for the first time, need to recurse
                if (m.references)
                {
                    for (let r of m.references)
                    {
                        if (!processedMessages.has(r))
                        {
                            newMessages.push(r);
                            processedMessages.add(r);
                        }
                    }
                }

                if (!processedMessages.has(m.message_id))
                {
                    newMessages.push(m.message_id);
                    processedMessages.add(m.message_id);
                }

            });

            // Switch to the new collection
            messages = newMessages;
        }

        // Update the result with the new groups
        let newConversations = [];
        for (var g of gb.groups)
        {
            // Look up the message for each message id
            let messages = [];
            for (let mid of g)
            {
                // Get the known messages for this id
                let msgs = messageIdToMailboxMap.get(mid);
                if (msgs)
                    messages.push(msgs[0]); // just use the first
            }
            
            // Sort by date
            messages.sort((a,b) => a.date - b.date);

            // Get the last message
            let lastMessage = messages[messages.length-1];

            // Create conversation
            let conv = {
                conversation_id: messages[0].message_id,
                date: lastMessage.date,
                subject: lastMessage.subject,
                message_ids: messages.map(x => x.message_id),
                flags: g.flags,
            }

            // Add conversation to result
            newConversations.push(conv);
            result.push(conv);
        }

        // Store new conversations
        if (newConversations.length)
        {
            await ccoll.insertMany(newConversations);
        };
    
        // Done!
        return result;
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


}



module.exports = Account;