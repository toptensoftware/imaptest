const express = require('express');
const asyncHandler = require('express-async-handler');

const ImapPromise = require('../lib/ImapPromise');
const Utils = require('../lib/Utils');

const HttpError = require('./HttpError');
const db = require('./db');
const config = require('./config');

// Create router
let router = express.Router();


// Create a new session key (aka "login").  Expects a JSON post body with
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
router.post('/createSession', asyncHandler(async (req, res) => {

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

        // Work out cookie options
        let cookieOptions = {
            sameSite: 'strict',
            httpOnly: process.env.NODE_ENV !== "development",
            secure: process.env.NODE_ENV !== "development"
        };
        if (req.body.stayLoggedIn)
        {
            // 30-days
            cookieOptions.expires =  Date.now() + 1000 * 60 * 60 * 24 * 30;
        };

        // Return the session 
        let sessionKey = `msk-${sessionId}-${encrypted.iv}`
        res.cookie('msk-session-key', sessionKey, cookieOptions);
        res.json({
            result: "OK" 
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
    let key = req.cookies['msk-session-key'];

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
            login.sessionToken = session.sessionToken;
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
router.post('/deleteSession', (req, res) => {

    // Remove from session key cache
    SessionKeyCache.delete(req.cookies['msk-session-key']);

    // Remove from database
    db.run("DELETE FROM sessions WHERE sessionId=?", req.login.sessionId);

    // Clear session key and token cookies
    res.clearCookie('msk-session-key');
    res.clearCookie('msk-session-token');

    // Done
    res.json({result: "OK"});
});

// Open the session and return session token via cookie
router.post('/openSession', (req, res) => {

    // Create a session CSRF token
    req.login.sessionToken = Utils.random(16);

    // Store session token in database
    db.run("UPDATE sessions SET sessionToken=? WHERE sessionId=?", req.login.sessionToken, req.login.sessionId);

    // Set cookie
    let cookieOptions = {
        httpOnly: false,                // Needs to be accessible to JS
        secure: process.env.NODE_ENV !== "development"
    };
    res.cookie("msk-session-token", req.login.sessionToken, cookieOptions)

    // TODO: return initial application state

    // Done
    res.json({result: "OK"});
});


// Validate session token
router.use((req, res, next) => {

    // Check CSRF token
    if (req.headers['msk-session-token'] != req.login.sessionToken)
    {
        throw new HttpError(401, "invalid key");
    }

    next();
});

module.exports = router;