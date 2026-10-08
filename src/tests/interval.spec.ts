import { describe, it, expect } from "vitest";
import { chain } from "../Chain";
import { range } from "../Range";

describe("chain.interval", () => {
    it("groups items into intervals", async () => {
        const result = await chain(range(0, 100)).interval(10).toArray();

        expect(result).toEqual([
            [0, 9],
            [10, 19],
            [20, 29],
            [30, 39],
            [40, 49],
            [50, 59],
            [60, 69],
            [70, 79],
            [80, 89],
            [90, 99],
        ]);
    });

    it("groups items into intervals, even if the last interval is not full", async () => {
        const result = await chain(range(0, 10)).interval(8).toArray();
        expect(result).toEqual([
            [0, 7],
            [8, 9],
        ]);
    });

    it("groups items into intervals, even if the last interval contains only one item", async () => {
        const result = await chain(range(0, 10)).interval(9).toArray();
        expect(result).toEqual([
            [0, 8],
            [9, 9],
        ]);
    });

    it("groups items into intervals, even if the size of the interval is 0", async () => {
        const result = await chain(range(0, 10)).interval(0).toArray();
        expect(result).toEqual([
            [0, 0],
            [1, 1],
            [2, 2],
            [3, 3],
            [4, 4],
            [5, 5],
            [6, 6],
            [7, 7],
            [8, 8],
            [9, 9],
        ]);
    });
});
