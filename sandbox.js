const Utils = require('./lib/Utils');
const assert = require('assert');

let o = [10, 20, 30];
let n = [1, 2, -10, 15, 16, 25, 26, 33, 35, -40];

console.log(JSON.stringify(o));
console.log(JSON.stringify(n));

function compare(a,b) {
    if (a == b)
        return 0;
    if (a == -b)
        return null;
    return a - b;
}

// Generate edits
let edits = Utils.generate_diff(o, n, compare);
edits.forEach(x => console.log(JSON.stringify(x)));


// Apply edits
for (let e of edits)
{
    switch (e.op)
    {
        case 'i':
            o.splice(e.oi + e.adjust, 0, n[e.ni]);
            break;

        case 'd':
            o.splice(e.oi + e.adjust, 1);
            break;

        case 'u':
            o[e.oi + e.adjust] = n[e.ni];
            break;
    }
}

console.log(JSON.stringify(o));

assert.deepEqual(o, n);
console.log("Success!");
