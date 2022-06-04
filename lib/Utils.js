const addrparser = require('address-rfc2822');
const crypto = require('crypto');

class Utils
{
    formatDate(d)
    {
        let now = new Date();
    
        // Today?
        if (d.getDate() == now.getDate() && d.getMonth() == now.getMonth() && d.getFullYear() == now.getFullYear())
            return d.toLocaleTimeString(undefined, { timeStyle: "short" });
    
        // This year?
        if (d.getYear() == now.getYear())
        {
            return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
        }
    
        return d.toLocaleDateString(undefined, { dateStyle: "short" });
    }
    


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

    static get_combined_header_value(hdrs, key, joinWith)
    {
        let arr = hdrs[key];
        if (!arr)
            return "";

        return arr.join(joinWith);
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
        let id = Utils.get_combined_header_value(hdrs, 'message-id', ' ')
        let m = id.match(/\<(.+?)\>/);
        return m ? m[1] : id;
    }

    static clean_references(hdrs)
    {
        let refs = [];

        let m1 = Utils.execAll(Utils.get_combined_header_value(hdrs, 'in-reply-to', ' '), /\<(.+?)\>/g);
        if (m1)
            refs = m1.map(x => x[1]);
        
        let m2 = Utils.execAll(Utils.get_combined_header_value(hdrs, 'references', ' '), /\<(.+?)\>/g);
        if (m2)
            refs = refs.concat(m2.map(x=>x[1]));

        // Also include self in list of references (makes look up in conversation building easier)
        refs.push(Utils.clean_message_id(hdrs));

        refs = [...new Set(refs)];

        if (refs.length == 0)
            return undefined;
        return refs;
    }

    static participants_from_headers(hdrs)
    {
        let from = Utils.get_combined_header_value(hdrs, 'from');
        let to = Utils.get_combined_header_value(hdrs, 'to');
        return Utils.combine_address_list(from, to);
    }

    static iterate_uids(uids, erange)
    {
        if (!uids)
            uids = [];
            
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
            return b.date - a.date;     // Date descending
        
        if (a.conversation_id < b.conversation_id)
            return -1;
        if (a.conversation_ud > b.conversation_id)
            return 1;
        return 0;
    }

    static combine_address_list(a, b)
    {
        if (a && b)
            return a + "," + b;
        if (a)
            return a;
        if (b)
            return b;
        return "";
    }

    // Parse an RFC2822 style address list
    static split_address_list(str, intoArray)
    {
        let len = str.length;
        let inQuote = false;
        let commentDepth = 0;
        let buf = "";
        for (let i=0; i<len; i++)
        {
            let ch = str[i];

            // In quote?
            if (inQuote)
            {
                // End of quote
                if (ch == '"')
                {
                    inQuote = false;
                    buf += ch;
                    continue;
                }

                // Escape character in quoted string
                if (ch == '\\')
                {
                    buf += '\\';
                    i++;
                    if (i < len)
                        buf += str[i];
                    continue;
                }

                // Append quoted character
                buf += ch;
                continue;
            }

            // In comment?
            if (commentDepth)
            {
                // End comment?
                if (ch == ')')
                {
                    commentDepth--;
                    continue;
                }
                
                // Nested comment?
                if (ch == '(')
                {
                    commentDepth++;
                    continue;
                }

                // Escape character in comment?
                if (ch == '\\')
                {
                    i++;
                    continue;
                }

                // Ignore comment content
                continue;
            }

            // Separator?
            if (ch == ',' || ch == ';')
            {
                buf = buf.trim();
                if (buf.length > 0)
                    intoArray.push(buf);
                buf = "";
                continue;
            }

            // Start of quote?
            if (ch == '"')
            {
                inQuote++;
                buf += ch;
                continue;
            }

            // Start of comment
            if (ch == '(')
            {
                commentDepth++;
                continue;
            }

            // All other characters
            buf += ch;
        }

        // Add trailing content
        if (commentDepth == 0)
        {
            buf = buf.trim();
            if (buf.length > 0)
                intoArray.push(buf);
        }

        // Done
        return intoArray;
    }

    static parse_participants(str)
    {
        // Split it
        let parts = [];
        Utils.split_address_list(str, parts);

        // Parse addresses
        let addresses = [];
        for (let p of parts)
        {
            try
            {
                addresses = [...addresses, ...addrparser.parse(p)];
            }
            catch (err)
            {
                // dont care
            }
        }

        // Now combine duplicates
        let map = new Map();
        for (let a of addresses)
        {
            let existing = map.get(a.address);
            if (existing)
            {
                if (existing.phrase && !a.phrase)
                    continue;
            }
            map.set(a.address, a);
        }

        // Convert map back to array
        return [...map.values()];
    }


    static clean_participants(str)
    {
        return Utils.parse_participants(str).map(x => x.format()).join(",");
    }


    // Format a date similar to PHP's date formatting
    // Based on this: https://gist.github.com/williamd5/56904a0a505fd8e18c646398e94135a6
    // plus added 'G' and 'A' support
    static format_date(format, date)
    {
        if (!date)
            return "N/A";
        if (!date || date === "") date = new Date();
        else if (!(date instanceof Date)) date = new Date(date.replace(/-/g, "/")); // attempt to convert string to date object

        let string = '',
            mo = date.getMonth(), // month (0-11)
            m1 = mo + 1, // month (1-12)
            dow = date.getDay(), // day of week (0-6)
            d = date.getDate(), // day of the month (1-31)
            y = date.getFullYear(), // 1999 or 2003
            h = date.getHours(), // hour (0-23)
            mi = date.getMinutes(), // minute (0-59)
            s = date.getSeconds(); // seconds (0-59)

        for (let i of format.match(/(\\)*./g))
            switch (i)
            {
                case 'j': // Day of the month without leading zeros  (1 to 31)
                    string += d;
                    break;

                case 'd': // Day of the month, 2 digits with leading zeros (01 to 31)
                    string += (d < 10) ? "0" + d : d;
                    break;

                case 'l': // (lowercase 'L') A full textual representation of the day of the week
                    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    string += days[dow];
                    break;

                case 'w': // Numeric representation of the day of the week (0=Sunday,1=Monday,...6=Saturday)
                    string += dow;
                    break;

                case 'D': // A textual representation of a day, three letters
                    var days = ["Sun", "Mon", "Tue", "Wed", "Thr", "Fri", "Sat"];
                    string += days[dow];
                    break;

                case 'm': // Numeric representation of a month, with leading zeros (01 to 12)
                    string += (m1 < 10) ? "0" + m1 : m1;
                    break;

                case 'n': // Numeric representation of a month, without leading zeros (1 to 12)
                    string += m1;
                    break;

                case 'F': // A full textual representation of a month, such as January or March 
                    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                    string += months[mo];
                    break;

                case 'M': // A short textual representation of a month, three letters (Jan - Dec)
                    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    string += months[mo];
                    break;

                case 'Y': // A full numeric representation of a year, 4 digits (1999 OR 2003)	
                    string += y;
                    break;

                case 'y': // A two digit representation of a year (99 OR 03)
                    string += y.toString().slice(-2);
                    break;

                case 'h': // 12-hour format of an hour with leading zeros (01 to 12)
                    var hour = (h === 0) ? 12 : h;
                    hour = (hour > 12) ? hour - 12 : hour;
                    string += (hour < 10) ? "0" + hour : hour;
                    break;

                case 'H': // 24-hour format of an hour with leading zeros (00 to 23)
                    string += (h < 10) ? "0" + h : h;
                    break;

                case 'g': // 12-hour format of an hour without leading zeros (1 to 12)
                    var hour = (h === 0) ? 12 : h;
                    string += (hour > 12) ? hour - 12 : hour;
                    break;

                case 'G': // 24-hour format of an hour without leading zeros (0 to 23)
                    string += h;
                    break;

                case 'a': // Lowercase Ante meridiem and Post meridiem (am or pm)
                    string += (h < 12) ? "am" : "pm";
                    break;

                case 'A': // Uppercase Ante meridiem and Post meridiem (am or pm)
                    string += (h < 12) ? "AM" : "PM";
                    break;

                case 'i': // Minutes with leading zeros (00 to 59)
                    string += (mi < 10) ? "0" + mi : mi;
                    break;

                case 's': // Seconds, with leading zeros (00 to 59)
                    string += (s < 10) ? "0" + s : s;
                    break;

                case 'c': // ISO 8601 date (eg: 2012-11-20T18:05:54.944Z)
                    string += date.toISOString();
                    break;

                default:
                    if (i.startsWith("\\")) i = i.substr(1);
                    string += i;
            }

        return string;
    }
    

    static random(length)
    {
        return crypto.randomBytes(length).toString('hex');
    }

    static encrypt(cypherKey, text)
    {
        const iv = crypto.randomBytes(16);
    
        const cipher = crypto.createCipheriv("aes-256-ctr", cypherKey, iv);
    
        const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    
        return {
            iv: iv.toString('hex'),
            content: encrypted.toString('hex')
        };
    };
    
    static decrypt(cypherKey, content, iv)
    {
        const decipher = crypto.createDecipheriv("aes-256-ctr", cypherKey, Buffer.from(iv, 'hex'));
    
        const decrpyted = Buffer.concat([decipher.update(Buffer.from(content, 'hex')), decipher.final()]);
    
        return decrpyted.toString();
    };

    static encryptJson(cypherKey, obj)
    {
        return Utils.encrypt(cypherKey, JSON.stringify(obj));
    };
    
    static decryptJson(cypherKey, content, iv)
    {
        return JSON.parse(Utils.decrypt(cypherKey, content, iv));
    };
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
