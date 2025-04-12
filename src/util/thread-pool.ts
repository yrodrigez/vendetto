class RateLimitedThreadPool {
    private readonly limit: number;
    private readonly interval: number;
    private queue: Array<{
        task: () => Promise<any>;
        resolve: (value: any) => void;
        reject: (reason: any) => void;
    }> = [];
    private running = false;

    /**
     * @param limit Maximum tasks to execute per interval.
     * @param interval Time window (in ms) to wait between batches.
     */
    constructor(limit: number, interval: number) {
        this.limit = limit; // In our case, 5 tasks
        this.interval = interval; // In our case, 5000 ms (5 seconds)
    }

    /**
     * Submits an asynchronous task to the threadpool.
     * @param task A function that returns a Promise.
     * @returns A Promise that resolves or rejects with the task's result.
     */
    submit(task: () => Promise<any>): Promise<any> {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            // Start processing if not already running.
            if (!this.running) {
                this.running = true;
                this.runQueue();
            }
        });
    }

    /**
     * Processes the task queue in batches.
     */
    private async runQueue(): Promise<void> {
        try {
            while (this.queue.length > 0) {
                // Extract a batch of tasks up to the set limit
                const batch = this.queue.splice(0, this.limit);

                // Run all tasks in the batch concurrently
                await Promise.all(
                    batch.map(({ task, resolve, reject }) =>
                        task().then(resolve).catch(reject)
                    )
                );

                // If there are remaining tasks, wait for the interval
                if (this.queue.length > 0) {
                    await this.delay(this.interval);
                }
            }
        } catch (error) {
            console.error('Thread pool encountered an error:', error);
            throw error // Propagate the error to the caller
        } finally {
            this.running = false;
        }
    }

    /**
     * Helper function that returns a Promise which resolves after a specified delay.
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export default RateLimitedThreadPool;
