const inspect = require('util').inspect;
const fs = require('fs');
const readline = require('readline-sync');

const program = require('commander').program;

const Imap = require('../lib/ImapPromise');
const WorkerAccount = require('../lib/WorkerAccount');
const SQL = require('../lib/SQL');
const Utils = require('../lib/Utils');
const MessageFetcher = require('../lib/MessageFetcher');

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

program.command('status')
    .description("Display status of local cache")
    .option("--mailboxes", "Show status of mailboxes")
    .action((options) => register(async (account) => {
        if (options.mailboxes)
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
            account.dropEverything();
        else
            account.dropAllConversations();
    }));


program.command('list')
    .description("List conversations in a mailbox")
    .argument("mailbox", "The mailbox to show")
    .option("--take", "The number of items to show", 25)
    .option("--skip", "The number of items to skip", 0)
    .option('--detail <level>', "Detail level (1, 2 or 3)", 1)
    .action((mailbox, options) => register(async (account) => {

        function format_flags(f)
        {
            return `[${f & 1 ? 'I' : '-'}${f&2 ? 'U' : '-'}]`
        }

        let detail = parseInt(options.detail);

        for (let c of account.db.iterate(new SQL()
            .select()
            .from("conversation_mailboxes")
            .leftJoin("conversations").on("conversation_mailboxes.conversation_rid = conversations.rid")
            .where({ mailbox: mailbox })
            .orderBy("date DESC")
            .skipTake(parseInt(options.skip), parseInt(options.take))
        ))
        {
            let d = new Date(c.date * 1000);
            console.log(Utils.format_date("d M Y H:i", d), format_flags(c.flags), c.subject);

            if (detail > 1)
            {
                // Show participants
                for (let a of Utils.parse_participants(c.participants))
                {
                    console.log(`   * ${a.format()}`);
                }

                if (detail > 2)
                {
                    console.log(`   * Conversation-Id: ${c.conversation_id}`);
                    for (let m of account.db.iterate(new SQL()
                        .select()
                        .from("conversation_messages")
                        .leftJoin("messages").on("conversation_messages.message_id = messages.message_id")
                        .where({ conversation_rid: c.rid})
                        .orderBy("date DESC")
                        ))
                    {
                        console.log(`   - ${Utils.format_date("d M Y H:i", new Date(m.date * 1000))} ${format_flags(m.flags)} ${m.mailbox} ${m.uid} ${m.participants}`);
                    }
                }
            }
        }

    }));

program.command('fetch')
    .description("Fetch a conversation")
    .argument("conversation_id", "The conversation id")
    .option('--text', "Get in plain text format")
    .action((conversation_id, options) => register(async (account, config) => {

        // Sync account
        //await account.sync();

        // Get the conversation
        let c = await account.get_conversation({
            conversation_id,
        });

        // Create message fetcher
        let mf = new MessageFetcher(config);
        await mf.open();

        // Fetch all messages in the conversation
        let promises = []
        for (let m of c.messages)
        {
            promises.push(mf.fetch(m.quids, options.text ? 'text' : 'html')
                .then(function(r) {
                    m.parts = r.parts;
                    m.attachments = r.attachments;
                })
            );
        }
        await Promise.all(promises);

        // Close message fetcher
        await mf.close();

        console.log(JSON.stringify(c, null, 4));

    }));


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

    config = Object.assign(configFile.common, config);

    // Config
    if (program.opts().debug)
        config.debug = console.log;

    config.info = console.log;


    // Create IMAP object
    let account = new WorkerAccount(config);
    await account.open();

    // Invoke command
    try
    {
        let start = Date.now();
        await _action(account, config)
        console.error(`Completed in ${Date.now() - start} ms`);
    }
    catch (err)
    {
        console.error(err.message);
    }
    
    // Close
    await account.close();
})();


