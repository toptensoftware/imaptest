const TestSuite = require('./TestSuite.js');

test('Link and Unlink Messages', async () => {

    return new TestSuite().run(async (ts) => {
        
        // Create two unrelated messages
        await ts.createMessage("testbox", 1);
        await ts.createMessage("testbox", 2);
        await ts.sync();
        await ts.checkConversation(1, 1, [1]);
        await ts.checkConversation(2, 2, [2]);
    
        // Link via a common child
        await ts.createMessage("testbox", 3, [1, 2]);
        await ts.sync();
        await ts.checkConversation(1, 1, [1, 2, 3]);
    
        // Unlink messages by deleting common child 
        await ts.deleteMessage("testbox", ts.uidof("testbox", 3));
        await ts.sync();
        await ts.checkConversation(1, 1, [1]);
        await ts.checkConversation(2, 2, [2]);

    });
});


test('Chain of Messages', async () => {

    return new TestSuite().run(async (ts) => {
        
        // Mak echain
        await ts.createMessage("testbox", 10);
        await ts.createMessage("testbox", 11, [10]);
        await ts.createMessage("testbox", 12, [11]);
        await ts.createMessage("testbox", 13, [12]);
        await ts.createMessage("testbox", 14, [13]);
        await ts.sync();
        await ts.checkConversation(10, 10, [10, 11, 12, 13, 14]);

        // Break chain
        await ts.deleteMessage("testbox", ts.uidof("testbox", 12));
        await ts.sync();
        await ts.checkConversation(10, 10, [10, 11]);
        await ts.checkConversation(13, 13, [13, 14]);
    
        // Repair chain
        await ts.createMessage("testbox", 12, [11]);
        await ts.sync();
        await ts.checkConversation(10, 10, [10, 11, 12, 13, 14]);

        // Create second chain
        await ts.createMessage("testbox", 20);
        await ts.createMessage("testbox", 21, [20]);
        await ts.createMessage("testbox", 22, [21]);
        await ts.createMessage("testbox", 23, [22]);
        await ts.createMessage("testbox", 24, [23]);
        await ts.sync();
        await ts.checkConversation(20, 20, [20, 21, 22, 23, 24]);
    
        // Join chains by common parent
        await ts.createMessage("testbox", 30, [10, 20]);
        await ts.sync();
        await ts.checkConversation(10, 10, [10, 11, 12, 13, 14, 20, 21, 22, 23, 24, 30]);
    
        // Unjoin chains by common parent
        await ts.deleteMessage("testbox", ts.uidof("testbox", 30));
        await ts.sync();
        await ts.checkConversation(10, 10, [10, 11, 12, 13, 14]);
        await ts.checkConversation(20, 20, [20, 21, 22, 23, 24]);
    
        // Join chains at mid point
        await ts.createMessage("testbox", 30, [12, 22]);
        await ts.sync();
        await ts.checkConversation(10, 10, [10, 11, 12, 13, 14, 20, 21, 22, 23, 24, 30]);
    
        // Unjoin chains at mid point
        await ts.deleteMessage("testbox", ts.uidof("testbox", 30));
        await ts.sync();
        await ts.checkConversation(10, 10, [10, 11, 12, 13, 14]);
        await ts.checkConversation(20, 20, [20, 21, 22, 23, 24]);
    });
});


test('Join individual messages by single reference set', async () => {

    return new TestSuite().run(async (ts) => {
        
        await ts.createMessage("testbox", 40);
        await ts.createMessage("testbox", 41);
        await ts.createMessage("testbox", 42);
        await ts.createMessage("testbox", 43);
        await ts.createMessage("testbox", 44);
        await ts.sync();
        await ts.checkConversation(40, 40, [40]);
        await ts.checkConversation(41, 41, [41]);
        await ts.createMessage("testbox", 45, [40, 41, 42, 43, 44]);
        await ts.sync();
        await ts.checkConversation(40, 40, [40, 41, 42, 43, 44, 45]);
        
    });
});

test('Chain of messages in different mailboxes', async () => {

    return new TestSuite().run(async (ts) => {
        
        await ts.createMessage("testbox", 50);
        await ts.createMessage("archive", 51, [50]);
        await ts.createMessage("testbox", 52, [51]);
        await ts.createMessage("archive", 53, [52]);
        await ts.createMessage("testbox", 54, [53]);
        await ts.sync();
        await ts.checkConversation(50, 50, [50, 51, 52, 53, 54]);
        
    });
});

test('Tight circular reference', async () => {

    return new TestSuite().run(async (ts) => {
        
        await ts.createMessage("testbox", 60, [61]);
        await ts.createMessage("testbox", 61, [60]);
        await ts.sync();
        await ts.checkConversation(60, 60, [60, 61]);
        
    });
});

test('Loose circular reference', async () => {

    return new TestSuite().run(async (ts) => {
        
        await ts.createMessage("testbox", 70, [74]);
        await ts.createMessage("testbox", 71, [70]);
        await ts.createMessage("testbox", 72, [71]);
        await ts.createMessage("testbox", 73, [72]);
        await ts.createMessage("testbox", 74, [73]);
        await ts.sync();
        await ts.checkConversation(70, 70, [70, 71, 72, 73, 74]);
        
    });
});

test('Flags', async () => {

    return new TestSuite().run(async (ts) => {
        
        await ts.createMessage("testbox", 80);
        await ts.createMessage("testbox", 81, [80]);
        await ts.sync();
        await ts.checkConversation(80, 80, [80, 81]);
        await ts.imap.openBox("testbox", false);
        await ts.imap.addFlags(ts.uidof("testbox", 80), "\\Flagged");
        await ts.imap.addFlags(ts.uidof("testbox", 81), "\\Seen");
        await ts.sync();
        await ts.checkConversation(80, 80, [80, 81]);
        await ts.imap.delFlags(ts.uidof("testbox", 80), "\\Flagged");
        await ts.imap.delFlags(ts.uidof("testbox", 81), "\\Seen");
        await ts.sync();
        await ts.checkConversation(80, 80, [80, 81]);
        
    });
});
