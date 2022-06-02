const path = require('path');

const HttpError = require('../lib/HttpError');
const AsyncLock = require('../lib/AsyncLock');
const WorkerThread = require('../lib/WorkerThread');
const WorkerAccount = require('../lib/WorkerAccount');
const config = require('./config');

let accountMap = new Map();
let accountMapLock = new AsyncLock();

class Account
{
    constructor(user, password)
    {
        this.lastAccessTime = 0;
        this.lastSyncTime = 0;
        this.user = user;
        this.password = password;
        this.previousPasswords = [];
        this.workerThread = null;
        this.workerAccount = null;
    }
}

// Get the worker account for a user
async function getAccount(user, password)
{
    // Take a lock while we look up the account
    let account = await accountMapLock.section(async () => {

        // Find existing account
        let account = accountMap.get(user);

        // Already open?
        if (account != null)
        {
            // Check was opened with the same password
            if (account.password == password)
                return account;

            // If we reach here it means there are two active
            // signins for this account with different passwords.
            // Since passwords are validated via an IMAP sign in
            // as part of the auth process, the newer login should
            // take precedence since it's probably the user has 
            // changed their password.  Force old clients of this
            // account to re-authorize.

            // Is this and old login?
            if (account.previousPasswords.indexOf(password) >= 0)
            {
                throw new HttpError(401, "password expired");
            }

            // Remember the old password and update the new one
            account.previousPasswords.push(account.password);
            account.password = password;

            // Release the worker account that has the wrong password
            account.workerAccount.close();      // No await
            account.workerAccount.release();    // No await
            account.workerAccount = null;
        }
        else
        {
            // Create a new account
            account = new Account(user, password);
            accountMap.set(user, account);
        }

        // Create the worker
        if (account.workerThread == null)
            account.workerThread = new WorkerThread();

        // Create account config
        let accountConfig = Object.assign(
            { data_dir: config.data_dir }, 
            config.imap, 
            { user: user, password: password }
        );

        // Create the worker
        account.workerAccount = await account.workerThread.createObject(
                    path.join(__dirname, "../lib/WorkerAccount"), null, accountConfig);

        // Remember not opened/synced yet
        account.lastSyncTime = 0;

        // Done
        return account;
    });

    // If the account was just created do the initial sync
    if (!account.lastSyncTime)
    {
        account.lastSyncTime = Date.now();          // prevent re-entry
        await account.workerAccount.openAndSync();
        account.lastSyncTime = Date.now();          // actual
    }

    // Remember the last access time
    account.lastAccessTime = Date.now();
        
    // Return the worker account
    return account;
}

module.exports = 
{
    get : getAccount,
};