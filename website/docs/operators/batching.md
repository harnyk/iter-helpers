# Batching operators

These operators group items into values.

## batch

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

See [`batch`](../api/functions/batch.md) and [`BatchOptions`](../api/type-aliases/BatchOptions.md).

## interval

```ts
await chain(["a", "b", "c", "d", "e", "f", "g"]).interval(3).toArray();
// => [["a", "c"], ["d", "f"], ["g", "g"]]
```

See [`interval`](../api/functions/interval.md) in the API reference.

## bufferize

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

See [`bufferize`](../api/functions/bufferize.md) and [`BufferizeOptions`](../api/interfaces/BufferizeOptions.md).
