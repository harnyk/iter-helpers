import { CompatChan } from "@harnyk/chan";

/**
 * Options of `Fifo`.
 */
export interface FifoOptions {
    /** The number of queued items at which `send` starts to wait for consumers. Unlimited by default. */
    highWatermark?: number;
}

/**
 * An asynchronous queue that is also an `AsyncIterable`.
 *
 * Producers call `send` (which waits when the queue is full, giving back
 * pressure) and finish with `end`; consumers iterate the fifo with `for await`.
 *
 * @example
 * ```ts
 * const fifo = new Fifo<number>();
 *
 * const consumed = (async () => {
 *     const items: number[] = [];
 *     for await (const item of fifo) {
 *         items.push(item);
 *     }
 *     return items;
 * })();
 *
 * await fifo.send(1);
 * await fifo.send(2);
 * fifo.end();
 *
 * await consumed; // => [1, 2]
 * ```
 */
export class Fifo<T> implements AsyncIterable<T> {
    #ch: CompatChan<T>;

    constructor(private options?: FifoOptions) {
        this.#ch = new CompatChan<T>(this.options?.highWatermark ?? Infinity);
    }

    /**
     * Sends an item to the fifo.
     *
     * Resolves as soon as the item is actually pushed.
     * If the internal queue is full, blocks until the queue is drained.
     */
    send(item: T): Promise<void> {
        return this.#ch.send(item);
    }

    /**
     * Ends the queue: no more items can be sent, and a `send` after this
     * rejects with `chan is closed`.
     *
     * Items already in the queue are still delivered to consumers; the
     * iteration finishes after them.
     */
    end(): void {
        return this.#ch.close();
    }

    /**
     * Queue statistics: the peak length reached by the queued data, the
     * waiting writers and the waiting readers.
     */
    get stat() {
        return this.#ch.stat;
    }

    async *[Symbol.asyncIterator]() {
        yield* this.#ch;
    }
}
