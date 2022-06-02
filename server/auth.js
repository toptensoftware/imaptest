const express = require('express');
const asyncHandler = require('express-async-handler');

const ImapPromise = require('../lib/ImapPromise');
const Utils = require('../lib/Utils');
const HttpError = require('../lib/HttpError');

const db = require('./db');
const config = require('./config');
const WorkerAccount = require('./WorkerAccount');

// Create router
let router = express.Router();

router.use((req, res, next) => {
    next();
});

// Trim all expired session keys from db
let last_trim = 0;
function trimOldSessionKeys()
{
    // Only run this once per day
    let now = Date.now();
    if (now > last_trim + 1000 * 60 * 60 * 24)
    {
        db.run("DELETE FROM sessions WHERE expiry < ?", Math.floor(Date.now() / 1000));
        last_trim = now;
    }
}

/*
## Authentication

1. Client calls POST `/api/openSession` with no parameters/body

2. If there's a valid `msk-session-key` HttpOnly cookie associated with the request
   the server will create and return a `msk-session-token` - a non-HttpOnly cookie
   which the client must keep in memory and remove from `document.cookies`.

3. If the POST to `openSession` fails, the user should be prompted to login and the 
   login details passed to `/api/createSession`.  On successful session creation
   the client should continue at step 2 above to open the session.

4. For all other API requests, the client should pass the `msk-session-token` as 
   a header by the same name.

5. Periodically the server will return a new `msk-session-token` cookie in which case
   the client must store it in memory, remove it from the document cookie collection
   and use it for all future requests
  
6. To logout, the client should POST to `/api/deleteSession`.

*/



// Create a new session key (aka "login").  Expects a JSON post body with
//      { user: <username>, pass: <password>, stayLoggedIn: bool }
// Returns a session-key in a http only cookie
// The session key consists of three parts:
//     msk-xxxxxxxxxxxxxxxxxxxx-yyyyyyyyyyyyyyyyyyyyyy
// where:
//     * msk - identifies this as a Mail Session Key
//     * xxxx - session id which is a primary key into the sessions table
//     * yyyy - the initialization vector data for decrypting the session
//              username and password from the db.
// Warning: a session key + access to the database allows retrieval
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
        let encrypted = Utils.encryptJson(config.encryption_key, login);
        let sessionId = Utils.random(16);

        // Work out when the session expires
        // For non-persistent logins, keep them in the db for 1 day
        let expiryDays = req.body.persistent ? config.persistent_login_days : 1
        let expiry = Date.now() + 1000 * 60 * 60 * 24 * expiryDays;

        // Store it
        db.insert("sessions", { 
            sessionId: sessionId,
            expiry: Math.floor(expiry / 1000),
            user: login.user,
            data: encrypted.content 
        });

        // Work out cookie options
        let cookieOptions = {
            sameSite: 'strict', // process.env.NODE_ENV !== "development",
            httpOnly: true,
            secure: process.env.NODE_ENV !== "development"
        };
        if (req.body.persistent)
        {
            // Set expiration date
            cookieOptions.expires = new Date(expiry);
        };

        // Return the session 
        let sessionKey = `msk-${sessionId}-${encrypted.iv}`;
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

    // Delete old session keys
    trimOldSessionKeys();

    // Get the session key
    let key = req.cookies['msk-session-key'];
    if (!key)
        throw new HttpError(401, "invalid key");

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
            login = Utils.decryptJson(config.encryption_key, session.data, parts[2]);
            
            // Check it decrypted properly
            if (login.user != session.user)
                throw new Error("invalid key");

            // Cache key in memory
            login.cacheTimeout = Date.now() + 1000 * config.session_key_cache_seconds;
            login.sessionId = sessionId;
            if (config.use_csrf_tokens)
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
    if (config.use_csrf_tokens)
        res.clearCookie('msk-session-token');

    // Done
    res.json({result: "OK"});
});


function generateSessionToken(req, res)
{
    if (!config.use_csrf_tokens)
        return;

    // Create a session CSRF token
    req.login.sessionToken = Utils.random(16);
    
    // Regenerate every minute
    req.login.regenerateTokenTime = Date.now() + 1000 * config.csrf_token_regenerate_seconds;

    // Store session token in database
    db.run("UPDATE sessions SET sessionToken=? WHERE sessionId=?", req.login.sessionToken, req.login.sessionId);

    // Return as cookie
    let cookieOptions = {
        httpOnly: false,                // Needs to be accessible to JS
        secure: process.env.NODE_ENV !== "development"
    };
    res.cookie("msk-session-token", req.login.sessionToken, cookieOptions)
}

// Open the session always generates a new session token
router.post('/openSession', (req, res, next) => {

    // Generate session token
    generateSessionToken(req, res);

    // Carry on
    next();
});


// Validate session token
router.use((req, res, next) => {

    if (config.use_csrf_tokens)
    {
        // Check CSRF token
        if (req.headers['msk-session-token'] != req.login.sessionToken)
        {
            throw new HttpError(401, "invalid key");
        }
    
        // Periodically generate new session token
        if (Date.now() > req.login.regenerateTokenTime)
        {
            // Re-generate session token
            generateSessionToken(req, res);
        }
    }
    
    // Open the account
    WorkerAccount.get(req.login.user, req.login.password)
        .then((account) => { req.account = account; next(); })
        .catch(next);
});


// Open the session always generates a new session token
router.post('/openSession', (req, res) => {

    res.json({result: "OK"});

});


module.exports = router;