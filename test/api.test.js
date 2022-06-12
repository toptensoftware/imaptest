const ListPatch = require('../lib/ListPatch.js');
const TestSuite = require('./TestSuite.js');

test('Mailboxes', async () => {

    return new TestSuite().run(async (ts) => {
        
        await ts.createMessage("testbox", 1);
        await ts.createMessage("testbox", 2);
        await ts.sync();

        let mailboxes = await ts.account.get_mailboxes();

        expect(mailboxes).toMatchObject({
            mailboxes: [
                { name: 'Inbox', count_unread: 0 },
                { name: 'archive', count_unread: 0 },
                { name: 'testbox', count_unread: 2 },
            ]
        });
        expect(mailboxes.mrev).toBeTruthy();

    });
});

test('Mailboxes mrev number kept across sync', async () => {

    return new TestSuite().run(async (ts) => {
        
        await ts.sync();
        let mailboxes1 = await ts.account.get_mailboxes();

        await ts.sync();
        let mailboxes2 = await ts.account.get_mailboxes();

        expect(mailboxes1.mrev).toEqual(mailboxes2.mrev);

    });
});

test('Mailboxes mrev changes when data changes', async () => {

    return new TestSuite().run(async (ts) => {
        
        await ts.sync();
        let mailboxes1 = await ts.account.get_mailboxes();

        await ts.createMessage("testbox", 1);

        await ts.sync();
        let mailboxes2 = await ts.account.get_mailboxes();

        expect(mailboxes1.mrev).not.toEqual(mailboxes2.mrev);

    });
});

test('Mailboxes since_mrev when no changes', async () => {

    return new TestSuite().run(async (ts) => {
        
        await ts.sync();
        let mailboxes1 = await ts.account.get_mailboxes();

        await ts.sync();
        let mailboxes2 = await ts.account.get_mailboxes({since_mrev: mailboxes1.mrev});

        expect(mailboxes2.delta_mailboxes).toMatchObject([]);

    });
});

test('Mailboxes since_mrev when changes', async () => {

    return new TestSuite().run(async (ts) => {

        // Get original mailbox list
        await ts.sync();
        let mailboxes1 = await ts.account.get_mailboxes();

        // Make a change
        await ts.createMessage("testbox", 1);

        // Get the detla
        await ts.sync();
        let mailboxes2 = await ts.account.get_mailboxes({since_mrev: mailboxes1.mrev});

        // Apply the delta
        ListPatch.apply_list_patch(mailboxes1.mailboxes, mailboxes2.delta_mailboxes);
        mailboxes1.mrev = mailboxes2.mrev;

        // Check it matches
        let expected = await ts.account.get_mailboxes();
        expect(mailboxes1).toEqual(expected);

    });
});

test('Conversations', async () => {

    return new TestSuite().run(async (ts) => {
        
        // Create two unrelated messages
        await ts.createMessage("testbox", 1);
        await ts.createMessage("testbox", 2);
        await ts.sync();

        let convs = await ts.account.get_conversations({mailbox: "testbox"});

        expect(convs).toMatchObject({
            conversations: [
                { subject: 'Message #2', flags: 2 },
                { subject: 'Message #1', flags: 2 },
            ],
            skipped: 0,
            taken: 2,
        });
        expect(convs.crev).toBeTruthy();

    });
});

test('Conversations (delta)', async () => {

    return new TestSuite().run(async (ts) => {
        
        // Create initial set of messages
        await ts.createMessage("testbox", 1);
        await ts.createMessage("testbox", 2);
        await ts.sync();
        let convs1 = await ts.account.get_conversations({mailbox: "testbox"});

        // Create some new messages
        await ts.createMessage("testbox", 3);
        await ts.createMessage("testbox", 4);
        await ts.sync();

        // Get delta
        let convs2 = await ts.account.get_conversations({mailbox: "testbox", since_crev: convs1.crev});
        expect(convs2.delta_conversations.length).toEqual(1);

        // Patch convs1
        let convsFinal = Object.assign({}, convs2);
        delete convsFinal.delta_conversations;
        ListPatch.apply_list_patch(convs1.conversations, convs2.delta_conversations);
        convsFinal.conversations = convs1.conversations;

        // Get the expected conversations
        let expected = await ts.account.get_conversations({mailbox: "testbox"});

        // Check matches
        delete convsFinal.crev;
        delete expected.crev;
        expect(convsFinal).toEqual(expected);

    });
});
