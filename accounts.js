let accounts = {
    rs: {
        user: 'brad@rocketskeleton.com',
        password: 'rafiki23',
        host: 'mxdev.toptensoftware.com',
        port: 993,
        tls: true,
    },

    tts: {
        user: 'brad@toptensoftware.com',
        password: 'ormapkrcwiipjwik-1U',
        host: 'mx2.toptensoftware.com',
        port: 993,
        tls: true,
    }
}

accounts.default = accounts.rs;

module.exports = accounts;