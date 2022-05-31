const express = require('express');
const asyncHandler = require('express-async-handler');

const ImapPromise = require('../lib/ImapPromise');
const Utils = require('../lib/Utils');

const HttpError = require('./HttpError');
const db = require('./db');
const config = require('./config');

// Create router
let router = express.Router();


// Request a session key (aka "login").  Expects a JSON post body with
//      { user: <username>, pass: <password> }
// Returns a session key that should be passed back to any api requiring
// authentication in a header field "session-key".
// The session key consists of three parts:
//     msk-xxxxxxxxxxxxxxxxxxxx-yyyyyyyyyyyyyyyyyyyyyy
// where:
//     * msk - identifies this as a Mail Session Key
//     * xxxx - session id as primary key into the sessions table
//     * yyyy - the initialization vector data for decrypting the session
//              username and password from the db.
// Note a session key + access to the database allows retrieval
// of the user's username AND password. We need to keep that info
// around to establish connection to IMAP server.
router.post('/requestSessionKey', asyncHandler(async (req, res) => {

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
        let sessionId = Utils.random(16);

        // Store it
        db.insert("sessions", { 
            sessionId: sessionId,
            timestamp: Math.floor(Date.now() / 1000),
            user: login.user,
            data: encrypted.content 
        });

        // Return the session 
        res.json({
            key: `msk-${sessionId}-${encrypted.iv}`
        })
    }
    catch (err)
    {
        throw new HttpError(401, err);
    }

}));


// An in-memory cache of recently validated session keys
let SessionKeyCache = new Map();

// Session key verification
// Reads the session-key header, checks it's validity.  If ok calls
// processing continues with the subsequent route handlers below.
// If it fails, a http 401 error is generated and processing stops.
// Login information `{user:pass:}` will be available as req.login
router.use((req, res, next) => {

    // Get the session key
    let key = req.headers['session-key'];

    // Check cache and if found and not expired, we don't 
    // need to do the DB lookup check
    let login = SessionKeyCache.get(key);
    if (login && Date.now() > login.cacheTimeout)
    {
        login = null;
    }

    // If not found, decrypt from database
    if (login == null)
    {
        // Split the key
        let parts = key.split('-');
        if (parts.length != 3)
            throw new HttpError(401, "invalid key");

        if (parts[0] != 'msk')
            throw new HttpError(401, "invalid key");

        // Get the record
        let sessionId = parts[1];
        let session = db.get("SELECT * FROM sessions WHERE sessionId=?", sessionId);
        if (!session)
            throw new HttpError(401, "invalid key");

        // Decrypt it
        try
        {
            // Decrypt it
            login = Utils.decryptJson(session.data, parts[2]);
            
            // Check it decrypted properly
            if (login.user != session.user)
                throw new Error("invalid key");

            // Cache key in memory for 5 minutes
            login.cacheTimeout = Date.now() + 1000 * 5 * 60;
            login.sessionId = sessionId;
            SessionKeyCache.set(key, login);
        }
        catch (err)
        {
            throw new HttpError(401, "invalid key");
        }
    }

    // Store login information
    req.login = login;

    // Authenticated!
    next();
});

// Deletes the current session key (aka logout)
router.get('/deleteSessionKey', (req, res) => {

    // Remove from session key cache
    SessionKeyCache.delete(req.headers['session-key']);

    // Remove from database
    db.run("DELETE FROM sessions WHERE sessionId=?", req.login.sessionId);

    // Done
    res.json({result: "OK"});

});

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

router.use((error, req, res, next) => {
    if (error instanceof HttpError)
    {
        res.send(error.code, error.message);
    }
    else
        next();
})

module.exports = router;