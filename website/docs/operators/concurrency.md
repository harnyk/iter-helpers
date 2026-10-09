# Concurrent processing

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

## Requests with a concurrency limit

Thousands of product pages must be fetched from an API that tolerates about eight requests at a time. `concurrentMap` keeps eight requests in flight and starts the next one as soon as one of them finishes. The error mapper records the failed ids instead of ending the whole run.

```ts
type Details = { id: string; price: number };

declare const productIds: AsyncIterable<string>;
declare function fetchDetails(id: string): Promise<Details>;

const failures: { id: string; error: unknown }[] = [];

const details = await chain(productIds)
    .concurrentMap({ concurrency: 8 }, fetchDetails, (id, error) => {
        failures.push({ id, error });
        return null;
    })
    .filter((item): item is Details => item !== null)
    .toArray();
```

Without an error mapper, the first failed request ends the iteration with its error; see [Errors](../errors.md).

## Concurrent bulk inserts

`batch` and `concurrentMap` together write several batches to the database at the same time. `onTaskStarted` and `onTaskCompleted` keep a count of the batches in flight, for logs or metrics.

```ts
type Row = { id: number; email: string };

declare const rows: AsyncIterable<Row>;
declare const db: { insertMany(rows: Row[]): Promise<void> };

let inFlight = 0;

await chain(rows)
    .batch(500)
    .concurrentMap(
        {
            concurrency: 4,
            onTaskStarted: () => {
                inFlight++;
            },
            onTaskCompleted: () => {
                inFlight--;
            },
        },
        async (batch) => {
            await db.insertMany(batch);
            return batch.length;
        },
    )
    .consume((inserted) => {
        console.log(`inserted ${inserted} rows, ${inFlight} batches in flight`);
    });
```

:::warning

Results come in the order the calls complete. When a result is emitted, earlier items may still be in flight, so the output cannot tell that "everything up to here is done". A checkpoint that relies on the order needs sequential processing, as in the [interval example](./batching.md#scheduled-processing-of-a-table).

:::

:::note

`concurrentMap` limits the number of running calls, not the number of finished results waiting for the consumer. The calls do not wait for the consumer: when it is slower than they are, their results queue up in memory. Keep the work that is slow in the mapper itself.

:::

See [`concurrentMap`](../api/functions/concurrentMap.md) and [`ConcurrentMapOptions`](../api/interfaces/ConcurrentMapOptions.md).
