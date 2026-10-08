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

See [`filter`](../api/functions/filter.md) in the API reference.

## take and skip

```ts
await chain([1, 2, 3, 4, 5]).take(2).toArray(); // => [1, 2]
await chain([1, 2, 3, 4, 5]).skip(2).toArray(); // => [3, 4, 5]
```

A size of 0 or less gives an empty iteration.

See [`take`](../api/functions/take.md) and [`skip`](../api/functions/skip.md).

## flatten

```ts
await chain([[1, 2], [3], [4, 5]])
    .flatten()
    .toArray();
// => [1, 2, 3, 4, 5]
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

See [`Operator`](../api/type-aliases/Operator.md).
