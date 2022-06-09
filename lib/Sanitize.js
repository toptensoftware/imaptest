const sanitizeHtml = require('sanitize-html');

let _rxColorHex = /(#(0x)?[0-9a-fA-F]+)/;
let _rxColorRgb = /(rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\))/
let _rxColorRgba = /(rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\,\s*(\d+(\.?\d*)?|\.\d+)\s*\))/
let _rxWord = /(\b[a-zA-Z0-9]+\b)/
let _rxNumber = /(\d+(\.?\d*)?|\.\d+)/
let _rxMetric = /((\d+(\.?\d*)?|\.\d+)(?:pt|px|em|ex|ch|rem|vw|vh|vmin|vmax|%)?)/

let rxNumber = new RegExp("^" + _rxNumber.source + "$");
let rxMetric = new RegExp("^" + _rxMetric.source + "$");
let rxMetrics = new RegExp("^(" + _rxMetric.source + "[ \t]*)+$");
let rxBorderStyle = /^(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset)$/

let foreColors = [];
let hasBackground = false;

// Fake regex for testing colors and recording the presence of color attributes
let rxColorFormats = [
    _rxColorHex, _rxColorRgb, _rxColorRgba
]
let rxBackColor = {
    test: function(value)
    {
        let isColor = rxColorFormats.some(x => x.test(value));
        hasBackground |= isColor;
        return isColor;
    }
}

let rxForeColor = {
    test: function(value)
    {
        let isColor = rxColorFormats.some(x => x.test(value));
        if (isColor)
            foreColors.push(value);
        return isColor;
    }
}

// Fake regex for testing "border" styles
let rxBorderParts = [
    rxMetric, rxForeColor, rxBorderStyle
]
let rxBorder = {
    test: function(value)
    {
        let parts = value.split(value).filter(x => x);
        return parts.every(x => rxBorderParts.some(y => y.test(x)));
    }
}

class Sanitize
{
    static cidMapper;


    static options = {
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
            "*": [ 'class', 'style', 'align', 'valign', 'nowrap', 'border', 'dir', 'width', 'height', 
                    'aria-hidden', 'rel', 'role', 'color', 'bgcolor' ],
            a: [ 'href', 'name', 'target' ],
            img: [ 'src', 'srcset', 'alt', 'title', 'width', 'height', 'loading' ],
            table: [ 'cellspacing', 'cellpadding' ],
            td: [ 'colspan' ],
            th: [ 'colspan' ],
        },
        allowedStyles: {
            '*': {
                'background-color': [ rxBackColor ],
                'border': [ rxBorder ],
                'border-bottom': [ rxBorder ],
                'border-left': [ rxBorder ],
                'border-right': [ rxBorder ],
                'border-top': [ rxBorder ],
                'border-collapse': [ /^separate|collapse|inherit|initial|unset$/ ],
                'border-spacing': [ rxMetrics ],
                'border-radius': [ rxMetrics ],
                'border-style': [ rxBorderStyle ],
                'box-sizing': [ /^border-box|content-box|inherit|initial|unset$/ ],
                'color': [ rxForeColor ],
                'clear': [ /^none|left|right|both|inherit|initial|unset$/ ],
                'display': [ /^none|inline|block|contents|flex|grid|inline-block|inline-flex|inline-grid|inline-table|list-item|run-in|table|table-caption|table-column-group|table-header-group|table-footer-group|table-row-group|table-cell|table-column|table-row|inherit|initial|unset$/ ],
                'float': [ /^none|left|right|inherit|initial|unset$/ ], 
                'font-size': [ rxMetric ],
                'font-family': [ /^.*$/ ],
                'font-weight': [
                    rxNumber,
                    /^normal|bold|lighter|bolder|inherit|initial|unset|revert|revert-layer|unset$/
                ],
                'height': [ rxMetric ],
                'line-height': [ rxMetric ],
                'margin': [ rxMetrics ],
                'margin-top': [ rxMetric ],
                'margin-bottom': [ rxMetric ],
                'margin-left': [ rxMetric ],
                'margin-right': [ rxMetric ],
                'max-width': [ rxMetric ],
                'max-height': [ rxMetric ],
                'min-width': [ rxMetric ],
                'min-height': [ rxMetric ],
                'object-fit': [ /^fill|contain|cover|none|scale-down|inherit|initial|unset$/ ],
                'overflow': [ /^visible|hidden|clip|scroll|auto|inherit|initial|unset$/ ],
                'padding': [ rxMetrics ],
                'padding-top': [ rxMetric ],
                'padding-bottom': [ rxMetric ],
                'padding-left': [ rxMetric ],
                'padding-right': [ rxMetric ],
                'table-layout': [ /^auto|fixed|inherit|initial|unset$/ ],
                'text-align': [ /^left|right|center$/ ],
                'text-decoration': [ /^underline|none|inherit|initial|unset$/ ],
                'text-decoration-skip': [ /^none|ink|objects|spaces|leading-spaces|trailing-spaces|edges|box-decoration|inherit|initial|unset$/ ],
                'text-overflow': [ /^clip|ellipsis|inherit|initial|unset$/ ],
                'text-transform': [ /^none|capitalize|uppercase|lowercase|inherit|initial|unset$/ ],
                'vertical-align': [ 
                    /^baseline|sub|super|top|text-top|middle|bottom|text-bottom|inherit|initial|unset$/,
                    rxMetric
                ],
                'width': [ rxMetric ],
                'word-wrap': [ /^normal|break-word|inherit|initial|unset$/ ],
            },
        },
        transformTags: {
            '*': function (tagName, attribs)
            {
                if (attribs.color)
                    foreColors.push(attribs.color);
                if (attribs.bgcolor)
                    hasBackground = true;
                return { tagName, attribs }
            },
            'body': function(tagName, attribs)
            {
                // Rename 'body' to 'div'
                return {
                    tagName: "div",
                    attribs: attribs,
                }
            },
            'img': function(tagName, attribs)
            {
                // Remap 'cid:' links to call api for content
                if (attribs.src?.startsWith("cid:"))
                {
                    let mapped = Sanitize.cidMapper?.(attribs.src.substring(4));
                    if (mapped)
                        attribs.src = mapped;
                    else
                        attribs.src = "";
                }
                return { tagName, attribs };
            },
            'a': function (tagName, attribs)
            {
                // Make sure all anchor tags have target="_blank"
                attribs.target = "_blank"
                return { tagName, attribs };
            }
        }
    };

    static Html(html, cidMapper)
    {
        // Tim eit
        let start = Date.now();
        
        // Reset state
        foreColors = []
        hasBackground = false;
        Sanitize.cidMapper = cidMapper;

        // Sanitize
        let clean = sanitizeHtml(html, Sanitize.options);

        // Clean up
        Sanitize.cidMapper = null;
        console.log("Sanitize took", Date.now() - start);
        return {
            foreColors,
            hasBackground,
            clean,
        }
    }
}

module.exports = Sanitize;