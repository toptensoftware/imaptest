const Utils = require('../lib/Utils');


test('Encrypt/decrypt', () => {

    let data = { "apples": "red", "bananas": "yellow" };

    let key = "3Q02pJrfVbptLmab9kqWA73S027fsqBe";

    let encrypt = Utils.encryptJson(key, data);
    let data2 = Utils.decryptJson(key, encrypt.content, encrypt.iv);

    expect(data2).toEqual(data);
});
