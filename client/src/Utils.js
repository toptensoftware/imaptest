
function groupBy(array, groupFn)
{
    let map = new Map();
    for (let i=0; i<array.length; i++)
    {
        let k = groupFn(array[i]);
        let group = map.get(k);
        if (!group)
        {
            group = [];
            map.set(k, group);
        }
        group.push(array[i]);
    }

    return [...map.keys()].map(x => ({
        group: x,
        items: map.get(x),
    }))
}

function orderBy(array, compareFn)
{
    let array2 = [...array];
    array2.sort(compareFn);
    return array2;
}

function any(array, predicate)
{
    for (let i of array)
    {
        if (predicate(i))
            return true;
    }
    return false;
}

function compareStrings(a, b)
{
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}

function queryString(args)
{
    if (!args)
        return "";
    let qs = Object.keys(args).map(key => `${encodeURIComponent(key)}=${encodeURIComponent(args[key])}`).join('&');    
    if (qs)
        return "?" + qs;
    else
        return "";
}

function formatDateFromSecondsShort(d)
{
    d = new Date(d * 1000);
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


function formatDateFromSecondsLong(d)
{
    let now = new Date();

    d = new Date(d * 1000);

    // Main date/time component
    let retv;
    if (d.getDate() == now.getDate() && d.getMonth() == now.getMonth() && d.getFullYear() == now.getFullYear())
        retv = d.toLocaleTimeString(undefined, { timeStyle: "short" });
    else
        retv = `${d.toLocaleDateString(undefined, { dateStyle: "full" } )} ${d.toLocaleTimeString(undefined, { timeStyle: "short"} )}`;

    // Add relative hint
    const deltaHours = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (deltaHours < 0 && deltaHours > -24)
    {
        const fmt = new Intl.RelativeTimeFormat();
        retv += ` (${fmt.format(Math.round(deltaHours), 'hours')})`
    }
    else
    {
        const deltaDays = deltaHours / 24;
        if (deltaDays < 0 && deltaDays >= 7)
        {
            const fmt = new Intl.RelativeTimeFormat();
            retv += ` (${fmt.format(Math.round(deltaHours), 'days')})`    
        }
    }

    return retv;
}

// From: https://newbedev.com/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
const units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
function niceBytes(x)
{
  let l = 0, n = parseInt(x, 10) || 0;

  while(n >= 1024 && ++l){
      n = n/1024;
  }
 
  //include a decimal point and a tenths-place digit if presenting 
  //less than ten of KB or greater units
  return(n.toFixed(n < 10 && l > 0 ? 1 : 0) + ' ' + units[l]);
}


// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
function luminance(R8bit,G8bit,B8bit)
{
    let RsRGB = R8bit/255;
    let GsRGB = G8bit/255;
    let BsRGB = B8bit/255;
    let R = RsRGB <= 0.03928 ? RsRGB/12.92 : ((RsRGB+0.055)/1.055) ** 2.4;
    let G = GsRGB <= 0.03928 ? GsRGB/12.92 : ((GsRGB+0.055)/1.055) ** 2.4;
    let B = BsRGB <= 0.03928 ? BsRGB/12.92 : ((BsRGB+0.055)/1.055) ** 2.4;
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Parse a string in css rgb(r,g,b) format
function parseRgbString(str)
{
    let m = str.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (m)
        return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
    return;
}

// Parse a color in any valid css format
function parseColor(color)
{
    let div = document.createElement('div');
    div.style.color = color;
    div.style.display = "none";
    document.body.appendChild(div);
    let result = parseRgbString(getComputedStyle(div).color);
    div.parentNode.removeChild(div);
    return result;
}

export default {
    groupBy,
    orderBy,
    any,
    compareStrings,
    queryString,
    formatDateFromSecondsShort,
    formatDateFromSecondsLong,
    niceBytes,
    luminance,
    parseRgbString,
    parseColor,
}
