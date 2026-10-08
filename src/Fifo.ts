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
 * `end(error)` finishes the queue with an error that the consumers receive
 * after the queued items.
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
    #ended = false;
    #failure: { error: unknown } | null = null;

    constructor(private options?: FifoOptions) {
        this.#ch = new CompatChan<T>(this.options?.highWatermark ?? Infinity);
    }

    /**
     * Sends an item to the fifo.
     *
     * Resolves as soon as the item is actually pushed.
     * If the internal queue is full, waits until a slot is free.
     */
    send(item: T): Promise<void> {
        return this.#ch.send(item);
    }

    /**
     * Ends the queue: no more items can be sent, and a `send` after this
     * rejects with `chan is closed`.
     *
     * Items already in the queue are still delivered to consumers; the
     * iteration finishes after them. If an error is passed, every consumer
     * receives it, thrown from the iteration, after the queued items; even
     * `undefined` counts as an error when it is passed explicitly. Ending a
     * queue that is already ended does nothing, so the first error wins.
     *
     * @param reason - the error the queue ends with, if it did not end normally
     */
    end(...reason: [error?: unknown]): void {
        if (this.#ended) {
            return;
        }
        this.#ended = true;
        if (reason.length > 0) {
            this.#failure = { error: reason[0] };
        }
        this.#ch.close();
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
        if (this.#failure) {
            throw this.#failure.error;
        }
    }
}
