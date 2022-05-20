const MultiValueMap = require("./MultiValueMap");
const Database = require('./Database');
const GroupBuilder = require("./GroupBuilder");
const Utils = require("./Utils");


class ConversationCache
{
    // Constructor
    constructor(account)
    {
        this.account = account;
        this.account.sync_notify = this;
    }

    // Get conversations for a set of messages
    async getConversations(messages)
    {
        let mcoll = Database.db.collection(this.account.collection_name("messages"));
        let ccoll = Database.db.collection(this.account.collection_name("conversations"));

        // Start by handling all the message ids for which
        // we already have a conversation built
        let found_conversations = new Map();
        await Utils.batch_work(messages, 500, async (batch) => {

            await ccoll.find({ message_ids: { $in: batch } }).forEach(c => {
                found_conversations.set(c._id, c);
            });

            debugger;

        });

        let result = [...found_conversations.values()];

        /*
        for (let i=messages.length-1; i>=0; i--)
        {
            let conv = this.messageIdToConversationMap.get(i);
            if (conv)
            {
                result.push(conv);
                messages.slice(i, 1);
            }
        }
        */

        // Build conversations for any other messages
        let gb = new GroupBuilder();
        let processedMessages = new Set();
        let messageIdToMailboxMap = new MultiValueMap();
        while (messages.length)
        {
            // Keep track of already processed messages
            for (let m of messages)
            {
                processedMessages.add(m);
            }

            // Clear the current message list
            let newMessages = [];

            // Next get all messages related to those asked for
            await mcoll.find({ 
                $or: [
                    { message_id: { $in: messages } },
                    { references: { $in: messages } }
                ]
            }).forEach((m) => {

                // Cache it
                messageIdToMailboxMap.add(m.message_id, m);

                // Add message to the group
                gb.add(m.message_id, m.references);

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
            });

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
            messages.sort(x => x.date);

            // Get the last message
            let lastMessage = messages[messages.length-1];

            // Create conversation
            let conv = {
                date: lastMessage.date,
                subject: lastMessage.subject,
                message_ids: messages.map(x => x.message_id),
            }

            // Add conversation to result
            newConversations.push(conv);
            result.push(conv);
        }

        // Store new conversations
        if (newConversations.length)
        {
            await ccoll.insertMany(
                newConversations
            )
        };

        // Done!
        return result;
    }

    // Notify of sync start
    sync_start()
    {
        this.added_messages = new Map();
        this.deleted_mids = new Set();
        this.flagged_mids = new Set();
    }

    // Notify of sync end
    async sync_finish(tx)
    {
        // Remove any messages that were both added and removed
        for (let delmid of this.deleted_mids)
        {
            if (this.added_messages.has(delmid))
            {
                this.deleted_mids.delete(delmid);
                this.added_messages.delete(delmid);
            }
        }

        // Work out the full set of affect messages

        // Added messages
        let affected_mids = new Set();
        for (let [k,v] of this.added_messages)
        {
            // The added message id
            affected_mids.add(k);

            // Also need to rebuild any conversations that the new
            // messages reference
            if (v.references)
            for (let r of v.references)
                affected_mids.add(r);
        }

        // Deleted messages
        for (let mid of this.deleted_mids)
        {
            affected_mids.add(mid);
        }

        // Flagged messages
        for (let mid of this.flagged_mids)
        {
            affected_mids.add(mid);
        }

        // Delete the affected conversations
        let ccoll = tx.collection(this.account.collection_name("conversations"));
        await Utils.batch_work([...ccoll], 500, (batch) => {

            return ccoll.deleteMany({ 
                message_ids: { $in: batch } 
            });

        });


        // Clean up
        delete this.added_messages;
        delete this.deleted_mids;
        delete this.flagged_mids;
    }

    // Notify of sync error
    sync_error()
    {
        // Clear entire cache
        this.clear();

        // Clean up
        delete this.added_messages;
        delete this.deleted_mids;
        delete this.flagged_mids;
    }

    // Notify of message added
    message_added(msg)
    {
        this.added_messages.add(msg.message_id, msg);
    }

    // Noitfy of message deleted
    message_deleted(mid)
    {
        this.deleted_mids.add(mid);
    }

    // Notify of message flagged
    message_flagged(mid)
    {
        this.flagged_mids.add(mid);
    }
}

module.exports = ConversationCache;