const TestSuite = require('./TestSuite.js');
const SQL = require('../lib/SQL');

test('Synchronize Messages to DB', async () => {

    return new TestSuite().run(async (ts) => {

        // Create initial messages
        await ts.createMessage("testbox", 1);
        await ts.createMessage("testbox", 2);
        await ts.createMessage("testbox", 3);
        await ts.createMessage("testbox", 4);
        await ts.syncAndCheck();
    
        // Add another message
        await ts.createMessage("testbox", 5);
        await ts.syncAndCheck();
    
        // Delete a message
        await ts.deleteMessage("testbox", ts.uidof("testbox", 5));
        await ts.syncAndCheck();
    
        // Flag a message
        await ts.imap.openBox("testbox");
        await ts.imap.setFlags(ts.uidof("testbox", 1), "\\Seen");
        await ts.imap.setFlags(ts.uidof("testbox", 2), "\\Flagged");
        await ts.syncAndCheck();
    
        // Move messages
        await ts.imap.openBox("testbox");
        await ts.imap.move([ts.uidof("testbox", 3), ts.uidof("testbox", 4)], "archive");
        await ts.syncAndCheck();
    
        // Rename mailbox
        await ts.imap.renameBox("archive", "new_archive");
        await ts.syncAndCheck();
    
        // Delete mailbox
        await ts.imap.delBox("new_archive");
        await ts.syncAndCheck();
    
        // Touch the uidvalidity and check the sync refetches the entire mailbox
        let data = JSON.parse(ts.account.db.pluck(new SQL().select("data").from("mailboxes").where({name: "testbox"})));
        data.uidvalidity = 0;
        ts.account.db.update("mailboxes", { data: JSON.stringify(data) }, { name: "testbox"});
        await ts.syncAndCheck();
    });
});