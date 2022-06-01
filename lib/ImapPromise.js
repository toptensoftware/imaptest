const Imap = require('node-imap');

let originalSearch = Imap.prototype._search;
let originalESearch = Imap.prototype._esearch;
let originalThread = Imap.prototype._thread;
Imap.prototype._search = function(which, criteria, cb) {

    if (typeof(criteria) !== 'string')
    {
        return originalSearch.apply(this, arguments);
    }

    if (this._box === undefined)
      throw new Error('No mailbox is currently selected')
    let cmd = which + 'SEARCH', info = { hasUTF8: false /*output*/ }, query = ' ' + criteria
    let lines
    if (info.hasUTF8) {
      cmd += ' CHARSET UTF-8'
      lines = query.split(CRLF)
      query = lines.shift()
    }
    cmd += query
    this._enqueue(cmd, cb)
    if (info.hasUTF8) {
      const req = this._queue[this._queue.length - 1]
      req.lines = lines
    }
}


Imap.prototype._esearch = function(which, criteria, options, cb) 
{
    if (typeof(criteria) !== 'string')
    {
        return originalESearch.apply(this, arguments);
    }


    if (this._box === undefined)
      throw new Error('No mailbox is currently selected')
    const info = { hasUTF8: false /*output*/ }
    let query = " " + criteria
    let charset = ''
    let lines
    if (info.hasUTF8) {
      charset = ' CHARSET UTF-8'
      lines = query.split(CRLF)
      query = lines.shift()
    }
    if (typeof options === 'function') {
      cb = options
      options = ''
    }
    else if (!options)
      options = ''
    if (Array.isArray(options))
      options = options.join(' ')
    this._enqueue(which + 'SEARCH RETURN (' + options + ')' + charset + query, cb)
    if (info.hasUTF8) {
      const req = this._queue[this._queue.length - 1]
      req.lines = lines
    }
  }

Imap.prototype._thread = function(which, algorithm, criteria, cb) {

    if (typeof(criteria) !== 'string')
    {
        return originalThread.apply(this, arguments);
    }

    algorithm = algorithm.toUpperCase()
    if (!this.serverSupports('THREAD=' + algorithm))
      throw new Error('Server does not support that threading algorithm')
    const info = { hasUTF8: false /*output*/ }
    let query = " " + criteria
    let charset = 'US-ASCII'
    let lines
    if (info.hasUTF8) {
      charset = 'UTF-8'
      lines = query.split(CRLF)
      query = lines.shift()
    }
    this._enqueue(which + 'THREAD ' + algorithm + ' ' + charset + query, cb)
    if (info.hasUTF8) {
      const req = this._queue[this._queue.length - 1]
      req.lines = lines
    }
}



class ImapPromiseBase
{
    constructor(imap)
    {
        this.imap = imap;
    }

    promise(fn, args)
    {
        return new Promise((resolve, reject) => {
            let newArgs = [...args, (err, data) => {
                if (err)
                    reject(err);
                else
                {
                    this.errorManager.pendingRejects.delete(reject);
                    resolve(data);
                }
            }];
            this.errorManager.pendingRejects.add(reject);
            fn.apply(this.imap, newArgs);
        });
    }
    
    delKeywords() { return this.promise(this.imap.delKeywords, arguments); }
    addKeywords() { return this.promise(this.imap.addKeywords, arguments); }
    setKeywords() { return this.promise(this.imap.setKeywords, arguments); }
    delFlags() { return this.promise(this.imap.delFlags, arguments); }
    addFlags() { return this.promise(this.imap.addFlags, arguments); }
    setFlags() { return this.promise(this.imap.setFlags, arguments); }
    move() { return this.promise(this.imap.move, arguments); }
    copy() { return this.promise(this.imap.copy, arguments); }
    search() { return this.promise(this.imap.search, arguments); }
    delLabels() { return this.promise(this.imap.delLabels, arguments); }
    addLabels() { return this.promise(this.imap.addLabels, arguments); }
    setLabels() { return this.promise(this.imap.setLabels, arguments); }
    esearch() { return this.promise(this.imap.esearch, arguments); }
    sort() { return this.promise(this.imap.sort, arguments); }
    thread() { return this.promise(this.imap.thread, arguments); }
    delKeywordsSince() { return this.promise(this.imap.delKeywordsSince, arguments); }
    addKeywordsSince() { return this.promise(this.imap.addKeywordsSince, arguments); }
    setKeywordsSince() { return this.promise(this.imap.setKeywordsSince, arguments); }
    delFlagsSince() { return this.promise(this.imap.delFlagsSince, arguments); }
    addFlagsSince() { return this.promise(this.imap.addFlagsSince, arguments); }
    setFlagsSince() { return this.promise(this.imap.setFlagsSince, arguments); }
    expunge() { return this.promise(this.imap.expunge, arguments); }

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
            fetch.once('end', () => {
                resolve(result)
            });
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
        this.errorManager = this;
        this.pendingRejects = new Set();
    }

    get seq()
    {
        if (this._seq == null)
        {
            this._seq = new ImapPromiseBase(this.imap.seq);
            this._seq.errorManager = this;
        }
        return this._seq;
    }

    onUnexpectedClose()
    {
        if (this._ending)
            return;

        let err = new Error("IMAP Session was closed by server");
        err.imap_error = true;
        for (let reject of this.pendingRejects)
        {
            reject(err);
        }
    }

    onUnexpectedError(err)
    {
        if (this._ending)
            return;

        err.imap_error = true;
        for (let reject of this.pendingRejects)
        {
            reject(err);
        }
    }

    connect()
    {
        this.imap.on('error', this.onUnexpectedError.bind(this));
        this.imap.on('close', this.onUnexpectedClose.bind(this));

        let events = new TempEvents();
            return new Promise((resolve, reject) => {
            events.on(this.imap, 'ready', resolve);
            events.on(this.imap, 'error', reject);
            this.imap.connect();
        }).then(() => events.removeAll());        

    }

    end()
    {
        if (this.imap.state == 'disconnected')
            return;
            
        this._ending = true;
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

    getBoxes()  { return this.promise(this.imap.getBoxes, arguments) }
    openBox()   { return this.promise(this.imap.openBox, arguments); }
    status()    { return this.promise(this.imap.status, arguments); }
    addBox()    { return this.promise(this.imap.addBox, arguments); }
    delBox()    { return this.promise(this.imap.delBox, arguments); }
    renameBox() { return this.promise(this.imap.renameBox, arguments); }
    append()    { return this.promise(this.imap.append, arguments); }

}


module.exports = ImapPromise;