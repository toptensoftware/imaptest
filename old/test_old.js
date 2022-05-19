const { performance, PerformanceObserver } = require("perf_hooks")

const Imap = require('node-imap');
const inspect = require('util').inspect;
const jsonfile = require('jsonfile');
const utils = require('./utils');
const Mailbox = require('./Mailbox');
const User = require('./User');

const perfObserver = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
      console.log(entry.name, entry.duration)
    })
  })
  
perfObserver.observe({ entryTypes: ["measure"], buffer: true })



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
        await user.sync();
        performance.mark("sync-end")
        performance.measure("sync", "sync-start", "sync-end")

        console.log(`Mailboxes: ${user.boxes.size}`);
        console.log(`Messages:  ${user.totalMessageCount}`);

        performance.mark("buildIndex-start")
        await user.buildIndicies();
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
        let uid = 0;
        let low = 0;
        for (let i=0; i<1000; i++)
        {
            let binpos = inbox.findUID(uid, 0);
            let linfound = inbox.messages.find(x => x.uid == uid);
            if (binpos >= 0)
            {
                if (inbox.messages[binpos].uid != uid)
                    debugger;
                if (inbox.messages[binpos] != linfound)
                    debugger;
            }
            else 
            {
                if (linfound)
                {
                    debugger;
                }
            }
            uid += Math.floor(Math.random() * 10);
            if (binpos)
                low = binpos;
        }
        */

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