const { performance, PerformanceObserver } = require("perf_hooks")
const Imap = require('./imap_promise');
const inspect = require('util').inspect;

const perfObserver = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
      console.log(entry.name, entry.duration)
    })
  })
  
perfObserver.observe({ entryTypes: ["measure"], buffer: true });


(async function() {

    let imap = new Imap({
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
    });

    await imap.connect();
    console.log("Connected");

    await imap.openBox("Archive");
    console.log("Archive Opened");

    performance.mark("sync-start")
    performance.mark("sync-end")
    let data = await imap.thread("REFERENCES", [ "ALL" ]);
    performance.measure("sync", "sync-start", "sync-end")

    await imap.end();
    console.log("Finished");
})();