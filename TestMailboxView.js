const assert = require('assert');
const MailboxView = require('./lib/MailboxView');
const TestSuite = require("./TestSuite")

function dump_view(view)
{
    for (let c of view.conversations)
    {
        console.log(`Conversation: id: ${c.conversation_id} subject: '${c.subject}' flags: ${c.flags}`);
        for (let m of c.message_ids)
        {
            console.log(` - ${m}`);
        }
    }
    console.log()
}

new TestSuite().run(async (ts) => {

    ts.quiet(true);

    // Create some messages
    console.log('\n--- Adding initial message ---');
    await ts.createMessage("testbox", 1);
    await ts.createMessage("testbox", 2, [1]);
    await ts.sync();

    // Create mailbox view
    console.log('\n--- Creating Mailbox View ---');
    let v = new MailboxView(ts.account, "testbox");
    await v.open();
    dump_view(v);

    console.log('\n--- Adding a message ---');
    await ts.createMessage("testbox", 3);
    await ts.sync();
    dump_view(v);

    console.log('\n--- Adding a message to existing conversation ---');
    await ts.createMessage("testbox", 4, [2]);
    await ts.sync();
    dump_view(v);

    console.log('\n--- Combining all conversations ---');
    await ts.createMessage("testbox", 5, [1,2,3,4]);
    await ts.sync();
    dump_view(v);

    console.log('\n--- Flagging messages ---');
    await ts.imap.openBox("testbox", false);
    await ts.imap.addFlags(ts.uidof("testbox", 1), "\\Flagged");
    await ts.imap.addFlags(ts.uidof("testbox", 2), "\\Seen");
    await ts.sync();
    dump_view(v);

    // Close view
    v.close();

});
