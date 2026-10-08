import { describe, it, expect } from "vitest";
import { chain } from "../Chain";

describe("chain.map", () => {
    it("calls a function for each item returning the transformed item", async () => {
        const result = await chain([1, 2, 3])
            .map((item) => item * 2)
            .toArray();

        expect(result).toEqual([2, 4, 6]);
    });
});
