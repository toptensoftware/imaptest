const Utils = require('../lib/Utils');


test('Message flags', () => {

    // 1 = important (\\Flagged set)
    // 2 = unread (\\Seen not set)
    expect(Utils.message_flags_mask("\\blah \\Seen")).toEqual(0);
    expect(Utils.message_flags_mask("\\blah \\Flagged \\Seen")).toEqual(1);
    expect(Utils.message_flags_mask("\\blah")).toEqual(2);
    expect(Utils.message_flags_mask("\\blah \\Flagged")).toEqual(3);

});

test('Clean message id', () => {

    expect(Utils.clean_message_id({
        'message-id': [ '<123@xyz.com>']
    })).toEqual('123@xyz.com');

    expect(Utils.clean_message_id({
        'message-id': [ '123@xyz.com']
    })).toEqual('123@xyz.com');

});

test('Clean references', () => {

    expect(Utils.clean_references({
        'in-reply-to': [ '<001@xyz.com>' ],
        'references': [ '<002@xyz.com> <003@xyz.com> <003@xyz.com>', '<004@xyz.com>' ],
        'message-id': [ '<123@xyz.com>']
    })).toEqual(['001@xyz.com', '002@xyz.com', '003@xyz.com', '004@xyz.com', '123@xyz.com' ]);

});

test('Addresses from headers', () => {

    expect(Utils.get_email_addresses_from_headers({
        'from': ['a@xyz.com'],
        'to': [ 'b@xyz.com' ],
        'cc': ['c@xyz.com', 'd@xyz.com,Mr E. <e@xyz.com>'],
    })).toEqual({
        from: 'a@xyz.com',
        to: 'b@xyz.com',
        cc: 'c@xyz.com,d@xyz.com,Mr E. <e@xyz.com>'
    });

});

test('Participants from headers', () => {

    expect(Utils.participants_from_headers({
        'from': ['a@xyz.com'],
        'to': [ 'b@xyz.com' ],
        'cc': ['c@xyz.com', 'd@xyz.com,Mr E. <e@xyz.com>'],
    })).toEqual('a@xyz.com,b@xyz.com,c@xyz.com,d@xyz.com,Mr E. <e@xyz.com>');

});
