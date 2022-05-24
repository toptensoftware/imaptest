const User = require('./User');
const data = require('./data');

(async function() {

    await data.open("mongodb://localhost:44017/?directConnection=true", "imapsync");

    let user = new User({
        user: 'brad@rocketskeleton.com',
        password: 'rafiki23',
        host: 'mxdev.toptensoftware.com',
        /*
        user: 'brad@toptensoftware.com',
        password: 'ormapkrcwiipjwik-1U',
        host: 'mx2.toptensoftware.com',
        */
        port: 993,
        tls: true,
        debug: console.log
    });

    await user.open();
    await user.sync();
    await user.close();
    
    await data.close();

    console.log("Finished");
})();