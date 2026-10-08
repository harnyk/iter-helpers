import { describe, it, expect } from "vitest";
import { chain, Fifo, mux, range, type Iter } from "../main";
import { sleep } from "./sleep";

describe("docs examples", () => {
    it("quick start", async () => {
        const result = await chain(range(1, 6))
            .map((n) => n * 2)
            .skip(1)
            .take(3)
            .toArray();

        expect(result).toEqual([4, 6, 8]);
    });

    it("pipe: an operator function and an operator object", async () => {
        function double(source: Iter<number>): Iter<number> {
            return (async function* () {
                for await (const n of source) {
                    yield n * 2;
                }
            })();
        }

        expect(await chain([1, 2]).pipe(double).toArray()).toEqual([2, 4]);
        expect(await chain([1, 2]).pipe({ process: double }).toArray()).toEqual(
            [2, 4],
        );
    });

    it("consume: calls the callback for each item", async () => {
        const seen: number[] = [];
        await chain([1, 2, 3]).consume((n) => {
            seen.push(n);
        });

        expect(seen).toEqual([1, 2, 3]);
    });

    it("map: errorMapper turns a thrown error into a value", async () => {
        const result = await chain([1, 2, 3])
            .map(
                (n) => {
                    if (n === 2) {
                        throw new Error("two");
                    }
                    return n * 10;
                },
                (n) => -n,
            )
            .toArray();

        expect(result).toEqual([10, -2, 30]);
    });

    it("filter: a type predicate narrows the type", async () => {
        const mixed: (number | string)[] = [1, "a", 2, "b"];
        const numbers = await chain(mixed)
            .filter((v): v is number => typeof v === "number")
            .toArray();

        expect(numbers).toEqual([1, 2]);
    });

    it("take: a size of at least 1", async () => {
        expect(await chain([1, 2, 3, 4, 5]).take(2).toArray()).toEqual([1, 2]);
    });

    it("skip: drops the first items", async () => {
        expect(await chain([1, 2, 3, 4, 5]).skip(2).toArray()).toEqual([
            3, 4, 5,
        ]);
    });

    it("flatten: arrays into items", async () => {
        const result = await chain([[1, 2], [3], [4, 5]])
            .flatten()
            .toArray();

        expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it("tap and onEnd", async () => {
        const log: string[] = [];
        const result = await chain(["a", "b"])
            .tap((s) => {
                log.push(`saw ${s}`);
            })
            .onEnd(() => {
                log.push("done");
            })
            .toArray();

        expect(result).toEqual(["a", "b"]);
        expect(log).toEqual(["saw a", "saw b", "done"]);
    });

    it("batch: by size", async () => {
        const result = await chain(range(0, 5)).batch(2).toArray();

        expect(result).toEqual([[0, 1], [2, 3], [4]]);
    });

    it("batch: by time frame", async () => {
        async function* slow() {
            yield 1;
            await sleep(150);
            yield 2;
        }

        const result = await chain(slow())
            .batch({ size: 10, timeFrame: 50 })
            .toArray();

        expect(result).toEqual([[1], [2]]);
    });

    it("interval: first and last item of each group", async () => {
        const result = await chain(["a", "b", "c", "d", "e", "f", "g"])
            .interval(3)
            .toArray();

        expect(result).toEqual([
            ["a", "c"],
            ["d", "f"],
            ["g", "g"],
        ]);
    });

    it("bufferize: a custom reducer", async () => {
        const sums = await chain([1, 2, 3, 4, 5])
            .bufferize({
                getInitialValue: () => 0,
                reducer: (acc: number, value: number) => acc + value,
                shouldFlush: (_acc, _value, count) => count >= 2,
            })
            .toArray();

        expect(sums).toEqual([3, 7, 5]);
    });

    it("concurrentMap: results come in completion order", async () => {
        const delays = [60, 10, 30];
        const work = async (ms: number) => {
            await sleep(ms);
            return ms;
        };

        const parallel = await chain(delays)
            .concurrentMap({ concurrency: 3 }, work)
            .toArray();
        const sequential = await chain(delays)
            .concurrentMap({ concurrency: 1 }, work)
            .toArray();

        expect(parallel).toEqual([10, 30, 60]);
        expect(sequential).toEqual([60, 10, 30]);
    });

    it("concurrentMap: errorMapper turns a thrown error into a value", async () => {
        const result = await chain([1, 2, 3])
            .concurrentMap(
                { concurrency: 2 },
                async (n) => {
                    if (n === 2) {
                        throw new Error("two");
                    }
                    return n;
                },
                (n) => `failed:${n}`,
            )
            .toArray();

        expect(result).toHaveLength(3);
        expect(result).toEqual(expect.arrayContaining([1, 3, "failed:2"]));
    });

    it("Fifo: a producer and a consumer", async () => {
        const fifo = new Fifo<number>();

        const consumed = (async () => {
            const items: number[] = [];
            for await (const item of fifo) {
                items.push(item);
            }
            return items;
        })();

        await fifo.send(1);
        await fifo.send(2);
        fifo.end();

        expect(await consumed).toEqual([1, 2]);
    });

    it("mux: merges inputs and keeps the order within each input", async () => {
        const merged = await chain(
            mux([
                [1, 2, 3],
                [10, 20, 30],
            ]),
        ).toArray();

        expect(merged).toHaveLength(6);
        expect(merged.filter((n) => n < 10)).toEqual([1, 2, 3]);
        expect(merged.filter((n) => n >= 10)).toEqual([10, 20, 30]);
    });

    it("range: finite, stepped, descending and endless", async () => {
        expect([...range(0, 3)]).toEqual([0, 1, 2]);
        expect([...range(0, 10, 5)]).toEqual([0, 5]);
        expect([...range(3, 0)]).toEqual([3, 2, 1]);
        expect(await chain(range(1)).take(3).toArray()).toEqual([1, 2, 3]);
    });
});
