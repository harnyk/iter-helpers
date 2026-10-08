# Documentation, part A: LICENSE, JSDoc, Readme — design

Date: 2026-10-08

## Context and goal

`@harnyk/iter-helpers` (the maintained fork of `sweepbright/iter-helpers`) has an outdated and partly incorrect Readme, almost no JSDoc (only `Chain` is documented) and no `LICENSE` file although `package.json` declares MIT.

Goal of this PR (part A): documentation that matches the real behavior of the code, readable in the editor (JSDoc), on GitHub and on npm (Readme). It is the content base for part B.

Part B (a separate, later PR, out of scope here): Docusaurus site, TypeDoc API reference, mermaid diagrams, GitHub Pages workflow.

## Decisions

| Topic | Decision |
|---|---|
| Language | English (code, Readme, JSDoc) |
| Positioning | Describe only what the library does: chains of operators over sync/async iterators (`batch`, `concurrentMap`, `Fifo`, `mux`, ...). Native iterator helpers are not mentioned or compared anywhere |
| License | MIT text in `LICENSE`; copyright line see "Open item" |
| JSDoc style | TSDoc syntax only (TypeDoc-compatible for part B): description, `@param`, `@returns`, short `@example` for every export of `src/main.ts` |
| Doc comment placement | Operators are documented where they are declared (`Map.ts`, `Take.ts`, ...); `Chain` methods reference them with `@see` |
| Version | Not bumped in this PR; the release is made by the owner with `pnpm version` |

## Scope

1. `LICENSE` (MIT). npm includes it in the tarball automatically.
2. JSDoc for every public function, class and type exported from `src/main.ts`.
3. Readme rewritten: Node 22 requirement and badges, one-line description, installation, quick start with one end-to-end example, operator table, sections for `Fifo`, `mux`, `range`, `bufferize`, `tap`, `onEnd`, `concurrentMap` (with `errorMapper`), `batch` (including the `{ size, timeFrame }` form), a short "Migrating from 0.x" section (`Fifo.push`/`waitDrain` removed, Node >= 22).
4. Text fixes: `.skip(n)` skips the first `n` items (the old text said it returns the last `n`); `.interval(n)` yields `[first, last]` of each group of `n` items. The existing mermaid diagram of `interval` is correct and stays.
5. `Diagrams.md` stays as is (it moves to the site in part B); descriptions for `bufferize`, `tap`, `onEnd` are added only if a diagram is actually illustrative.

## Keeping the docs honest

- Every example that shows an output is duplicated as a test in `src/tests/docs-examples.spec.ts` (same code, same expected result). A changed example fails CI.
- The behavior of every operator whose description changes (`skip`, `interval`, `batch` with `timeFrame`, `concurrentMap` with `errorMapper`) is verified by running it before the text is written.
- `eslint-plugin-tsdoc` validates comment syntax. No lint rule requires a comment on every export.

## Out of scope

- Any behavior change of operators or new features.
- The known `bufferize` problem (source error is lost, consumer hangs): issue #2. The Readme must not promise error-propagation guarantees that the code does not have.
- The Docusaurus site and the generated API reference (part B).

## Commit order

Branch `docs/readme-jsdoc-license` from `master`; every commit passes `lint`, `check-types`, `test`, `build`, `check-package`.

1. `LICENSE`.
2. JSDoc for operators and types, in groups of files; `eslint-plugin-tsdoc`.
3. `docs-examples.spec.ts` tests for the examples.
4. Readme rewrite.
5. `Diagrams.md` touches, only if needed.

## Risks

- JSDoc examples are comments and are not executed; the duplicated tests are the only guard. Examples without a test must not show outputs.
- `eslint-plugin-tsdoc` may not yet support ESLint 10 (flat config); if so, fall back to checking comments through the TypeDoc run in part B and note it in the PR.

## Success criteria

- `LICENSE` exists and appears in `pnpm pack --dry-run`.
- Every export of `src/main.ts` has a TSDoc comment; all checks are green.
- The Readme matches the API and behavior verified by the examples tests; it contains no mention of native iterator helpers.

## Open item (owner decision)

Copyright holder line in `LICENSE`. The library was written at SweepBright and open-sourced by agreement; the first commit is from 2023-10-25. Proposed: `Copyright (c) 2023-2026 Mark Harnyk and contributors`. If SweepBright should be named as a holder, the line must say so; this is not decided by the code.
