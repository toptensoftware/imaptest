
class Conversation
{
    constructor(messages)
    {
        this.messages = messages;
    }

    get id()
    {
        return this.messages[0][0].message.message_id;
    }

    get date()
    {
        return this.messages[this.messages.length-1][0].message.date;
    }

}

module.exports = Conversation;