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
        return this._map.get(key);
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
        // Get the value list
        let arr = this._map.get(key);

        if (arr)
        {
            // Remove the value from the array
            if (Utils.inplace_filter(arr, predicate))
            {
                if (arr.length == 0)
                    this._map.delete(key);
            }
        }
    }

    toJSON() 
    { 
        let o = {};
        for (let [k,v] of this._map)
        {
            o[k] = v;
        }
        return o;
    }
}


module.exports = MultiValueMap
