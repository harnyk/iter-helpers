import { CompatChan } from "@harnyk/chan";

export interface FifoOptions {
    highWatermark?: number;
}

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
     * End the queue.
     *
     * This method stops the queue from pushing more items.
     *
     * If the queue has items and it's being iterated over,
     * the items will eventually be flushed, then the iteration will stop.
     *
     * After the `end` method is called, calls to `send` will be rejected.
     *
     * Resolves once all items are read by consumers.
     */
    end(): void {
        return this.#ch.close();
    }

    get stat() {
        return this.#ch.stat;
    }

    async *[Symbol.asyncIterator]() {
        yield* this.#ch;
    }
}
