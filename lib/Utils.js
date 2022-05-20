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
}


module.exports = Utils;
