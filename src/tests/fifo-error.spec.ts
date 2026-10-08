import { describe, it, expect } from "vitest";
import { Fifo } from "../Fifo";
import { collect, withTimeout } from "./unhandled";

describe("fifo - end(error)", () => {
    it("delivers the queued items, then throws the error", async () => {
        const fifo = new Fifo<number>();
        await fifo.send(1);
        await fifo.send(2);
        fifo.end(new Error("boom"));

        const { items, error } = await withTimeout(collect(fifo));

        expect(items).toEqual([1, 2]);
        expect(error).toEqual(new Error("boom"));
    });

    it("keeps the first error when ended twice", async () => {
        const fifo = new Fifo<number>();
        fifo.end(new Error("first"));
        fifo.end(new Error("second"));

        const { error } = await withTimeout(collect(fifo));

        expect(error).toEqual(new Error("first"));
    });

    it("gives the error to every reader", async () => {
        const fifo = new Fifo<number>();
        const readers = [collect(fifo), collect(fifo)];
        await fifo.send(1);
        fifo.end(new Error("boom"));

        const results = await withTimeout(Promise.all(readers));

        for (const result of results) {
            expect(result.error).toEqual(new Error("boom"));
        }
        expect(results.flatMap((result) => result.items)).toEqual([1]);
    });

    it("rejects send after end(error) with chan is closed", async () => {
        const fifo = new Fifo<number>();
        fifo.end(new Error("boom"));

        await expect(fifo.send(1)).rejects.toThrow("chan is closed");
    });

    it("ends normally when no error is given", async () => {
        const fifo = new Fifo<number>();
        await fifo.send(1);
        fifo.end();

        const { items, error } = await withTimeout(collect(fifo));

        expect(items).toEqual([1]);
        expect(error).toBeUndefined();
    });

    it("an explicit undefined reason is still a failure", async () => {
        const fifo = new Fifo<number>();
        await fifo.send(1);
        fifo.end(undefined);

        const result = await withTimeout(collect(fifo));

        expect(result.items).toEqual([1]);
        expect(result.failed).toBe(true);
        expect(result.error).toBeUndefined();
    });
});
