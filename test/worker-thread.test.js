const { wrap } = require('module');
const path = require('path');
const WorkerThread = require('../lib/WorkerThread');


test('Worker Thread Test', async () => {

    // Create Worker
    let wt = new WorkerThread();
    let o = await wt.createObject(path.join(__dirname, "Worker.js"), null, "Apples", "Pears");

    // Test basic ops
    expect(await o.getP1()).toEqual("Apples");
    expect(await o.getP2()).toEqual("Pears");
    expect(await o.concat()).toEqual("Apples-Pears");
    await o.setP1("Hello");
    await o.setP2("World");
    expect(await o.concat()).toEqual("Hello-World");

    // Async method
    expect(await o.asyncMethod()).toEqual("Did Delay");

    // Callbacks
    let callbackData;
    function callback(data) 
    {
        callbackData = data
    };
    await o.on('event', callback);
    await o.triggerCallback();
    expect(callbackData).toEqual("Callback Data");

    // Clean up
    await o.release();
    await wt.terminate();
});

