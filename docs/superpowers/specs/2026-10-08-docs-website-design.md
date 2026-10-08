# Documentation, part B: online docs on Docusaurus — design

Date: 2026-10-08

## Context and goal

Part A gave the library a LICENSE, TSDoc for the whole API and a rewritten Readme. Part B publishes the documentation online, the last step before `1.0.0`: guides, an API reference generated from the TSDoc, diagrams, hosted on GitHub Pages.

Owner's decisions: Docusaurus as the generator; the site is the source of truth for the guides and the Readme becomes short (no duplicated copies).

## Decisions

| Topic | Decision |
|---|---|
| Generator | Docusaurus 3 (`@docusaurus/core`, preset classic), docs-only mode (`routeBasePath: "/"`, no blog) |
| API reference | `docusaurus-plugin-typedoc` + `typedoc-plugin-markdown`, entry `src/main.ts`, output `website/docs/api` (generated, git-ignored) |
| Diagrams | `@docusaurus/theme-mermaid`; `Diagrams.md` moves to the site |
| Layout | `website/` is a separate project with its own `package.json` and `pnpm-lock.yaml` (not a pnpm workspace); the library, its release workflow and its tarball are untouched |
| Language | English |
| URL | `https://harnyk.github.io/iter-helpers/` (`baseUrl: /iter-helpers/`) |
| Markdown | `markdown.format: "detect"`: `.md` files are plain CommonMark, not MDX (the text contains `{ }` and `<` that MDX would treat as markup) |
| Not now | search, versioned docs, custom domain, i18n, blog |

## Pages

- **Getting started**: installation, quick start, concepts.
- **Operators**, four pages with the examples of the current Readme: transforming (`map`, `filter`, `take`, `skip`, `flatten`, `tap`, `onEnd`, `pipe`), batching (`batch`, `interval`, `bufferize`), concurrency (`concurrentMap`), sources (`range`, `mux`, `Fifo`).
- **Errors**, **Migrating from 0.x**, **Diagrams**.
- **API**: generated.

The Readme shrinks to: badges, description, installation, quick start, a link to the documentation, license. `package.json` gets `homepage` pointing to the site.

## Quality gates

- Site build with `onBrokenLinks: "throw"` and `onBrokenMarkdownLinks: "throw"`.
- `website/scripts/check-snippets.mjs`: extracts every ```ts block from `website/docs/**/*.md` (not `api/`) and type-checks it with `tsc` against `src/main.ts` (path mapping for `@harnyk/iter-helpers`). The `docs-examples.spec.ts` tests that pin the outputs stay as they are.
- The unexported internal type `Iteratee` (used by `mux`) is not documented; its TypeDoc warning is silenced by configuration (`validation.notExported: false`), the public API is not extended before 1.0.0.
- Root tooling ignores the site's generated files: ESLint ignores `website`; prettier ignores `website/build`, `website/.docusaurus`, `website/docs/api`, `website/node_modules`.

## CI and deployment

`.github/workflows/docs.yml`:

- On pull requests and on pushes to `master`: install the root and `website` dependencies, run the snippet check, build the site.
- On pushes to `master` only: upload the build as a Pages artifact and deploy with `actions/deploy-pages` (environment `github-pages`, permissions `contents: read`, `pages: write`, `id-token: write`); third-party actions are pinned by SHA, Node 24.
- Dependabot gets an `npm` entry for `/website`.

Repository setting (owner's decision, not part of the code): GitHub Pages with source "GitHub Actions". It is enabled only after the owner agrees (`gh api -X POST repos/harnyk/iter-helpers/pages -f build_type=workflow`).

## Out of scope

Search, version switcher, analytics, custom domain, translations; changes to the library code or its release workflow.

## Risks

- **Docusaurus, React and TypeDoc versions** are large new dev dependencies, isolated in `website/`; the root install, lint and tests do not depend on them.
- **TypeDoc on TS 6:** `typedoc` 0.28 lists TS 6.0.x as supported and already ran on this code; the plugin runs it from `website/`, so it must resolve `typescript`, `@types/node` and `@harnyk/chan` from the repository root (`src/` imports them). If that is awkward, the plugin gets `tsconfig` and the root `node_modules` is installed in CI before the site build.
- **Generated Markdown under `markdown.format: "detect"`:** the TypeDoc output is plain Markdown; if some page needs MDX, that single page is set to `.mdx`.
- **Pages must be enabled by the owner** before the first deployment can succeed; until then the deploy job is expected to fail on `master`.
- **Duplicated links:** the old Readme and `Diagrams.md` links change; the Readme links to the site, and `Diagrams.md` is removed.

## Success criteria

- `pnpm --dir website build` succeeds with zero broken links; the snippet check passes.
- Every export of `src/main.ts` appears in the generated API reference, with its description.
- CI builds the site on PRs; after Pages is enabled, a push to `master` deploys it to the URL above.
- The Readme is short and links to the site; no guide text is duplicated.
- Root `lint`, `check-types`, `test`, `build`, `check-package` stay green; `pnpm pack --dry-run` still contains only `dist`, `LICENSE`, `Readme.md`, `package.json`.

## Branch

`docs/website` from `master`. Commit order: site skeleton and config; content pages; Readme/Diagrams move; snippet check; CI and Dependabot.
