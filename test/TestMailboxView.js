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

    function check_view(view, expected_conversations)
    {
        dump_view(view);

        assert.equal(view.conversations.length,  expected_conversations.length);
        for (let i=0; i<expected_conversations.length; i++)
        {
            let vc = view.conversations[i];
            let ec = expected_conversations[i];
    
            assert.equal(vc.conversation_id, ts.make_message_id(ec.id));
            assert.equal(vc.flags, ec.flags);

            let expected_messages = ec.messages;
            assert(vc.message_ids.length == expected_messages.length);
            for (let j=0; j<expected_messages.length; j++)
            {
                assert.equal(vc.message_ids[j], ts.make_message_id(expected_messages[j]))
            }
        }
    }
    

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

    check_view(v, [ 
        { id: 1, flags: 2, messages: [ 1, 2] }
    ]);

    console.log('\n--- Adding a message ---');
    await ts.createMessage("testbox", 3);
    await ts.sync();

    check_view(v, [
        { id: 3, flags: 2, messages: [ 3 ] },
        { id: 1, flags: 2, messages: [ 1, 2 ] } 
    ]);

    console.log('\n--- Adding a message to existing conversation ---');
    await ts.createMessage("testbox", 4, [2]);
    await ts.sync();

    check_view(v, [
        { id: 1, flags: 2, messages: [ 1, 2, 4] }, 
        { id: 3, flags: 2, messages: [ 3 ] }
    ]);

    console.log('\n--- Combining all conversations ---');
    await ts.createMessage("testbox", 5, [1,2,3,4]);
    await ts.sync();

    check_view(v, [
        { id: 1, flags: 2, messages: [ 1, 2, 3, 4, 5] }
    ]);


    console.log('\n--- Flagging messages ---');
    await ts.imap.openBox("testbox", false);
    await ts.imap.addFlags(ts.uidof("testbox", 1), "\\Flagged");
    await ts.imap.addFlags(ts.uidof("testbox", 2), "\\Seen");
    await ts.sync();

    check_view(v, [
        { id: 1, flags: 3, messages: [ 1, 2, 3, 4, 5] }
    ]);


    // Close view
    v.close();

});
