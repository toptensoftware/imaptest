const inspect = require('util').inspect;
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const { program } = require('commander');

const Imap = require('./imap_promise');

let _action;

function register(action) { _action = action }

program
    .option('-c, --config', "config file", "imaptool.config.json")
    .option('-a, --account <account>', 'the account to use')
    .option('-d, --debug', 'display IMAP log', false);

program.command('caps')
    .description("Show server capabilities")
    .action((options) => register(async (imap) => {
        console.log(imap.imap._caps.join("\n"));
    }));

program.command('boxes')
    .description("List mailboxes")
    .option('--details', "Show mailbox details", false)
    .option('--status', "Shown mailbox status", false)
    .action((options) => register(async (imap) => {
        // List mailboxes
        let boxes = Object.entries(await imap.getBoxes());
        for (let [k, v] of boxes)
        {
            let output = null;

            if (options.details)
            {
                output = Object.assign(output ?? {}, v);
            }
            if (options.status)
            {
                let boxStatus = await imap.status(k);
                output = Object.assign(output ?? {}, boxStatus)
            }

            if (output)
            {
                if (!output.name)
                    output.name = k;
                console.log(JSON.stringify(output, null, 4));
            }
            else
                console.log(k);
        }
    }));

program.command('mkbox')
    .description("Add a mailbox")
    .argument('<name>', "The new mailbox name")
    .action((name, options) => register(async (imap) => {
        await imap.addBox(name);
    }));

program.command('rmbox')
    .description("Remove a mailbox")
    .argument('<name>', "The mailbox to delete")
    .action((name, options) => register(async (imap) => {
        await imap.delBox(name);
    }));

program.command('mvbox')
    .description("Rename a mailbox")
    .argument('<from>', "The mailbox to rename")
    .argument('<to>', "The new mailbox name")
    .action((from, to, options) => register(async (imap) => {
        await imap.renameBox(from, to);
    }));

program.command('esearch')
    .description("Run an esearch")
    .argument('<criteria>', "The search criteria")
    .option('-m, --mailbox <mailbox>', "The mailbox name", "INBOX")
    .action((criteria, options) => register(async (imap) => {

        await imap.openBox(options.mailbox);
        let msgs = await imap.esearch(criteria);
        console.log(msgs.all.join(' '));

    }));

program.command('search')
    .description("Run a search")
    .argument('<criteria>', "The search criteria")
    .option('-m, --mailbox <mailbox>', "The mailbox name", "INBOX")
    .action((criteria, options) => register(async (imap) => {

        await imap.openBox(options.mailbox);
        let msgs = await imap.search(criteria);
        console.log(msgs.join(' '));

    }));

program.command('thread')
    .description("Run a thread search")
    .argument('<criteria>', "The search criteria")
    .option('--algorithm <algorithn>', "The threading algorithm", "REFERENCES")
    .option('-m, --mailbox <mailbox>', "The mailbox name", "INBOX")
    .action((criteria, options) => register(async (imap) => {

        await imap.openBox(options.mailbox);
        let msgs = await imap.thread(options.algorithm, criteria);
        console.log(JSON.stringify(msgs));

    }));


program.command('fetch')
    .description("Fetch messages headers and attributes")
    .argument('<uids...>', "The uids to fetch")
    .option('--fields <fields...>', "The fields to fetch", [ "FROM", "TO", "SENDER", "DATE", "SUBJECT", "MESSAGE-ID" ])
    .option('-m, --mailbox <mailbox>', "The mailbox name", "INBOX")
    .option('--json', "Output as JSON")
    .action((uids, options) => register(async (imap) => {

        await imap.openBox(options.mailbox);
        let messages = await imap.fetchHeaders(uids, { bodies: options.fields ? `HEADER.FIELDS (${options.fields.map(x=>x.toUpperCase()).join(' ')})` : undefined});
        messages = messages.map(function(x){ return { headers: x.headers, attributes: x.attributes } });
        if (options.json)
        {
            console.log(JSON.stringify(messages, null, 4));
        }
        else
        {
            for (let m of messages)
            {
                console.log(`\nUID ${m.attributes.uid}`);

                for (let [k,v] of Object.entries(m.headers))
                {
                    console.log(`   ${k.padEnd(20, ' ')}: ${v.join(", ")}`);
                }

                console.log(`   ${"flags".padEnd(20, ' ')}: ${m.attributes.flags}`);
            }
        }

        console.log(`\n${messages.length} messages`)

    }));

program.command('mv')
    .description("Move messages between mailboxes")
    .argument('<from>', "The source mailbox")
    .argument('<to>', "The target mailbox")
    .argument('<uids...>', "The messages to move")
    .action((from, to, uids, options) => register(async (imap) => {
        await imap.openBox(from);
        await imap.move(uids, to);
    }));


program.command('cp')
    .description("Copy messages between mailboxes")
    .argument('<from>', "The source mailbox")
    .argument('<to>', "The target mailbox")
    .argument('<uids...>', "The messages to copy")
    .action((from, to, uids, options) => register(async (imap) => {
        await imap.openBox(from);
        await imap.copy(uids, to);
    }));


program.command('flags')
    .description("Set message flags")
    .option('-m, --mailbox <mailbox>', "The mailbox name", "INBOX")
    .argument('<uids...>', "The messages to copy")
    .option('-a, --add <add...>', "The flags to add")
    .option('-r, --remove <remove...>', "The flags to delete")
    .option('--replace <replace...>', "The flags to replace the existing flags")
    .action((uids, options) => register(async (imap) => {

        await imap.openBox(options.mailbox);

        if (options.add)
        {
            let sysflags = options.add.filter(x => x[0] == '\\');
            if (sysflags.length)
                await imap.addFlags(uids,sysflags);

            let keywords = options.add.filter(x => x[0] != '\\');
            if (keywords.length)
                await imap.addKeywords(uids, keywords);
        }

        if (options.remove)
        {
            let sysflags = options.remove.filter(x => x[0] == '\\');
            if (sysflags.length)
                await imap.delFlags(uids,sysflags);

            let keywords = options.remove.filter(x => x[0] != '\\');
            if (keywords.length)
                await imap.delKeywords(uids, keywords);
        }
    
        if (options.replace)
        {
            let sysflags = options.replace.filter(x => x[0] == '\\');
            if (sysflags.length)
                await imap.setFlags(uids,sysflags);

            let keywords = options.replace.filter(x => x[0] != '\\');
            if (keywords.length)
                await imap.setKeywords(uids, keywords);
        }
    }));


program.command('export')
    .description("Export messages from a mailbox")
    .argument('<uids...>', "The messages to export")
    .option('-m, --mailbox <mailbox>', "The mailbox name", "INBOX")
    .option('-o, --out <filename>', "The output file name (use placeholderd $mailbox & $uid)", "export-$mailbox-$uid.eml")
    .action((uids, options) => register(async (imap) => {

        await imap.openBox(options.mailbox);

        // Work out output folder
        let folder = path.dirname(options.out
            .replace(/\$mailbox/g, options.mailbox)
            .replace(/\$uid/g, "1"));

        // Make sure it exists
        fs.mkdirSync(folder, { recursive: true })

        await new Promise((resolve, reject) => {

            // Fetch message
            let fetch = imap.fetch(uids, { bodies: "" } );

            // Message content
            fetch.on('message', (msg, seqno) => {

                let attributes = {};

                msg.on('body', function(stream, info) 
                {
                    // Work out temp file name
                    let tempfile = path.join(folder, `imap-export-${info.seqno}.tmp`)
                    let tempstream = fs.createWriteStream(tempfile);
                    stream.pipe(tempstream);
                    stream.once('close', () => {
                        // Rename file now that we know the uid
                        let filename = options.out
                            .replace(/\$mailbox/g, options.mailbox)
                            .replace(/\$uid/g, attributes.uid);
                        fs.renameSync(tempfile, filename);
                        console.log(`${filename}`)
                    })
                });
                msg.once('attributes', (attrs) => {
                    attributes = attrs;
                })
            });

            // Resolve/reject
            fetch.once('error', (err) => reject(err));
            fetch.once('end', () => {
                resolve()
            });
        });

    }));

program.command('import')
    .description("Import messages to a mailbox")
    .argument('<files...>', "The files to import")
    .option('--flags <flags...>', "Flags for the appended messages")
    .option('-m, --mailbox <mailbox>', "The target mailbox name")
    .action((files, options) => register(async (imap) => {

        // Glob only works with forward slashes, so fix what the
        // user gave us (if windows)
        let fixbs;
        if (path.sep == '\\')
        {
            fixbs = new RegExp("\\" + path.sep, 'g');
            unfix = new RegExp("/", 'g');
        }

        // Global all files
        let fileset = [];
        for (let f of files)
        {
            if (fixbs)
                f = f.replace(fixbs, "/")

            let g = await new Promise((resolve, reject) => {
                glob(f, {}, function (err, files) {
                    if (err)
                        reject(err);
                    else
                        resolve(files);
                })
            });
            
            fileset = [...fileset, ...g]
        }

        // Handle backslashes again
        if (unfix)
        {
            fileset = fileset.map(x => x.replace(unfix, path.sep));
        }

        // Quit if nothing
        if (!fileset.length)
            return;

        // Setup append options
        let append_options = {
            mailbox: options.mailbox,
            flags: options.flags,
        }

        // Append all files
        for (let f of fileset)
        {
            // Read the entire file
            let data = fs.readFileSync(f);

            // Append it
            let uid = await imap.append(data, append_options);

            console.log(`${uid} ${f}`)
        }

    }));

program.parse();

(async function ()
{
    // Read the config file
    let configFile = JSON.parse(fs.readFileSync(program.opts().config, 'utf8'));

    // Work out which account to use
    let accountName = program.opts().account;
    let account;
    if (!accountName)
    {
        defAccount = Object.entries(configFile.accounts).filter(x => x[1].default);
        if (defAccount.length == 1)
            account = defAccount[0][1];
        else
            throw new Error("No default account");
    }
    else
        account = configFile.accounts[accountName];

    //console.log(`account: ${account.user} on ${account.host}`);

    // Config
    let config = {};
    if (program.opts().debug || configFile.debug)
        config.debug = console.log;

    // Create IMAP object
    let imap = new Imap(Object.assign({}, account, config));

    // Connect
    await imap.connect();

    // Invoke command
    try
    {
        await _action(imap)
    }
    catch (err)
    {
        console.error(err.message);
    }

    // Done
    await imap.end();
})();

