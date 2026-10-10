# CLAUDE.md

TypeScript monorepo: Vue SPA, a framework-free API of Lambda-shaped handlers, and an AWS CDK app.

**This is a sandbox scaffold.** The API uses no framework, only plain handlers in the AWS Lambda / API Gateway shape (ADR 0006), and the CDK stack has no resources yet (ADR 0005). Don't introduce a framework, hosting model or AWS resource on your own initiative: it needs a story, and an ADR via the `adr` skill.

## Commands

```bash
pnpm install                     # Node 26, pnpm 12
pnpm dev                         # web (vite :5173) + api dev server (:3000); vite proxies /api
pnpm check                       # lint + typecheck + test + cdk synth — the definition of done
pnpm format                      # biome autofix (format + lint + import order)
pnpm lint:docs                   # validate story structure (part of check)
pnpm --filter <pkg> test         # one package: web | api | infra | @app/shared
pnpm --filter <pkg> exec vitest run <file> -t "<name>"   # one test
```

## Layout

| Path | What | Notes |
|---|---|---|
| `apps/web` | Vue 3 + Vite SPA | Vitest + `@vue/test-utils` + happy-dom |
| `apps/api` | Lambda-shaped handlers, no framework | One handler per route, listed in `routes.ts`; `dev-server.ts` (node:http) runs them locally (ADR 0006) |
| `packages/shared` | zod schemas + inferred types | The API contract. Imported from source, no build step |
| `infra` | CDK v2 app, one empty `AppStack` | Run directly by Node (`cdk.json`); add resources as stories need them |
| `tooling` | Repo scripts | `validate-docs.ts` checks product docs |
| `docs/product/<feature>` | PRD, story map, stories | Written by the planning skills; see `docs/product/README.md` |
| `docs/adr` | Architecture decisions | Read before changing anything an ADR covers |

## Workflow: TDD, strict gates

1. **Red** — write a failing test that states the behaviour. Run it; confirm it fails for the right reason.
2. **Green** — the minimum code to pass.
3. **Refactor** — clean up with tests green.
4. **Gate** — `pnpm check` must exit 0 before you say a task is done. Never claim "done" on a red or unrun gate; report the failure instead.

Rules:
- No production code without a test that exercised it first. Bug fixes start with a test that reproduces the bug.
- Name tests after the behaviour they check (`it("returns 404 for unknown routes")`), never after stories or tickets.
- Changing or deleting a test is fine when the behaviour or design changes; say why in the commit. Never change a test only to make it pass, and never commit `.skip`/`.only` (the guard blocks them).
- Test behaviour through public interfaces: call handlers directly (and the dev server over HTTP) for the API, `mount()` for components, `Template.fromStack()` assertions for infra.
- API request/response shapes are defined once in `packages/shared` as zod schemas; the API and web both import them. Change the schema first.

## Skills (`.claude/skills/`)

Delivery chain: **write-prd → story-map → write-story → implement-story → open-pr**, plus **adr** for decisions.
New feature work starts from a story with Given/When/Then ACs. If there isn't one, offer the chain rather than coding from a vague request. Every AC needs at least one test: `test-auditor` checks the mapping at review, and the PR lists which test covers each AC.

## Review loop (subagents, `.claude/agents/`)

Run after the gate is green, before a story is `done` or a PR is opened. Launch the relevant reviewers **in parallel**, passing the story path if there is one:

| Reviewer | Run when the diff (`git diff main...HEAD`) touches |
|---|---|
| `code-reviewer` | always |
| `test-auditor` | a story is being implemented |
| `security-reviewer` | `apps/api`, `apps/web`, `packages/shared`, or any `package.json` / `pnpm-workspace.yaml` |
| `infra-reviewer` | `infra/`, or anything that changes how the API is packaged or deployed |

1. Fix every `blocker`, re-run `pnpm check`, then re-run **only the reviewers that blocked**.
2. Allow at most **2 rounds**. If blockers remain, stop and show the user the findings. Don't keep looping.
3. `should-fix` and `nit` findings don't block. List them under "Review notes" in the PR.
4. If you disagree with a blocker, don't ignore it. Tell the user why.

## Conventions

- Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any`, no `as` casts to silence errors, no non-null `!`.
- ESM everywhere; relative imports include the `.ts` extension.
- Biome owns formatting and lint — don't hand-format, run `pnpm format`.
- Tests live next to code: `foo.ts` → `foo.test.ts`.
- Keep handlers/adapters thin; logic goes in plain functions that are easy to test.
- Write for the next human reader: brief, intention-revealing names, small single-purpose functions, early returns, no speculative generality, comments that say *why*. `code-reviewer` checks this.

## Git

Trunk-based. `main` is always releasable.
- Branch per change: `feat/…`, `fix/…`, `chore/…`. Keep PRs small (aim < ~400 changed lines).
- Conventional Commits, enforced by commitlint on every commit and on PR titles: `feat(api): add story endpoint`. Scopes: `web api infra shared tooling harness deps docs release` (see `commitlint.config.js`; `main` is also allowed, but only release-please uses it).
- **The type decides the version** (release-please, ADR 0004): `fix` → patch, `feat` → minor, `feat!` or a `BREAKING CHANGE:` footer → major. Below 1.0.0, breaking changes bump minor. `chore`/`ci`/`docs`/`test`/`refactor` don't release. Pick the type honestly; don't call a feature a `fix` or hide a breaking change.
- Commit when the gate is green. Squash-merge PRs: **the PR title becomes the commit on `main`**, so it must be a correct Conventional Commit.
- Never edit `CHANGELOG.md`, `.release-please-manifest.json` or `version` fields by hand; release-please owns them.

## Autonomy

You may, without asking: edit code, add/upgrade dev dependencies, run any `pnpm` script, `cdk synth`/`cdk diff`, create branches and commits.

Ask first: `git push`, opening/merging PRs, `cdk deploy`/`destroy`, anything touching real AWS accounts, deleting files you didn't create, changing CI or harness config (`.claude/`, `.github/`).

Never: commit secrets or read `.env*` files, force-push, push to `main`, bypass hooks (`--no-verify`).

## Harness (hooks)

Hooks in `.claude/settings.json` enforce the rules above; their logic lives in `.claude/hooks/*.ts` (tested, run with plain `node`).
- **Before** an edit/command (`guard.ts`): blocks lockfile/env edits, `.skip`/`.only`, `--no-verify`, and commit/push on `main`.
- **After** an edit (`post-edit.ts`): Biome-fixes the file, then typechecks its package. Treat its output as your next task.
- **On stop** (`stop-gate.ts`): runs `pnpm check`; you can't finish while it's red.
- **On commit**: Lefthook runs Biome on staged files and commitlint on the message.
- **On push**: Lefthook blocks any push to `main` (`.lefthook/pre-push/protect-main.sh`), then runs `pnpm check`. This stands in for GitHub branch protection, which the free plan doesn't enforce on private repos.

If a hook blocks you, fix the cause; don't work around it. If you think the hook is wrong, tell the user.

## Gotchas

- **TypeScript 7 vs vue-tsc**: the repo uses TS 7 (native), but `vue-tsc` needs the TS 6 JS API, so `apps/web` pins `typescript@^6`. Don't "unify" them.
- **CDK + `exactOptionalPropertyTypes`**: incompatible with aws-cdk-lib types, so `infra/tsconfig.json` turns it off. Keep it on everywhere else.
- **Biome and Vue**: Biome can't see usage inside `<template>`, so `biome.json` turns off unused-import/variable rules for `*.vue`. Remove genuinely unused imports in `.vue` files by hand.
- **pnpm build scripts** are blocked by default; allow them in `pnpm-workspace.yaml` → `allowBuilds` (esbuild is allowed because Vite needs it).
