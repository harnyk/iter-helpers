# Transforming operators

These operators change, filter or observe the items of a chain.

## map

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

### Parsing JSONL without stopping at a broken line

A large export usually has a few broken lines. With an error mapper, a line that fails to parse becomes a value that describes the failure, and the import goes on.

```ts
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

type Parsed =
    { ok: true; record: unknown } | { ok: false; line: string; error: unknown };

const lines = createInterface({ input: createReadStream("export.jsonl") });

const parsed = chain(lines).map(
    (line): Parsed => ({ ok: true, record: JSON.parse(line) }),
    (line, error): Parsed => ({ ok: false, line, error }),
);

for await (const item of parsed) {
    if (!item.ok) {
        console.warn("skipped a broken line:", item.line);
    }
}
```

### Enriching records with an asynchronous lookup

The mapper may be asynchronous: `map` waits for it and emits the result.

```ts
type Order = { id: string; customerId: string; total: number };
type Customer = { id: string; country: string };

declare const orders: AsyncIterable<Order>;
declare function fetchCustomer(id: string): Promise<Customer>;

const enriched = chain(orders).map(async (order) => {
    const customer = await fetchCustomer(order.customerId);
    return { ...order, country: customer.country };
});
```

`map` handles one item at a time: the next order is read only after the lookup of the previous one has finished. To run several lookups at once, use [`concurrentMap`](./concurrency.md).

See [`map`](../api/functions/map.md) in the API reference.

## filter

The predicate must be synchronous and must be a type predicate, so the type of the chain is narrowed.

```ts
const mixed: (number | string)[] = [1, "a", 2, "b"];
const numbers = await chain(mixed)
    .filter((v): v is number => typeof v === "number")
    .toArray();
// => [1, 2]
```

### Keeping only valid records

Parsed JSON is `unknown`. A type guard drops the records that do not have the expected shape and gives the rest of the chain a precise type.

```ts
type Row = { id: number; email: string };

declare const records: AsyncIterable<unknown>;

function isRow(value: unknown): value is Row {
    return (
        typeof value === "object" &&
        value !== null &&
        typeof (value as Row).id === "number" &&
        typeof (value as Row).email === "string"
    );
}

const rows = chain(records).filter(isRow); // a Chain<Row>
```

### Picking one kind of event

In a stream of mixed events, the predicate selects one variant of the union, and the following operators see only that variant.

```ts
type PageView = { type: "view"; page: string };
type Purchase = { type: "purchase"; orderId: string; amount: number };

declare const events: AsyncIterable<PageView | Purchase>;

const amounts = chain(events)
    .filter((event): event is Purchase => event.type === "purchase")
    .map((purchase) => purchase.amount);
```

See [`filter`](../api/functions/filter.md) in the API reference.

## take and skip

```ts
await chain([1, 2, 3, 4, 5]).take(2).toArray(); // => [1, 2]
await chain([1, 2, 3, 4, 5]).skip(2).toArray(); // => [3, 4, 5]
```

A size of 0 or less gives an empty iteration.

### Previewing a huge file

Chains are lazy, and `take` stops asking the source for items once it has enough. Looking at the first lines of a multi-gigabyte export reads only the beginning of the file.

```ts
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const input = createReadStream("export.jsonl");
try {
    const preview = await chain(createInterface({ input })).take(5).toArray();
    console.log(preview);
} finally {
    input.destroy();
}
```

The readline interface stops reading when the iteration stops, but it does not close the file stream; `destroy()` releases the file.

### Skipping a header and resuming

`skip` drops the header of a CSV file. A second `skip` lets a restarted import pass over the rows that an earlier run already handled.

```ts
declare const csvLines: AsyncIterable<string>;
declare const alreadyImported: number;

const rows = chain(csvLines)
    .skip(1) // the header
    .skip(alreadyImported) // the rows imported by an earlier run
    .map((line) => line.split(","));
```

The skipped items are still read from the source, they are only not emitted.

See [`take`](../api/functions/take.md) and [`skip`](../api/functions/skip.md).

## flatten

```ts
await chain([[1, 2], [3], [4, 5]])
    .flatten()
    .toArray();
// => [1, 2, 3, 4, 5]
```

### Walking a paginated API

An API that returns items page by page is a generator of arrays; `flatten` turns it into a stream of items, and the next page is requested only when the items of the current one have been consumed.

```ts
type User = { id: string; name: string };
type Page = { items: User[]; next: string | null };

declare function fetchPage(cursor: string | null): Promise<Page>;

async function* pages() {
    let cursor: string | null = null;
    do {
        const page = await fetchPage(cursor);
        yield page.items;
        cursor = page.next;
    } while (cursor !== null);
}

const users = chain(pages()).flatten(); // a Chain<User>
```

### One order, many lines

`map` followed by `flatten` turns every item into any number of items.

```ts
type Order = { id: string; lines: { sku: string; quantity: number }[] };

declare const orders: AsyncIterable<Order>;

const orderLines = chain(orders)
    .map((order) => order.lines.map((line) => ({ orderId: order.id, ...line })))
    .flatten();
```

See [`flatten`](../api/functions/flatten.md) in the API reference.

## tap and onEnd

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

### Logging progress

`tap` observes the items without changing them; `onEnd` runs once after the last one.

```ts
declare const records: AsyncIterable<unknown>;

let processed = 0;

await chain(records)
    .tap(() => {
        processed++;
        if (processed % 10_000 === 0) {
            console.log(`processed ${processed} records`);
        }
    })
    .onEnd(() => {
        console.log(`done: ${processed} records`);
    })
    .consume();
```

A `tapper` may be asynchronous; the chain waits for it before passing the item on.

:::warning

`onEnd` is not called when the consumer stops early or the source throws. Do not release resources in it: use `try`/`finally` around the consumption.

```ts
declare const records: AsyncIterable<unknown>;
declare function openConnection(): Promise<{ close(): Promise<void> }>;

const connection = await openConnection();
try {
    await chain(records).consume();
} finally {
    await connection.close();
}
```

:::

See [`tap`](../api/functions/tap.md) and [`onEnd`](../api/functions/onEnd.md).

## pipe

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

### A reusable operator

An async generator function is the simplest way to write an operator. This one drops the items whose key has been seen before.

```ts
import { chain, type OperatorFunction } from "@harnyk/iter-helpers";

function dedupeBy<T>(key: (item: T) => string): OperatorFunction<T, T> {
    return async function* (source) {
        const seen = new Set<string>();
        for await (const item of source) {
            const k = key(item);
            if (!seen.has(k)) {
                seen.add(k);
                yield item;
            }
        }
    };
}

type User = { id: string; email: string };
declare const users: AsyncIterable<User>;

const unique = chain(users).pipe(dedupeBy((user) => user.email));
```

The set of seen keys grows with the number of distinct keys, so this fits streams with a bounded number of them.

### A pipeline fragment as an operator

A chain is itself an `Iter`, so a function that builds a chain is an operator. Several sources can share the same cleaning steps.

```ts
type Row = { id: number; email: string };

declare const exportA: AsyncIterable<unknown>;
declare const exportB: AsyncIterable<unknown>;
declare function isRow(value: unknown): value is Row;

const cleanRows = (source: Iter<unknown>) =>
    chain(source)
        .filter(isRow)
        .map((row) => ({ ...row, email: row.email.toLowerCase() }));

const fromA = chain(exportA).pipe(cleanRows);
const fromB = chain(exportB).pipe(cleanRows);
```

See [`Operator`](../api/type-aliases/Operator.md).
