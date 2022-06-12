// Simple worker thread object for testing

class Worker
{
    constructor(p1, p2)
    {
        this.p1 = p1;
        this.p2 = p2;
    }

    getP1() { return this.p1; }
    getP2() { return this.p2; }
    setP1(value) { this.p1 = value; }
    setP2(value) { this.p2 = value; }
    concat() { return this.p1 + "-" + this.p2; }

    async asyncMethod()
    {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return "Did Delay";
    }

    on(eventName, callback)
    {
        if (eventName == 'event')
            this.callback = callback;
    }

    async triggerCallback()
    {
        await new Promise((resolve) => setTimeout(resolve, 300));
        this.callback("Callback Data");
    }
}


module.exports = Worker;