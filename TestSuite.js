const assert = require('assert');

const Database = require('./lib/Database');
const Utils = require('./lib/Utils');
const Imap = require('./lib/IMapPromise');
const Account = require('./lib/Account');

let config = {
    user: 'testSuite',
    password: 'pass',
    host: 'localhost',
    port: 44143,
    tls: false,
    db_server: "mongodb://localhost:44017/?directConnection=true", 
    db_name: "testsuite",
    db_base_collection_name: "testsuite",
    info: console.log,
    //debug: console.log
};

class TestSuite
{
    constructor()
    {
        this._mbMap = new Map();
        this._message_date = Date.now();
        this.qdepth = 0;
    }
    async run(callback)
    {
        console.log("Running Test Suite...");

        try
        {
            let start = Date.now();

            await this.init();

            await callback(this);

            console.log(`\nTest suit finished in ${Date.now() - start} ms.`)
        }
        finally
        {
            await this.finish();
        }
    }

    async init()
    {
        // Open database
        console.log("Opening database");
        await Database.open(config);
        
        // Open IMAP
        console.log("Connecting IMAP")
        this.imap = new Imap(Object.assign({}, config, {
            //debug: console.log
        }));
        await this.imap.connect();
        
        // Clean up IMAP
        console.log(`Opening and cleaning IMAP account`);
        let boxes = await this.imap.getBoxes();
        for (let b of Object.keys(boxes))
        {
            if (b != "INBOX")
            {
                console.log(` - deleting mailbox '${b}'`)
                await this.imap.delBox(b);
            }
        }

        // Create test mailboxes
        console.log("Creating mailboxes");
        await this.imap.addBox("testbox");
        await this.imap.addBox("archive");

        // Create db account
        console.log(`Opening and cleaning DB account`);
        this.account = new Account(config);
        await this.account.open();
        await this.account.dropEverything();

        // Initial empty state sync
        await this.syncAndCheck();
    }

    async finish()
    {
        await this.account?.close();
        await this.imap?.end();
        await Database.close();
    }
    
    getCollection(name)
    {
        return Database.db.collection(this.account.collection_name(name));
    }
    
    make_message_id(id)
    {
        return `msg_${id}@box.com`;
    }
    
    // Create a test messages
    async createMessage(mailbox, id, refs)
    {
        // Work out headers
        let headers = {
            "MIME-Version": "1.0",
            "From": "sender@box.com",
            "To": "receiver@box.com",
            "Subject": `Message #${id}`,
            "Date": Utils.format_email_date(new Date(this._message_date + id * 5000)),
            "Message-ID": `<${this.make_message_id(id)}>`,
        }
        if (refs)
        {
            headers["References"] = refs.map(x => `<${this.make_message_id(x)}>`).join(',');
        }
    
        // Build full message
        let msg = "";
        for (let [k,v] of Object.entries(headers))
        {
            msg += `${k}: ${v}\n`;
        }
    
        // Create message body (which includes a copy of the headers for easy checking)
        msg += `\nMessage #${id}\n\n` + msg;
        
        // Save the message
        let uid = await this.imap.append(msg, { 
            mailbox: mailbox
        });

        this.getMidMap(mailbox).set(id, uid);

        return uid;
    }

    getMidMap(mailbox)
    {
        let map = this._mbMap.get(mailbox);
        if (!map)
        {
            map = new Map();
            this._mbMap.set(mailbox, map);
        }
        return map;
    }

    uidof(mailbox, id)
    {
        let uid = this.getMidMap(mailbox).get(id);
        assert(uid)
        return uid;
    }
    
    async deleteMessage(mailbox, uid)
    {
        await this.imap.openBox(mailbox, false);
        await this.imap.setFlags(uid, '\\Deleted');
        await this.imap.expunge();
    }
    
    async checkMailboxIntegrity(mailbox)
    {
        // Get db mailbox
        let db_mailbox = await this.getCollection("mailboxes").findOne({
            name: mailbox
        });
    
        // Get imap mailbox
        let imap_mailbox = await this.imap.openBox(mailbox, false);
    
        assert.equal(db_mailbox.uidnext, imap_mailbox.uidnext);
        assert.equal(db_mailbox.uidvalidity, imap_mailbox.uidvalidity);
        assert.equal(db_mailbox.highestmodseq, imap_mailbox.highestmodseq);
    
        // Get db messages
        let db_messages = await this.getCollection("messages").find({
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
            assert.equal(Utils.message_flags_mask(imap_message.attributes.flags), db_message.flags);
        }
        console.log(`Mailbox '${mailbox}' passed integrity check.`);
    }

    quiet(q)
    {
        if (q)
        {
            this.qdepth++;
            if (this.qdepth == 1)
            {
                this.save_output = this.account.info;
                this.account.info = null;
            }
        }
        else
        {
            this.qdepth--;
            if (this.qdepth == 0)
            {
                this.account.info = this.save_output;
                delete this.save_output;
            }
        }

    }

    async sync()
    {
        await this.account.sync();
    }
    
    async syncAndCheck()
    {
        await this.account.sync();
    
        // Get IMAP boxes
        let imap_boxes = Object.keys(await this.imap.getBoxes());
        imap_boxes.sort();
    
        // Get DB boxes
        let db_boxes = [...this.account.mailboxes.keys()];
        db_boxes.sort();
    
        // Should be the same
        assert.deepEqual(imap_boxes, db_boxes);
    
        // Validate all boxes
        for (let b of imap_boxes)
        {
            await this.checkMailboxIntegrity(b);
        }
    }

    async checkConversation(msgid, conv_id, msg_ids)
    {
        // Get the conversation object
        let convs = await this.getCollection("conversations").find({
            conversation_id: this.make_message_id(conv_id),
        }).toArray();

        // The must be exactly one conversation
        assert.equal(convs.length, 1);
        let conv = convs[0];

        // Check message ids match
        assert.deepEqual(conv.message_ids, msg_ids.map(x => this.make_message_id(x)));

        // Check messages
        let flags = 0;
        await this.getCollection("messages").find(
            { message_id: { $in: conv.message_ids } }
        ).forEach(x => {

            // Check message has correct conversation id
            assert.equal(x.conversation_id, this.make_message_id(conv_id));

            // Track flags
            flags |= x.flags
        });
        assert.equal(conv.flags, flags);

        // Check there are no messages with this conversation id that aren't in the conversation
        let bad_messages = await this.getCollection("messages").find({
            conversation_id: { conv_id },
            message_id: { $not: { $in: conv.message_ids } } 
        }).toArray();
        assert.equal(bad_messages.length, 0);
    }
}

module.exports = TestSuite;

