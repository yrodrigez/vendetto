import RateLimitedThreadPool from '../../util/thread-pool';

describe('RateLimitedThreadPool', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('executes tasks successfully', async () => {
        const pool = new RateLimitedThreadPool(2, 1000);
        const task = jest.fn().mockResolvedValue('result');

        const promise = pool.submit(task);
        await jest.runAllTimersAsync();

        expect(task).toHaveBeenCalledTimes(1);
        await expect(promise).resolves.toBe('result');
    });

    test('respects rate limit by processing in batches', async () => {
        const pool = new RateLimitedThreadPool(2, 1000);
        const executionOrder: number[] = [];

        const createTask = (id: number) => async () => {
            executionOrder.push(id);
            return id;
        };

        // Submit 5 tasks
        const promises = [
            pool.submit(createTask(1)),
            pool.submit(createTask(2)),
            pool.submit(createTask(3)),
            pool.submit(createTask(4)),
            pool.submit(createTask(5)),
        ];

        // First batch should run immediately
        // Need to flush promises to ensure the async operations complete
        await jest.advanceTimersByTimeAsync(0);
        await Promise.resolve(); // Flush microtasks
        await Promise.resolve(); // Ensure promises are settled

        expect(executionOrder).toEqual([1]);

        // Second batch after interval
        await jest.advanceTimersByTimeAsync(1000);
        await Promise.resolve();
        await Promise.resolve();

        expect(executionOrder).toEqual([1, 2, 3]);

        // Third batch after another interval
        await jest.advanceTimersByTimeAsync(1000);
        await Promise.resolve();
        await Promise.resolve();

        expect(executionOrder).toEqual([1, 2, 3, 4, 5]);

        // Verify all promises resolve with expected values
        await expect(Promise.all(promises)).resolves.toEqual([1, 2, 3, 4, 5]);
    });

    test('handles task errors correctly', async () => {
        const pool = new RateLimitedThreadPool(2, 5000); // Set interval to 0 for immediate execution
        const errorMessage = 'Task failed';
        const task = jest.fn().mockImplementation(() => Promise.reject(new Error(errorMessage)));

        const promise = pool.submit(task);

        await expect(promise).rejects.toThrow(errorMessage);
        expect(task).toHaveBeenCalledTimes(1);
    });

    test('processes an empty queue without errors', async () => {
        const pool = new RateLimitedThreadPool(2, 1000);
        // Nothing to test here, just making sure no errors occur
        await jest.runAllTimersAsync();
    });

    test('continues processing after a task fails', async () => {
        jest.useFakeTimers();

        const pool = new RateLimitedThreadPool(2, 5000);
        const errorMessage = 'Task failed';
        const successMessage = 'Task succeeded';

        const failingTask = () => Promise.reject(new Error(errorMessage));
        const successTask = () => Promise.resolve(successMessage);

        const failPromise = pool.submit(failingTask);
        const successPromise = pool.submit(successTask);

        failPromise.catch(() => {/* intentionally empty */});

        await jest.runAllTimersAsync();

        await expect(failPromise).rejects.toThrow(errorMessage);
        await expect(successPromise).resolves.toBe(successMessage);
    });

    test('handles long-running tasks correctly', async () => {
        const pool = new RateLimitedThreadPool(2, 1000);
        let resolveTask: (value: string) => void;

        const longTask = () => new Promise<string>(resolve => {
            resolveTask = resolve;
        });

        const normalTask = jest.fn().mockResolvedValue('normal');

        const longPromise = pool.submit(longTask as any);
        const normalPromise = pool.submit(normalTask);

        await jest.advanceTimersByTimeAsync(2000);
        expect(normalTask).not.toHaveBeenCalled();

        resolveTask!('long');

        await Promise.resolve();

        await jest.advanceTimersByTimeAsync(1000);

        await Promise.resolve();

        expect(normalTask).toHaveBeenCalledTimes(1);
        await expect(longPromise).resolves.toBe('long');
        await expect(normalPromise).resolves.toBe('normal');
    });
});