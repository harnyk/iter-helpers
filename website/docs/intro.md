---
slug: /
title: Getting started
---

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

Pictures of what the operators do are on the [Diagrams](./diagrams.md) page, and every function and type is described in the [API reference](./api/index.md).
