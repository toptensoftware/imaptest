const fs = require('fs');

// Load Config
let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

module.exports = config;