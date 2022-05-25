const assert = require("assert");
const Utils = require("./Utils");
const Database = require('./Database');

class MessageInfo
{
    constructor(mid)
    {
        this.message_id = mid;          // message-id
        this.conversation = null;       // Conversation
        this.messages = [];             // [DB message]
    }
}

class MailboxView
{
    constructor(account, mailbox)
    {
        this.account = account;
        this.mailbox = mailbox;
        this.midMap = new Map();        // mid => MessageInfo
        this.convMap = new Map();       // cid => Conversation
        this.convList = [];             // [Conversation]
    }

    // called from Account each time opened
    async open()
    {
        // Get messages collection
        let mcoll = Database.db.collection(this.account.collection_name("messages"));
        await mcoll.find({mailbox: this.mailbox}).forEach((m) => {
            this.addMessage(m);
        });

        // Build conversations
        await this.buildConversations();

        // Set self as a listener
        this.account.addListener(this);
    }

    // Close it
    close()
    {
        this.account.removeListener(this);
        delete this.account;
        delete this.mailbox;
        delete this.midMap;
        delete this.convMap;
        delete this.convList;
    }

    // Get (or create) the message info for a specified message id
    getMessageInfo(mid, create)
    {
        // Get the message info
        let mi = this.midMap.get(mid);
        if (!mi)
        {
            if (!create)
                return null;
            mi = new MessageInfo(mid);
            this.midMap.set(mid, mi);
        }

        return mi;
    }

    // Add a message object to this view
    addMessage(message)
    {
        // Get message info
        let mi = this.getMessageInfo(message.message_id, true);

        // Add the message
        mi.messages.push(message);
    }

    // Remove a message object from this view
    removeMessage(message)
    {
        // Get the message info
        let mi = this.getMessageInfo(message.message_id, false);
        if (!mi)
            return;

        // Find the removed message in list
        let index = mi.findIndex(x => x.uid == message.uid);
        if (index >= 0)
            mi.messages.splice(index, 1);

        // Remove the message info if no longer needs
        if (mi.conversation == null && mi.messages.length == 0)
        {
            this.midMap.delete(message.message_id);
        }
    }

    // Add a conversation to this view
    addConversation(conv)
    {
        // Associate this conversation with all its message ids
        for (let i=0; i<conv.message_ids.length; i++)
        {
            let mi = this.getMessageInfo(conv.message_ids[i], false);
            if (mi != null)
                mi.conversation = conv;
        }

        // Add to conversation map
        this.convMap.set(conv.conversation_id, conv);

        // Add to conversation list
        this.convList.sortedInsert(conv, x => Utils.compare_conversations(x, conv));
    }

    // Remove a conversation from this view
    removeConversation(conversation_id)
    {
        // Remove it
        let conv = this.convMap.get(conversation_id);
        if (conv == null)
            return false;

        // Remove from map
        this.convMap.delete(conversation_id);

        // Disassociate this conversation with all its message ids
        // Associate this conversation with all its message ids
        for (let i=0; i<conv.message_ids.length; i++)
        {
            let mi = this.getMessageInfo(conv.message_ids[i], false);
            if (mi != null)
            {
                mi.conversation = null;
                if (mi.messages.length == 0)
                {
                    this.midMap.delete(message.message_id);
                }
            }
        }

        // Remove from conversation list
        let i = this.convList.findIndexBinary(x => Utils.compare_conversations(x, conv));
        assert(i >= 0);
        assert(this.convList[i].conversation_id == conversation_id);
        this.convList.splice(i, 1);
        return true;
    }

    async onSynchronize(sync_info)
    {
        // Add messages from this mailbox
        for (let m of sync_info.added_messages)
        {
            if (m.mailbox == this.mailbox)
                this.addMessage(m);
        }

        // Remove deleted messages
        for (let m of sync_info.deleted_messages)
        {
            if (m.mailbox == this.mailbox)
            {
                this.removeMessage(m);
            }
        }

        // Ignore modified messages (we'll notice these changes via the conversation changes)
        for (let cid of sync_info.affected_conversations)
        {
            this.removeConversation(cid);
        }

        // Build missing conversations
        await this.buildConversations();
    }

    async buildConversations()
    {
        // Build a list of messages that are in the folder, but don't have
        // a conversations associated with them
        let unmapped_mids = [];
        for (let mi of this.midMap.values())
        {
            if (mi.conversation == null)
                unmapped_mids.push(mi.message_id);
        }

        // Build conversations and associate...
        if (unmapped_mids.length > 0)
        {
            let conversations = await this.account.getConversations(unmapped_mids);
            for (let c of conversations)
            {
                this.addConversation(c);
            }
        }
    }

    get conversations()
    {
        return this.convList;
    }

    /*
    fetchUpdates()
    {
        // Get difference since the last fetch...
        let diff = Utils.generate_diff(this.delivered_conversations, this.convList, (a, b) => {
            
            // Do default compare
            let compare = Utils.compare_conversations(a,b);

            // If same, check for modification
            if (compare == 0)
            {
                if (this.modifiedConversations.has(a.conversation_id))
                    return null;
                else
                    return 0;
            }

            return compare;
        });

        // Annotate the diff with the actual annotation objects
        for (let e of diff)
        {
            switch (e.op)
            {
                case 'i':
                    e.conversation = this.convList[e.ni];
                    break;

                case 'u':
                    e.conversation = this.convList[e.ni];
                    e.old_conversation = this.delivered_conversations[e.oi];
                    break;

                case 'd':
                    e.conversation = this.delivered_conversations[e.oi];
                    break;
            }
        }

        // Remember what we've sent
        this.delivered_conversations = [...this.convList];
        this.modifiedConversations.clear();

        // Done!
        return diff;
    }
    */
}

module.exports = MailboxView;