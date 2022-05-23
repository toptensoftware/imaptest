const Utils = require('./lib/Utils');
const assert = require('assert');
const AsyncReadersWriter = require('./lib/AsyncReadersWriter');


let lock = new AsyncReadersWriter();

let currentTime = 0;
let pending_delays = [];
function delay_dispatcher()
{
    if (pending_delays == null)
        return;
    
    console.log(`tick ${currentTime}`);
    for (let i=pending_delays.length-1; i>=0; i--)
    {
        if (pending_delays[i].due == currentTime)
        {
            let cb = pending_delays[i].callback;
            pending_delays.splice(i, 1);
            cb();
        }
    }
    currentTime++;

    if (currentTime < 100)
        setImmediate(delay_dispatcher);
}

function start_delay_dispatcher()
{
    setImmediate(delay_dispatcher);
}

function stop_delay_dispatcher()
{
    pending_delays = null;
}

function delay(period, callback)
{
    if (callback)
    {
        pending_delays.push({
            due: currentTime + period - 1,
            callback: callback,
        })
    }
    else
    {
        return new Promise((resolve, reject) => {
            delay(period, resolve);
        });

    }
}



async function worker(name, periods)
{
    for (let i=0; i < periods.length; i++)
    {
        if (periods[i] > 0)
        {
            console.log(`${name}: step #${i+1} - request read lock`)
            await lock.read(async () => {

                console.log(`${name}: delaying ${periods[i]}`)
                await delay(periods[i])
                console.log(`${name}: expired`)

            });
            console.log(`${name}: released read lock`)
        }
        else
        {
            console.log(`${name}: step #${i+1} - requesting write lock`)
            await lock.write(async () => {

                console.log(`${name}: delaying ${-periods[i]}`)
                await delay(-periods[i])
                console.log(`${name}: expired`)

            });
            console.log(`${name}: released write lock`)
        }
    }
}

(async function () {

    start_delay_dispatcher();

    let promises = [
        worker("A", [1, -1, 1]),
        worker("B", [1, -1, 1]),
        worker("C", [1, 1, 1]),
    ];

    await Promise.all(promises);

    stop_delay_dispatcher();
    
    console.log("Finished!");
    

})();











const AsyncReadersWriter = require('./lib/AsyncReadersWriter');

function delay(period)
{
    return new Promise((resolve) => setTimeout(resolve, period));
}

let active_readers = 0;
let active_writers = 0;
let total_ops_executed = 0;

async function writer(name)
{
    assert(active_writers == 0);
    assert(active_readers == 0);

    active_writers++;
    console.log(`   In Writer ${name} (${active_readers}/${active_writers})`);
    await delay(Math.floor(Math.random() * 50));
    total_ops_executed++;
    //console.log(`   Leave Writer ${name} (${active_readers}/${active_writers}) ${total_ops_executed}`);
    active_writers--;
}

async function reader(name)
{
    assert(active_writers == 0);

    active_readers++;
    console.log(`   In Reader ${name} (${active_readers}/${active_writers})`);
    await delay(Math.floor(Math.random() * 50));
    total_ops_executed++;
    //console.log(`   Leave Reader ${name} (${active_readers}/${active_writers}) ${total_ops_executed}`);
    active_readers--;
}

let lock = new AsyncReadersWriter();

async function client(cid) {

    for (let i=0; i<10; i++)
    {
        let name = `client ${cid} op ${i+1}`;
        if (Math.random() < 0.5)
        {
            //console.log(`start reader ${name}`)
            await lock.read(reader, name);
            //console.log(`finis reader ${name}`)
        }
        else
        {
            //console.log(`start writer ${name}`)
            await lock.write(writer, name);
            //console.log(`finish writer ${name}`)
        }
    }
};


let finished = false;
function keep_alive()
{
    setTimeout(function() {
        if (!finsihed) 
            keep_alive();
    }, 100);
}

(async function () {


    let promises = [];
    for (let i=0; i<20; i++)
        promises.push(client(i+1));

    await Promise.all(promises);

    finished = true;
    console.log(`Finished! ${total_ops_executed}`);

})();

