[![CI](https://github.com/harnyk/iter-helpers/actions/workflows/ci.yml/badge.svg)](https://github.com/harnyk/iter-helpers/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@harnyk/iter-helpers)](https://www.npmjs.com/package/@harnyk/iter-helpers)

# Iter Helpers

> Requires Node.js 22 or newer.

Composable operators for synchronous and asynchronous iterators in TypeScript: `map`, `filter`, `batch`, `concurrentMap`, `mux`, a back-pressured `Fifo` and more, chained fluently with `chain()`.

## Installation

```
pnpm add @harnyk/iter-helpers
```

`npm install @harnyk/iter-helpers` and `yarn add @harnyk/iter-helpers` work as well. The package ships ESM and CommonJS builds with type definitions.

## Quick start

```ts
import { chain, range } from "@harnyk/iter-helpers";

const result = await chain(range(1, 6))
    .map((n) => n * 2)
    .skip(1)
    .take(3)
    .toArray();
// => [4, 6, 8]
```

`chain()` accepts anything you can iterate with `for await`: an array, a generator or an async generator. Every method of the chain applies an operator and returns a new chain. Chains are lazy: nothing is read from the source until you consume the chain with `toArray()`, `consume()` or `for await`.

## Concepts

- `Iter<T>` - a synchronous `Iterable<T>` or an `AsyncIterable<T>`.
- operator - a function that takes an `Iter` and returns a new `Iter` (or an object with such a function as its `process` method).
- piping - composing operators with `chain(...).pipe(operator)`.

## Chain methods

| Method                                        | What it does                                                         |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `chain(iter)`                                 | wraps an iterable in a chain                                         |
| `.pipe(operator)`                             | applies any operator                                                 |
| `.map(mapFn, errorMapFn?)`                    | transforms each item                                                 |
| `.concurrentMap(options, mapFn, errorMapFn?)` | like `map`, with several calls in flight                             |
| `.filter(typePredicate)`                      | keeps the items that satisfy a type predicate                        |
| `.take(n)`                                    | keeps the first `n` items                                            |
| `.skip(n)`                                    | drops the first `n` items                                            |
| `.batch(sizeOrOptions)`                       | groups items into arrays, by size and/or time                        |
| `.interval(n)`                                | emits the first and the last item of each group of `n` items         |
| `.flatten()`                                  | turns an iteration of arrays into an iteration of items              |
| `.bufferize(options)`                         | accumulates items; emits on `shouldFlush`, `timeFrame` or at the end |
| `.tap(fn)`                                    | runs a side effect for each item                                     |
| `.onEnd(fn)`                                  | calls `fn` once after the last item (not on early stop or error)     |
| `.toArray()`                                  | resolves to an array of all items                                    |
| `.consume(fn?)`                               | runs the iteration, calling `fn` for each item                       |

Diagrams of what the operators do are in [Diagrams.md](./Diagrams.md).

## Operators

### map

```ts
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
// => [10, -2, 30]
```

When `mapFn` throws, the optional second function turns the error into a value and the iteration continues. Without it, the error is rethrown to the consumer.

### filter

The predicate must be synchronous and must be a type predicate, so the type of the chain is narrowed.

```ts
const mixed: (number | string)[] = [1, "a", 2, "b"];
const numbers = await chain(mixed)
    .filter((v): v is number => typeof v === "number")
    .toArray();
// => [1, 2]
```

### take and skip

```ts
await chain([1, 2, 3, 4, 5]).take(2).toArray(); // => [1, 2]
await chain([1, 2, 3, 4, 5]).skip(2).toArray(); // => [3, 4, 5]
```

A size of 0 or less gives an empty iteration.

### flatten

```ts
await chain([[1, 2], [3], [4, 5]])
    .flatten()
    .toArray();
// => [1, 2, 3, 4, 5]
```

### batch

```ts
await chain(range(0, 5)).batch(2).toArray();
// => [[0, 1], [2, 3], [4]]
```

`batch` also takes `{ size, timeFrame }`. A batch is emitted when it reaches `size` items or `timeFrame` milliseconds after its first item, whichever comes first; the rest at the end of the source is emitted as a smaller batch.

```ts
import { setTimeout as sleep } from "node:timers/promises";

async function* slow() {
    yield 1;
    await sleep(150);
    yield 2;
}

await chain(slow()).batch({ size: 10, timeFrame: 50 }).toArray();
// => [[1], [2]]
```

### interval

```ts
await chain(["a", "b", "c", "d", "e", "f", "g"]).interval(3).toArray();
// => [["a", "c"], ["d", "f"], ["g", "g"]]
```

### bufferize

`bufferize` is the building block of `batch` and `interval`: you describe how items are accumulated and when the accumulated value is emitted.

```ts
const sums = await chain([1, 2, 3, 4, 5])
    .bufferize({
        getInitialValue: () => 0,
        reducer: (acc: number, value: number) => acc + value,
        shouldFlush: (_acc, _value, count) => count >= 2,
    })
    .toArray();
// => [3, 7, 5]
```

### concurrentMap

Runs up to `concurrency` calls at the same time. Results are emitted in the order the calls complete, not in the order of the input.

```ts
import { setTimeout as sleep } from "node:timers/promises";

const delays = [60, 10, 30];
const work = async (ms: number) => {
    await sleep(ms);
    return ms;
};

await chain(delays).concurrentMap({ concurrency: 3 }, work).toArray();
// => [10, 30, 60]
await chain(delays).concurrentMap({ concurrency: 1 }, work).toArray();
// => [60, 10, 30]
```

As in `map`, an optional third argument turns an error thrown by the mapper into a value.

### tap and onEnd

```ts
const log: string[] = [];
const result = await chain(["a", "b"])
    .tap((s) => {
        log.push(`saw ${s}`);
    })
    .onEnd(() => {
        log.push("done");
    })
    .toArray();
// result => ["a", "b"]
// log => ["saw a", "saw b", "done"]
```

### pipe

An operator is a function from an `Iter` to an `Iter`:

```ts
function double(source: Iter<number>): Iter<number> {
    return (async function* () {
        for await (const n of source) {
            yield n * 2;
        }
    })();
}

await chain([1, 2]).pipe(double).toArray(); // => [2, 4]
await chain([1, 2]).pipe({ process: double }).toArray(); // => [2, 4]
```

## Standalone helpers

### range

```ts
[...range(0, 3)]; // => [0, 1, 2]
[...range(0, 10, 5)]; // => [0, 5]
[...range(3, 0)]; // => [3, 2, 1]
await chain(range(1)).take(3).toArray(); // => [1, 2, 3]
```

Without an end the range is endless. A step that points away from the end gives an empty range, and a step of 0 throws a `RangeError`.

### mux

Merges several inputs into one. Items arrive as they are produced, so the order across inputs is not defined; the order within each input is kept.

```ts
const merged = await chain(
    mux([
        [1, 2, 3],
        [10, 20, 30],
    ]),
).toArray();
// merged.filter((n) => n < 10) => [1, 2, 3]
// merged.filter((n) => n >= 10) => [10, 20, 30]
```

### Fifo

An asynchronous queue that is also an `AsyncIterable`. Producers call `send` (it waits when the queue is full, which gives back pressure; set the limit with `new Fifo({ highWatermark })`) and finish with `end()`. A `send` after `end()` rejects with `chan is closed`.

```ts
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

await consumed; // => [1, 2]
```

`end(error)` finishes the queue with an error: consumers get the items already queued, then the error is thrown from their iteration.

## Errors

The first error ends the iteration: the consumer receives the items that were already emitted, then the error is thrown from `for await` or `toArray()`.

```ts
async function* failing() {
    yield 1;
    yield 2;
    throw new Error("source failed");
}

try {
    for await (const batch of chain(failing()).batch(5)) {
        console.log(batch);
    }
} catch (error) {
    console.log((error as Error).message);
}
// [ 1, 2 ]
// source failed
```

- `map`: an error thrown by the mapper is rethrown unless an error mapper turns it into a value.
- `batch`, `interval`, `bufferize`: the items accumulated at the moment of the failure are emitted first, as a last, smaller value.
- `concurrentMap`: after an error no new calls start, and the results of calls that are still running are discarded. Like `map`, it rethrows a mapper error unless an error mapper is given.
- `mux`: the first failing input ends the iteration; the other inputs stop at their next item. An input that is blocked while sending at that moment may stay blocked, because a blocked `send` is not woken up when the queue ends; it holds no CPU and raises no error.

## Migrating from 0.x

- Node.js 22 or newer is required.
- `Fifo.push()` and `Fifo.waitDrain()` are removed. Use `await fifo.send(item)`.
- The package name is `@harnyk/iter-helpers` (it was `@sweepbright/iter-helpers`).
- The package is ESM-first and also ships a CommonJS build.
- Errors thrown by sources and mappers now reach the consumer in `batch`, `interval`, `bufferize`, `concurrentMap` and `mux` (before, the consumer could hang and the process could crash with an `unhandledRejection`).
- `concurrentMap` starts working when it is consumed, not when it is applied.
- `take(0)` and `take(-1)` are empty; `range` with a step pointing away from the end is empty, with a step of 0 it throws a `RangeError`.

## License

[MIT](./LICENSE)
