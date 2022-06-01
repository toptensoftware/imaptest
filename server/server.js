const path = require('path');
const fs = require('fs');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
const morgan = require('morgan');

const Account = require('../lib/Account');
const ImapPromise = require('../lib/IMapPromise');
const Utils = require('../lib/Utils');

const HttpError = require('./HttpError');
const config = require('./config');
const { resolveSoa } = require('dns');


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
//app.use(morgan('tiny'));
app.use(morgan('combined'));
app.use(cors());
app.use(cookieParser())
app.use(bodyParser.json());
app.use(express.static("public"));

// Routes
app.use('/api', require('./auth'));
app.use('/api', require('./api'));

// Error handler
app.use((error, req, res, next) => {

    let r = {
        code: 500,
        message: error.message,
    }

    if (process.env.NODE_ENV == "development")
    {
        r.stack =  error.stack;
    }

    if (error instanceof HttpError)
    {
        r.code = error.code;
    }


    res.send(r.code, JSON.stringify(r, null, 4));
})

// Start server
const port = process.env.PORT || config.port || 4000;
app.listen(port, () => {
    console.log(`listening on ${port}`);
});