// WorkerThread.js
//
// Implements a simple worker thread that supports instantiating object
// and then async invocation of either async or sync methods on that object
//
// To use:
// 
// 1. Create an instance of the worker thread
//
//      let wt = new WorkerThread();
//
// 2. Create object instances in the worker thread
//
//      let o = wt.createObject(path.join(__dirname, "./MyObject.js"), null, constructorArg1, etc...);
//
//    The first parameter is the name of a file to `require()` - it should be fully qualified
//    The second parameter is an optional name of an of an object returned from
//      the `require` to be used as the constructor.  If not specified, the value
//      returned from `require` itself is used as the constructor.
//    Any other args are passed to the constructor.
//
// 3. createObject returns a proxy object that can be used from the main thread to 
//    invoke the real object in the worker thread
//
//      let result = await o.DoSomeCpuIntensiveWork(arg1, arg2, etc...)
//
// 4. When finished with an object you must explicitly release it:
//
//      await o.release();
//
// 5. When finished with the thread, terminate it:
//
//      await wt.terminate();
//
// Notes:
// * all arguments and returned value need to confirm to the rules of
//   worker thread postMessage calls.
// * the methods invoked on the worker object can be either async or sync.
// * async target methods must return a Promise... other `thenable` object 
//   won't work
// 

const {
    Worker, isMainThread, parentPort, workerData
} = require('node:worker_threads');
const path = require('path');

if (isMainThread)
{
    // Handler for returned main thread proxies.
    ProxyHandler = {

        set: function(obj, prop, value) 
        {
            return obj[prop] = value;
        },

        get: function(target, prop)
        {
            // Don't forward "then" calls
            if (prop == 'then')
                return undefined;

            if (target.hasOwnProperty(prop))
                return target[prop];

            // Create and return proxy function
            return function()
            {
                // Invoke the worker...
                return target.workerThread.invoke(
                    target.objectId,
                    prop, 
                    Array.prototype.slice.call(arguments)
                );
            }
        },


    }

    // Manages a single worker thread instance
    class WorkerThread
    {
        // Constructor
        constructor()
        {
            this.nextObjectId = 1;
            this.nextInvokeId = 1;
            this.pending = new Map();
            this.worker = new Worker(__filename)
            this.worker.on('message', this.onMessage.bind(this));
            this.worker.on('error', this.onError.bind(this));
            this.worker.on('exit', this.onExit.bind(this));
        }

        // Terminates the work.  Can be await to known
        // when the thread is finished.
        terminate()
        {
            return this.worker.terminate();
        }

        // Create an object in the worker thread
        // requireName - the name of a file to be `require()` for the object constructor
        //               (nb: this should be fully qualified)
        // objName - the name of the constructor sub-object (or null to use the value returned
        //           from `require` as the constructor)
        // Any additional args will be passed to the target object constructor
        createObject(requireName, objName)
        {
            if (!path.isAbsolute(requireName))
                throw new Error("The requireName path must be fully qualified");
            
            return new Promise((resolve, reject) => {

                // Setup the async call
                let invokeId = this.nextInvokeId++;
                this.pending.set(invokeId, { resolve, reject });

                // Allocate an object id
                let objectId = this.nextObjectId++;

                // Post it
                this.worker.postMessage({
                    action: "construct",
                    invokeId,
                    objectId,
                    requireName, 
                    objName,
                    args: Array.prototype.slice.call(arguments, 2)
                });

            });
        }

        // Invoke a method on the target object (used internally by the proxy)
        // objectId - id of the object to invoke
        // fnName - name of the method to invoke
        // args - an array of arguments to pass to the function call
        invoke(objectId, fnName, args)
        {
            return new Promise((resolve, reject) => {

                // Setup the async call
                let invokeId = this.nextInvokeId++;
                this.pending.set(invokeId, { resolve, reject });

                // Post it
                this.worker.postMessage({
                    action: "invoke",
                    invokeId,
                    objectId,
                    fnName,
                    args
                });
            });

        }

        // Handle reply messages from the worker thread
        onMessage(msg)
        {
            // Find the pending resolve/reject and remove
            // from the map now that we've received it
            let rr = this.pending.get(msg.invokeId);
            this.pending.delete(msg.invokeId);

            // Reject if failed
            if (msg.err)
            {
                rr.reject(msg.err);
                return;
            }

            // If the call was to construct an object, create and return
            // its proxy.
            if (msg.action == "construct")
            {
                // This object holds details about the target object
                let obj = {
                    objectId: msg.result,
                    workerThread: this,
                }

                // And we wrap it in a proxy
                msg.result = new Proxy(obj, ProxyHandler);
            }

            // Done
            rr.resolve(msg.result);
        }

        onError(err)
        {
            // TODO
            debugger;
        }

        onExit()
        {
            // TODO
            debugger;
        }
    }
    
    // Export class
    module.exports = WorkerThread;
}
else
{
    // A map of objectId => object instance
    let objMap = new Map();

    // Listen for messages
    parentPort.on('message', async (msg) => {

        try
        {
            let result;
            switch (msg.action)
            {
                case "construct":
                {
                    // Get the constructor
                    let req = require(msg.requireName);
                    let cons = msg.objName ? req[msg.objName] : req;
    
                    // Call it
                    let obj = new cons(...msg.args);

                    // Store the object reference
                    objMap.set(msg.objectId, obj);

                    // Result is the id of the object we created
                    result = msg.objectId;
                    break;
                }
    
                case "invoke":
                {
                    if (msg.fnName == "release")
                    {
                        // Special case to release object.  Just remove it from
                        // the map so it can be collected
                        objMap.delete(msg.objectId);
                    }
                    else
                    {
                        // Get the target object
                        let obj = objMap.get(msg.objectId);

                        // Invoke it
                        result = obj[msg.fnName](...msg.args);

                        // Handle async methods
                        if (result instanceof Promise)
                        {
                            result.then((r) => {

                                parentPort.postMessage({ 
                                    action: msg.action, 
                                    invokeId: msg.invokeId, 
                                    result: r
                                });

                            }).catch((err) => {

                                parentPort.postMessage({ 
                                    action:msg.action, 
                                    invokeId: msg.invokeId, 
                                    err 
                                });

                            });
                            return;
                        }
                    }
                }
                break;

                default:
                    // What the?
                    throw new Error("Unknown worker thread action");
            }

            // Post result message
            parentPort.postMessage({ 
                action: msg.action, 
                invokeId: msg.invokeId, 
                result
            });
        }
        catch (err)
        {
            // Post error message
            parentPort.postMessage({ 
                action:msg.action, 
                invokeId: msg.invokeId, 
                err 
            });
        }
    });
}