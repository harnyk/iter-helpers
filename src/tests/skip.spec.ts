import { describe, it, expect } from "vitest";
import { chain } from "../Chain";
import { range } from "../Range";

describe("skip", () => {
    it("skips items", async () => {
        const result = await chain(range(0, 10)).skip(2).toArray();
        expect(result).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    });
});
