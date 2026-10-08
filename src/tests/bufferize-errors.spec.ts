import { describe, it, expect } from "vitest";
import { chain } from "../main";
import { sleep } from "./sleep";
import { collect, trackUnhandled, withTimeout } from "./unhandled";

async function* failingAfter<T>(items: T[]): AsyncGenerator<T> {
    yield* items;
    throw new Error("source failed");
}

describe("bufferize family - errors", () => {
    it("batch: emits the partial batch, then the source error", async () => {
        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(collect(chain(failingAfter([1, 2])).batch(5))),
        );

        expect(result.items).toEqual([[1, 2]]);
        expect(result.error).toEqual(new Error("source failed"));
        expect(unhandled).toEqual([]);
    });

    it("batch: emits full batches first, then the partial one, then the error", async () => {
        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(collect(chain(failingAfter([1, 2, 3])).batch(2))),
        );

        expect(result.items).toEqual([[1, 2], [3]]);
        expect(result.error).toEqual(new Error("source failed"));
        expect(unhandled).toEqual([]);
    });

    it("interval: emits the partial interval, then the source error", async () => {
        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(collect(chain(failingAfter([1, 2])).interval(3))),
        );

        expect(result.items).toEqual([[1, 2]]);
        expect(result.error).toEqual(new Error("source failed"));
        expect(unhandled).toEqual([]);
    });

    it("bufferize: a throwing reducer emits what was accumulated, then the error", async () => {
        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(
                collect(
                    chain([1, 2, 3]).bufferize({
                        getInitialValue: () => [] as number[],
                        reducer: (acc: number[], value: number) => {
                            if (value === 3) {
                                throw new Error("reducer failed");
                            }
                            return [...acc, value];
                        },
                    }),
                ),
            ),
        );

        expect(result.items).toEqual([[1, 2]]);
        expect(result.error).toEqual(new Error("reducer failed"));
        expect(unhandled).toEqual([]);
    });

    it("timeFrame: a flushed value, the partial one, then the error, nothing after", async () => {
        async function* slowThenFailing() {
            yield 1;
            await sleep(120);
            yield 2;
            throw new Error("source failed");
        }

        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(
                collect(
                    chain(slowThenFailing()).batch({
                        size: 10,
                        timeFrame: 40,
                    }),
                ),
            ),
        );

        expect(result.items).toEqual([[1], [2]]);
        expect(result.error).toEqual(new Error("source failed"));
        expect(unhandled).toEqual([]);
    });

    it("timeFrame: the pending timer is cancelled by the error", async () => {
        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(
                collect(
                    chain(failingAfter([1])).batch({
                        size: 10,
                        timeFrame: 30,
                    }),
                ),
            ),
        );

        expect(result.items).toEqual([[1]]);
        expect(result.error).toEqual(new Error("source failed"));
        expect(unhandled).toEqual([]);
    });

    it("a source that throws undefined is still a failure", async () => {
        async function* throwsUndefined() {
            yield 1;
            throw undefined;
        }

        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(collect(chain(throwsUndefined()).batch(5))),
        );

        expect(result.items).toEqual([[1]]);
        expect(result.failed).toBe(true);
        expect(unhandled).toEqual([]);
    });

    describe.each([
        { name: "the source ends", throwAtEnd: false },
        { name: "the source fails", throwAtEnd: true },
    ])("timeFrame with a slow consumer, when $name", ({ throwAtEnd }) => {
        it("does not lose a timer flush that is still waiting for the consumer", async () => {
            async function* source() {
                yield 1;
                await sleep(30);
                yield 2;
                await sleep(30);
                yield 3;
                await sleep(30);
                if (throwAtEnd) {
                    throw new Error("source failed");
                }
            }

            const batches: number[][] = [];
            let failed = false;
            const consumer = (async () => {
                try {
                    for await (const batch of chain(source()).batch({
                        size: 100,
                        timeFrame: 10,
                    })) {
                        batches.push(batch);
                        await sleep(150);
                    }
                } catch {
                    failed = true;
                }
            })();

            const { unhandled } = await trackUnhandled(() =>
                withTimeout(consumer, 3000),
            );

            expect(batches.flat()).toEqual([1, 2, 3]);
            expect(failed).toBe(throwAtEnd);
            expect(unhandled).toEqual([]);
        });
    });
});
