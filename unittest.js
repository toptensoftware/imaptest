const Imap = require('./imap_promise');
const inspect = require('util').inspect;

(async function() {

    // Create imap
    let config = {
        user: 'test001',
        password: 'pass',
        host: 'localhost',
        port: 33143,
        tls: false,
        debug: console.log
    }
    let imap = new Imap(config)

    console.log("connecting");

    // Open connection
    await imap.connect();
    console.log("connected");

    // Get list of boxes
    let boxes = await imap.getBoxes();
    console.log(inspect(boxes));

    // Open inbox
    let inbox = await imap.openBox("INBOX");
    console.log(inspect(inbox));

    let body = 
`MIME-Version: 1.0
From: Brad Robinson <brobinson@toptensoftware.com>
Date: Mon, 9 May 2022 15:42:37 +1000
Message-ID: <1000@box.com>
Subject: Message 1
To: Brad <brad@rocketskeleton.com>

This is the message!
`;

    //let uid = await imap.append(body, { });

    // Get all messages
    /*
    await imap.fetch("1:*", { bodies: 'HEADER.FIELDS (DATE SUBJECT MESSAGE-ID REFERENCES IN-REPLY-TO)', seq: true }, (m) => {
        console.log(inspect(m));
    });
    */

    let result = await imap.esearch(['ALL']);
    console.log(inspect(result));

    // Close connection
    console.log("disconnecting");
    await imap.disconnect();
    console.log("disconnected");

})();

console.log("OK");