const Utils = require('../lib/Utils');
const Account = require('./Account');

class Session
{
    constructor(loginId, user, password)
    {
        this.loginId = loginId;
        this.sessionId = Utils.random(16);
        this.user = user;
        this.password = password;
        this.access_time = Date.now();
    }

    async open()
    {
        // Open the account
        this.account = await Account.open(this.user, this.password);
    }

    async close()
    {
        if (this.account != null)
        {
            let account = this.account;
            this.account = null;
            await account.close();
        }
    }
}

module.exports = Session;