const Utils = require('../lib/Utils');


test('Split address list', () => {

    let addresses = `a@xyz.com,<b@xyz.com>,Mr C. <c@xyz.com>,<d@xyz.com> (Mr, D.),<e@xyz.com> "Mr, E",((x,),) blah`;
    let expected = ['a@xyz.com','<b@xyz.com>','Mr C. <c@xyz.com>','<d@xyz.com> (Mr, D.)','<e@xyz.com> "Mr, E"','((x,),) blah'];
    let r = [];
    Utils.split_address_list(addresses, r);
    expect(r).toEqual(expected);
});
