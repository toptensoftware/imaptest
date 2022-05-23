const assert = require('assert');
const TestSuite = require("./TestSuite")

new TestSuite().run(async (ts) => {

    console.log("\nCheck two unrelated messages");
    await ts.createMessage("testbox", 1);
    await ts.createMessage("testbox", 2);
    await ts.sync();
    await ts.checkConversation(1, 1, [1]);
    await ts.checkConversation(2, 2, [2]);

    console.log("\nLink messages via a common child");
    await ts.createMessage("testbox", 3, [1, 2]);
    await ts.sync();
    await ts.checkConversation(1, 1, [1, 2, 3]);

    console.log("\nUnlink messages by deleting common child");
    await ts.deleteMessage("testbox", ts.uidof("testbox", 3));
    await ts.sync();
    await ts.checkConversation(1, 1, [1]);
    await ts.checkConversation(2, 2, [2]);

    console.log("\nChain of conversations");
    await ts.createMessage("testbox", 10);
    await ts.createMessage("testbox", 11, [10]);
    await ts.createMessage("testbox", 12, [11]);
    await ts.createMessage("testbox", 13, [12]);
    await ts.createMessage("testbox", 14, [13]);
    await ts.sync();
    await ts.checkConversation(10, 10, [10, 11, 12, 13, 14]);

});
