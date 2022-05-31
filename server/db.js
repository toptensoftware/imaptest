const path = require('path');

const Database = require('../lib/Database');

const config = require('./config');


// Create server database
let db = new Database(path.join(config.data_dir, "server.db"));

// Migrate
db.migrate([
    function()
    {
        db.createTable({
            tableName: "sessions",
            columns: [
                { sessionId: "STRING NOT NULL" },
                { sessionToken: "STRING" },
                { timestamp: "INTEGER NOT NULL" },
                { user: "STRING NOT NULL" },
                { data: "STRING NOT NULL" }
            ],
            indicies: [
                {
                    unique: true,
                    columns: [
                        { sessionId: "ASC" },
                    ]
                }
            ]
        });
    }
]);


module.exports = db;