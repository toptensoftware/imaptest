const AsyncLock = require('./AsyncLock');

// Proxy handler
ProxyHandler = {
    get: function(target, prop)
    {
        // Get the target member
        let target_member = target[prop];

        // Only serialize functions
        if (typeof(target_member) !== 'function')
            return target_member;

        // Don't forward "then" calls
        if (prop == 'then')
            return undefined;

        // Return proxy function
        return function()
        {
            let fnArgs = arguments;
            return target.$lock.section(() => {
    
                return target_member.apply(target, fnArgs);
    
            });
        }
    },
}

function Serialize(target)
{
    target.$lock = new AsyncLock();
    return new Proxy(target, ProxyHandler);
}

module.exports = Serialize;