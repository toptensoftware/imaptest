const _ = require('lodash');
const fs = require('fs');

let defaultConfig = {

    // Where to store data files
    data_dir: "./data",


    auth: {
        // For encryption of session keys
        encryption_key: "3Q02pJrfVbptLmab9kqWA73S027fsqBe",

        // How long persistent login (aka "Trust this device and keep me logged in")
        // should stay logged in.
        persistent_login_days: 30,
    
        // Enable CSRF tokens (disabled in development by default)
        use_csrf: process.env.NODE_ENV !== "development",

        // How often to rotate login keys
        rotate_login_key_seconds: 60,
    },

    // Imap configuration
    "imap": {
        "port": 993,
        "tls": true
    }

}

// Load Config
let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Merge with default
config = _.merge({}, defaultConfig, config);

// Given user email address get the IMAP configuration
config.imapForUser = function(email)
{
    // Get the domain part of the email addres
    let atPos = email.indexOf('@');
    if (atPos < 0)
        throw new Error("Invalid email address");
    let domain = email.substring(atPos + 1);

    // Find the config
    let imap = this.imap[domain];

    // And merge with defaults
    return Object.assign({ 
        port: 993,
        tls: true,
    }, imap);
}

module.exports = config;