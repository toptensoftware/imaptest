const { performance, PerformanceObserver } = require("perf_hooks")

const Imap = require('node-imap');
const inspect = require('util').inspect;
const jsonfile = require('jsonfile');
var readline = require('readline-sync');

const perfObserver = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
      console.log(entry.name, entry.duration)
    })
  })
  
perfObserver.observe({ entryTypes: ["measure"], buffer: true })

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

    static iterate_uids(uids, erange)
    {
        if (!erange)
        {
            let pos = 0;
            return {
                current: () => uids[pos],
                eof: () => pos == uids.length,
                next: () => pos++,
            }
        }
        else
        {
            let pos = -1;
            let min = 0;
            let max = 0;
            let current = 0;
            let iter = {
                current: () => current,
                eof: () => pos == uids.length,
                next: () => 
                {
                    // Within range
                    if (pos >= 0 && current < max)
                    {
                        current++;
                        return;
                    }
    
                    // Move to next
                    pos++;
    
                    if (pos >= uids.length)
                        return;
    
                    // Parse it
                    let colonPos = uids[pos].indexOf(':');
                    if (colonPos >= 0)
                    {
                        min = parseInt(uids[pos].substring(0, colonPos));
                        max = parseInt(uids[pos].substring(colonPos+1));
                        if (min > max)
                        {
                            let temp = min;
                            min = max;
                            max = temp;
                        }
                    }
                    else
                    {
                        min = max = parseInt(uids[pos]);
                    }
                    current = min;
                }
            }
            iter.next();
            return iter;
        }
    }
}

class Mailbox
{
    constructor(user, name)
    {
        this._user = user;
        this._name = name;
        this._data = null;
        this._box = null;
    }

    async load()
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

        // Create default (empty) data
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
    }


    get messages() { return this._data.messages }

    async sync()
    {
        // Load data
        await this.load();

        // Open the box
        this._box = await new Promise((resolve, reject) => 
        {
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

        console.log(`syncing ${this.name} ${this._box.messages.total} messages...`)

        // Track sync stats
        this.sync_info = {
            added_messages: 0,
            deleted_messages: 0,
            flagged_messages: 0,
        }

        let isDirty = false;

        // If uid validity has changed, clear everything
        if (this._box.uidvalidity != this._data.uidvalidity)
        {
            // Fetch everything
            await this.fetchAll();
            isDirty = true;
        }
        else
        {
            // Fetch any new messages
            if (this._data.uidnext != this._box.uidnext)
            {
                await this.fetch(`${this._data.highestuid + 1}:*`, true);
                this._data.uidnext = this._box.uidnext;
                isDirty = true;
            }

            // Are there any deleted messages?
            if (this._data.messages.length != this._box.messages.total)
            {
                await this.trimDeletedMessages();
                isDirty = true;
            }

            // Any flags changed?
            if (this._data.highestmodseq < this._box.highestmodseq)
            {
                await this.syncFlags();
                this._data.highestmodseq = this._box.highestmodseq;
                isDirty = true;
            }
        }

        // Save changes
        if (isDirty)
        {
            await jsonfile.writeFile(this.storage, this._data, { spaces: 2 });
        }

        if (this.sync_info.added_messages != 0)
            console.log(`  - added:   ${this.sync_info.added_messages}`);
        if (this.sync_info.deleted_messages != 0)
            console.log(`  - deleted: ${this.sync_info.deleted_messages}`);
        if (this.sync_info.flagged_messages != 0)
            console.log(`  - flagged: ${this.sync_info.flagged_messages}`);

        //console.log(`Synced ${this.name}`)
        this._box = null;
    }

    get storage() 
    {
        return `${this._user.storageBase}-${this.name}.json`;
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

            fetch.on('message', (fetch_msg, seqno) => {
                let msg_hdrs = {};
                let msg_attrs = {};
                fetch_msg.on('body', function(stream, info) 
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
                fetch_msg.once('attributes', (attrs) => {
                    msg_attrs = attrs;
                })
                fetch_msg.once('end', () => {
                    // Create message entry
                    let m = {
                        uid: msg_attrs.uid,
                        message_id: utils.clean_message_id(msg_hdrs),
                        references: utils.clean_references(msg_hdrs),
                    };
                    
                    if (msg_attrs.flags.indexOf('\\Seen') < 0)
                        m.unread = true;
                    if (msg_attrs.flags.indexOf('\\Flagged') >= 0)
                        m.important = true;

                    this._data.messages.push(m);

                    this.sync_info.added_messages++;

                    // Update the highest seen uid
                    if (m.uid > this._data.highestuid)
                        this._data.highestuid = m.uid;
                    
                    // Mark dirty
                    this._dirty = true;
                });
            });

            fetch.once('error', reject);
            fetch.once('end', resolve);
        });
    }

    async fetchAll()
    {
        this._data.uidvalidity = this._box.uidvalidity;
        this._data.highestmodseq = this._box.highestmodseq;
        this._data.highestuid = 0;
        this._data.uidnext = this._box.uidnext;
        this._data.messages = [];

        if (this._box.messages.total == 0)
            return Promise.resolve();

        return this.fetch("1:*", false);
    }

    async trimDeletedMessages()
    {
        // Box completely emptied?
        if (this._box.messages.total == 0)
        {
            this._data.messages = [];
            return Promise.resolve();
        }

        // Use ESearch if supported
        let isESearch = this._imap.serverSupports('ESEARCH');
        let search_fn = isESearch ? this._imap.esearch : this._imap.search;

        // Get all uids
        let uids = await new Promise((resolve, reject) => {
            search_fn.call(this._imap, [ 'ALL' ], (err, result) => {
                if (err)
                    reject(err);
                else
                    resolve(isESearch ? result.all : result);
            });
        });

        // Trim messages
        let old_messages = this._data.messages;
        let new_messages = [];
        let iter = utils.iterate_uids(uids, isESearch);
        for (let idst=0; idst < old_messages.length; idst++)
        {
            // Matching uid?
            if (!iter.eof() && old_messages[idst].uid == iter.current())
            {
                new_messages.push(old_messages[idst]);
                iter.next();
            }
            else
            {
                // Deleted message
                //console.log(`message ${old_messages[idst].uid} deleted`)
                this.sync_info.deleted_messages++;
            }
        }

        // If we finished iterating the uid list then
        // things look ok
        if (iter.eof())
        {
            // Store new messages array
            this._data.messages = new_messages;
            return true;
        }

        // We didn't get to the end of the UID list so something has gone
        // awry.  Refresh everything.
        await this.fetchAll();

        return false;
    }

    async syncFlags()
    {
        return new Promise((resolve, reject) => {
        
            let fetch = this._imap.fetch("1:*", { 
                modifiers: {
                    changedsince: this._data.highestmodseq 
                }
            });

            fetch.on('message', (fetch_msg, seqno) => {
                let msg_attrs = {};
                fetch_msg.once('attributes', (attrs) => {
                    msg_attrs = attrs;
                })
                fetch_msg.once('end', () => {

                    let m = this._data.messages.find(x => x.uid == msg_attrs.uid);
                    if (m)
                    {
                        let unread = msg_attrs.flags.indexOf('\\Seen') < 0;
                        let delta = 0;
                        if (unread != !!m.unread)
                        {
                            if (unread)
                                m.unread = true;
                            else
                                delete m.unread;
                            delta = 1;
                        }

                        let important = msg_attrs.flags.indexOf('\\Flagged') >= 0;
                        if (important != !!m.important)
                        {
                            if (important)
                                m.important = true;
                            else
                                delete m.important;
                            delta = 1;
                        }

                        this.sync_info.flagged_messages += delta;
                    }
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
    }

    async load()
    {
        this._boxes = new Map();
        try
        {
            // Read json file
            let file = await jsonfile.readFile(this.storage);

            // Create and load mailboxes
            for (let i=0; i<file.boxes.length; i++)
            {
                let box = new Mailbox(this, file.boxes[i]);
                this._boxes.set(file.boxes[i], box);
                await box.load();
            }
        }
        catch (err) { /* don't care */}
    }

    // Builds an index of message-id to message
    buildIndex()
    {
        // A map of message id to an array of { mailbox, message }
        this._mapMessageId = new Map();

        // A map where the value is a array of messages-id of messages
        // that reference to the key message-id.  This is the inverse
        // of message.references
        this._referencedBy = new Map();

        // Make conversation map now, will use later
        this._mapMessageToConversation = new Map();


        // Keep track of how many messages have no message-id
        let noMessageIdCount = 0;

        // For all boxes
        for (let b of this._boxes.values())
        {
            // Iterate all messages
            let messages = b.messages;
            let length = messages.length;
            for (let i=0; i<length; i++)
            {
                // Get the message its Id
                let m = messages[i];
                let msg_id = m.message_id;
                if (!msg_id)
                {
                    noMessageIdCount++;
                    continue;
                }

                // Add it to the map
                let e = this._mapMessageId.get(msg_id);
                if (e === undefined)
                {
                    e = [];
                    this._mapMessageId.set(msg_id, e);
                }
                e.push({ message: m, mailbox: b});

                // Also make a map of the messages which messages
                // reference which
                for (let j=0; j<m.references.length; j++)
                {
                    let e = this._referencedBy.get(m.references[j]);
                    if (e === undefined)
                    {
                        e = new Set();
                        this._referencedBy.set(m.references[j], e);
                    }
                    e.add(msg_id);
                }
            }
        }

        console.log(`unique messages: ${this._mapMessageId.size}`);
        console.log(`referenced messages: ${this._referencedBy.size}`);
        console.log(`messages without id: ${noMessageIdCount}`);
    }

    // Given a message ID, build a conversation for it
    getConversation(msg_id)
    {
        // Already created?
        let conv = this._mapMessageToConversation.get(msg_id);
        if (conv)
            return conv;

        // Get all referenced messages
        let messages = new Set();
        this.getAllReferences(msg_id, messages);
        messages = [...messages];

        // Create a new conversation with those messages
        conv = {
            messages: messages,
        };

        // Associate this conversation with all the messages in the conversation
        for (let i=0; i<messages.length; i++)
            this._mapMessageToConversation.set(messages[i], conv);

        // Done, return the conversation
        return conv;
    }

    // Recursively find all other messages associated with a message
    getAllReferences(msg_id, result)
    {
        // Quit if we've already processed this message
        if (result.has(msg_id))
            return;

        // Add this message to the set
        result.add(msg_id);

        // Recursively add all the referenced messages
        let msgs = this._mapMessageId.get(msg_id);
        if (msgs)
        {
            for (let i=0; i<msgs.length; i++)
            {
                let refs = msgs[i].message.references;
                if (refs)
                {
                    for (let j=0; j<refs.length; j++)
                    {
                        this.getAllReferences(refs[j], result);
                    }
                }
            }
        }

        // Also add all the messages that reference this one
        let refs = this._referencedBy.get(msg_id);
        if (refs)
        {
            for (let m of refs)
            {
                this.getAllReferences(m, result);
            }
        }
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

        // Wrap imap box objects with our Mailbox class
        for (let e of Object.entries(boxes))
        {
            let mb = this._boxes.get(e[0]);
            if (!mb)
                this._boxes.set(e[0], new Mailbox(this, e[0]));
        }

        // Remove deleted boxes
        for (var b of this._boxes.keys())
        {
            if (!boxes.hasOwnProperty(b))
            {
                this._boxes.delete(b);
            }
        }

        // Save list of boxes
        await jsonfile.writeFile(this.storage, {
            boxes: Array.from(this._boxes.keys())
        })

        //await this._boxes.get('INBOX').sync();
        // Sync all boxes
        await this.syncAll();
    }

    async syncAll()
    {
        for (var b of this._boxes.values())
        {
            await b.sync();
        }
    }

    get totalMessageCount()
    {
        let sum = 0;
        for (var b of this._boxes.values())
        {
            sum += b.messages.length;
        }
        return sum;
    }

    get boxes() { return this._boxes }

    get storageBase() 
    {
        let config = this._imap._config;
        return `data/${config.host}-${config.user}`;
    }

    get storage()
    {
        return `${this.storageBase}.json`;
    }


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



async function main() 
{ 
    //readline.question("Ready?");

    let user = new User({
        /*
        user: 'brad@rocketskeleton.com',
        password: 'rafiki23',
        host: 'mxdev.toptensoftware.com',
        */
        user: 'brad@toptensoftware.com',
        password: 'ormapkrcwiipjwik-1U',
        host: 'mx2.toptensoftware.com',
        port: 993,
        tls: true,
        //debug: console.log
    })

    try
    {
        console.log("loading user");
        await user.load();

        performance.mark("sync-start")
        await user.open();
        performance.mark("sync-end")
        performance.measure("sync", "sync-start", "sync-end")

        console.log(`Mailboxes: ${user.boxes.size}`);
        console.log(`Messages:  ${user.totalMessageCount}`);

        performance.mark("buildIndex-start")
        await user.buildIndex();
        performance.mark("buildIndex-end")
        performance.measure("buildIndex", "buildIndex-start", "buildIndex-end")

        performance.mark("buildConvs-start")
        console.log("Generating conversations");
        let inbox = user.boxes.get("Archive");
        for (let i=0; i<inbox.messages.length; i++)
        {
            let msg = inbox.messages[i];
            let conv = user.getConversation(msg.message_id);
        }
        performance.mark("buildConvs-end")
        performance.measure("buildConvs", "buildConvs-start", "buildConvs-end")

        /*
        //let testMessage = "CAEr=6tNk5XbERB_=Lipib3zAnpGOexhQqKggyqY4ZmdDvMFMvA@mail.gmail.com";
        let testMessage = "CAEr=6tO7at5Z5S80HwRE_gZmjUAHtvJzA-ZMqHSx9_zSDqP4bg@mail.gmail.com";
        let conv = user.getConversation(testMessage);
        console.log("Messages in conversation:");
        for (let i=0; i<conv.messages.length; i++)
        {
            let msgid = conv.messages[i];
            console.log(msgid);

            let msgs = user._mapMessageId.get(msgid);
            for (let j=0; j<msgs.length; j++)
            {
                console.log(`  - ${msgs[j].mailbox.name} ${msgs[j].message.uid}`);
            }
        }
        */

        /*
        await user.open();
        */
       await user.close();

        ///readline.question("Done");
        console.log("done");

    }
    catch (err)
    {
        console.log(err);
    }

}

main();