const { MongoParseError } = require("mongodb/lib/error");

class Utils
{
    static day_names = [
        "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
    ];

    static month_names = [
        "Jan", "Feb", "Mar", "Apr",
        "May", "Jun", "Jul", "Aug",
        "Sep", "Oct", "Nov", "Dec"
    ];

    static format_email_date(d)
    {
        let offs = d.getTimezoneOffset();
        let sign = offs < 0 ? '+' : '-';
        offs = Math.abs(offs);
        return  Utils.day_names[d.getDay()] + 
                ", " + d.getDate() + 
                " " + Utils.month_names[d.getMonth()] + 
                " " + d.getFullYear() + 
                " " + String(d.getHours()).padStart(2, '0') + 
                ":" + String(d.getMinutes()).padStart(2, '0') + 
                ":" + String(d.getSeconds()).padStart(2, '0') + 
                " " + sign
                    + String(Math.floor(offs/60)).padStart(2, '0') 
                    + String(offs % 60).padStart(2, '0');
    }

    // Filter an array inplace using predicate callback
    // Returns true if array was modified
    static inplace_filter(arr, predicate)
    {
        let original_length = arr.length;
        let i = original_length;
        while (i--)
        {
            if (!predicate(arr[i]))
                arr.splice(i, 1);
        }
        return arr.length != original_length;
    }

    static get_combined_header_value(hdrs, key)
    {
        let arr = hdrs[key];
        if (!arr)
            return "";

        return arr.join(' ');
    }

    static execAll(str, regex)
    {
        let matches = [];
        let match;
        while (match = regex.exec(str)) {
            matches.push(match)
        }
        return matches;
    }

    static message_flags_mask(flagStrings)
    {
        let r = (flagStrings.indexOf('\\Seen') < 0 ? 2 : 0) |
                (flagStrings.indexOf('\\Flagged') >= 0 ? 1 : 0);
        return r;
    }

    static clean_message_id(hdrs)
    {
        // Is there a message id?
        let id = Utils.get_combined_header_value(hdrs, 'message-id')
        let m = id.match(/\<(.+?)\>/);
        return m ? m[1] : id;
    }

    static clean_references(hdrs)
    {
        let refs = [];

        let m1 = Utils.execAll(Utils.get_combined_header_value(hdrs, 'in-reply-to'), /\<(.+?)\>/g);
        if (m1)
            refs = m1.map(x => x[1]);
        
        let m2 = Utils.execAll(Utils.get_combined_header_value(hdrs, 'references'), /\<(.+?)\>/g);
        if (m2)
            refs = refs.concat(m2.map(x=>x[1]));

        refs = [...new Set(refs)];

        if (refs.length == 0)
            return undefined;
        return refs;
    }

    static iterate_uids(uids, erange)
    {
        if (!erange)
        {
            let pos = 0;
            return {
                current: () => uids[pos],
                eof: () => pos == uids.length,
                next: () => pos++,
            }
        }
        else
        {
            let pos = -1;
            let min = 0;
            let max = 0;
            let current = 0;
            let iter = {
                current: () => current,
                eof: () => pos == uids.length,
                next: () => 
                {
                    // Within range
                    if (pos >= 0 && current < max)
                    {
                        current++;
                        return;
                    }
    
                    // Move to next
                    pos++;
    
                    if (pos >= uids.length)
                        return;
    
                    // Parse it
                    let colonPos = uids[pos].indexOf(':');
                    if (colonPos >= 0)
                    {
                        min = parseInt(uids[pos].substring(0, colonPos));
                        max = parseInt(uids[pos].substring(colonPos+1));
                        if (min > max)
                        {
                            let temp = min;
                            min = max;
                            max = temp;
                        }
                    }
                    else
                    {
                        min = max = parseInt(uids[pos]);
                    }
                    current = min;
                }
            }
            iter.next();
            return iter;
        }
    }

    static async batch_work(items, batch_size, callback)
    {
        let pos = 0;
        while (pos < items.length)
        {
            // Get the batch
            let batch = items.slice(pos, pos + batch_size);

            // Call handler
            let r = callback(batch);
            if (r instanceof Promise)
                await r;

            // Carry on...
            pos += batch_size;
        }
    }

    static compare_conversations(a, b)
    {
        if (a.date != b.date)
            return a.date - b.date;
        
        if (a.conversation_id < b.conversation_id)
            return -1;
        if (a.conversation_ud > b.conversation_id)
            return 1;
        return 0;
    }

    // Generates a list of edits to make two sorted arrays equal
    // (will work on unsorted arrays but will often give terrible results)
    // The return value is an array of operations:
    // {
    //     op:      'i' = insert, 'd' = delete, 'u' = update
    //     oi:      the index in the old array
    //     ni:      the index in the new array
    //     adjust:  an adjustment that reflects the inserts and deletes performed so far.
    //              by adding this value to oi you can get the correct index in the original
    //              array (after edits applied so far)
    // }
    // The compare callback is passed two objects (a and b) and should return a comparison
    // result between them:
    //    a < b => -1
    //    a > b => 1
    //    a == b => 0           (if the items are identical and unchanged)
    //    a == b => null        (if the items are the same identity but the item has changed 
    //                           in some way (generated 'u' ops)
    static generate_diff(oldList, newList, compare)
    {
        let edits = [];
        let oi = 0;
        let ni = 0;
        let adjust = 0;
        let olen = oldList.length;
        let nlen = newList.length;
        while (oi < olen || ni < nlen)
        {
            // Get entries
            let o = oi < olen ? oldList[oi] : null;
            let n = ni < nlen ? newList[ni] : null;
    
            // New entry at end?
            if (o == null)
            {
                edits.push( { op: "i", oi, ni, adjust } );
                adjust++;
                ni++;
                continue;
            }
    
            // Remove entry at end
            if (n == null)
            {
                edits.push( { op: "d", oi, ni, adjust } );
                oi++;
                continue;
            }

            // Compare items
            let diff = compare(o, n);

            // Same item unchanged
            if (diff == 0)
            {
                oi++;
                ni++;
                continue;
            }

            // Same item edited
            if (diff == null)
            {
                edits.push( { op: "u", oi, ni, adjust } )
                oi++;
                ni++;
                continue;
            }

            if (diff < 0)
            {
                // Delete old item
                edits.push( { op: "d", oi, ni, adjust } )
                oi++;
                adjust--;
            }
            else
            {
                // Insert new item
                edits.push( { op: 'i', oi, ni, adjust } )
                ni++;
                adjust++;
            }
        }     
        
        return edits;
    }
}

if (!Array.prototype.findIndexBinary)
{
    // Performs a binary search on the array.  The callback function
    // is passed a single value from the array and should return
    //  * > 0 if the passed value is larger than the search position
    //  * 0 if equal
    //  * < 0 if smaller
    Array.prototype.findIndexBinary = function(compare)
    {
        let lo = 0;
        let hi = this.length - 1;

        while (lo <= hi)
        {
            let mid = Math.floor((lo + hi) / 2);
            let comp = compare(this[mid]);
            if (comp == 0)
                return mid;
            if (comp < 0)
                lo = mid + 1;
            else
                hi = mid - 1;
        }

        return -lo - 1;
    }
}

if (!Array.prototype.sortedInsert)
{
    Array.prototype.sortedInsert = function(value, compare)
    {
        // Binary search
        let pos = this.findIndexBinary(compare);
        if (pos < 0)
        {
            // Convert to insert position
            pos = -(pos + 1);
        }
        else
        {
            // Insert matching items after other matching items
            pos++;
            while (pos < this.length && compare(this[pos]) == 0)
                pos++;
        }

        // Insert it
        this.splice(pos, 0, value);
    }
}

if (!Array.prototype.groupByToMap)
{
    Array.prototype.groupByToMap = function(group_fn)
    {
        let map = new Map();
        for (let i=0; i<this.length; i++)
        {
            let k = group_fn(this[i]);
            let group = map.get(k);
            if (!group)
            {
                group = [];
                map.set(k, group);
            }
            group.push(this[i]);
        }
        return map;
    }
}


module.exports = Utils;
