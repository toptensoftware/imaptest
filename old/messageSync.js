const assert = require('assert');

const Database = require('../lib/Database');
const TestAccount = require('./TestAccount');
let dbconfig = {
    "db_server": "mongodb://localhost:44017/?directConnection=true",
    "db_name": "unittests",
    "db_base_collection_name": "unittests"
};

before(async () => {
    await Database.open(dbconfig);
});

after(async () => {
    await Database.close();
});



describe('Message Sync', function () {
  
    it('can connect (IMAP)', async function () {

        let account = new TestAccount();
        await account.connect();
        await account.disconnect();

    });

    it('can sync', async function () {

        let account = new TestAccount();
        await account.connect();
        await account.sync();
        await account.disconnect();

    });


});