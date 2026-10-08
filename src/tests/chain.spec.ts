import { describe, it, expect } from "vitest";
import { chain } from "../Chain";

describe("chain", () => {
    it("has a consume method which resolves when the iteration is done", async () => {
        //💡Rule: don't forget to call `.consume()` or `.toArray()`
        // in order to start the iteration.
        //💡Rule: `await` any of this method's result in order to
        // wait for the iteration to be done.
        await chain([1, 2, 3]).consume();
    });

    it("consumes an array", async () => {
        const result = await chain([1, 2, 3]).toArray();

        expect(result).toEqual([1, 2, 3]);
    });

    it("consumes an async iterator", async () => {
        async function* generate() {
            yield 1;
            yield 2;
            yield 3;
        }

        const result = await chain(generate()).toArray();

        expect(result).toEqual([1, 2, 3]);
    });
});
