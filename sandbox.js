let assert = require('assert');


let folders = [
    { group: "A", order: 1, name: "snoozed", icon: "snooze", title: "Snoozed" },
    { group: "A", order: 3, name: "sent", icon: "send", title: "Sent" },
    { group: "C", order: 5, name: "trash", icon: "delete", title: "Trash" },
    { group: "C", order: 6, name: "junk", icon: "report", title: "Junk" },
    { group: "A", order: 2, name: "drafts", icon: "draft", title: "Drafts" },
    { group: "A", order: 4, name: "archive", icon: "archive", title: "Archive" },
    { group: "A", order: 0, name: "inbox", icon: "inbox", title: "Inbox", unread: 2 },
];

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


let r = groupBy(folders, x=>x.group);

console.log(JSON.stringify(r, null, 4));
