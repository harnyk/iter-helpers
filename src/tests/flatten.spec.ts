import { describe, it, expect } from "vitest";
import { chain } from "../Chain";

describe("chain.flatten", () => {
    it("flattens arrays into separate items", async () => {
        const result = await chain([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]])
            .flatten()
            .toArray();

        expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
});
