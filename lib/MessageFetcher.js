const { inspect } = require('util');
const iconv = require('iconv-lite');
const quotedPrintable = require('quoted-printable');
const _ = require('lodash');

const Imap = require('./IMapPromise');
const FlattenStructure = require('./FlattenStructure');
const { isUndefinedOrNull } = require('node-imap/lib/utils');


class MessageFetcher
{
    // Constructor
    constructor(config)
    {
        this.config = config;
        this.queue = [];
        this.selectedBox = null;
    }

    // Open connection
    async open()
    {
        //this.config.debug = console.log;
        this.imap = new Imap(this.config);
        await this.imap.connect();
        this.selectedBox = null;

        this.imap.on('error', (err) => {
            console.log("IMAP error in message fetcher, disconnecting")
            this.imap?.end();
            this.imap = null;
            this.selectedBox = null;
        });

        this.imap.on('end', (err) => {
            console.log("IMAP disconnected")
            this.imap = null;
            this.selectedBox = null;
        });
    }

    // Close connection
    async close()
    {
        if (this.imap)
        {
            await this.imap.end();
            this.imap = null;
            this.selectedBox = null;
        }
    }

    async fetchPart(quid, partid)
    {
        // Parse the quid
        let m = quid.match(/^(.+)-(\d+)-(\d+)$/);
        if (!m)
            throw new Error("misformed quid");

        return new Promise((resolve, reject) => {

            this.queue.push({
                op: "part",
                mailbox: m[1],
                uidvalidity: parseInt(m[2]),
                uid: parseInt(m[3]),
                partid,
                resolve, 
                reject,
            });

            this.processQueue();

        });
    }

    // Fetch the body of a message from one of a set of alternative quids
    // (where each quid refers to different copies of the same message)
    // quids = a array of qualified uids: "mailbox-uidvalidity-uid"
    // Returns a flattened body structure (see FlattenStructure) with
    // each top-level text part adorned with a `data` property containing
    // the decoded and charset converted part text. (typically html or plain)
    async fetchBodyText(alternativeQuids, format)
    {
        let firstError;
        for (let quid of alternativeQuids)
        {
            try
            {
                return await this.fetchBodyText1(quid, format);
            }
            catch (err)
            {
                // Remember error and try again with other locations
                firstError = err;
            }
        }

        if (firstError)
            throw firstError;

        return null;
    }

    // Fetch a single message
    async fetchBodyText1(quid, format)
    {
        // Parse the quid
        let m = quid.match(/^(.+)-(\d+)-(\d+)$/);
        if (!m)
            throw new Error("misformed quid");

        return new Promise((resolve, reject) => {

            this.queue.push({
                op: "message",
                quid: quid,
                mailbox: m[1],
                uidvalidity: parseInt(m[2]),
                uid: parseInt(m[3]),
                format,
                resolve, 
                reject,
            });

            this.processQueue();

        });
    }

    async processQueue()
    {
        // Quit if already processing
        if (this.processing)
            return; 
        this.processing = true;
            
        try
        {
            // Make sure open
            if (!this.imap)
            {
                await this.open();
            }
            
            while (this.queue.length)
            {
                // Find next entry to process, picking from the currently selected box first
                let qe;
                if (this.selectedBox)
                {
                    let index = this.queue.findIndex(x => x.mailbox == this.selectedBox);
                    if (index >= 0)
                    {
                        qe = this.queue[index];
                        this.queue.splice(index, 1);
                    }
                }
                if (!qe)
                {
                    qe = this.queue.shift();
                }
                
                // Process it
                try
                {
                    let result = await this.processEntry(qe);
                    qe.resolve(result);
                }
                catch (err)
                {
                    qe.reject(err);
                }
            }
        }
        catch (err)
        {
            console.log("error processing fetch queue, aborting all pending ops");
            for (let qe of this.queue)
            {
                qe.reject(err);
            }
            this.close();
        }

        this.processing = false;
    }

    async processEntry(qe)
    {
        // Open the mailbox
        if (qe.mailbox != this.selectedBox?.name)
        {
            this.selectedBox = await this.imap.openBox(qe.mailbox);
        }

        // Check uid validity
        if (this.selectedBox.uidvalidity != qe.uidvalidity)
        {
            throw new Error("uidvalidity mismatch");
        }

        if (qe.op == 'message')
        {
            return await this.processMessageEntry(qe);
        }
        else if (qe.op == 'part')
        {
            return await this.processPartEntry(qe);
        }
    }

    async processMessageEntry(qe)
    {
        let options =   {
            bodies: 'HEADER.FIELDS (FROM TO CC SUBJECT DATE)',
            struct: true
        }

        let result;

        await this.imap.fetch(qe.uid, options, (msg, seqno) => {

            let headers = {};
            let attributes = {};
            let body = [];

            msg.on('body', function(stream) 
            {
                stream.on('data', (chunk) => {
                    body.push(chunk);
                });
                stream.on('end', () => {
                    body = Buffer.concat(body).toString('binary');
                    headers = Imap.parseHeader(body);
                });
            });
            msg.once('attributes', (attrs) => {
                attributes = attrs;
            })
            msg.once('end', () => {
                result = { headers, attributes, body }
            });
        })

        // Restructure
        result.attributes.struct = MessageFetcher.restructure(result.attributes.struct);

        // Flatten the structure
        let fs = FlattenStructure(result.attributes.struct, qe.format);

        // Store other stuff too
        fs.quid = qe.quid;
        fs.headers = result.headers;
        fs.attributes = result.attributes;

        // Download all the inline text parts
        for (let p of fs.parts)
        {
            if (p.type=='text' || p.type == 'message')
            {
                // Get the part
                let result = await this.fetchPartHelper(qe.uid, p.partID, false);
    
                // Decode it and store on the part
                p.data = this.decodePartHelper(p, result.data);
            }
        }

        // Return the parts
        return fs;
    }

    async processPartEntry(qe)
    {
        // Fetch part
        let result = await this.fetchPartHelper(qe.uid, qe.partid, true);

        // Find the part
        let struct = MessageFetcher.restructure(result.attributes.struct);
        let part = MessageFetcher.findStructurePart(struct, qe.partid);

        // Quit if not found
        if (!part)
            throw new Error("part not found");

        // Connect part and data
        part.data = this.decodePartHelper(part, result.data);

        // Return it
        return part;
    }

    decodePartHelper(p, data)
    {
        // Decode
        switch (p.encoding?.toLowerCase())
        {
            case "7bit":
            case "8bit":
            case "binary":
                break;

            case "quoted-printable":
                data = Buffer.from(quotedPrintable.decode(data.toString('binary')), 'binary');
                break;
            
            case "base64":
                data = Buffer.from(data.toString('binary'), 'base64');
                break;

            default:
                throw new Error(`unsupported encoding ${p.encoding}`);
        }

        // Decode text
        if (p.type == 'text')
        {
            data = iconv.decode(data, p.params?.charset ?? "ascii");
        }

        // Store data and remove encoding since we've already handled it
        delete p.encoding;

        return data;
    }

    async fetchPartHelper(uid, part, fetchStruct)
    {
        let options =   {
            bodies: `${part}`,
            struct: fetchStruct,
        }

        let result = {};

        await this.imap.fetch(uid, options, (msg, seqno) => {

            let buffers = [];

            msg.on('body', function(stream) 
            {
                stream.on('data', (chunk) => {
                    buffers.push(chunk);
                });
                stream.on('end', () => {
                });
            });
            msg.once('attributes', (attrs) => {
                result.attributes = attrs;
            })
            msg.once('end', () => {
                result.data = Buffer.concat(buffers);
            });
        });

        return result;
    }

    // Restructures the return body structure from imap to a more
    // friendly format where the subparts are listed as an array
    // `subparts` in the parent part
    static restructure(struct)
    {
        let root = struct[0];
        root.subparts = struct.slice(1).map(x => MessageFetcher.restructure(x));;
        return root;
    }

    static findStructurePart(struct, partid)
    {
        if (struct.partID == partid)
            return struct;

        for (let p of struct.subparts)
        {
            let f = MessageFetcher.findStructurePart(p, partid);
            if (f)
                return f;
        }

        return null;
    }

}

module.exports = MessageFetcher;