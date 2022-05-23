let assert = require('assert');

// Implements a promised base async multiple-writers, single-writer lock
class AsyncReadersWriter
{
    constructor()
    {
        this.active_readers = 0;
        this.active_writers = 0;
        this.wakeNextWriter = [];
    }

    // Calls the callback when there are no write 
    // callbacks in progress
    async read(callback)
    {
        // Don't start new readers while locked
        if (this.block_new_reads)
        {
            await this.block_new_reads;
        }

        // If this is the first active reader then create a promise
        // that can release the writers when we're finished
        if (this.active_readers == 0)
        {
            this.block_new_writes = new Promise((resolve) => {
                this.unblock_new_writes = resolve
            });
        }

        try
        {
            assert(this.active_writers == 0);
            this.active_readers++;
            return await callback.apply(null, Array.prototype.slice.call(arguments, 1));
        }
        finally
        {
            this.active_readers--;
            if (this.active_readers == 0)
            {
                this.unblock_new_writes();
                this.block_new_writes = null;
            }
        }
    }

    // Calls the callback when there are no other operations
    // in progress, and blocks read callbacks until finished
    async write(callback)
    {
        // Lock readers while writes in progress
        if (!this.block_new_reads)
        {
            this.block_new_reads = new Promise((resolve) => {
                this.unblock_new_reads = resolve
            });
        }

        // Wait until all readers have finished
        if (this.block_new_writes)
        {
            await this.block_new_writes;
        }

        // Wait until all other writers have finished
        if (this.active_writers != 0)
        {
            await new Promise((resolve) => {
                this.wakeNextWriter.push(resolve);
            });
        }

        // We're good to go, invoke the callback
        try
        {
            assert(this.active_writers == 0);
            assert(this.active_readers == 0);
            this.active_writers++;
            return await callback.apply(null, Array.prototype.slice.call(arguments, 1));
        }
        finally
        {
            this.active_writers--;
            assert(this.active_writers == 0);
            assert(this.active_readers == 0);

            // If we've got other pending write operations
            // then wake the next one, otherwise wake the 
            // readers if we have any
            if (this.wakeNextWriter.length > 0)
            {
                this.wakeNextWriter.shift()();
            }
            else
            {
                this.unblock_new_reads();
                this.block_new_reads = null;
            } 
        }
    }
}

module.exports = AsyncReadersWriter