const express = require('express');
const asyncHandler = require('express-async-handler');

const ImapPromise = require('../lib/ImapPromise');
const Utils = require('../lib/Utils');
const HttpError = require('../lib/HttpError');

const db = require('./db');
const config = require('./config');
const Session = require('./Session');
const SQL = require('../lib/SQL');
const { update } = require('../lib/SQL');

// Create router
let router = express.Router();


// -------------------------- LOGIN --------------------------

// Trim logins once per day
function purgeExpiredLogins()
{
    db.run("DELETE FROM logins WHERE expiry < ?", Math.floor(Date.now() / 1000));
}
setTimeout(purgeExpiredLogins, 1000 * 60 * 60 * 24);
purgeExpiredLogins();


// Helper to parse a login key
function parseLoginKey(key)
{
    if (key)
    {
        let parts = key.split('-');
        if (parts.length == 4 && parts[0] == 'msk')
        {
            return {
                loginId: parts[1],
                iv: parts[2],
                rotation: parts[3],
            }
        }
    }

    throw new HttpError(401, "invalid key");
}

// Helper to set the login key cookie
function setLoginKeyCookie(res, loginRecord, iv)
{
    // Work out cookie options
    let cookieOptions = {
        sameSite: 'strict', // process.env.NODE_ENV !== "development",
        httpOnly: true,
        secure: process.env.NODE_ENV !== "development"
    };
    if (loginRecord.persistent)
    {
        // Set expiration date
        cookieOptions.expires = new Date(loginRecord.expiry * 1000);
    };

    // Return csrf token
    res.setHeader("x-csrf-token", loginRecord.csrf);


    // Return the login 
    let loginKey = `msk-${loginRecord.loginId}-${iv}-${loginRecord.rotation}`;
    res.cookie('msk-login-key', loginKey, cookieOptions);
}

router.post('/login', asyncHandler(async (req, res) => {
    
    let imap;
    try
    {
        // Encrypt it
        let encrypted = Utils.encryptJson(config.encryption_key, {
            user: req.body.user,
            password: req.body.pass
        });

        // Work out when the login expires
        // For non-persistent logins, keep them in the db for 1 day
        let expiryDays = req.body.persistent ? config.persistent_login_days : 1
        let expiry = Date.now() + 1000 * 60 * 60 * 24 * expiryDays;
        
        // Store it
        let loginRecord = { 
            loginId: Utils.random(16),
            expiry: Math.floor(expiry / 1000),
            user: req.body.user,
            data: encrypted.content,
            persistent: req.body.persistent ? 1 : 0,
            rotation: Utils.random(16),
            csrf: Utils.random(16),
            prev_rotation: "",
            prev_csrf: "",
            prev_time: 0,
        };
        db.insert("logins", loginRecord);

        // Return cookie
        setLoginKeyCookie(res, loginRecord, encrypted.iv);

        // Done
        res.json({});
    }
    catch (err)
    {
        throw new HttpError(401, err);
    }

}));


// Logout the current user
router.post('/logout', asyncHandler(async (req, res) => {

    // Parse the key
    let loginKey = parseLoginKey(req.cookies['msk-login-key']);

    // Remove from database
    db.run("DELETE FROM logins WHERE loginId=?", loginKey.loginId);

    // Clear session key and token cookies
    res.clearCookie('msk-login-key');

    // Close all sessions associated with this login
    let waitList = [];
    for (let [k,v] of sessionMap)
    {
        if (v.loginId == loginKey.loginId)
        {
            waitList.push(v.close());
            sessionMap.delete(k);
        }
    }
    if (waitList.length)
    {
        await Promise.allSettled(waitList);
    }

    // Done
    res.json({});
}));



// Login key verification
router.use((req, res, next) => {

    // Get the login key
    let loginKey = parseLoginKey(req.cookies['msk-login-key']);

    // Get the login
    let loginRecord = db.get("SELECT * FROM logins WHERE loginId=?", loginKey.loginId);
    if (!loginRecord)
        throw new HttpError(401, "invalid key");

    // Check valid
    let login = Utils.decryptJson(config.encryption_key, loginRecord.data, loginKey.iv);
        
    // Check it decrypted properly
    if (loginRecord.user != login.user)
        throw new Error("compromised key");

    // Compromise detection
    if (loginRecord.rotation != loginKey.rotation)
    {
        // Allow a 30-second roll over period of using the old rotation key
        if (loginRecord.prev_time == 0 || 
            loginRecord.prev_time + 30 * 1000 < Date.now() / 1000 ||
            loginRecord.prev_rotation != loginKey.rotation)
        {
            throw new HttpError(401, "compromised key")
        }
    }

    // Check CSRF token
    if (loginRecord.csrf != req.headers['x-csrf-token'])
    {
        // Allow a 30-second roll over period of using the old rotation key
        if (loginRecord.prev_time == 0 || 
            loginRecord.prev_time + 30 * 1000 < Date.now() / 1000 ||
            loginRecord.prev_csrf != req.headers['x-csrf-token'])
        {
            throw new HttpError(401, "compromised key");
        }
    }

    // Attach login info to request
    req.login = {
        loginRecord, 
        loginKey,
        login
    }

    // Carry on
    next();
});




// -------------------------- SESSION --------------------------


let sessionMap = new Map();

// Parse a session key
function parseSessionKey(key)
{
    if (key)
    {
        let parts = key.split('-');
        if (parts.length == 2 && parts[0] == 'msk')
            return parts[1];
    }

    throw new HttpError(401, "invalid key");
}



// Open session
router.post('/openSession', asyncHandler(async (req, res) => {

    // Rotate login key
    if (req.login.loginRecord.prev_time + 30 * 1000 < Date.now() / 1000)
    {
        req.login.loginRecord.rotation = Utils.random(16);
        req.login.loginRecord.csrf = Utils.random(16);
        db.run("UPDATE logins SET prev_rotation = rotation, prev_csrf = csrf, prev_time = ?, rotation=?, csrf=? WHERE loginId=?", 
            Math.floor(Date.now() / 1000),
            req.login.loginRecord.rotation,
            req.login.loginRecord.csrf, 
            req.login.loginRecord.loginId
        );
        setLoginKeyCookie(res, req.login.loginRecord, req.login.loginKey.iv);
    }


    // Login to IMAP to verify username/password
    try
    {
        let imap_config = Object.assign({}, config.imap, req.login.login);
        imap = new ImapPromise(imap_config);
        await imap.connect();
        await imap.end();
    }
    catch (err)
    {
        throw new HttpError(401, 'login failed');
    }

    // Now that we've validated the user name/password, invalidate any 
    // other sessions for the same user with a different password
    // Remove them all from the list first, then wait for them to close
    let waitList = [];
    for (let [k,v] of sessionMap)
    {
        if (v.user == req.login.login.user && 
            v.password != req.login.login.password)
        {
            waitList.push(v.close());
            sessionMap.delete(k);
        }
    }
    if (waitList.length)
    {
        await Promise.allSettled(waitList);
    }

    // Create and open session
    let session = new Session(req.login.loginRecord.loginId, req.login.login.user, req.login.login.password);
    await session.open();

    // Store it
    sessionMap.set(session.sessionId, session);

    // Return session id
    res.json({
        sessionId: `msk-${session.sessionId}`,
    })
}));


// Close session
router.post('/closeSession', asyncHandler(async (req, res) => {

    // Get the session id
    let sessionId = parseSessionKey(req.headers['x-session-id']);

    // Close session
    let session = sessionMap.get(sessionId);
    sessionMap.delete(sessionId)
    if (session)
    {
        await session.close();
    }

    // Done
    res.json({});
}));

// Login key verification
router.use((req, res, next) => {

    // Get the session id
    let sessionId = parseSessionKey(req.headers['x-session-id']);

    // Close session
    req.session = sessionMap.get(sessionId);
    if (!req.session)
        throw new HttpError(401, 'invalid key');

    // Remember activity
    req.session.access_time = Date.now();

    // Carry on
    next();

});

module.exports = router;