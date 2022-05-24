const inspect = require('util').inspect;
const fs = require('fs');
const readline = require('readline-sync');

const program = require('commander').program;

const Imap = require('./lib/ImapPromise');
const Database = require('./lib/Database');
const Account = require('./lib/Account');

let _action;

function register(action) { _action = action }

program
    .option('-c, --config', "config file", "imaptool.config.json")
    .option('-a, --account <account>', 'the account to use')
    .option('-d, --debug', 'display IMAP log', false);

program.command('sync')
    .description("Sync db with imap")
    .option('--verbose', "Display changes")
    .action((options) => register(async (account) => {
        await account.sync();
    }));

program.command('snapshot')
    .description("Save or restore db snapshots")
    .argument("<name>", "The name of the snapshot")
    .option("--restore", "Restore a snapshot")
    .option("--save", "Save asnap shot")
    .option("--delete", "Save asnap shot")
    .action((name, options) => register(async (account) => {

        let srcSuffix;
        let dstSuffix;
        let delSuffix;
        if (options.save)
        {
            srcSuffix = "";
            delSuffix = dstSuffix = ` (${name})`;
        }
        else if (options.restore)
        {
            delSuffix = dstSuffix = "";
            srcSuffix = ` (${name})`;
        }
        else if (options.delete)
        {
            delSuffix = ` (${name})`;
        }
        else
        {
            throw new Error("Please specify --save or --restore")
        }

        for (let coll of ["mailboxes", "messages", "conversations"])
        {
            let collname = account.collection_name(coll);
            if (delSuffix)
            {
                try
                {
                    await Database.db.collection(collname + delSuffix).drop();
                }
                catch (err) { /* don't care */ }
            }
            if (srcSuffix !== undefined && dstSuffix !== undefined)
                await copyCollection(collname + srcSuffix, collname + dstSuffix);
        }

        async function copyCollection(from, to) {
            await Database.db.collection(from).aggregate([ { $out: to } ]).forEach(x=>{});
        }


    }));



    /*
program.command('trim')
    .description("Trim DB of invalid conversations")
    .action((options) => register(async (account) => {
        await account.trimConversations();
    }));
    */

program.command('status')
    .description("Display status of local cache")
    .option("--mailboxes", "Show status of mailboxes")
    .option("--messages", "Show status of messages")
    .action((options) => register(async (account) => {
        if (options.messages)
        {
            console.log(JSON.stringify(await account.status_messages(), null, 4));
        }
        else if (options.mailboxes)
        {
            console.log(JSON.stringify(await account.status_mailboxes(), null, 4));
        }
        else
        {
            console.log(JSON.stringify(await account.status(), null, 4));
        }
    }));

program.command('drop')
    .description("Drop all conversations")
    .option("--all", "Drop entire message cache and all conversations")
    .action((options) => register(async (account) => {
        if (options.all)
            await account.dropEverything();
        else
            await account.dropAllConversations();
    }));

    /*
program.command('list')
    .description("List conversations for messages")
    .argument('<mids...>', "The message ids to show conversations for")
    .action((mids, options) => register(async (account) => {
        let convs = await account.getConversations(mids)
        console.log(inspect(convs));
    }));

program.command('listbox')
    .description("List conversations for a mailbox")
    .argument('<mailbox>', "The mailbox to show conversations for")
    .option('--limit <messages>', "Only fetch N most recent messages")
    .action((mailbox, options) => register(async (account) => {

        // Track time
        let start = Date.now();

        let findOpts = {
            projection: { _id: 0, message_id: 1 }
        }
        if (options.limit)
        {
            findOpts.sort = { date: -1 };
            findOpts.limit = parseInt(options.limit);
        }
    
        // Get all messages for the mailbox
        let mcoll = Database.db.collection(account.collection_name("messages"));
        let mids = [];
        await mcoll.find(
            { mailbox: mailbox },
            findOpts
        ).forEach((m) => mids.push(m.message_id));
        let fetchedAt = Date.now();

        // Build conversations
        let convs = await account.getConversations(mids);
        let convedAt = Date.now();

        // Show result
        console.log(inspect(convs));

        // Count how many actual messages 
        let count = 0;
        convs.forEach(x => count += x.message_ids.length);
        console.log(`Grouped ${count} messages into ${convs.length} conversations in ${convedAt - fetchedAt} ms. (fetch took ${fetchedAt - start} ms)`);
    }));
    */

program.parse();

(async function ()
{
    // Read the config file
    let configFile = JSON.parse(fs.readFileSync(program.opts().config, 'utf8'));
    let config = {}
    
    // Work out which account to use
    let accountName = program.opts().account;
    if (accountName != 'none')
    {
        if (!accountName)
        {
            defAccount = Object.entries(configFile.accounts).filter(x => x[1].default);
            if (defAccount.length == 1)
                config = defAccount[0][1];
            else
                config = {}
        }
        else
            config = configFile.accounts[accountName];
    }

    // Config
    if (program.opts().debug)
        config.debug = console.log;

    config.info = console.log;


    // Connect
    await Database.open(config);
        
    // Create IMAP object
    let account = new Account(config);
    await account.open();

    // Invoke command
    try
    {
        let start = Date.now();
        await _action(account)
        console.error(`Completed in ${Date.now() - start} ms`);
    }
    catch (err)
    {
        console.error(err.message);
    }
    
    // Close
    await account.close();
    await Database.close()
})();


