const path = require('path');
const fs = require('fs');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const Account = require('../lib/Account');
const ImapPromise = require('../lib/IMapPromise');
const Utils = require('../lib/Utils');

const HttpError = require('./HttpError');
const config = require('./config');


/*
let account;
(async () => {

    let a  = new Account(config);
    await a.open();
    await a.sync();
    account = a;

    console.log("Account synced");

})();
*/

// Create expression app
const app = express();

// Setup middleware
app.use(morgan('tiny'));
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api', require('./api'));

// Start server
const port = process.env.PORT || config.port || 4000;
app.listen(port, () => {
    console.log(`listening on ${port}`);
});