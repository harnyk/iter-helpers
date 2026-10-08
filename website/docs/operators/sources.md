# Sources and queues

Helpers that create or merge iterations.

## range

```ts
[...range(0, 3)]; // => [0, 1, 2]
[...range(0, 10, 5)]; // => [0, 5]
[...range(3, 0)]; // => [3, 2, 1]
await chain(range(1)).take(3).toArray(); // => [1, 2, 3]
```

Without an end the range is endless. A step that points away from the end gives an empty range, and a step of 0 throws a `RangeError`.

See [`range`](../api/functions/range.md) in the API reference.

## mux

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

See [`mux`](../api/functions/mux.md) in the API reference.

## Fifo

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

See [`Fifo`](../api/classes/Fifo.md) and [`FifoOptions`](../api/interfaces/FifoOptions.md).
