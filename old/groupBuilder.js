const assert = require('assert');

const GroupBuilder = require('../lib/GroupBuilder');

describe('GroupBuilder', function () {
  
    it('can be empty', function () {

        let gb = new GroupBuilder();
        assert.equal(gb.groups.size, 0);
        assert.equal(gb.groupsById.size, 0);

    });

    it('can have single item', function () { 

        let gb = new GroupBuilder();
        gb.add("A", []);

        assert.equal(gb.groups.size, 1);
        assert.equal(gb.groupsById.size, 1);
        assert.equal(gb.groupsById.get("A").size, 1);
        assert.deepEqual([...gb.groupsById.get("A")], ["A"]);

    });

    it('can have ungrouped items', function () { 

        let gb = new GroupBuilder();
        gb.add("A", []);
        gb.add("B", []);

        assert.equal(gb.groups.size, 2);
        assert.equal(gb.groupsById.size, 2);
        assert.deepEqual([...gb.groupsById.get("A")], ["A"]);
        assert.deepEqual([...gb.groupsById.get("B")], ["B"]);
    });

    it('can have grouped items', function () { 

        let gb = new GroupBuilder();
        gb.add("A", []);
        gb.add("B", [ "A" ]);

        assert.equal(gb.groups.size, 1);
        assert.equal(gb.groupsById.size, 2);
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("B"));
        assert(gb.groups.has(gb.groupsById.get("A")));
    });

    it('can have circular references', function () { 

        let gb = new GroupBuilder();
        gb.add("A", [ "B" ]);
        gb.add("B", [ "A" ]);

        assert.equal(gb.groups.size, 1);
        assert.equal(gb.groupsById.size, 2);
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("B"));
        assert(gb.groups.has(gb.groupsById.get("A")));
    });

    it('can have multiple references', function () { 

        let gb = new GroupBuilder();
        gb.add("A", [ "B", "C", "D" ]);

        assert.equal(gb.groups.size, 1);
        assert.equal(gb.groupsById.size, 4);
        assert.deepEqual([...gb.groupsById.get("A")], ["A", "B", "C", "D"]);
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("B"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("C"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("D"));
        assert(gb.groups.has(gb.groupsById.get("A")));
    });

    it('can have link to existing gtoup', function () { 

        let gb = new GroupBuilder();
        gb.add("A", [ "B", "C", "D" ]);
        gb.add("E", [ "D" ])

        assert.equal(gb.groups.size, 1);
        assert.equal(gb.groupsById.size, 5);
        assert.deepEqual([...gb.groupsById.get("A")], ["E", "A", "B", "C", "D"]);
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("B"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("C"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("D"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("E"));
        assert(gb.groups.has(gb.groupsById.get("A")));
    });

    it('can have link from existing group', function () { 

        let gb = new GroupBuilder();
        gb.add("A", [ "B", "C", "D" ]);
        gb.add("D", [ "E" ])

        assert.equal(gb.groups.size, 1);
        assert.equal(gb.groupsById.size, 5);
        assert.deepEqual([...gb.groupsById.get("A")], ["A", "B", "C", "D", "E"]);
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("B"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("C"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("D"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("E"));
        assert(gb.groups.has(gb.groupsById.get("A")));
    });

    it('can combine groups via references', function () { 

        let gb = new GroupBuilder();
        gb.add("A", [ "B", "C", "D" ]);
        gb.add("E", [ "F", "G", "H" ]);
        gb.add("D", ["H"])

        assert.equal(gb.groups.size, 1);
        assert.equal(gb.groupsById.size, 8);
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("B"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("C"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("D"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("E"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("F"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("G"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("H"));
        assert(gb.groups.has(gb.groupsById.get("A")));
    });

    it('can combine groups via initial id', function () { 

        let gb = new GroupBuilder();
        gb.add("A", [ "B", "C", "D" ]);
        gb.add("E", [ "F", "G", "H" ]);
        gb.add("A", ["E"])

        assert.equal(gb.groups.size, 1);
        assert.equal(gb.groupsById.size, 8);
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("B"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("C"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("D"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("E"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("F"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("G"));
        assert.equal(gb.groupsById.get("A"), gb.groupsById.get("H"));
        assert(gb.groups.has(gb.groupsById.get("A")));
    });
});