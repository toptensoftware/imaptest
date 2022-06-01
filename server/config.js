const fs = require('fs');

let defaultConfig = {

    // Where to store data files
    data_dir: "./data",

    // For encryption of session keys
    encryption_key: "3Q02pJrfVbptLmab9kqWA73S027fsqBe",

    // How long persistent login (aka "Trust this device and keep me logged in")
    // should stay logged in.
    persistent_login_days: 30,

    // How long to keep session keys cached in memory before
    // reloading from DB
    session_key_cache_seconds: 300,

    // Enable CSRF tokens (disabled in development by default)
    use_csrf_tokens: process.env.NODE_ENV !== "development",

    // How often to regenerate CSRF tokens. Se to zero for every request
    // but note this will also hit the DB on every request
    csrf_token_regenerate_seconds: 60,

    // Imap configuration
    "imap": {
        "port": 993,
        "tls": true
    }

}

// Load Config
let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Merge with default
config = Object.assign({}, defaultConfig, config);

module.exports = config;