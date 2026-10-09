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

### Bulk inserts into a database

Writing rows one by one is slow; a database accepts them much faster in bulk.

```ts
type Row = { id: number; email: string };

declare const rows: AsyncIterable<Row>;
declare const db: { insertMany(rows: Row[]): Promise<void> };

await chain(rows)
    .batch(500)
    .consume((batch) => db.insertMany(batch));
```

`consume` waits for every insert before it takes the next batch, and `batch` reads the source only a batch or two ahead of its consumer. A slow database therefore slows down the reading instead of filling the memory.

### Shipping logs

Log records are sent to a collector in batches of 100. When records are rare, the time frame makes sure that a record waits at most a second before it is shipped.

```ts
type LogRecord = { level: "info" | "error"; message: string };

declare const logs: AsyncIterable<LogRecord>;
declare function ship(records: LogRecord[]): Promise<void>;

await chain(logs).batch({ size: 100, timeFrame: 1000 }).consume(ship);
```

See [`batch`](../api/functions/batch.md) and [`BatchOptions`](../api/type-aliases/BatchOptions.md).

## interval

```ts
await chain(["a", "b", "c", "d", "e", "f", "g"]).interval(3).toArray();
// => [["a", "c"], ["d", "f"], ["g", "g"]]
```

### Scheduled processing of a table

This is what `interval` was made for. A job runs on a schedule and processes the rows added to a table since its last run. A cheap query streams only the timestamps of the new rows, in ascending order; `interval(1000)` turns them into windows of a thousand rows; each window is then processed by a heavy query that selects its rows by timestamp.

```ts
declare const db: {
    // the timestamps of the rows created after `since`, ascending
    timestamps(since: Date): AsyncIterable<Date>;
    // ... WHERE created_at BETWEEN $1 AND $2
    processWindow(from: Date, to: Date): Promise<void>;
    saveCheckpoint(at: Date): Promise<void>;
};
declare const lastCheckpoint: Date;

await chain(db.timestamps(lastCheckpoint))
    .interval(1000)
    .consume(async ([from, to]) => {
        await db.processWindow(from, to);
        await db.saveCheckpoint(to);
    });
```

The windows hold the same number of rows, not the same stretch of time: a busy hour gives many windows, a quiet night gives one, and every heavy query does about the same amount of work. Only a pair of timestamps is kept per window, so memory does not grow with the window size.

The windows are processed one after another on purpose: after every window, everything up to its end is done, and the checkpoint is correct. If the job fails, the next run starts from the last saved checkpoint.

:::warning

Rows that share a timestamp can sit on both sides of a window boundary. `BETWEEN` includes both ends, so such rows are selected by two windows. Make the processing idempotent, for example with an upsert, so that handling a row twice does no harm.

:::

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

### Batches by size in bytes

An HTTP endpoint limits the size of a request body. Lines are accumulated until they add up to about a megabyte.

```ts
declare const lines: AsyncIterable<string>;
declare function upload(body: string): Promise<void>;

const MAX_BYTES = 1_000_000;

await chain(lines)
    .bufferize({
        getInitialValue: () => ({ lines: [] as string[], bytes: 0 }),
        reducer: (acc, line: string) => {
            acc.lines.push(line);
            acc.bytes += Buffer.byteLength(line) + 1;
            return acc;
        },
        shouldFlush: (acc) => acc.bytes >= MAX_BYTES,
    })
    .consume((chunk) => upload(chunk.lines.join("\n")));
```

`shouldFlush` runs after the line has been added, so a chunk can exceed the limit by its last line; keep the limit a little below the real one. A new accumulator is created with `getInitialValue` after every flush, so the reducer may mutate it.

### Aggregating metrics every 10 seconds

Without `shouldFlush`, only the time frame and the end of the source emit the accumulator: here a count and a sum per metric, reported every ten seconds.

```ts
type Measurement = { name: string; value: number };
type Stats = Map<string, { count: number; sum: number }>;

declare const measurements: AsyncIterable<Measurement>;
declare function report(stats: Stats): Promise<void>;

await chain(measurements)
    .bufferize({
        getInitialValue: (): Stats => new Map(),
        reducer: (acc, measurement: Measurement) => {
            const stats = acc.get(measurement.name) ?? { count: 0, sum: 0 };
            stats.count++;
            stats.sum += measurement.value;
            acc.set(measurement.name, stats);
            return acc;
        },
        timeFrame: 10_000,
    })
    .consume(report);
```

The time frame starts with the first item of a window, so a quiet period sends no empty report.

See [`bufferize`](../api/functions/bufferize.md) and [`BufferizeOptions`](../api/interfaces/BufferizeOptions.md).
