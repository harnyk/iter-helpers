import { describe, it, expect } from "vitest";
import { chain } from "../Chain";
import { range } from "../Range";

describe("range", () => {
    it("produces an async iterator", async () => {
        // Finite ascending range with default step (1)
        expect(await chain(range(0, 4)).toArray()).toEqual([0, 1, 2, 3]);

        // Finite descending range with default step (-1)
        expect(await chain(range(4, 0)).toArray()).toEqual([4, 3, 2, 1]);

        // Infinite ascending range with default step (1)
        // (take() is used to limit the number of items)
        expect(await chain(range(0)).take(5).toArray()).toEqual([
            0, 1, 2, 3, 4,
        ]);

        // Infinite descending range with explicit step.
        // (take() is used to limit the number of items)
        expect(
            await chain(range(0, undefined, -1))
                .take(5)
                .toArray(),
        ).toEqual([0, -1, -2, -3, -4]);

        // Finite ascending range with explicit step.
        expect(await chain(range(0, 2, 0.5)).toArray()).toEqual([
            0, 0.5, 1, 1.5,
        ]);

        // Finite descending range with explicit step.
        expect(await chain(range(2, 0, -0.5)).toArray()).toEqual([
            2, 1.5, 1, 0.5,
        ]);
    });
});
