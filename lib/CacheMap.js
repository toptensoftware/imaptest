class CacheMap
{
    // Constructor
    constructor(max_duration)
    {
        this._map = new Map();
        this.max_duration = max_duration;
    }

    // Store a value in the cache
    set(key, value)
    {
        // Store the value and the time it was cached
        this._map.set(key, {
            cached_at: Date.now(),
            value: value,
        });
    }

    // Get a value
    get(key)
    {
        // Get value
        let val = this._map.get(key);

        // Found?
        if (val)
        {
            // Update cache time
            val.cached_at = Date.now();

            // Return actual value
            val = val.value;
        }

        // Trim
        this.trim();
        
        // Done
        return val;
    }

    // Trim values older than max_duration
    trim()
    {
        for (let [k,v] of this._map)
        {
            if (v.cached_at + this.max_duration < Date.now())
                this._map.delete(k);
        }
    }

}

module.exports = CacheMap;