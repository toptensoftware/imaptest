const Imap = require('node-imap');

class ImapPromise
{
    constructor(config)
    {
        this.imap = new Imap(config);
    }

    connect()
    {
        return new Promise((resolve, reject) => {
            this.imap.once('ready', resolve);
            this.imap.once('error', reject);
            this.imap.connect();
        });        
    }

    disconnect()
    {
        return new Promise((resolve, reject) => {
            this.imap.once('close', resolve);
            this.imap.once('error', reject);
            this.imap.end();
        })        
    }

    serverSupports(cap)
    {
        return this.imap.serverSupports(cap);
    }

    get state()
    {
        return this.imap.state;
    }

    getBoxes()
    {
        return new Promise((resolve, reject) => {
            this.imap.getBoxes((err, boxes) => {
                if (err)
                    reject(resolve)
                else
                    resolve(boxes);
            });
        });
    }

    openBox(name, readonly)
    {
        return new Promise((resolve, reject) => 
        {
            this.imap.openBox(name, readonly, (err, box) => {
                if (err)
                    reject(err);
                else
                    resolve(box);
            });
        });
    }

    append(msgdata, options)
    {
        return new Promise((resolve, reject) => {

            this.imap.append(msgdata, options, (err, uid) => {
                if (err)
                    reject(err);
                else
                    resolve(uid);
            });
        });
    }

    fetch(source, options, callback)
    {
        return this.#fetch_internal(source, options, callback);
    }

    #fetch_internal(source, options, callback)
    {
        return new Promise((resolve, reject) => {

            // Fetch with UIDs or Sequence numbers?
            let kind = options.seq ? this.imap.seq : this.imap;

            // Fetch 
            let fetch = kind.fetch(source, options);

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

    search(criteria)
    {
        return new Promise((resolve, reject) => {
            this.imap.search(criteria, (err, result) => {
                if (err)
                    reject(err);
                else
                    resolve(result);
            });
        });
    }

    esearch(criteria)
    {
        return new Promise((resolve, reject) => {
            this.imap.esearch(criteria, (err, result) => {
                if (err)
                    reject(err);
                else
                    resolve(result);
            });
        });
    }
}


module.exports = ImapPromise;