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

export default {
    groupBy,
    orderBy,
    compareStrings,
    queryString,
}
