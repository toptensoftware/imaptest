let assert = require('assert');
let lp = require('./lib/ListPatch');

let oldList = [
    { id: 10, count: 1, subject: "apples", unread:true },
    { id: 20, count: 1, subject: "pears", unread:true },
    { id: 30, count: 1, subject: "bananas", unread:true },
    { id: 40, count: 1, subject: "oranges", unread:true },
    { id: 50, count: 1, subject: "pineapples", unread:true },
]


let newList = [
    { id: 10, count: 1, subject: "apples", unread:true },
    { id: 20, count: 1, subject: "pears", unread:true },
    { id: 30, count: 15, subject: "bananas", unread:true },
    { id: 40, count: 1, subject: "oranges", unread:true },
    { id: 50, count: 1, subject: "pineapples", unread:true },
]


let edits = lp.build_list_patch(oldList, newList, (a, b) => a.id - b.id, lp.build_patch);

lp.apply_list_patch(oldList, newList, edits);

console.log(JSON.stringify(edits));

//console.log(JSON.stringify(oldList, null, 4));

assert.deepEqual(oldList, newList);

console.log("OK");