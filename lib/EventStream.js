class SimpleSSE
{
    constructor()
    {
        this.clients = [];
        this.eventData = new Map();
        this.middleware = this.middleware.bind(this);
    }

    _send(res, packet)
    {
        if (packet.event != "")
            res.write(`event: ${packet.event}\n`);
        if (packet.id)
            res.write(`id: ${packet.id}\n`);
        res.write(`data: ${JSON.stringify(packet.data)}\n\n`);
    }

    send(data, event, id)
    {
        // Default event?
        if (!event)
            event = "";

        // Store data packet
        let packet = {
            event,
            data,
            id
        };
        this.eventData.set(event, packet);

        // Send to all clients
        for (let c of this.clients)
        {
            this._send(c.res, packet);
        }
    }

    middleware(req, res)
    {
        // Setup event stream
        req.socket.setTimeout(0);
        req.socket.setNoDelay(true);
        req.socket.setKeepAlive(true);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Accel-Buffering', 'no');
        if (req.httpVersion !== '2.0') 
        {
            res.setHeader('Connection', 'keep-alive');
        }

        // Send current data packets
        for (let [k,v] of this.eventData)
        {
            this._send(res, v);
        }
    
        // Create new client
        const clientId = Date.now();    
        const newClient = {
            id: clientId,
            res: res
        };
        this.clients.push(newClient);
        console.log(`New SSE Stream: ${clientId}`);

        // Hook up for close listener
        req.on('close', () => {
            console.log(`Closed SSE Stream: ${clientId}`);
            this.clients = this.clients.filter(client => client.id !== clientId);
        });
    }        

}

module.exports = SimpleSSE;

    /*
    // Kill old clients
    for (let i=clients.length - 1; i>=0; i--)
    {
        let client = clients[i];
        if (client.id + 5000 < Date.now())
        {
            client.res.end();
            clients.splice(i, 1);
            console.log("Killed client", client.id)
        }
    }
    */