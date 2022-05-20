const Imap = require('../imap_promise');
const data = require('../data');
const utils = require('../utils');
const User = require('../User');
const assert = require('assert');

class TestAccount
{
    constructor()
    {
        // Create config
        this.config = {
            user: 'test-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
            password: 'pass',
            host: 'localhost',
            port: 44143,
            tls: false,
            //debug: console.log
        }

        // Create Imap connection
        this.imap = new Imap(this.config);

        // Create User object
        this.sync_user = new User(this.config);

        this.nextMessageIndex = 0;
    }

    get user()
    {
        return this.config.user;
    }

    connect()
    {
        return this.imap.connect();
    }

    disconnect()
    {
        return this.imap.end();
    }

    createMessage(from, to, subject, body, mailbox)
    {

        let message = 
`MIME-Version: 1.0
From: ${from}
To: ${to}
Subject: ${subject}
Date: ${utils.format_email_date(new Date())}
Message-ID: <msg_${Date.now()}_${Math.floor(Math.random() * 10000)}@box.com>

${body}
`;
        
        return this.imap.append(message, { 
            mailbox: mailbox ?? "INBOX"
        });
    }

    createMessageQuick()
    {
        this.nextMessageIndex++;
        return this.createMessage(
                "sender@domain.com", 
                "receiver@domain.com", 
                `Message #${this.nextMessageIndex++}`,
                `This is the body of message #${this.nextMessageIndex++}`
                )
    }

    async sync()
    {
        await this.sync_user.load();
        await this.sync_user.open();
        await this.sync_user.sync();
        await this.sync_user.close();
    }

    async checkIntegrity()
    {
        let boxes = await this.imap.getBoxes();
        for (let [k,v] of Object.entries(boxes))
        {
            await this.checkMailboxIntegrity(k);
        };
    }

    async checkMailboxIntegrity(mailbox)
    {
        // Get db mailbox
        let db_mailbox = await data.db.collection("mailboxes").findOne({
            user: this.config.user,
            host: this.config.host,
            name: mailbox
        });

        // Get imap mailbox
        let imap_mailbox = await this.imap.openBox(mailbox, true);

        assert.equal(db_mailbox.uidnext, imap_mailbox.uidnext);
        assert.equal(db_mailbox.uidvalidity, imap_mailbox.uidvalidity);
        assert.equal(db_mailbox.highestmodseq, imap_mailbox.highestmodseq);

        // Get db messages
        let db_messages = await data.db.collection(this.sync_user.collection_name("messages")).find({
            mailbox: mailbox, 
        }).sort({ uid: 1}).toArray();

        // Get imap messages
        let imap_messages = await this.imap.fetchHeaders("1:*", 
            {
                bodies: 'HEADER.FIELDS (DATE SUBJECT MESSAGE-ID REFERENCES IN-REPLY-TO)',
            });

        // Same message count
        assert.equal(db_messages.length, imap_messages.length);

        // Check the critical info about all messages match
        for (let i=0; i<db_messages.length; i++)
        {
            let imap_message = imap_messages[i];
            let db_message = db_messages[i];

            assert.equal(imap_message.attributes.uid, db_message.uid);
            
            assert.equal(utils.clean_message_id(imap_message.headers), db_message.message_id);
            assert.deepEqual(utils.clean_references(imap_message.headers), db_message.references);
            assert.equal(imap_message.attributes.flags.indexOf('\\Seen') < 0, !!db_message.unread);
            assert.equal(imap_message.attributes.flags.indexOf('\\Flagged') >= 0, !!db_message.important);
        }
    }

}

module.exports = TestAccount;