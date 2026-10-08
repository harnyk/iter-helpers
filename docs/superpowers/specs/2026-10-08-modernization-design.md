# Modernization of iter-helpers (fork) — design

Date: 2026-10-08

## Context and goal

This repository is a fork of `sweepbright/iter-helpers`, identical to upstream at the start. The author (Mark Harnyk, original author of the library) is making the fork the primary home of the library. SweepBright may pull changes from it. The last upstream commit is v0.6.0 from 2024-07-29, and the tooling is stale.

Goal of this work: a single PR that fully modernizes tooling and TypeScript and removes explicitly deprecated API. The result is released as `1.0.0-rc.0`.

Out of scope (separate later work):

- Documentation rework (next PR).
- Reviewing the API and operators against native Iterator helpers. Native async helpers are not taken into account for now; the library is positioned as a convenient replacement and extension of them.
- Any behavior changes to operators beyond what tooling upgrades force.

## Decisions

| Topic | Decision |
|---|---|
| Package name | `@harnyk/iter-helpers` |
| Version | `1.0.0-rc.0`; RCs are published under dist-tag `rc`, stable under `latest` |
| Minimum Node | 22 (`engines.node: ">=22"`). Node 20 is EOL; SweepBright's older runtime is not our constraint |
| Package manager | pnpm (`packageManager` field, `pnpm-lock.yaml`, lockfile imported via `pnpm import`) |
| Tests | vitest, explicit imports (no globals) |
| Build | tsup, ESM + CJS + `.d.ts` |
| Lint / format | ESLint flat config + typescript-eslint; prettier owns formatting |
| CI/CD | GitHub Actions; npm trusted publishing (OIDC) with provenance |
| Deprecated API | `Fifo.push` and `Fifo.waitDrain` are removed |

## 1. Package and build

- `package.json`: new `name`, `version`, `repository` pointing to the fork, `author` is the fork owner. `contributors` stay (MIT, authorship history preserved).
- `"type": "module"`, `exports` with `types` / `import` / `require` conditions, `main` and `types` kept for legacy resolvers, `sideEffects: false`, `files: ["dist"]`.
- tsup builds `src/main.ts` into `dist/` (ESM `.js`, CJS `.cjs`, `.d.ts` and `.d.cts`), `target: node22`. `lib/` is replaced by `dist/`; `.gitignore` is updated.
- TypeScript: latest stable, `target`/`lib` ES2023, `moduleResolution: "Bundler"`, `verbatimModuleSyntax`. Sources are not rewritten (no `.js` import suffixes): tsup compiles, `tsc --noEmit` only checks types. The unused `ts-node` section is removed.
- CI quality gates: `publint` and `@arethetypeswrong/cli`.

## 2. Tests, lint, package manager

- `vitest.config.ts` replaces `jest.config.js`. Specs stay in `src/tests/`. `jest`, `ts-jest`, `@types/jest` are removed. Fake-timer usage (`jest.*`) is migrated to `vi.*`. Coverage via `@vitest/coverage-v8`, no threshold.
- ESLint flat config (`eslint.config.js`) with the unified `typescript-eslint` package and `eslint-config-prettier`. The stylistic rules `indent`, `quotes`, `semi` are dropped.
- Prettier is upgraded and applied to the whole repo in a dedicated formatting-only commit. `.prettierrc` and `.editorconfig` are aligned with each other.
- `Fifo` deprecated methods are removed together with `fifo-deprecated.spec.ts`; `fifo-actual.spec.ts` is renamed to `fifo.spec.ts`.
- Scripts are used through `ni` / `nr` locally.

## 3. CI/CD and release

`.github/workflows/ci.yml` (push to `master`, PRs):

- Node matrix 22 and 24, pnpm with cache.
- `pnpm install --frozen-lockfile`, then lint, check-types, test, build, `publint`, `attw`.
- `permissions: contents: read`; third-party actions pinned by SHA.

`.github/workflows/release.yml` (tags `v*`):

- `permissions: id-token: write, contents: read`; Node 24 with npm >= 11.5.1.
- Same checks, then `pnpm publish --provenance --no-git-checks`. The dist-tag is derived from the version (`rc` for `-rc.N`, otherwise `latest`).
- Authentication via trusted publishing (OIDC), no `NPM_TOKEN`.
- Gated by GitHub Environment `npm-publish` with a required reviewer (replaces the CircleCI `approve` step).

Other:

- `.circleci/` is removed.
- `.github/dependabot.yml` for npm and github-actions, weekly, grouped.
- Minimal Readme update: package name, install commands, CI badge. The full documentation rework is the next PR.

### Manual steps outside the repository (owner)

1. First publish of `@harnyk/iter-helpers@1.0.0-rc.0` manually, if npm cannot attach a trusted publisher to a not-yet-existing package.
2. On npmjs.com: add a Trusted Publisher (fork repository, `release.yml`, environment `npm-publish`).
3. On GitHub: create Environment `npm-publish` with a required reviewer.

## Commit order within the PR

Each commit must pass checks on its own.

1. Migrate to pnpm.
2. Prettier over the whole repo (formatting only).
3. Jest to vitest.
4. ESLint flat config and typescript-eslint.
5. TypeScript upgrade and tsconfig; minimal type fixes if the upgrade exposes real issues (separate commits with explanation).
6. tsup, `exports`, new package name, version `1.0.0-rc.0`.
7. Remove deprecated `Fifo` API.
8. GitHub Actions, Dependabot, remove CircleCI.

## Risks

- Newer TypeScript and typescript-eslint may reveal real typing problems in operators. Fixes stay minimal.
- The ESM + CJS dual package must be verified by `attw` and `publint`; `moduleResolution: "Bundler"` does not catch consumer-side resolution problems on its own.
- Trusted publishing for a brand-new package may need the manual first publish.

## Success criteria

- `pnpm lint`, `pnpm check-types`, `pnpm test`, `pnpm build` all pass on Node 22 and 24.
- `publint` and `attw` report no problems; the package imports correctly via both `import` and `require`.
- CI on GitHub Actions is green; a tag `v1.0.0-rc.0` publishes with provenance under dist-tag `rc`.
- No deprecated API remains; no behavior change of the operators.
