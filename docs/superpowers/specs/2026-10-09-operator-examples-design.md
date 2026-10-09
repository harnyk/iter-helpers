# Real-world examples on the operator pages — design

## Goal

The operator pages of the documentation site (`website/docs/operators/*.md`)
show each operator only on toy input (`[1, 2, 3]`). They explain the syntax but
not what the operator is for. Every operator gets one or two examples taken
from realistic tasks, so a reader sees when to reach for it.

This is the first of two sub-projects. The second one — six end-to-end guides
(JSONL import, API fan-out, telemetry shipping, a job queue on `Fifo`,
scheduled table processing, a file system walk) — gets its own spec later and
is out of scope here.

## Principles

- **The short shape example stays first.** The current one-liner on numbers
  with `// =>` output keeps showing the semantics at a glance. Below it come
  one or two real-world examples, each under a sub-heading that names the task
  (for example "Bulk inserts into a database") and introduced by one or two
  sentences on why this operator fits.
- **The outside world is declared in the block.** Databases, HTTP clients,
  loggers and files are described with `declare` statements inside the code
  block itself (`declare const db: { insertMany(rows: Row[]): Promise<void> }`).
  Each example stays self-contained and copyable, the reader sees the contract,
  and `check-snippets` keeps type-checking every block without changes to the
  checker.
- **No invented output.** Real-world examples are type-checked, not executed,
  so they carry no `// =>` comments that claim a result. Output is shown only
  in the shape examples, which are already covered by
  `src/tests/docs-examples.spec.ts`.
- **TSDoc and the API reference stay as they are.** The minimal examples in the
  source comments are not changed; the extended ones live on the operator
  pages.
- **Pitfalls sit next to the example they belong to**, as a short paragraph or
  an admonition (`:::note` / `:::warning`).
- **Native iterator or async helpers are not mentioned.**

## Examples per operator

| Operator | Examples |
|---|---|
| `map` | Parsing JSONL: `errorMapper` turns a broken line into `{ ok: false, line, error }` instead of ending the import. Asynchronous enrichment: the mapper awaits a lookup. |
| `filter` | A type predicate `isValidRecord` after parsing. Picking one variant of a discriminated union (`e.type === "purchase"`). |
| `take` / `skip` | A preview with `take(5)` of a huge file that stops reading it (laziness). `skip(1)` to drop a CSV header. |
| `flatten` | A paginated API: a generator of pages becomes a stream of items. One order becomes many order lines. |
| `tap` / `onEnd` | Progress logging every 10 000 items. A summary in `onEnd`, with the caveat that it is not called on early stop or error, so cleanup belongs in `try/finally`. |
| `pipe` | A reusable custom operator `dedupeBy(key)`. A pipeline fragment (`(source) => chain(source).map(...).filter(...)`) used as an operator. |
| `batch` | `batch(500)` followed by `insertMany`. Log shipping with `{ size: 100, timeFrame: 1000 }`, so lines do not wait in the buffer when events are rare. |
| `interval` | The original use: a scheduled job reads the sorted timestamps of new rows, `interval(1000)` turns them into windows of a thousand rows, and each window is processed with `WHERE ts BETWEEN $1 AND $2`. Caveat: rows sharing the timestamp at a window boundary fall into two windows, so processing must be idempotent or the window half-open. |
| `bufferize` | Batches by size in bytes (about 1 MB per request). Metric aggregation (count and sum) flushed every 10 seconds with `timeFrame`. |
| `concurrentMap` | HTTP requests with a concurrency limit, where `errorMapper` collects failures into a report. Concurrent bulk inserts after `batch`, with an in-flight counter driven by `onTaskStarted` / `onTaskCompleted`. Caveat: the output order is the completion order. |
| `range` | Splitting an id space into ranges: `range(0, maxId, 10_000)` mapped to `[from, to]`. Offsets for paged queries. |
| `mux` | Merging several JSONL files into one stream, keeping the order within each file. Merging several queues. |
| `Fifo` | Turning a push source (an `EventEmitter` or a callback API) into an async iterable, with back pressure through `highWatermark`. A side channel for logs: the pipeline sends log records to a fifo, a separate consumer ships them to a logger in batches. |

## Structure of the pages

The four pages and the sidebar stay as they are (`transforming`, `batching`,
`concurrency`, `sources`). Within each operator section the order is: the shape
example, the real-world examples under `###` headings, pitfalls, the link to
the API reference.

## Verification

- `pnpm check-snippets` in `website/` passes: every new block type-checks
  against `src/main.ts`.
- `pnpm build` in `website/` passes (broken links throw).
- Every example is checked by hand against the actual signatures and semantics
  in `src/` (argument order of `concurrentMap`, the `Fifo` options, what `mux`
  accepts, the behaviour of `onEnd`, the partial-buffer rule of `bufferize`).
- Root `pnpm test` stays green; no library code changes are expected.
