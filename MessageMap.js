const utils = require('./utils');

class MessageMap
{
    constructor()
    {
        this._map = new Map();
    }

    get size()
    {
        return this._map.size;
    }

    get(message_id)
    {
        return this._map.get(message_id);
    }

    add(message_id, mbm)
    {
        let msglist = this._map.get(message_id);
        if (msglist === undefined)
        {
            msglist = [];
            this._map.set(message_id, msglist);
        }
        msglist.push(mbm);
    }

    remove(message_id, message)
    {
        // Get the message list
        let msglist = this._map.get(message_id);

        // Remove the message from the array
        if (utils.inplace_filter(msglist, x => x.message != message))
        {
            if (msglist.length == 0)
                this._map.delete(message_id);
        }
    }

    removeMailbox(mailbox)
    {
        // Remove all messages from this mailbox
        for (let [message_id, msglist] of this._map)
        {
            // Filter the list of associated messages
            if (utils.inplace_filter(msglist, x => x.mailbox != mailbox))
            {
                // If the list is empty, remove it
                if (msglist.length == 0)
                    this._map.delete(message_id);
            }
        }
    }
}

module.exports = MessageMap;
