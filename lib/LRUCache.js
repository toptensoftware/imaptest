
// Implements a simple LRU cache
class LRUCache
{
    constructor(capacity)
    {
        this.capacity = capacity;
        this.map = new Map(); 
        this.head = {};
        this.tail = {};
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    get(key)
    {
        // Get element
        let c = this.map.get(key);
        if (c === undefined)
            return c;

        // Move to end of list
        if (c.next != this.tail)
        {
            // Remove from list
            c.prev.next = c.next;
            c.next.prev = c.prev;
    
            // Insert at end of list
            this.tail.prev.next = c;
            c.prev = this.tail.prev; 
            c.next = this.tail;
            this.tail.prev = c;
        }

        // Return value
        return c.value;
    }

    set(key, value)
    {
        // Check if key already exists
        if (this.get(key))
        {
            // get() will have moved to end of list, so easy to find to update the value
            this.tail.prev.value = value;
        }
        else
        {
            // check if map size is at capacity
            if (this.map.size === this.capacity)
            {
                // Remove oldest item (ie: item at head of list)
                this.map.delete(this.head.next.key);
                this.head.next = this.head.next.next;
                this.head.next.prev = this.head;
            }

            // Create new node
            let newNode = {
                value,
                key,
            };

            // Add to map
            this.map.set(key, newNode); 
            this.tail.prev.next = newNode;

            // Add to list
            newNode.prev = this.tail.prev;
            newNode.next = this.tail;
            this.tail.prev = newNode;
        }
    }
}

module.exports = LRUCache;
