module.exports = 
{
    migrate: function(db)
    {
        db.migrate([

            function()
            {
                db.createTable({
                    tableName: "mailboxes",
                    columns: [
                        { rid: "INTEGER PRIMARY KEY AUTOINCREMENT" },
                        { name: "STRING NOT NULL" },
                        { data: "STRING NOT NULL" }
                    ],
                    indicies: [
                        {
                            unique: true,
                            columns: [
                                { name: "ASC" },
                            ]
                        },
                    ]
                });
            
                db.createTable({
                    tableName: "messages",
                    columns: [
                        { rid: "INTEGER PRIMARY KEY AUTOINCREMENT" },
                        { date: "INTEGER" },
                        { subject: "STRING" },
                        { message_id: "STRING NOT NULL" },
                        { mailbox: "STRING NOT NULL" },
                        { state: "INTEGER NOT NULL" },
                        { uid: "INTEGER NOT NULL" },
                        { flags: "INTEGER NOT NULL" }
                    ],
                    indicies: [
                        {
                            columns: [
                                { message_id: "ASC" },
                            ]
                        },
                        {
                            columns: [
                                { state: "ASC" },
                            ]
                        },
                        {
                            unique: true,
                            columns: [
                                { mailbox: "ASC" },
                                { uid: "ASC" },
                                { state: "ASC" },
                            ]
                        }
                    ]
                });
            
                db.createTable({
                    tableName: "message_references",
                    columns:[
                        { message_rid: "INTEGER NOT NULL" },
                        { reference: "STRING NOT NULL" },
                    ],
                    indicies: [
                        {
                            columns:[
                                { message_rid: "ASC" },
                            ]
                        },
                        {
                            columns:[
                                { reference: "ASC" },
                            ]
                        }
                    ]
                });
            
            
                db.createTable({
                    tableName: "conversations",
                    columns:[
                        { rid: "INTEGER PRIMARY KEY AUTOINCREMENT" },
                        { date: "INTEGER" },
                        { subject: "STRING" },
                        { flags: "INTEGER NOT NULL" },
                        { conversation_id: "STRING" }
                    ],
                    indicies: [
                        {
                            unique: true,
                            columns:[
                                { conversation_id: "ASC" },
                            ]
                        }
                    ]
                });
            
            
                db.createTable({
                    tableName: "conversation_messages",
                    columns:[
                        { conversation_rid: "INTEGER NOT NULL" },
                        { message_id: "STRING NOT NULL" }
                    ],
                    indicies: [
                        {
                            columns:[
                                { conversation_rid: "ASC" },
                            ]
                        },
                    ]
                });
            
            
                db.createTable({
                    tableName: "conversation_mailboxes",
                    columns:[
                        { conversation_rid: "INTEGER NOT NULL" },
                        { date: "INTEGER NOT NULL" },
                        { mailbox: "STRING NOT NULL" }
                    ],
                    indicies: [
                        {
                            columns:[
                                { conversation_rid: "ASC" },
                            ]
                        },
                        {
                            columns:[
                                { mailbox: "ASC" },
                                { date: "ASC" },
                            ]
                        }
                    ]
                });
            }
        
        ]);
    }
}