# Error propagation, laziness and edge cases — design

Date: 2026-10-08

## Context and goal

Seven open issues describe behavior that contradicts what the documentation promises or what a reasonable user expects. Fixed together in one PR (owner's decision): `Fixes #2 #3 #4 #5 #6 #7 #8`.

| Issue | Problem | Contract after this change |
|---|---|---|
| #2 | `bufferize` / `batch` / `interval`: a source error is lost, the consumer hangs, `unhandledRejection` | The error reaches the consumer |
| #3 | `concurrentMap`: an item is silently dropped when the mapper throws without `errorMapper` | Same as `map`: the error reaches the consumer |
| #4 | `concurrentMap`: a source error hangs the consumer | The error reaches the consumer |
| #5 | `mux`: an input error hangs the consumer | The error reaches the consumer |
| #6 | `take(0)` / `take(-1)` yield one item | Empty iteration; the source is not read |
| #7 | `range` with a step pointing away from `end`, or step 0, never ends | Away from `end`: empty range. Step 0: `RangeError` |
| #8 | `concurrentMap` is eager | Starts on the first `next()`, like every other operator |

Out of scope: stopping background work when a consumer stops early (not filed, separate decision); changes to `@harnyk/chan`; new features.

## Decisions

- **Error mechanism (owner chose option A):** implemented in this repository on top of `Fifo`; `@harnyk/chan` is unchanged (it can only `close()` without a reason).
- **`Fifo.end(error?: unknown)`**: with an `error`, the iteration delivers the items already in the queue and then throws that error (for every reader). A second `end` is ignored, so the first error wins. Without an argument the behavior is unchanged. `send` after `end` still rejects with `chan is closed`.
- **Error contract of operators:** the first error ends the iteration. The consumer receives the items already emitted, then the error. No new calls start after an error; results of calls already in flight are discarded and never become `unhandledRejection`.
- **`bufferize`:** items accumulated but not yet emitted are discarded when the source (or the `reducer` / `shouldFlush`) fails. Pending `timeFrame` timers are cancelled. A failure inside the timer flush is routed to the same error path.
- **`concurrentMap`:** `process` becomes an async generator that creates the `Fifo` and starts its reading loop on the first `next()` (laziness, #8). A source error, a mapper error without `errorMapper`, or an `errorMapper` that throws ends the iteration with that error.
- **`mux`:** the first input error ends the iteration. Other inputs stop at their next item (their `send` into the ended fifo rejects, which is swallowed). An input that is blocked in `send` at that moment stays blocked: `chan` does not wake a blocked `send` on `close()`. It holds no CPU and raises no error; documented as a known limitation.
- **`take(size)`:** `size <= 0` returns at once without touching the source.
- **`range`** follows Python: `end` given and the step points away from it gives an empty range; `step === 0` throws `RangeError("range: step must not be 0")` on the first `next()` (the function stays a generator); no `end` stays endless.
- **Release:** not part of the PR. The owner bumps with `pnpm version prerelease --preid=rc` after merge.

## Tests (red first)

New `src/tests/error-propagation.spec.ts`, built from the reproductions in the issues, plus additions to the existing specs:

- a helper records `unhandledRejection` events during a test and asserts there are none;
- `Fifo`: `end(error)` delivers queued items then throws, for two readers; the first of two `end(error)` calls wins;
- `bufferize` / `batch` / `interval`: a source error, a throwing `reducer`, and an error with a pending `timeFrame` reject the consumer, with no unhandled rejection and no timer left;
- `concurrentMap`: a source error; a mapper error without `errorMapper`; an `errorMapper` that throws; an error while other calls are in flight; laziness (no consumption means zero source reads and zero mapper calls); existing ordering and `errorMapper` behavior unchanged;
- `mux`: one failing input among healthy ones rejects the consumer; no unhandled rejection;
- `take(0)` and `take(-1)`: empty result and zero source reads (a counting source);
- `range`: `range(0, 5, -1)` is empty, `range(5, 0, 1)` is empty, `range(0, 5, 0)` throws `RangeError`, endless `range(1)` unchanged.

All existing tests, including the 18 documentation examples, must stay green.

## Documentation

- Remove "Known issues" from the Readme; add a short "Errors" section stating the contract above (including the discard rule of `bufferize` and the `mux` limitation).
- Update the TSDoc of `Fifo.end`, `bufferize`, `batch`, `interval`, `concurrentMap`, `mux`, `take` and `range` (`take`: `size <= 0` is empty; `range`: new step rules). The `docs-examples` tests get a case for each new documented behavior.
- The Readme claim "chains are lazy" loses its `concurrentMap` exception.

## Commit order

Branch `fix/errors-laziness-edge-cases`; each commit has its red tests first and passes lint, types, tests, build and `check-package`.

1. `Fifo.end(error?)`.
2. `bufferize` family.
3. `concurrentMap` (errors and laziness).
4. `mux`.
5. `take`.
6. `range`.
7. Documentation.

## Risks

- **Behavior changes visible to users:** iterations that used to hang or crash the process now reject; `concurrentMap` no longer starts work before consumption; `take(0)` and `range(0, 5, -1)` return empty. All are bug fixes, but they are changes. Called out in the PR description.
- **Discarding the partial batch on failure** is a choice; the alternative (emit the partial batch, then throw) can be chosen later without changing the error mechanism.
- **Races in `concurrentMap`:** error, capacity wake-up and completion callbacks interact. The tests cover failure while other calls are in flight and failure while the loop waits for capacity; the implementation keeps one `failed` flag checked before every start and every send.

## Success criteria

- Every reproduction from #2 to #8 passes as a test and none emits `unhandledRejection`.
- Lint, types, the full test suite, build and `check-package` are green; documentation examples unchanged in meaning.
- The Readme no longer contains "Known issues"; the issues close when the PR merges.

## Branching note

This branch starts from `docs/readme-jsdoc-license` (PR #9, open). After #9 is merged the branch is rebased onto `master` and its PR retargeted.
