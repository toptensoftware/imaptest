const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const fs = require('fs');
const Account = require('./lib/Account');
const asyncHandler = require('express-async-handler');
const ImapPromise = require('./lib/IMapPromise');
const { v4: uuidv4 } = require('uuid');
const Utils = require('./lib/Utils');
const app = express();
const Database = require('./lib/Database');
const path = require('path');
const res = require('express/lib/response');

// Load Config
let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Create sessions database
let db = new Database(path.join(config.data_dir, "sessions.db"));
db.migrate([
    function()
    {
        db.createTable({
            tableName: "sessions",
            columns: [
                { rid: "INTEGER PRIMARY KEY AUTOINCREMENT" },
                { timestamp: "INTEGER NOT NULL" },
                { data: "STRING NOT NULL" }
            ],
        });
    }
]);

/*
let account;
(async () => {

    let a  = new Account(config);
    await a.open();
    await a.sync();
    account = a;

    console.log("Account synced");

})();
*/

class HttpError extends Error
{
    constructor(code, message)
    {
        super(message);
        this.code = code;
    }
}

app.use(morgan('tiny'));
app.use(cors());
app.use(bodyParser.json());

app.post('/api/requestApiKey', asyncHandler(async (req, res) => {

    let imap;
    try
    {
        // Package all required login information
        let login = {
            user: req.body.user,
            password: req.body.pass
        };

        // Login to IMAP to verify username/password
        let imap_config = Object.assign({}, config.imap, login)
        imap = new ImapPromise(imap_config);
        await imap.connect();
        await imap.end();

        // Encrypt it
        let encrypted = Utils.encryptJson(login);

        // Store it
        let keyid = db.insert("sessions", { 
            timestamp: Date.now() / 1000,
            data: encrypted.content 
        }).lastInsertRowid;

        // Return the session 
        res.json({
            key: `key-${keyid}-${encrypted.iv}`
        })
    }
    catch (err)
    {
        throw new HttpError(401, err);
    }

}));

app.post('/api/checkKey', asyncHandler(async (req, res) => {

    // Split the key
    let parts = req.body.key.split('-');
    if (parts.length != 3)
        throw new HttpError(400, "invalid key");

    // Get the record
    let encryptedContent = db.pluck("SELECT data FROM sessions WHERE rid=?", parseInt(parts[1]));
    if (!encryptedContent)
        throw new HttpError(400, "invalid key");

    // Decrypt it
    let key = parts[2];
    let login = Utils.decryptJson(encryptedContent, key);

    // Decrypt it
    res.json(login);

}));

app.get('/api/folders', (req, res) => {
    res.json(account.get_mailboxes());
});

app.get('/api/conversations', (req, res) => {
    res.json(account.get_conversations(req.query));
});

app.get('/api/conversation', (req, res) => {
    res.json(account.get_conversation(req.query));
});

app.use((error, req, res, next) => {
    if (error instanceof HttpError)
    {
        res.send(error.code, error.message);
    }
    else
        next();
})

const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`listening on ${port}`);
});