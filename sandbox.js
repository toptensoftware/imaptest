const Database = require('./lib/Database');
const Utils = require('./lib/Utils');

(async function(){

    await Database.open({
        dbserver: "mongodb://localhost:44017/?directConnection=true", 
        dbname: "sandbox"
    });

    let coll = Database.db.collection("test");

    let things = [];
    for (let i=0; i < 10000; i++)
    {
        things.push({
            myid: i,
            text: `This is thing ${i}`,
        })
    }

    let start = Date.now();

    //await coll.createIndex({ myid: 1 });

    await coll.deleteMany({});
    console.log(`Trashed in ${Date.now() - start}`);

    start = Date.now();
    await coll.insertMany(things)
    console.log(`Inserted in ${Date.now() - start}`);

    start = Date.now();
    let found = await coll.find({}, { projection: {_id: 0, myid: 1}}).toArray();
    console.log(`Found ${found.length} in ${Date.now() - start}`);

    /*
    start = Date.now();
    await Utils.batch_work(found, 500, async (batch) => {

        await coll.deleteMany({myid: { $in: batch.map(x => x.myid ) } } );

    });
    console.log(`Deleted in ${Date.now() - start}`);
    */

   
    let ops = [];
    Utils.batch_work(found, 1000, (batch) => {
        ops.push({ 
            deleteMany: 
            { 
                filter: 
                { 
                    myid: { $in:  batch.map(x => x.myid ) }
                }
            }
        });
    });
    
    start = Date.now();
    await coll.bulkWrite(ops);
    console.log(`Deleted in ${Date.now() - start}`);


    await Database.close();

    console.log("OK");

})();