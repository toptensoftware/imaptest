const inspect = require('util').inspect;

const { program } = require('commander');

const accounts = require('./accounts');
const Imap = require('./imap_promise');

let _action;

function register(action) { _action = action }

program
    .option('-a, --account <account>', 'the account to use', 'default')
    .option('-d, --debug', 'display IMAP log', false);

program.command('caps')
    .description("Show IMAP server capabilities")
    .action((options) => register(async (imap) => {
        console.log(imap.imap._caps.join("\n"));
    }));

program.command('boxes')
    .description("List IMAP mailboxes")
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
                console.log(inspect(output));
            }
            else
                console.log(" mailbox:", k);
        }
    }));

program.command('addbox')
    .description("Add an IMAP mailbox")
    .argument('<name>', "The new mailbox name")
    .action((name, options) => register(async (imap) => {
        await imap.addBox(name);
    }));

program.command('delbox')
    .description("Remove an IMAP mailbox")
    .argument('<name>', "The mailbox to delete")
    .action((name, options) => register(async (imap) => {
        await imap.delBox(name);
    }));

program.command('renamebox')
    .description("Rename an IMAP mailbox")
    .argument('<from>', "The mailbox to rename")
    .argument('<to>', "The new mailbox name")
    .action((from, to, options) => register(async (imap) => {
        await imap.renameBox(from, to);
    }));

program.command('esearch')
    .description("Run an IMAP esearch")
    .argument('<criteria>', "The search criteria")
    .option('-m, --mailbox <mailbox>', "The mailbox name", "INBOX")
    .action((criteria, options) => register(async (imap) => {

        await imap.openBox(options.mailbox);
        let msgs = await imap.esearch(criteria);
        console.log(msgs.all.join(' '));

    }));

program.command('search')
    .description("Run an IMAP search")
    .argument('<criteria>', "The search criteria")
    .option('-m, --mailbox <mailbox>', "The mailbox name", "INBOX")
    .action((criteria, options) => register(async (imap) => {

        await imap.openBox(options.mailbox);
        let msgs = await imap.search(criteria);
        console.log(msgs.join(' '));

    }));

program.command('thread')
    .description("Run an IMAP thread search")
    .argument('<criteria>', "The search criteria")
    .option('--algorithm <algorithn>', "The threading algorithm", "REFERENCES")
    .option('-m, --mailbox <mailbox>', "The mailbox name", "INBOX")
    .action((criteria, options) => register(async (imap) => {

        await imap.openBox(options.mailbox);
        let msgs = await imap.thread(options.algorithm, criteria);
        console.log(inspect(msgs, { depth: 100 } ) );

    }));


program.command('headers')
    .description("Fetch IMAP headers and attributes")
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

program.command('move')
    .description("Move messages between IMAP mailboxes")
    .argument('<from>', "The source mailbox")
    .argument('<to>', "The target mailbox")
    .argument('<uids...>', "The messages to move")
    .action((from, to, uids, options) => register(async (imap) => {
        await imap.openBox(from);
        await imap.move(uids, to);
    }));


program.command('copy')
    .description("Copy messages between IMAP mailboxes")
    .argument('<from>', "The source mailbox")
    .argument('<to>', "The target mailbox")
    .argument('<uids...>', "The messages to copy")
    .action((from, to, uids, options) => register(async (imap) => {
        await imap.openBox(from);
        await imap.copy(uids, to);
    }));


program.command('flags')
    .description("Set flags on IMAP mailbox messages")
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
    .description("Export messages from an IMAP mailbox")
    .argument('<uids...>', "The messages to export")
    .option('-m, --mailbox <mailbox>', "The mailbox name", "INBOX")
    .option('-o, --out <filename>', "The output file name (use placeholderd $folder & $uid)")
    .action((uids, options) => register(async (imap) => {

        await imap.openBox(options.mailbox);

        await new Promise((resolve, reject) => {

            // Fetch message
            let fetch = imap.fetch(uids, { bodies: "" } );

            // Message content
            fetch.on('message', (msg, seqno) => {

                let attributes = {};
                let body = "";

                msg.on('body', function(stream) 
                {
                    stream.on('data', (chunk) => {
                        let str = chunk.toString('utf8');
                        body += str;
                    });
                    stream.on('end', () => {
                    });
                });
                msg.once('attributes', (attrs) => {
                    attributes = attrs;
                })
                msg.once('end', () => {
                    debugger;
                });
            });

            // Resolve/reject
            fetch.once('error', (err) => reject(err));
            fetch.once('end', () => {
                resolve()
            });
        });

    }));


program.parse();

(async function ()
{
    let account = accounts[program.opts().account];
    //console.log(`account: ${account.user} on ${account.host}`);

    // Config
    let config = {};
    if (program.opts().debug)
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

