# Migrating from 0.x

- Node.js 22 or newer is required.
- `Fifo.push()` and `Fifo.waitDrain()` are removed. Use `await fifo.send(item)`.
- The package name is `@harnyk/iter-helpers` (it was `@sweepbright/iter-helpers`).
- The package is ESM-first and also ships a CommonJS build.
- Errors thrown by sources and mappers now reach the consumer in `batch`, `interval`, `bufferize`, `concurrentMap` and `mux` (before, the consumer could hang and the process could crash with an `unhandledRejection`).
- `concurrentMap` starts working when it is consumed, not when it is applied.
- `take(0)` and `take(-1)` are empty; `range` with a step pointing away from the end is empty, with a step of 0 it throws a `RangeError`.
