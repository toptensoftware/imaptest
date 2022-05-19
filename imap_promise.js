const { Timestamp, TopologyDescriptionChangedEvent } = require('mongodb');
const Imap = require('node-imap');

function promise(_this, fn, args)
{
    return new Promise((resolve, reject) => {
        let newArgs = [...args, function (err, data) {
            if (err)
                reject(err);
            else
                resolve(data);
        }];
        fn.apply(_this, newArgs);
    });
}

class ImapPromiseBase
{
    constructor(imap)
    {
        this.imap = imap;
    }

    delKeywords() { return promise(this.imap, this.imap.delKeywords, arguments); }
    addKeywords() { return promise(this.imap, this.imap.addKeywords, arguments); }
    setKeywords() { return promise(this.imap, this.imap.setKeywords, arguments); }
    delFlags() { return promise(this.imap, this.imap.delFlags, arguments); }
    addFlags() { return promise(this.imap, this.imap.addFlags, arguments); }
    setFlags() { return promise(this.imap, this.imap.setFlags, arguments); }
    move() { return promise(this.imap, this.imap.move, arguments); }
    copy() { return promise(this.imap, this.imap.copy, arguments); }
    search() { return promise(this.imap, this.imap.search, arguments); }
    delLabels() { return promise(this.imap, this.imap.delLabels, arguments); }
    addLabels() { return promise(this.imap, this.imap.addLabels, arguments); }
    setLabels() { return promise(this.imap, this.imap.setLabels, arguments); }
    esearch() { return promise(this.imap, this.imap.esearch, arguments); }
    sort() { return promise(this.imap, this.imap.sort, arguments); }
    thread() { return promise(this.imap, this.imap.thread, arguments); }
    delKeywordsSince() { return promise(this.imap, this.imap.delKeywordsSince, arguments); }
    addKeywordsSince() { return promise(this.imap, this.imap.addKeywordsSince, arguments); }
    setKeywordsSince() { return promise(this.imap, this.imap.setKeywordsSince, arguments); }
    delFlagsSince() { return promise(this.imap, this.imap.delFlagsSince, arguments); }
    addFlagsSince() { return promise(this.imap, this.imap.addFlagsSince, arguments); }
    setFlagsSince() { return promise(this.imap, this.imap.setFlagsSince, arguments); }

    fetch()     { return this.imap.fetch.apply(this.imap, arguments); }

    fetchHeaders(uids, options, callback)
    {
        return new Promise((resolve, reject) => {

            // Fetch 
            let fetch = this.imap.fetch(uids, options);

            // Result store if not using callback
            let result = callback ? undefined : [];
    
            // Message content
            fetch.on('message', (msg, seqno) => {

                let headers = {};
                let attributes = {};
                let body = "";

                msg.on('body', function(stream) 
                {
                    stream.on('data', (chunk) => {
                        let str = chunk.toString('utf8');
                        body += str;
                    });
                    stream.on('end', () => {
                        headers = Imap.parseHeader(body);
                    });
                });
                msg.once('attributes', (attrs) => {
                    attributes = attrs;
                })
                msg.once('end', () => {
                    let m = { headers, attributes, body }
                    if (callback)
                        callback(m);
                    else
                        result.push(m);
                });
            });

            // Resolve/reject
            fetch.once('error', (err) => reject(err));
            fetch.once('end', () => resolve(result));
        });
    }
}

class TempEvents
{
    constructor()
    {
        this._handlers = [];
    }

    on(emitter, event, handler)
    {
        this._handlers.push( {
            emitter, event, handler
        });
        emitter.on(event, handler);
    }

    removeAll()
    {
        for (let e of this._handlers)
        {
            e.emitter.removeListener(e.event, e.handler);
        }
    }
}

class ImapPromise extends ImapPromiseBase
{
    constructor(config)
    {
        super(new Imap(config));
    }

    get seq()
    {
        if (this._seq == null)
            this._seq = new ImapPromiseBase(this.imap.seq);
        return this._seq;
    }

    connect()
    {
        let events = new TempEvents();
        return new Promise((resolve, reject) => {
            events.on(this.imap, 'ready', resolve);
            events.on(this.imap, 'error', reject);
            this.imap.connect();
        }).then(() => events.removeAll());        
    }

    end()
    {
        let events = new TempEvents();
        return new Promise((resolve, reject) => {
            events.on(this.imap, 'close', resolve);
            events.on(this.imap, 'error', reject);
            this.imap.end();
        }).then(() => events.removeAll());
    }

    get state()
    {
        return this.imap.state;
    }

    serverSupports()     { return this.imap.serverSupports.apply(this.imap, arguments); }
    on()                 { return this.imap.on.apply(this.imap, arguments); }
    off()                { return this.imap.off.apply(this.imap, arguments); }
    once()               { return this.imap.once.apply(this.imap, arguments); }
    removeListener()     { return this.imap.removeListener.apply(this.imap, arguments); }

    getBoxes()  { return promise(this.imap, this.imap.getBoxes, arguments) }
    openBox()   { return promise(this.imap, this.imap.openBox, arguments); }
    addBox()    { return promise(this.imap, this.imap.addBox, arguments); }
    delBox()    { return promise(this.imap, this.imap.delBox, arguments); }
    renameBox() { return promise(this.imap, this.imap.renameBox, arguments); }
    append()    { return promise(this.imap, this.imap.append, arguments); }

}


module.exports = ImapPromise;