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
});
