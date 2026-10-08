import { describe, it, expect } from "vitest";
import { chain } from "../Chain";
import { Fifo } from "../Fifo";
import { range } from "../Range";
import { sleep } from "./sleep";

// This entire test suite is deprecated
// It's kept here just to test that the old Fifo API is not broken.
// The new API is tested in fifo-actual.spec.ts
// The old is the one using the deprecated `Fifo` methods `waitDrain` and `push`.
// It is now recommended to use the `send` method instead.

describe("fifo - deprecated API", () => {
    it("creates an async iterator to which you can push items externally", async () => {
        const f = new Fifo<number>();

        // Let's start two processes at the same time:
        //  - iterate a fifo by consuming its items
        //  - push some items to the fifo
        const [results] = await Promise.all([
            chain(f).toArray(),
            (async (): Promise<void> => {
                f.push(1);
                f.push(2);
                f.push(3);
                f.end();
            })(),
        ]);

        expect(results).toEqual([1, 2, 3]);
    });

    it("allows for back-pressure behavior", async () => {
        const highWatermark = 2;

        const f = new Fifo<number>({
            highWatermark,
        });

        const report: string[] = [];

        const log = (item: string) => {
            report.push(item);
        };

        const mainChain = chain(range(0, 10))
            .tap(async (item) => {
                // IMPORTANT:
                // await waitDrain(); push() is deprecated. Use await send() instead.
                // The following notes are deprecated and
                // left here entirely for the backward compatibility:
                //
                // 💡Note that we are using the `waitDrain` method here
                // in order to make sure that the queue is drained.
                // Use it as a best practice.
                // 💡Another best practice is to avoid
                // parallelizing the calls to `await waitDrain()` and `push()`.
                // 💡There is an obvious reason to call `await waitDrain()` from inside
                // any function that would pause an iteration of the chain, like
                // in this example.
                await f.waitDrain();
                f.push(item);
            })
            .onEnd(() => {
                f.end();
            });

        const fifoReader = chain(f)
            .tap((item) => log(`Read: ${item}`))
            .tap(async () => {
                // In this test, the reader should perform slower
                // than the writer, because we want to test that
                // the queue can grow to its highWatermark.
                await sleep(50);
            });

        const [itemsWritten, itemsRead] = await Promise.all([
            mainChain.toArray(),
            fifoReader.toArray(),
        ]);

        // Check that the queue has not grown above the highWatermark
        expect(f.stat.data.peakLength).toBe(highWatermark);

        // Check that the reader has read all the items
        expect(itemsWritten).toEqual(itemsRead);
    });

    it("allows for back-pressure behavior when the highWatermark is 1", async () => {
        const f = new Fifo<number>({
            highWatermark: 1,
        });

        const input = chain(range(0, 10))
            .tap(async (item) => {
                await f.waitDrain();
                f.push(item);
            })
            .onEnd(() => {
                f.end();
            });

        async function* readFifo() {
            yield* f;
        }

        const output = chain(readFifo());

        const [itemsWritten, itemsRead] = await Promise.all([
            input.toArray(),
            output.toArray(),
        ]);

        expect(itemsWritten).toEqual(itemsRead);
    });

    it("#7: supports 1 writer and 2 readers", async () => {
        const f = new Fifo<number>();

        const fooLogs: number[] = [];
        const barLogs: number[] = [];

        async function foo() {
            for await (const item of f) {
                fooLogs.push(item);
                await sleep(5);
            }
        }

        async function bar() {
            for await (const item of f) {
                barLogs.push(item);
                await sleep(5);
            }
        }

        await Promise.all([
            foo(),
            bar(),
            chain(range(0, 10))
                .tap(async (item) => {
                    await f.waitDrain();
                    f.push(item);
                })
                .onEnd(async () => {
                    f.end();
                })
                .consume(),
        ]);

        // Some items consumed by foo
        expect(fooLogs.length).toBeGreaterThan(0);

        // Some items consumed by bar
        expect(barLogs.length).toBeGreaterThan(0);

        // No items lost
        expect(fooLogs.length + barLogs.length).toEqual(10);

        // All items reached the consumers
        const allLogs = [...fooLogs, ...barLogs].sort((a, b) => a - b);
        expect(allLogs).toEqual(await chain(range(0, 10)).toArray());
    });

    // More general example of multi-reader
    it("supports 1 writer and multiple readers", async () => {
        const f = new Fifo<number>({
            highWatermark: 5,
        });

        const readers: Promise<number[]>[] = [];
        for (let i = 0; i < 10; i++) {
            readers.push(
                (async () => {
                    const result: number[] = [];
                    for await (const item of f) {
                        result.push(item);
                    }
                    return result;
                })(),
            );
        }

        async function writer() {
            const result: number[] = [];
            for (let i = 0; i < 100; i++) {
                await f.waitDrain();
                f.push(i);
                result.push(i);
            }
            f.end();
            return result;
        }

        const [writerResult, readersResult] = await Promise.all([
            writer(),
            Promise.all(readers),
        ]);

        const normalizedReadersResult = readersResult
            .flat()
            .sort((a, b) => a - b);
        expect(normalizedReadersResult).toEqual(writerResult);
    });
});
