const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const fs = require('fs');
const Account = require('./lib/Account');

const app = express();

// Load Config
let accountName = 'tts';
let configFile = JSON.parse(fs.readFileSync('imaptool.config.json', 'utf8'));
config = configFile.accounts[accountName];
if (!config)
    throw new Error("No account");
config = Object.assign(configFile.common, config);

let account;
(async () => {

    let a  = new Account(config);
    await a.open();
    await a.sync();
    account = a;

    console.log("Account synced");

})();


app.use(morgan('tiny'));
app.use(cors());
app.use(bodyParser.json());

app.get('/api/folders', (req, res) => {
    res.json(account.get_mailboxes());
});

app.get('/api/conversations', (req, res) => {
    res.json(account.get_conversations(req.query));
});

app.get('/api/conversation', (req, res) => {
    res.json(account.get_conversation(req.query));
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`listening on ${port}`);
});