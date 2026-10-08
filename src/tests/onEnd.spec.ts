import { describe, it, expect, vi } from "vitest";
import { chain } from "../Chain";
import { range } from "../Range";

describe("chain.teardown", () => {
    it("calls a function on teardown", async () => {
        const onTap = vi.fn();
        const onEnd = vi.fn();

        const result = await chain(range(0, 10))
            .tap(onTap)
            .onEnd(onEnd)
            .toArray();

        expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

        expect(onTap).toHaveBeenCalledTimes(10);
        expect(onEnd).toHaveBeenCalledTimes(1);
    });
});
