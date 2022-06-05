const express = require('express');
const asyncHandler = require('express-async-handler');

const ImapPromise = require('../lib/ImapPromise');
const Utils = require('../lib/Utils');
const MessageFetcher = require('../lib/MessageFetcher');

const HttpError = require('../lib/HttpError');
const db = require('./db');
const config = require('./config');

// Create router
let router = express.Router();

router.get('/ping', asyncHandler(async (req, res) => {
    res.json({ user: req.login.user });
}));

router.post('/sync', asyncHandler(async (req, res) => {
    res.json(await req.account.sync());
}));

router.get('/folders', asyncHandler(async (req, res) => {
    res.json(await req.account.get_mailboxes());
}));

router.get('/conversations', asyncHandler(async (req, res) => {
    res.json(await req.account.get_conversations(req.query));
}));

router.get('/conversations_and_mailboxes', asyncHandler(async (req, res) => {
    res.json(await req.account.get_conversations_and_mailboxes(req.query));
}));

router.get('/conversation', asyncHandler(async (req, res) => {
    res.json(await req.account.get_conversation(req.query));
}));

router.get('/bodypart/:quid/:partid', asyncHandler(async (req, res) => {
    
    // Create message fetcher
    let mf = new MessageFetcher(req.account.config);

    await mf.open();

    try
    {
        let part = await mf.fetchPart(req.params.quid, req.params.partid);

        res.setHeader('content-type', `${part.type}/${part.subtype}`);
        res.write(part.data, 'binary');
        res.end(null, 'binary');
    }
    finally
    {
        await mf.close();
    }
}));


module.exports = router;