
const Imap = require('node-imap');
const inspect = require('util').inspect;
const jsonfile = require('jsonfile');

class utils
{
    static get_combined_header_value(hdrs, key)
    {
        let arr = hdrs[key];
        if (!arr)
            return "";

        return arr.join(' ');
    }

    static execAll(str, regex)
    {
        let matches = [];
        let match;
        while (match = regex.exec(str)) {
            matches.push(match)
        }
        return matches;
    }

    static clean_message_id(hdrs)
    {
        // Is there a message id?
        let id = utils.get_combined_header_value(hdrs, 'message-id')
        let m = id.match(/\<(.+?)\>/);
        return m ? m[1] : id;
    }

    static clean_references(hdrs)
    {
        let refs = [];

        let m1 = utils.execAll(utils.get_combined_header_value(hdrs, 'in-reply-to'), /\<(.+?)\>/g);
        if (m1)
            refs = m1.map(x => x[1]);
        
        let m2 = utils.execAll(utils.get_combined_header_value(hdrs, 'references'), /\<(.+?)\>/g);
        if (m2)
            refs = refs.concat(m2.map(x=>x[1]));

        refs = [...new Set(refs)];
        return refs;
    }

}

class mailbox
{
    constructor(user, name, mbox)
    {
        this._user = user;
        this._name = name;
        this._mbox = mbox;
        this._data = null;
    }

    async sync()
    {
        // Load data from file
        if (this._data == null)
        {
            try
            {
                this._data = await jsonfile.readFile(this.storage);
            }
            catch (err) { /* don't care */}
        }

        // Create default data
        if (this._data == null)
        {
            this._data = {
                name: this._name,
                uidvalidity: null,
                highestmodseq: null,
                highestuid: 0,
                uidnext: null,
                messages: []
            }
        }

        // Open the box
        let box = await new Promise((resolve, reject) => {
            this._imap.openBox(this._name, true, (err, box) => {
                if (err)
                {
                    reject(err);
                }
                else
                {
                    resolve(box);
                }
            });
        })

        // If uid validity has changed, clear everything
        if (box.uidvalidity != this._data.uidvalidity)
        {
            this._data.uidvalidity = box.uidvalidity;
            this._data.highestmodseq = box.highestmodseq;
            this._data.highestuid = 0;
            this._data.uidnext = box.uidnext;
            this._data.messages = [];
            this._isDirty = true;

            await this.fetch("1:*", false);
        }
        else
        {
            // Fetch any new messages
            if (this._data.uidnext != box.uidnext)
            {
                await this.fetch(`${this._data.highestuid + 1}:*`, true);
            }

            // Are there any deleted messages?
            if (this._data.messages.length != box.messages.length)
            {
                // Get all uids
                let uids = await new Promise((resolve, reject) => {
                    let search = this._imap.serverSupports('ESEARCH') ? this._imap.esearch : this._imap.search;
                    search.call(this._imap, [ 'ALL' ], (err, result) => {
                        if (err)
                            reject(err);
                        else
                            resolve(result);
                    });
                });

                uids = uids;
            }
        }

        // Save changes
        if (this._isDirty)
        {
            await jsonfile.writeFile(this.storage, this._data, { spaces: 2 });
            this._isDirty = false;
        }
    }

    get storage() 
    {
        let config = this._user._imap._config;
        return `${config.host}-${config.user}-${this.name}.json}`;
    }

    get name() { return this._name; }

    get _imap() { return this._user._imap; }

    fetch(range, is_uid_range)
    {
        return new Promise((resolve, reject) => {
        
            let src = is_uid_range ? this._imap : this._imap.seq;
            let fetch = src.fetch(range, {
                bodies: 'HEADER.FIELDS (MESSAGE-ID REFERENCES IN-REPLY-TO)'
            });

            fetch.on('message', (msg, seqno) => {
                let msg_hdrs = {};
                let msg_attrs = {};
                msg.on('body', function(stream, info) 
                {
                    let buffer = "";
                    stream.on('data', (chunk) => {
                        let str = chunk.toString('utf8');
                        buffer += str;
                    });
                    stream.on('end', () => {
                        msg_hdrs = Imap.parseHeader(buffer);
                    });
                });
                msg.once('attributes', (attrs) => {
                    msg_attrs = attrs;
                })
                msg.once('end', () => {
                    // Create message entry
                    let msg = {
                        uid: msg_attrs.uid,
                        message_id: utils.clean_message_id(msg_hdrs),
                        references: utils.clean_references(msg_hdrs)
                    };
                    this._data.messages.push(msg);

                    // Update the highest seen uid
                    if (msg.uid > this._data.highestuid)
                        this._data.highestuid = msg.uid;
                    
                    // Mark dirty
                    this._dirty = true;
                });
            });

            fetch.once('error', reject);
            fetch.once('end', resolve);
        });
    }

}

class User
{
    constructor(config)
    {
        // Create IMAP connection
        this._imap = new Imap(config)
        this._isOpen = false;
        this._boxes = new Map();
    }

    async open()
    {
        if (this._isOpen)
            return;
        this._isOpen = true;

        // Open connection
        await new Promise((resolve, reject) => {

            // Connect ok
            this._imap.once('ready', function() {
                resolve();
            });

            // Connect fail
            this._imap.once('error', function(err) {
                reject(err);
            })

            this._imap.connect();
        });

        // Get list of boxes
        let boxes = await new Promise((resolve, reject) => {
            this._imap.getBoxes((err, boxes) => {
                if (err)
                    reject(resolve)
                else
                    resolve(boxes);
            });
        });

        // Wrap imap box objects with out Mailbox class
        this._boxes.clear();
        for (let e of Object.entries(boxes))
        {
            this._boxes.set(e[0], new mailbox(this, e[0], e[1]));
        }

        await this._boxes.get('INBOX').sync();
        // Sync all boxes
        //await this.syncAll();
    }

    async syncAll()
    {
        for (var b of this._boxes.values())
        {
            await b.sync();
        }
    }

    get boxes() { return this._boxes }

    close()
    {
        if (!this._isOpen)
            return;
        this._isOpen = false;

        // Already disconnected?
        if (this._imap.state == 'disconnected')
            return Promise.resolve();

        // Close connection
        this._imap.end();
        return new Promise((resolve, reject) => {
            this._imap.once('end', resolve);
            this._imap.once('error', (err) => reject(err));
        });
    }

}


(async function() { 

    let user = new User({
        user: 'brad@rocketskeleton.com',
        password: 'rafiki23',
        host: 'mxdev.toptensoftware.com',
        port: 993,
        tls: true,
        debug: console.log
    })

    try
    {
        console.log("opening user");
        await user.open();
        console.log("opened user");

        console.log(`${user.boxes.size} mail boxes`);

        console.log("closing user");
        user.close();
        console.log("closed user");

        console.log("done");
    }
    catch (err)
    {
        console.log(err);
    }

})();

