const Utils = require('./Utils');

class MultiValueMap
{
    constructor()
    {
        this._map = new Map();
    }

    get size()
    {
        return this._map.size;
    }

    get(key)
    {
        return this._map.get(message_id);
    }

    add(key, value)
    {
        let arr = this._map.get(key);
        if (arr === undefined)
        {
            arr = [];
            this._map.set(key, arr);
        }
        arr.push(value);
    }

    delete(key)
    {
        this._map.delete(key);
    }

    has(key)
    {
        return this._map.has(key);
    }

    filter(key, predicate)
    {
        // Get the message list
        let arr = this._map.get(key);

        if (arr)
        {
            // Remove the message from the array
            if (Utils.inplace_filter(arr, predicate))
            {
                if (arr.length == 0)
                    this._map.delete(key);
            }
        }
    }
}


module.exports = MultiValueMap
