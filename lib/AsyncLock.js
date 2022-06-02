class AsyncLock
{
    constructor()
    {
        this.pending = [];
        this.taken = false;
    }

    async section(callback)
    {
        // If take, wait till available
        if (this.taken)
        {
            await new Promise((resolve) => {
                this.pending.push(resolve);
            });
        }

        // Take lock
        this.taken = true;
        try
        {
            // Invoke target
            return await callback();
        }
        finally
        {
            // Release lock
            this.taken = false;

            // Continue with next
            this.pending.shift()?.();
        }
    }
}

module.exports = AsyncLock;