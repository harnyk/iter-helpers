import { describe, it, expect } from "vitest";
import { mux } from "../main";
import { sleep } from "./sleep";
import { collect, trackUnhandled, withTimeout } from "./unhandled";

async function* failingAfter<T>(items: T[]): AsyncGenerator<T> {
    yield* items;
    throw new Error("source failed");
}

describe("mux - errors", () => {
    it("an input error reaches the consumer", async () => {
        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(collect(mux([[10, 20], failingAfter([1])]))),
        );

        expect(result.error).toEqual(new Error("source failed"));
        expect(unhandled).toEqual([]);
    });

    it("the other inputs stop quietly after the failure", async () => {
        async function* slowHealthy() {
            for (let i = 0; i < 5; i++) {
                await sleep(20);
                yield i;
            }
        }

        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(collect(mux([slowHealthy(), failingAfter([1])]))),
        );

        expect(result.error).toEqual(new Error("source failed"));
        expect(unhandled).toEqual([]);
    });

    it("an input that throws undefined is still a failure", async () => {
        async function* throwsUndefined() {
            yield 1;
            throw undefined;
        }

        const { result, unhandled } = await trackUnhandled(() =>
            withTimeout(collect(mux([[10, 20], throwsUndefined()]))),
        );

        expect(result.failed).toBe(true);
        expect(unhandled).toEqual([]);
    });
});
