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
            tableName: "logins",
            columns: [
                { loginId: "STRING NOT NULL" },
                { expiry: "INTEGER NOT NULL" },
                { user: "STRING NOT NULL" },
                { data: "STRING NOT NULL" },
                { persistent: "BOOLEAN NOT NULL"},
                { rotation: "STRING NOT NULL" },
                { csrf: "STRING NOT NULL" },
                { prev_time: "INTEGER NOT NULL"},
                { prev_rotation: "STRING NOT NULL" },
                { prev_csrf: "STRING NOT NULL" },
            ],
            indicies: [
                {
                    unique: true,
                    columns: [
                        { loginId: "ASC" },
                    ]
                }
            ]
        });
    }
]);


module.exports = db;