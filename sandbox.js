const Database = require('./lib/Database');
const Utils = require('./lib/Utils');

(async function(){

    await Database.open({
        dbserver: "mongodb://localhost:44017/?directConnection=true", 
        dbname: "sandbox"
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