const sanitizeHtml = require('sanitize-html');

class Sanitize
{
    static Html(html)
    {
        let clean = sanitizeHtml(html, {
            allowedTags: [
                "address", "article", "aside", "footer", "header", "h1", "h2", "h3", "h4",
                "h5", "h6", "hgroup", "main", "nav", "section", "blockquote", "dd", "div",
                "dl", "dt", "figcaption", "figure", "hr", "li", "main", "ol", "p", "pre",
                "ul", "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn",
                "em", "i", "kbd", "mark", "q", "rb", "rp", "rt", "rtc", "ruby", "s", "samp",
                "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr", "caption",
                "col", "colgroup", "table", "tbody", "td", "tfoot", "th", "thead", "tr",
                "img",
            ],
            allowedAttributes: {
                "*": [ 'class', 'style', 'align', 'valign', 'nowrap', 'border' ],
                a: [ 'href', 'name', 'target' ],
                img: [ 'src', 'srcset', 'alt', 'title', 'width', 'height', 'loading' ],
                table: [ 'cellspacing', 'cellpadding' ],
            },
            allowedStyles: {
                '*': {
                    'color': [
                        /^#(0x)?[0-9a-f]+$/i, 
                        /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/
                    ],
                    'text-align': [
                        /^left$/, 
                        /^right$/, 
                        /^center$/
                    ],
                    'font-size': [
                        /^\d+(?:pt|px|em|rem|%)$/
                    ],
                    'font-family': [
                        /^.*$/
                    ]
                },
            },
            transformTags: {
                'body': function(tagName, attribs)
                {
                    return {
                        tagName: "div",
                        attribs: attribs,
                    }
                },
                'img': function(tagName, attribs)
                {
                    if (attribs.src?.startsWith("cid:"))
                    {
                        attribs.src = `//api/bodypart?cid=${attribs.src.substring(4)}`;
                    }
                    return { tagName, attribs };
                }
            }
        });

        clean = `<div class="message-body">\n${clean}\n</div>`;

        return clean;
    }
}

module.exports = Sanitize;