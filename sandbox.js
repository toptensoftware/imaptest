const Database = require('./lib/Database');
const Utils = require('./lib/Utils');

(async function(){

    await Database.open({
        db_server: "mongodb://localhost:44017/?directConnection=true", 
        db_name: "sandbox"
    });

    let coll = Database.db.collection("test");

    /*
    await coll.insertOne({
        flags: 0
    });
    */

    await coll.updateMany(
        { },
        { $bit: { flags: { or: 2 } }  }
    )


    Database.close();
})();