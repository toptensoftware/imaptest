let Sanitize = require('./Sanitize');

// Convert a fetched and flattened message into HTML
// fs is the flattened structure
function MessageToHtml(fs)
{
    let html = "";
    let hasColor = false;

    for (let p of fs.parts)
    {
        if (p.type == 'message' && p.subtype == 'delivery-status')
        {
            html += "<hr />\n";
            html += `<pre>` + p.data + `</pre>\n`;
        }
        else if (p.type == 'text')
        {
            if (p.subtype == 'plain')
            {
                // Easy
                html += `<pre>` + p.data + `</pre>\n`;
            }
            else
            {
                // Not so easy.  Sanitize and replace `cid:` references
                // to fetch related parts
                let clean = Sanitize.Html(p.data, (cid) => {
                    let relatedPart = p.related[`<${cid}>`];
                    if (relatedPart)
                        return `/api/bodypart/${fs.quid}/${relatedPart.partID}`;
                });
                html += clean.clean;
                hasColor |= clean.hasColor;
            }
        }
        else if (p.type == 'image')
        {
            html += `<img src='/api/bodypart/${fs.quid}/${p.partID}' />\n`;
        }
    }

    html += '\n';
    
    return {
        hasColor,
        html
    }
}


module.exports = MessageToHtml;