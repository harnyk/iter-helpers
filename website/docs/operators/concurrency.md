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

See [`concurrentMap`](../api/functions/concurrentMap.md) and [`ConcurrentMapOptions`](../api/interfaces/ConcurrentMapOptions.md).
