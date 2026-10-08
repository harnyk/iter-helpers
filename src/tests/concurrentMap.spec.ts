import { describe, it, expect } from "vitest";
import { chain } from "../Chain";
import { Fifo } from "../Fifo";
import { range } from "../Range";

const sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

describe("chain.concurrentMap", () => {
    it("calls a function for each item in parallel returning the transformed item", async () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        const startTime = Date.now();

        // Let's define an asynchronous mapper that emulates a real work
        // by introducing a delay
        const delay = 100;
        const mapper = async (item: number) => {
            await sleep(delay);
            return item * 2;
        };

        const concurrency = 4;

        let currentConcurrency = 0;
        let maxConcurrency = 0;

        const result = await chain(input)
            .concurrentMap(
                {
                    // The only required option is concurrency
                    concurrency,
                    // Let's measure the real maximum concurrency
                    onTaskStarted() {
                        currentConcurrency++;
                        maxConcurrency = Math.max(
                            maxConcurrency,
                            currentConcurrency,
                        );
                    },
                    onTaskCompleted() {
                        currentConcurrency--;
                    },
                },
                mapper,
            )
            .toArray();

        const endTime = Date.now();

        expect(result).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);

        expect(maxConcurrency).toBe(concurrency);

        // The overall calculation time should be `concurrency` times
        // lower than if we did it sequentially.

        // (Let's reserve a 10% overhead though)
        const overheadFactor = 0.1;
        expect(endTime - startTime).toBeLessThan(
            Math.ceil(input.length / concurrency) *
                delay *
                (1 + overheadFactor),
        );
    });

    it("should process all items", async () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        const result = await chain(input)
            .concurrentMap({ concurrency: 4 }, async (a) => {
                return a;
            })
            .toArray();

        expect(result).toHaveLength(input.length);
    });

    it("should process all items with conditional stopping of the chain source", async () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        const fifo = new Fifo<number>();

        for (const item of input) {
            await fifo.send(item);
        }

        let counter = 0;

        const result = await chain(fifo)
            .concurrentMap({ concurrency: 4 }, async (a) => {
                return a * 2;
            })
            .tap(() => {
                counter++;
                if (counter >= input.length) {
                    fifo.end();
                }
            })
            .toArray();

        expect(result).toHaveLength(input.length);
    });

    it("does not leak unhandled rejections when the consumer stops early", async () => {
        const result = await chain(range(0, 20))
            .concurrentMap({ concurrency: 4 }, async (a) => {
                await sleep(5);
                return a;
            })
            .take(2)
            .toArray();

        expect(result).toHaveLength(2);

        // let the remaining in-flight tasks settle: vitest fails the run on any unhandled rejection
        await sleep(100);
    });
});
