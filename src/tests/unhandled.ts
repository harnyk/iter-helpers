export async function trackUnhandled<T>(
    run: () => Promise<T>,
): Promise<{ result: T; unhandled: unknown[] }> {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
        unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
        const result = await run();
        // let pending timers and microtasks settle before the list is read
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { result, unhandled };
    } finally {
        process.off("unhandledRejection", onUnhandled);
    }
}

export function withTimeout<T>(promise: Promise<T>, ms = 1000): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`TIMEOUT after ${ms} ms`)), ms),
        ),
    ]);
}

export async function collect<T>(
    iterable: AsyncIterable<T>,
): Promise<{ items: T[]; error?: unknown }> {
    const items: T[] = [];
    try {
        for await (const item of iterable) {
            items.push(item);
        }
    } catch (error) {
        return { items, error };
    }
    return { items };
}
