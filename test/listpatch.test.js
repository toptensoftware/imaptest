const lp = require('../lib/ListPatch');


test('Patch Object (add field)', () => {

    let a = { apples: "red" };
    let b = { apples: "red", bananas: "yellow" };
    let p = lp.build_patch(a, b);
    expect(p).toEqual({bananas:"yellow"});

    lp.apply_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch Object (delete field)', () => {

    let a = { apples: "red", bananas: "yellow" };
    let b = { apples: "red" };
    let p = lp.build_patch(a, b);
    expect(p).toEqual({bananas:undefined});

    lp.apply_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch Object (change field)', () => {

    let a = { apples: "red", bananas: "yellow" };
    let b = { apples: "red", bananas: "green" };
    let p = lp.build_patch(a, b);
    expect(p).toEqual({bananas:"green"});

    lp.apply_patch(a, p);
    expect(a).toEqual(b);

});

function compare(a, b)
{
    return a.id - b.id;
}


test('Patch List (no changes)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
    ];
    let b = [
        { id: 10, name: "apples", color: "red" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p).toEqual([]);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (insert leading item)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
    ];
    let b = [
        { id: 5, name: "bananas", color: "yellow" },
        { id: 10, name: "apples", color: "red" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(1);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});



test('Patch List (insert trailing item)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
    ];
    let b = [
        { id: 10, name: "apples", color: "red" },
        { id: 20, name: "bananas", color: "yellow" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(1);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});


test('Patch List (insert internal item)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 20, name: "bananas", color: "yellow" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(1);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (insert multiple items)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 16, name: "pineapples", color: "yello" },
        { id: 20, name: "bananas", color: "yellow" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(1);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (delete leading item)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 15, name: "oranges", color: "orange" },
        { id: 20, name: "bananas", color: "yellow" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(1);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});


test('Patch List (delete internal item)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 20, name: "bananas", color: "yellow" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(1);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (delete trailing item)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(1);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (delete multiple items)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 16, name: "pineapples", color: "yello" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10, name: "apples", color: "red" },
        { id: 20, name: "bananas", color: "yellow" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(1);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (edit single item)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10, name: "apples", color: "green" },
        { id: 20, name: "bananas", color: "yellow" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(1);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (edit consecutive items)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10, name: "apples", color: "green" },
        { id: 20, name: "bananas", color: "green" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(1);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (replace single item)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10, name: "apples", color: "red" },
        { id: 17, name: "pineapples", color: "yellow" },
        { id: 20, name: "bananas", color: "yellow" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(2);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});


test('Patch List (replace all items)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10010, name: "apples", color: "green" },
        { id: 10020, name: "bananas", color: "green" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(2);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (insert and delete)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 17, name: "pineapples", color: "yellow" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10, name: "apples", color: "red" },
        { id: 13, name: "pears", color: "green" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 20, name: "bananas", color: "yellow" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(2);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (delete and insert)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 17, name: "pineapples", color: "yellow" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10, name: "apples", color: "red" },
        { id: 17, name: "pineapples", color: "yellow" },
        { id: 19, name: "oranges", color: "orange" },
        { id: 20, name: "bananas", color: "yellow" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(2);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (delete and insert and edit)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 17, name: "pineapples", color: "yellow" },
        { id: 20, name: "bananas", color: "yellow" },
    ];
    let b = [
        { id: 10, name: "apples", color: "red" },
        { id: 17, name: "pineapples", color: "yellow" },
        { id: 19, name: "oranges", color: "orange" },
        { id: 20, name: "bananas", color: "black" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(3);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

test('Patch List (multiple delete and multiple insert and multiple edit)', () => {

    let a = [
        { id: 10, name: "apples", color: "red" },
        { id: 15, name: "oranges", color: "orange" },
        { id: 16, name: "pineapples", color: "yellow" },
        { id: 20, name: "bananas", color: "yellow" },
        { id: 21, name: "kiwifruit", color: "brown" },
    ];
    let b = [
        { id: 16, name: "pineapples", color: "yellow" },
        { id: 17, name: "apples", color: "red" },
        { id: 18, name: "oranges", color: "orange" },
        { id: 20, name: "bananas", color: "yellow(mod)" },
        { id: 21, name: "kiwifruit", color: "brown(mod)" },
    ];

    let p = lp.build_list_patch(a, b, compare, lp.build_patch);
    expect(p.length).toEqual(3);

    lp.apply_list_patch(a, p);
    expect(a).toEqual(b);

});

