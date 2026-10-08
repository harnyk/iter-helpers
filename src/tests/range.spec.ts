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

    // Never spread an iteration that may be infinite: take a bounded prefix.
    function firstItems(iterable: Iterable<number>, limit: number): number[] {
        const items: number[] = [];
        for (const item of iterable) {
            items.push(item);
            if (items.length >= limit) {
                break;
            }
        }
        return items;
    }

    it("a step pointing away from the end gives an empty range", () => {
        expect(firstItems(range(0, 5, -1), 3)).toEqual([]);
        expect(firstItems(range(5, 0, 1), 3)).toEqual([]);
    });

    it("a step of 0 throws a RangeError", () => {
        expect(() => firstItems(range(0, 5, 0), 3)).toThrow(RangeError);
        expect(() => firstItems(range(0, 5, 0), 3)).toThrow(
            "range: step must not be 0",
        );
    });

    it("an endless range with a negative step still counts down", () => {
        expect(firstItems(range(0, undefined, -1), 3)).toEqual([0, -1, -2]);
    });
});
