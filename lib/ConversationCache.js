const MultiValueMap = require("./MultiValueMap");
const Database = require('./Database');
const GroupBuilder = require("./GroupBuilder");


class ConversationCache
{
    // Constructor
    constructor(account)
    {
        this.account = account;
        this.account.sync_notify = this;
        this.clear();
    }

    // Clear entire cache
    clear()
    {
        // Map of message-id to conversation
        this.messageIdToConversationMap = new Map();

        // Map of message-id to known mailbox locations
        this.messageIdToMailboxMap = new MultiValueMap();
    }

    // Get conversations for a set of messages
    async getConversations(messages)
    {
        let result = [];

        // Start by handling all the message ids for which
        // we already have a conversation built
        for (let i=messages.length-1; i>=0; i--)
        {
            let conv = this.messageIdToConversationMap.get(i);
            if (conv)
            {
                result.push(conv);
                messages.slice(i, 1);
            }
        }

        // Build conversations for any other messages
        let gb = new GroupBuilder();
        let processedMessages = new Set();
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
            let mcoll = Database.db.collection(this.account.messages_collection_name);
            await mcoll.find({ 
                $or: [
                    { message_id: { $in: messages } },
                    { references: { $in: messages } }
                ]
            }).forEach((m) => {

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

        // Merge the new groups
        for (var [m,g] of gb.groupsById)
        {
            this.messageIdToConversationMap.set(m,g);
        }

        // Update the result with the new groups
        for (var g of gb.groups)
        {
            result.push(g);
        }

        return result;
    }

    // Remove a conversation
    remove_converstaion(message)
    {
        // get the conversation
        let conv = this.messageIdToConversationMap.get(message);

        // if it exists remove it for all message ids in the conversation
        if (conv)
        {
            for (let m of conv.messages)
            {
                this.messageIdToConversationMap.delete(m);
            }
        }
    }

    // Trim cache of a set of messages
    trim_cache(messages, keepMailboxMap)
    {
        for (let m of messages)
        {
            this.remove_converstaion(m);

            if (!keepMailboxMap)
            {
                this.messageIdToMailboxMap.delete(m);
            }
        }
    }

    // Notify of sync start
    sync_start()
    {
        this.added_messages = new Set();
        this.deleted_messages = new Set();
        this.flagged_messages = new Set();
    }

    // Notify of sync end
    sync_finish()
    {
        // Remove any messages that were added from the deleted message set (they were probably 
        // moved not actually deleted)
        this.deleted_messages = new Set([...this.deleted_messages].filter(x=>this.added_messages.has(x)));

        // Trim caches
        this.trim_cache(this.added_messages);
        this.trim_cache(this.deleted_messages);
        this.trim_cache(this.flagged_messages, true);

        // Clean up
        delete this.added_messages;
        delete this.deleted_messages;
        delete this.flagged_messages;
    }

    // Notify of sync error
    sync_error()
    {
        // Clear entire cache
        this.clear();

        // Clean up
        delete this.added_messages;
        delete this.deleted_messages;
        delete this.flagged_messages;
    }

    // Notify of message added
    message_added(mid)
    {
        this.added_messages.add(mid);
    }

    // Noitfy of message deleted
    message_deleted(mid)
    {
        this.deleted_messages.add(mid);
    }

    // Notify of message flagged
    message_flagged(mid)
    {
        this.flagged_messages.add(mid);
    }
}

module.exports = ConversationCache;