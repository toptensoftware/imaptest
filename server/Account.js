const path = require('path');

const HttpError = require('../lib/HttpError');
const AsyncLock = require('../lib/AsyncLock');
const WorkerThread = require('../lib/WorkerThread');
const WorkerAccount = require('../lib/WorkerAccount');
const config = require('./config');

class Account
{
    constructor(user, password)
    {
        this.user = user;
        this.password = password;
        this.access_time = 0;
        this.sync_revision = 0;
        this.invalidPasswords = [];
        this.workerThread = null;
        this.workerAccount = null;
        this.lock = new AsyncLock();
        this.refCount = 0;
    }

    async open()
    {
        // Remember this account was accessed
        this.access_time = Date.now();

        // Increment the reference count
        this.refCount++;

        // Quick exit if already open (typical case)
        if (this.sync_revision != 0)
            return;

        // Make sure we only do this once
        await this.lock.section(async () => {

            // Create account config
            let accountConfig = Object.assign(
                { data_dir: config.data_dir }, 
                config.imap, 
                { user: this.user, password: this.password }
            );

            // Create the worker thread and worker account
            this.workerThread = new WorkerThread();
            this.workerAccount = await this.workerThread.createObject(
                        path.join(__dirname, "../lib/WorkerAccount"), null, accountConfig);

            // Open it
            this.sync_revision = await this.workerAccount.openAndSync();
        });

    }

    async close()
    {
        this.refCount--;
        if (this.refCount == 0)
        {
            await (this.lock.section(async () => {
                await this.workerAccount.close();
                await this.workerAccount.release();
                await this.workerThread.terminate();
                this.workerAccount = null;
                this.workerThread = null;
                this.sync_revision = 0;
            }));
        }
    }

}

let accountMap = new Map();
let accountMapLock = new AsyncLock();

// Get the worker account for a user
async function openAccount(user, password)
{
    // Take a lock while we look up the account
    let account = await accountMapLock.section(async () => {

        // Find or create account
        let account = accountMap.get(user);
        if (!account)
        {
            // Create a new account
            account = new Account(user, password);
            accountMap.set(user, account);
        }

        // Done
        return account;
    });

    // Make sure the account is open
    await account.open();
        
    // Return the worker account
    return account;
}

module.exports = 
{
    open : openAccount,
};