import { describe, it, expect } from "vitest";
import { chain, concurrentMap } from "../main";
import { sleep } from "./sleep";
import { collect, trackUnhandled, withTimeout } from "./unhandled";

async function* failingAfter<T>(items: T[]): AsyncGenerator<T> {
    yield* items;
    throw new Error("source failed");
}

describe("concurrentMap - errors and laziness", () => {
    it("a source error reaches the consumer (#4)", async () => {
        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(
                collect(
                    chain(failingAfter([1, 2])).concurrentMap(
                        { concurrency: 2 },
                        async (n) => n,
                    ),
                ),
            ),
        );

        expect(result.error).toEqual(new Error("source failed"));
        expect(unhandled).toEqual([]);
    });

    it("a mapper error without errorMapper reaches the consumer, like map (#3)", async () => {
        const calls: number[] = [];

        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(
                collect(
                    chain([1, 2, 3]).concurrentMap(
                        { concurrency: 1 },
                        async (n) => {
                            calls.push(n);
                            if (n === 2) {
                                throw new Error("mapper failed");
                            }
                            return n;
                        },
                    ),
                ),
            ),
        );

        expect(result.items).toEqual([1]);
        expect(result.error).toEqual(new Error("mapper failed"));
        expect(calls).toEqual([1, 2]);
        expect(unhandled).toEqual([]);
    });

    it("an errorMapper that throws reaches the consumer", async () => {
        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(
                collect(
                    chain([1, 2]).concurrentMap(
                        { concurrency: 2 },
                        async () => {
                            throw new Error("mapper failed");
                        },
                        () => {
                            throw new Error("errorMapper failed");
                        },
                    ),
                ),
            ),
        );

        expect(result.error).toEqual(new Error("errorMapper failed"));
        expect(unhandled).toEqual([]);
    });

    it("an error while other calls are in flight discards their results quietly", async () => {
        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(
                collect(
                    chain([1, 2, 3]).concurrentMap(
                        { concurrency: 3 },
                        async (n) => {
                            if (n === 1) {
                                throw new Error("boom");
                            }
                            await sleep(30);
                            return n;
                        },
                    ),
                ),
            ),
        );

        expect(result.items).toEqual([]);
        expect(result.error).toEqual(new Error("boom"));
        expect(unhandled).toEqual([]);
    });

    it("does not read the source or call the mapper before it is consumed (#8)", async () => {
        let sourceReads = 0;
        let mapperCalls = 0;
        function* source() {
            sourceReads++;
            yield 1;
            yield 2;
        }

        chain(source()).concurrentMap({ concurrency: 2 }, async (n) => {
            mapperCalls++;
            return n;
        });
        await sleep(50);

        expect(sourceReads).toBe(0);
        expect(mapperCalls).toBe(0);
    });

    it("starts when the chain is consumed", async () => {
        const { items, error } = await withTimeout(
            collect(
                chain([1, 2]).concurrentMap(
                    { concurrency: 2 },
                    async (n) => n * 10,
                ),
            ),
        );

        expect(error).toBeUndefined();
        expect([...items].sort((a, b) => a - b)).toEqual([10, 20]);
    });

    it("a rejection without a reason is still a failure", async () => {
        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(
                collect(
                    chain([1, 2, 3]).concurrentMap(
                        { concurrency: 1 },
                        async (n) => {
                            if (n === 2) {
                                return Promise.reject();
                            }
                            return n;
                        },
                    ),
                ),
            ),
        );

        expect(result.items).toEqual([1]);
        expect(result.failed).toBe(true);
        expect(unhandled).toEqual([]);
    });

    it("an error while the loop waits for capacity reaches the consumer", async () => {
        const calls: number[] = [];

        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(
                collect(
                    chain([1, 2, 3, 4, 5]).concurrentMap(
                        { concurrency: 2 },
                        async (n) => {
                            calls.push(n);
                            await sleep(10);
                            if (n === 2) {
                                throw new Error("boom");
                            }
                            return n;
                        },
                    ),
                ),
            ),
        );

        expect(result.error).toEqual(new Error("boom"));
        expect(calls.length).toBeLessThan(5);
        expect(unhandled).toEqual([]);
    });

    describe("throwing callbacks", () => {
        it("onTaskStarted that throws reaches the consumer and does not leak a pool slot", async () => {
            let failNextStart = true;
            const operator = concurrentMap(
                {
                    concurrency: 1,
                    onTaskStarted: () => {
                        if (failNextStart) {
                            failNextStart = false;
                            throw new Error("started failed");
                        }
                    },
                },
                async (n: number) => n,
            );

            const first = await trackUnhandled(() =>
                withTimeout(collect(chain([1, 2]).pipe(operator))),
            );
            expect(first.result.error).toEqual(new Error("started failed"));
            expect(first.unhandled).toEqual([]);

            // the same operator object must still work: no slot was leaked
            const second = await withTimeout(
                collect(chain([1, 2]).pipe(operator)),
            );
            expect(second.error).toBeUndefined();
            expect(second.items).toEqual([1, 2]);
        });

        it("onTaskCompleted that throws reaches the consumer without hanging or leaking a rejection", async () => {
            const { result, unhandled } = await trackUnhandled(() =>
                withTimeout(
                    collect(
                        chain([1, 2, 3]).concurrentMap(
                            {
                                concurrency: 1,
                                onTaskCompleted: () => {
                                    throw new Error("completed failed");
                                },
                            },
                            async (n) => n,
                        ),
                    ),
                ),
            );

            expect(result.error).toEqual(new Error("completed failed"));
            expect(unhandled).toEqual([]);
        });
    });
});
