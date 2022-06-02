const express = require('express');

const ImapPromise = require('../lib/ImapPromise');
const Utils = require('../lib/Utils');

const HttpError = require('../lib/HttpError');
const db = require('./db');
const config = require('./config');

// Create router
let router = express.Router();


router.get('/folders', (req, res) => {
    //res.json(account.get_mailboxes());
    res.json({result: "OK"});
});

router.get('/conversations', (req, res) => {
    res.json(account.get_conversations(req.query));
});

router.get('/conversation', (req, res) => {
    res.json(account.get_conversation(req.query));
});


module.exports = router;