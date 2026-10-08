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

## Documentation

Guides, the list of operators, error handling, diagrams and the API reference are at **https://harnyk.github.io/iter-helpers/**.

## License

[MIT](./LICENSE)
