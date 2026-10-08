import { describe, it, expect } from "vitest";
/* eslint-disable indent */
import { chain } from "../Chain";
import { range } from "../Range";
import { sleep } from "./sleep";

describe("Bufferize", () => {
    it("can be used as batcher", async () => {
        const bufferized = await chain(range(0, 10))
            .bufferize({
                getInitialValue: (): number[] => [],
                reducer(acc, value) {
                    acc.push(value);
                    return acc;
                },
                shouldFlush(acc) {
                    return acc.length >= 3;
                },
            })
            .toArray();

        expect(bufferized).toEqual([[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]]);
    });

    it("can be used as a timeframe-based batcher", async () => {
        // Let's produce a new timestamp every 10 ms
        const bufferized = await chain(range(0, 100))
            .tap(() => sleep(10))
            .map(() => Date.now())
            // Let's pack into the batches at most every 210 ms
            .bufferize({
                timeFrame: 210,
                getInitialValue: (): number[] => [],
                reducer(acc, value) {
                    acc.push(value);
                    return acc;
                },
            })
            .toArray();

        // We should have 5 batches
        expect(bufferized).toHaveLength(5);

        // And the difference between the first and the last item in such a batch...
        const realTimeFrames = bufferized.map(
            (values) => values.at(-1)! - values.at(0)!,
        );

        // ...should be at most 220 ms
        expect(realTimeFrames.every((timeFrame) => timeFrame <= 220)).toBe(
            true,
        );
    });

    it("can be used as sum calculator", async () => {
        const sums = await chain(range(0, 10))
            .bufferize({
                getInitialValue: (): number => 0,
                reducer(acc, value) {
                    return acc + value;
                },
            })
            .toArray();

        expect(sums).toEqual([45]);
    });

    it("can be used as an actions reducer", async () => {
        interface IncFoo {
            type: "incFoo";
            value: number;
        }

        interface IncBar {
            type: "incBar";
            value: number;
        }

        const actions: (IncFoo | IncBar)[] = [
            { type: "incFoo", value: 1 },
            { type: "incFoo", value: 1 },
            { type: "incBar", value: -1 },
            { type: "incBar", value: -1 },
        ];

        const stateSnapshots = await chain(actions)
            .bufferize({
                getInitialValue: () => ({ foo: 0, bar: 0 }),
                shouldFlush: () => true,
                // We do not want to loose the accumulated state
                getNextInitialValue: (acc) => acc,
                reducer(acc, action) {
                    switch (action.type) {
                        case "incFoo":
                            return {
                                ...acc,
                                foo: acc.foo + action.value,
                            };

                        case "incBar":
                            return {
                                ...acc,
                                bar: acc.bar + action.value,
                            };
                    }
                },
            })
            .toArray();

        expect(stateSnapshots).toEqual([
            { foo: 1, bar: 0 },
            { foo: 2, bar: 0 },
            { foo: 2, bar: -1 },
            { foo: 2, bar: -2 },
        ]);
    });

    it("can be used as a bufferizing timeframe-based actions reducer", async () => {
        interface IncFoo {
            type: "incFoo";
            value: number;
        }

        interface IncBar {
            type: "incBar";
            value: number;
        }

        const actions: (IncFoo | IncBar)[] = [
            { type: "incFoo", value: 1 },
            { type: "incFoo", value: 1 },
            { type: "incBar", value: -1 },
            { type: "incBar", value: -1 },
        ];

        const stateSnapshots = await chain(actions)
            .tap(() => sleep(10))
            .bufferize({
                getInitialValue: () => ({ foo: 0, bar: 0 }),
                getNextInitialValue: (acc) => acc,
                timeFrame: 15,
                reducer(acc, action) {
                    switch (action.type) {
                        case "incFoo":
                            return {
                                ...acc,
                                foo: acc.foo + action.value,
                            };

                        case "incBar":
                            return {
                                ...acc,
                                bar: acc.bar + action.value,
                            };
                    }
                },
            })
            .toArray();

        expect(stateSnapshots).toEqual([
            { foo: 2, bar: 0 },
            { foo: 2, bar: -2 },

            // Compare it to the previous example:
            // { foo: 1, bar: 0 },
            // { foo: 2, bar: 0 },  // <---
            // { foo: 2, bar: -1 },
            // { foo: 2, bar: -2 }, // <---
        ]);
    });

    it("can be used as a non-standard batcher, packing numbers into batches when their sum exceeds a threshold", async () => {
        interface BatchWithSum {
            sum: number;
            values: number[];
        }

        const batches = await chain(range(0, 10))
            .bufferize({
                getInitialValue: (): BatchWithSum => ({ sum: 0, values: [] }),
                reducer(acc, value) {
                    acc.values.push(value);
                    acc.sum += value;
                    return acc;
                },
                shouldFlush(acc) {
                    return acc.sum >= 10;
                },
            })
            .map((batch) => batch.values)
            .toArray();

        expect(batches).toEqual([[0, 1, 2, 3, 4], [5, 6], [7, 8], [9]]);
    });
});
