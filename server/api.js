const express = require('express');
const asyncHandler = require('express-async-handler');

const ImapPromise = require('../lib/ImapPromise');
const Utils = require('../lib/Utils');
const MessageFetcher = require('../lib/MessageFetcher');
const MessageToHtml = require('../lib/MessageToHtml')

const HttpError = require('../lib/HttpError');
const db = require('./db');
const config = require('./config');

// Create router
let router = express.Router();

router.get('/ping', asyncHandler(async (req, res) => {
    res.json({ user: req.login.user });
}));

router.post('/sync', asyncHandler(async (req, res) => {
    res.json(await req.account.workerAccount.sync());
}));

// query params: 
// since_mrev - get deltas since previous mailboxes list revision
router.get('/folders', asyncHandler(async (req, res) => {
    res.json(await req.account.workerAccount.get_mailboxes(req.query));
}));

// query params
// skip - number of records to skip
// take - number of records to take
// mailbox - get conversations for a mailbox
// since_crev - get changes to conversation list since previously returned crev number
router.get('/conversations', asyncHandler(async (req, res) => {
    res.json(await req.account.workerAccount.get_conversations(req.query));
}));

// query params
// any combination of parameters to /folders and /conversations
router.get('/conversations_and_mailboxes', asyncHandler(async (req, res) => {
    res.json(await req.account.workerAccount.get_conversations_and_mailboxes(req.query));
}));

router.get('/conversation', asyncHandler(async (req, res) => {

    // Get the conversation
    let conv = await req.account.workerAccount.get_conversation(req.query);

    // Fetch message bodies...
    for (let m of conv.messages)
    {
        // Get the flattened message structure
        let fs = await req.account.messageFetcher.fetchBodyText(m.quids, 'html');

        // Get email addresses
        Object.assign(m, Utils.get_email_addresses_from_headers(fs.headers));

        // Convert to html
        let html = MessageToHtml(fs);
        m.html = html.html;
        m.hasBackground = html.hasBackground;
        m.foreColors = html.foreColors;
        m.attachments = fs.attachments.map(x => ({
            filename: x.disposition?.params?.filename ?? x.params?.name ?? "untitled",
            size: x.disposition?.params?.size ?? x.size ?? 0,
            type: `${x.type}/${x.subtype}`,
            partID: x.partID
        }));
        //m.rawParts = fs;
    }

    // Send it
    res.json(conv);
}));

router.get('/bodypart/:quid/:partid', asyncHandler(async (req, res) => {
    
    let part = await req.account.messageFetcher.fetchPart(req.params.quid, req.params.partid);

    if (parseInt(req.query.dl))
    {
        let filename = part.disposition?.params?.filename ?? part.params?.name ?? null;
        if (filename)
            res.setHeader('content-disposition', `attachment; filename=\"${filename}\"`);
        else
            res.setHeader('content-disposition', `attachment`);
    }

    res.setHeader('content-type', `${part.type}/${part.subtype}`);
    res.write(part.data, 'binary');
    res.end(null, 'binary');
}));

router.get('/sync_progress', (req, res) => {

    // Write current progress
    let p = req.account.progress;
    res.write(`${p.complete} ${p.message}\n`);

    // Either end immediately or wait for progress...
    if (p.complete >= 100)
    {
        res.end();
    }
    else
    {
        // Handler for progress change notifications
        let handler = function(p) {

            // Write update progress to output stream
            res.write(`${p.complete} ${p.message}\n`);

            // If finished, end the stream and remove handler
            if (p.complete >= 100)
            {
                res.end();
                req.account.off('progress', handler);
            }
        }

        // Hook up handler to monitor progress
        req.account.on('progress', handler);
    }
});


module.exports = router;