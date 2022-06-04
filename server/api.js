const express = require('express');
const asyncHandler = require('express-async-handler');

const ImapPromise = require('../lib/ImapPromise');
const Utils = require('../lib/Utils');

const HttpError = require('../lib/HttpError');
const db = require('./db');
const config = require('./config');

// Create router
let router = express.Router();

router.post('/sync', asyncHandler(async (req, res) => {
    res.json(await req.account.sync());
}));

router.get('/folders', asyncHandler(async (req, res) => {
    res.json(await req.account.get_mailboxes());
}));

router.get('/conversations', asyncHandler(async (req, res) => {
    res.json(await req.account.get_conversations(req.query));
}));

router.get('/conversation', asyncHandler(async (req, res) => {
    res.json(await req.account.get_conversation(req.query));
}));


module.exports = router;