import { describe, it, expect } from "vitest";
import { chain } from "../Chain";
import { range } from "../Range";

describe("chain.filter", () => {
    it("calls a function for each item filtering out the items for which the function returns false", async () => {
        const result = await chain(range(0, 10))
            .filter((item): item is number => item % 2 === 0)
            .toArray();

        expect(result).toEqual([0, 2, 4, 6, 8]);
    });
});
