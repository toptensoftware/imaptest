const assert = require('assert');
const SQL = require('../lib/SQL');
const TestSuite = require("./TestSuite")

new TestSuite().run(async (ts) => {

    // Create initial messages
    console.log("\n--- Creating messages ---");
    await ts.createMessage("testbox", 1);
    await ts.createMessage("testbox", 2);
    await ts.createMessage("testbox", 3);
    await ts.createMessage("testbox", 4);
    await ts.syncAndCheck();

    // Add another message
    console.log("\n--- Adding 1 message ---");
    await ts.createMessage("testbox", 5);
    await ts.syncAndCheck();

    // Delete a message
    console.log("\n--- Deleting 1 message ---")
    await ts.deleteMessage("testbox", ts.uidof("testbox", 5));
    await ts.syncAndCheck();

    // Flag a message
    console.log("\n--- Flagging 2 messages ---")
    await ts.imap.openBox("testbox");
    await ts.imap.setFlags(ts.uidof("testbox", 1), "\\Seen");
    await ts.imap.setFlags(ts.uidof("testbox", 2), "\\Flagged");
    await ts.syncAndCheck();

    // Move messages
    console.log("\n--- Moving 2 messages to archive ---")
    await ts.imap.openBox("testbox");
    await ts.imap.move([ts.uidof("testbox", 3), ts.uidof("testbox", 4)], "archive");
    await ts.syncAndCheck();

    // Rename mailbox
    console.log("\n--- Renaming mailbox ---")
    await ts.imap.renameBox("archive", "new_archive");
    await ts.syncAndCheck();

    // Delete mailbox
    console.log("\n--- Deleting mailbox ---")
    await ts.imap.delBox("new_archive");
    await ts.syncAndCheck();

    // Touch the uidvalidity and check the sync refetches the entire mailbox
    console.log("\n--- Hacking uidvalidity ---");
    let data = JSON.parse(ts.account.db.pluck(new SQL().select("data").from("mailboxes").where({name: "testbox"})));
    data.uidvalidity = 0;
    ts.account.db.update("mailboxes", { data: JSON.stringify(data) }, { name: "testbox"});
    await ts.syncAndCheck();

});
