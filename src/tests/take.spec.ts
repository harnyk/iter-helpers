import { describe, it, expect } from "vitest";
import { chain } from "../Chain";
import { range } from "../Range";

describe("take", () => {
    it("takes specific number of items then stops", async () => {
        const result = await chain(range(0, 10)).take(5).toArray();
        expect(result).toEqual([0, 1, 2, 3, 4]);
    });

    it("takes stops correctly even if the iterator is ended before the number of items has been taken", async () => {
        const result = await chain(range(0, 5)).take(10).toArray();
        expect(result).toEqual([0, 1, 2, 3, 4]);
    });

    it("breaks the iteration of the input too", async () => {
        const generatedItems: number[] = [];
        const infiniteSourceWithLogging = chain(range(0, 10)).tap((value) => {
            generatedItems.push(value);
        });

        const takenItems = await infiniteSourceWithLogging.take(5).toArray();

        expect(generatedItems).toEqual([0, 1, 2, 3, 4]);
        expect(takenItems).toEqual([0, 1, 2, 3, 4]);
    });

    it("take(0) is empty and does not read the source", async () => {
        let reads = 0;
        function* source() {
            reads++;
            yield 1;
            yield 2;
        }

        const result = await chain(source()).take(0).toArray();

        expect(result).toEqual([]);
        expect(reads).toBe(0);
    });

    it("a negative size is empty as well and does not read the source", async () => {
        let reads = 0;
        function* source() {
            reads++;
            yield 1;
            yield 2;
        }

        const result = await chain(source()).take(-1).toArray();

        expect(result).toEqual([]);
        expect(reads).toBe(0);
    });
});
