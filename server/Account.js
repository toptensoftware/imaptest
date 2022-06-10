const path = require('path');

const HttpError = require('../lib/HttpError');
const AsyncLock = require('../lib/AsyncLock');
const WorkerThread = require('../lib/WorkerThread');
const config = require('./config');
const MessageFetcher = require('../lib/MessageFetcher');
const { EventEmitter } = require('node:events');

class Account extends EventEmitter
{
    constructor(user, password)
    {
        super();
        this.user = user;
        this.password = password;
        this.access_time = 0;
        this.workerThread = null;
        this.workerAccount = null;
        this.lock = new AsyncLock();
        this.refCount = 0;
        this.messageFetcher = null;
        this.progress = { complete: 0, message: "idle" };
    }

    async open()
    {
        // Remember this account was accessed
        this.access_time = Date.now();

        // Increment the reference count
        this.refCount++;

        // Quick exit if already open (typical case)
        if (this.workerThread)
            return;

        // Make sure we only do this once
        await this.lock.section(async () => {

            // Create account config
            let accountConfig = Object.assign(
                { data_dir: config.data_dir }, 
                config.imap, 
                { user: this.user, password: this.password }
            );

            // Store config on the account
            this.config = accountConfig;

            // Create the worker thread and worker account
            this.workerThread = new WorkerThread();
            this.workerAccount = await this.workerThread.createObject(
                        path.join(__dirname, "../lib/WorkerAccount"), null, accountConfig);

            this.workerAccount.on('progress', (p) => {
                console.log(JSON.stringify(p));
                this.progress = p;
                this.emit('progress', p)
            });

            this.workerAccount.config = accountConfig;
            
            // Open it
            await this.workerAccount.open();

            // Start synchronize (don't wait)
            this.workerAccount.sync();
            
            // Open message fetcher too
            this.messageFetcher = new MessageFetcher(accountConfig)
            await this.messageFetcher.open();
        });

    }

    async close()
    {
        this.refCount--;
        if (this.refCount == 0)
        {
            // Close worker thread
            await (this.lock.section(async () => {
                await this.workerAccount.close();
                await this.workerAccount.release();
                await this.workerThread.terminate();
                this.workerAccount = null;
                this.workerThread = null;
            }));

            // Close message fetcher
            await this.messageFetcher.close();
            this.messageFetcher = null;
        }
    }

}

let accountMap = new Map();
let accountMapLock = new AsyncLock();

// Get the worker account for a user
async function getAccount(user, password)
{
    // Take a lock while we look up the account
    let account = await accountMapLock.section(async () => {

        // Find or create account
        let account = accountMap.get(user);

        // If it's got the wrong password, check if the new password is 
        // correct and use it instead
        if (account && account.password != password)
        {
            // Login to IMAP to verify new username/password
            try
            {
                let imap_config = Object.assign({}, config.imap, { user, password });
                imap = new ImapPromise(imap_config);
                await imap.connect();
                await imap.end();
            }
            catch (err)
            {
                throw new HttpError(401, 'login failed');
            }

            // Close the old account
            accountMap.delete(user);
            await account.close();
            account = null;
        }

        if (account == null)
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
    get : getAccount,
};