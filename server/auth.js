const express = require('express');
const asyncHandler = require('express-async-handler');

const ImapPromise = require('../lib/ImapPromise');
const Utils = require('../lib/Utils');
const HttpError = require('../lib/HttpError');

const db = require('./db');
const config = require('./config');
const Account = require('./Account');

// Create router
let router = express.Router();


// -------------------------- LOGIN --------------------------

// Trim logins once per day
function purgeExpiredLogins()
{
    db.run("DELETE FROM logins WHERE expiry < ?", Math.floor(Date.now() / 1000));
}
setInterval(purgeExpiredLogins, 1000 * 60 * 60 * 24);
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
    if (config.auth.use_csrf)
        res.setHeader("x-csrf-token", loginRecord.csrf);

    // Return the login 
    let loginKey = `msk-${loginRecord.loginId}-${iv}-${loginRecord.rotation}`;
    res.cookie('msk-login-key', loginKey, cookieOptions);
}

router.post('/login', asyncHandler(async (req, res) => {
    
    let imap;
    try
    {
        // Open account
        let login = {
            user: req.body.user,
            password: req.body.pass
        };

        // Open the account
        await Account.get(login.user, login.password);

        // Encrypt it
        let encrypted = Utils.encryptJson(config.auth.encryption_key, login);

        // Work out when the login expires
        // For non-persistent logins, keep them in the db for 1 day
        let expiryDays = req.body.persistent ? config.auth.persistent_login_days : 1
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

    // Clear login key cookie
    res.clearCookie('msk-login-key');

    // Done
    res.json({});
}));



// Login key verification
router.use(asyncHandler(async (req, res, next) => {

    // Get the login key
    let loginKey = parseLoginKey(req.cookies['msk-login-key']);

    // Get the login
    let loginRecord = db.get("SELECT * FROM logins WHERE loginId=?", loginKey.loginId);
    if (!loginRecord)
        throw new HttpError(401, "invalid key");

    // Decrypt record
    let login = Utils.decryptJson(config.auth.encryption_key, loginRecord.data, loginKey.iv);
    if (loginRecord.user != login.user)
        throw new Error("invalid key");

    // For all requests except for the event stream, check for login key compromise,
    // check csrf, and rotate the login key periodically.
    // Event stream is handle specially since HTML EventSource can't pass custom headers
    // and we don't want to have to specially handle the rotation of login keys in the
    // event stream response.
    if (req.url != '/events')
    {
        // Compromise detection
        if (config.auth.rotate_login_key_seconds !== false)
        {
            if (loginRecord.rotation != loginKey.rotation)
            {
                // Allow a 30-second grace period of using the old rotation key
                if (loginRecord.prev_time == 0 || 
                    loginRecord.prev_time + 30 * 1000 < Date.now() / 1000 ||
                    loginRecord.prev_rotation != loginKey.rotation)
                {
                    throw new HttpError(401, "compromised key")
                }
            }
        }

        // Check CSRF token
        if (config.auth.use_csrf)
        {
            if (loginRecord.csrf != req.headers['x-csrf-token'])
            {
                // Allow a 30-second grace period of using the old rotation key
                if (loginRecord.prev_time == 0 || 
                    loginRecord.prev_time + 30 * 1000 < Date.now() / 1000 ||
                    loginRecord.prev_csrf != req.headers['x-csrf-token'])
                {
                    throw new HttpError(401, "compromised key");
                }
            }
        }

        // Rotate login key
        if (config.auth.rotate_login_key_seconds !== false)
        {
            if (loginRecord.prev_time + config.auth.rotate_login_key_seconds * 1000 < Date.now() / 1000)
            {
                loginRecord.rotation = Utils.random(16);
                loginRecord.csrf = Utils.random(16);
                db.run("UPDATE logins SET prev_rotation = rotation, prev_csrf = csrf, prev_time = ?, rotation=?, csrf=? WHERE loginId=?", 
                    Math.floor(Date.now() / 1000),
                    loginRecord.rotation,
                    loginRecord.csrf, 
                    loginRecord.loginId
                );
                setLoginKeyCookie(res, loginRecord, loginKey.iv);
            }
        }
    }

    // Attach the account to the request
    try
    {
        req.login = login;
        req.account = await Account.get(login.user, login.password);
    }
    catch (err)
    {
        throw new HttpError(401, "failed to open account");
    }
    
    // Carry on
    next();
}));


module.exports = router;