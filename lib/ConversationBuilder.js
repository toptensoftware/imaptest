const MultiValueMap = require("./MultiValueMap");
const Database = require('./Database');
const GroupBuilder = require("./GroupBuilder");
const Utils = require("./Utils");


class ConversationBuilder
{
    // Get conversations for a set of messages
    static async getConversations(account, messages)
    {
        // Get collections
        let mcoll = Database.db.collection(account.collection_name("messages"));
        let ccoll = Database.db.collection(account.collection_name("conversations"));

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

        // Build conversations for any other messages
        let gb = new GroupBuilder();
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
            await ccoll.insertMany(newConversations);
        };
    
        // Done!
        return result;
    }
}

module.exports = ConversationBuilder;