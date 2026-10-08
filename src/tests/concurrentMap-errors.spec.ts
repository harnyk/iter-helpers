import { describe, it, expect } from "vitest";
import { chain } from "../main";
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
});
