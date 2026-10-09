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

### Splitting an id space

A table is processed in ranges of ten thousand ids, four ranges at a time. `range` yields the start of every range; `map` turns it into a pair of bounds.

```ts
declare const db: {
    maxId(): Promise<number>;
    processRange(from: number, to: number): Promise<void>;
};

const STEP = 10_000;
const maxId = await db.maxId();

await chain(range(0, maxId + 1, STEP))
    .map((from): [number, number] => [from, Math.min(from + STEP - 1, maxId)])
    .concurrentMap({ concurrency: 4 }, ([from, to]) => db.processRange(from, to))
    .consume();
```

`range` splits the ids evenly, so a range with gaps holds fewer rows. To split the actual rows evenly, stream their keys and use [`interval`](./batching.md#interval).

### Offsets for paged queries

`range` with a step yields the offsets of the pages; the pages are fetched one after another and `flatten` turns them into rows.

```ts
type Row = { id: number; email: string };

declare const db: {
    count(): Promise<number>;
    page(offset: number, limit: number): Promise<Row[]>;
};

const LIMIT = 1000;

const rows = chain(range(0, await db.count(), LIMIT))
    .map((offset) => db.page(offset, LIMIT))
    .flatten();
```

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

### Merging several files

Daily exports are imported as one stream. `mux` reads all the files at the same time and passes on whichever line is ready first, so lines of different files interleave while the lines of each file keep their order.

```ts
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const files = ["2026-10-01.jsonl", "2026-10-02.jsonl", "2026-10-03.jsonl"];

const lines = mux(
    files.map((file) => createInterface({ input: createReadStream(file) })),
);

await chain(lines)
    .map((line) => JSON.parse(line) as unknown)
    .consume();
```

### Several queues, one set of workers

Jobs from two queues are handled by the same four workers.

```ts
type Job = { id: string; kind: "order" | "refund" };

declare const orders: AsyncIterable<Job>;
declare const refunds: AsyncIterable<Job>;
declare function handle(job: Job): Promise<void>;

await chain(mux([orders, refunds]))
    .concurrentMap({ concurrency: 4 }, handle)
    .consume();
```

`mux` does not prioritise its inputs: a queue that produces more gets more of the workers. When one input fails, the merged iteration ends with its error; see [Errors](../errors.md).

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

### From a callback API to an async iterable

Many message clients deliver messages to a callback. A fifo turns them into an iteration, and every operator of the library can be applied to it. This client waits for the promise returned by the handler before it delivers the next message.

```ts
type Message = { id: string; body: string };

declare const client: {
    // waits for the promise returned by the handler before the next message;
    // resolves when the subscription is over
    subscribe(
        topic: string,
        handler: (message: Message) => Promise<void>,
    ): Promise<void>;
};

const messages = new Fifo<Message>({ highWatermark: 100 });

client.subscribe("orders", (message) => messages.send(message)).then(
    () => messages.end(),
    (error) => messages.end(error),
);

for await (const message of messages) {
    console.log(message.id);
}
```

Once 100 messages are queued, `send` waits, so the handler waits and the client stops delivering until the consumer catches up. Without `highWatermark` the queue has no limit and grows as long as the consumer is slower than the messages. When the subscription fails, `end(error)` makes the loop throw that error after the queued messages.

### A side channel for logs

An import writes log records to a fifo while a separate consumer ships them to a logging service in batches. The import does not wait for the logging service, only for a free slot in the queue.

```ts
type Row = { id: number; email: string };
type LogRecord = { level: "info" | "error"; message: string };

declare const rows: AsyncIterable<Row>;
declare const db: { insertMany(rows: Row[]): Promise<void> };
declare function shipLogs(records: LogRecord[]): Promise<void>;

const logs = new Fifo<LogRecord>({ highWatermark: 1000 });

const shipping = chain(logs)
    .batch({ size: 100, timeFrame: 1000 })
    // a failing logging service must not stop the import
    .consume((records) => shipLogs(records).catch(() => {}));

try {
    await chain(rows)
        .batch(500)
        .tap((batch) =>
            logs.send({
                level: "info",
                message: `inserting ${batch.length} rows`,
            }),
        )
        .consume((batch) => db.insertMany(batch));
} finally {
    logs.end();
    await shipping;
}
```

In `finally` the fifo is ended whether the import succeeded or failed, and the records already queued are still shipped before the program goes on.

:::warning

If the consumer of a fifo stops, nobody takes items out of it any more: once it is full, every `send` waits forever. That is why shipping errors are caught inside the consumer instead of ending it. The high watermark leaves room for bursts, so a slow logging service does not slow the import down right away.

:::

See [`Fifo`](../api/classes/Fifo.md) and [`FifoOptions`](../api/interfaces/FifoOptions.md).
