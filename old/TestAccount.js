const Imap = require('../lib/ImapPromise');
const Database = require('../lib/Database');
const Utils = require('../lib/Utils');
const Account = require('../lib/Account');

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
            tls: false
        }

        // Create Imap connection
        this.imap = new Imap(this.config);

        // Create User object
        this.account = new Account(this.config);

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

    createMessage(mailbox, id, refs)
    {
        // Work out headers
        let headers = {
            "MIME-Version": "1.0",
            "From": "sender@box.com",
            "To": "receiver@box.com",
            "Subject": `Message #${id}`,
            "Date": utils.format_email_date(new Date()),
            "Message-ID": `<msg_${id}@box.com>`,
        }
        if (refs)
        {
            headers["References"] = refs.map(x => `<msg_${x}@box.com>`).join(',');
        }

        // Build full message
        let msg = "";
        for (let [k,v] of headers)
        {
            msg += `${k}: ${v}\n`;
        }

        // Create message body (which includes a copy of the headers for easy checking)
        msg += `\nMessage #${id}\n\n` + msg;
        
        // Save the message
        return this.imap.append(msg, { 
            mailbox: mailbox
        });
    }

    async sync()
    {
        await this.account.load();
        await this.account.open();
        await this.account.sync();
        await this.account.close();
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
        let db_messages = await data.db.collection(this.account.collection_name("messages")).find({
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
            
            assert.equal(Utils.clean_message_id(imap_message.headers), db_message.message_id);
            assert.deepEqual(Utils.clean_references(imap_message.headers), db_message.references);
            assert.equal(Utils.message_flags_mask(imap_message.attributes), db_message.flags);
        }
    }

}

module.exports = TestAccount;