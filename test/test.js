const assert = require('assert');

const data = require('../data');
const TestAccount = require('./TestAccount');

before(async function () {
    console.log("Opening database...");
    await data.open("mongodb://localhost:44017/?directConnection=true", "imapsync");
});

after(async function () {
    await data.close();
    console.log("Database closed.");
});

describe('IMap Sync', function () {
  
    it('canConnect()', async function () {

        let acc = new TestAccount();
        await acc.connect();
        await acc.disconnect();

    });

    it('canAppendMessage', async function () {

        let acc = new TestAccount();
        await acc.connect();
        await acc.createMessageQuick();
        await acc.disconnect();
    });

    it('canSyncMessages', async function () {

        let acc = new TestAccount();
        await acc.connect();
        await acc.createMessageQuick();
        await acc.createMessageQuick();
        await acc.createMessageQuick();
        await acc.sync();
        await acc.checkIntegrity("INBOX");
        await acc.disconnect();
    });

    it('canResyncMessages', async function () {

        let acc = new TestAccount();
        await acc.connect();
        
        await acc.createMessageQuick();
        await acc.createMessageQuick();
        await acc.createMessageQuick();
        await acc.sync();
        await acc.checkIntegrity("INBOX");

        await acc.createMessageQuick();
        await acc.createMessageQuick();
        await acc.createMessageQuick();
        await acc.sync();
        await acc.checkIntegrity("INBOX");

        await acc.disconnect();
    });

});