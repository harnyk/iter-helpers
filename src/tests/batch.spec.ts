import { describe, it, expect } from "vitest";
import { chain } from "../Chain";
import { range } from "../Range";
import { sleep } from "./sleep";

describe("chain.batch", () => {
    it("groups items into batches", async () => {
        const result = await chain(range(0, 10)).batch(3).toArray();

        expect(result).toEqual([[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]]);
    });

    it("groups items into batches, based on a time frame", async () => {
        const result = await chain(range(0, 10))
            .tap(() => sleep(10))
            .batch({
                timeFrame: 25,
            })
            .toArray();

        expect(result).toEqual([[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]]);
    });

    it("groups items into batches, based on a size or a time frame (size takes precedence)", async () => {
        const result = await chain(range(0, 10))
            .tap(() => sleep(10))
            .batch({
                timeFrame: 50,
                size: 2,
            })
            .toArray();

        expect(result).toEqual([
            [0, 1],
            [2, 3],
            [4, 5],
            [6, 7],
            [8, 9],
        ]);
    });

    it("groups items into a single batch if the size is Infinity", async () => {
        const result = await chain(range(0, 10)).batch(Infinity).toArray();

        expect(result).toEqual([[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]]);
    });
});
