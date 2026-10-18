# CLAUDE.md

A casting tool for the **Chester Gang Show** production team: it shows which Scouts and Explorers are in which show items, and when. TypeScript monorepo: Vue SPA, a framework-free API of Lambda-shaped handlers, and an AWS CDK app. Domain background is in `README.md` → "The domain".

## Domain rules

- **Casting is per item.** A show is an ordered sequence of items (production numbers, sketches, songs, dances). A cast member appears in many items, sometimes in a named or featured part. Model "who is in which item", not one role per person.
- **Running order matters.** Back-to-back appearances (no time for a costume change) and uneven stage time are the core things users need to see.
- **Each production is self-contained.** Items and casting never carry over between years, even when cast members return. Scope data to a production.
- **Safeguarding and UK GDPR: most of the cast are under 18.** Store only first name, surname, section (Scouts, Explorers, Network), Scout group or Explorer unit, and age band (ADR 0010), plus short Singing and Acting casting notes (ADR 0014). Never add date of birth, exact age, address, contact details, photos or medical data without a story and an ADR that justify it. Casting data is for the production team only and must never be publicly reachable. The only data about the team is the username an admin chooses for each adult volunteer's account (ADR 0018). Don't put real cast data in tests, fixtures or seed data; use made-up names.
- **Users are non-technical volunteers**, often updating during or after a rehearsal. Prefer UI that is clear at a glance and quick to edit.

## Platform status

The API uses no framework, only plain handlers in the AWS Lambda / API Gateway shape (ADR 0006). The hosting model is Lambda behind an API Gateway HTTP API, with the pages on S3 and CloudFront (ADR 0017), and sign-in through a Cognito user pool whose token every API route requires (ADR 0018). The hosting feature (`docs/product/hosting`) builds it story by story. Don't introduce a framework, hosting model or AWS resource on your own initiative: it needs a story, and an ADR via the `adr` skill. Deploys are the maintainer's, from their own machine with their own AWS profile (`pnpm release`, or `pnpm infra:deploy` by hand); CI does not deploy, and an agent never deploys unasked.

## Commands

```bash
pnpm install                     # Node 26, pnpm 12
pnpm dev                         # web (vite :5173) + api (:3000) on the real remote table (AWS profile `default`); vite proxies /api
pnpm check                       # lint + typecheck + test + cdk synth — the definition of done
pnpm demo                        # the app on a made-up demo show (:5190), fresh each start; see tooling/demo
pnpm format                      # biome autofix (format + lint + import order)
pnpm test:e2e                    # browser layout tests at phone widths (CI job, not in check)
pnpm test:dynamo                 # API database tests against DynamoDB Local on :8000 (CI job, not in check; ADR 0016)
ALERT_EMAIL=… AWS_PROFILE=… pnpm infra:deploy   # deploy the stack (ask first); `infra:diff` previews. Never `pnpm deploy`: pnpm's own command
ALERT_EMAIL=… AWS_PROFILE=… pnpm release [version]   # the maintainer's release: merges the release-please PR, waits for its tag, then diffs and deploys it (never a diff that replaces the table or user pool), and offers the post-deploy check. With a version, only deploys that tag (redeploy, or go back). Asks before merging and deploying; user-only, see below
USER_POOL_ID=… CHECK_CLIENT_ID=… pnpm check:hosted <app url> <check admin> <check member>   # after a deploy: refuses anyone not signed in, lets the check admin in, refuses the member admin-only routes (ids from the stack outputs)
USER_POOL_ID=… pnpm account admin <username>   # create or restore an admin; `account check <admin> <member>` sets up the check's accounts
pnpm --filter <pkg> test         # one package: web | api | infra | @app/shared
pnpm --filter <pkg> exec vitest run <file> -t "<name>"   # one test
```

## Layout

| Path | What | Notes |
|---|---|---|
| `apps/web` | Vue 3 + Vite SPA | Vitest + `@vue/test-utils` + happy-dom; Playwright layout tests in `e2e/` |
| `apps/api` | Lambda-shaped handlers, no framework | One handler per route, listed in `routes.ts`; `dev-server.ts` (node:http) runs them locally (ADR 0006) |
| `packages/shared` | zod schemas + inferred types | The API contract. Imported from source, no build step |
| `infra` | CDK v2 app, one `AppStack` | Run directly by Node (`cdk.json`); add resources as stories need them |
| `tooling` | Repo scripts | `demo.ts` runs `pnpm demo`; `release.ts` runs `pnpm release`; harness tests |
| `docs/product/<feature>` | PRD, story map, stories | Written by the planning skills; see `docs/product/README.md` |
| `docs/adr` | Architecture decisions | Read before changing anything an ADR covers |

## Workflow: TDD, strict gates

1. **Red** — write a failing test that states the behaviour. Run it; confirm it fails for the right reason.
2. **Green** — the minimum code to pass.
3. **Refactor** — clean up with tests green.
4. **Gate** — `pnpm check` must exit 0 before you say a task is done. Never claim "done" on a red or unrun gate; report the failure instead.

Rules:
- No production code without a test that exercised it first. Bug fixes start with a test that reproduces the bug.
- **Documentation stories skip TDD.** A documentation story is one whose ACs are met by writing or changing docs (guides, README, ADRs, product docs) rather than app, API, infra or harness code. Write the docs, run the gate, done: no tests per AC, no Red/Green.
- Name tests after the behaviour they check (`it("returns 404 for unknown routes")`), never after stories or tickets.
- Changing or deleting a test is fine when the behaviour or design changes; say why in the commit. Never change a test only to make it pass, and never commit `.skip`/`.only` (the guard blocks them).
- Test behaviour through public interfaces: call handlers directly (and the dev server over HTTP) for the API, `mount()` for components, `Template.fromStack()` assertions for infra.
- API request/response shapes are defined once in `packages/shared` as zod schemas; the API and web both import them. Change the schema first.

### Browser layout tests (`apps/web/e2e`, ADR 0011)

Playwright walks each page and its forms at 320px and 360px, checking nothing scrolls sideways. CI runs them as a separate job; locally run `pnpm test:e2e` (once: `pnpm --filter web exec playwright install chromium`). They are a regression net, not AC coverage, and sit outside the Red/Green loop above.
- **Ask the user before adding any browser test**: a new page or form to walk, or a new kind of check (desktop widths, keyboard flows, anything beyond sideways scrolling). When a change adds a page, form or layout the walks don't cover, offer to add one. Don't add it unasked.
- Run `pnpm test:e2e` before a PR that changes `apps/web` layout or CSS, and fix what it finds.
- Use only the made-up data in `apps/web/e2e/data`. The tests start their own servers on :3100/:5180 and never touch `pnpm dev`'s real data.

## Skills (`.claude/skills/`)

Delivery chain: **write-prd → story-map → write-story → implement-story → open-pr**, plus **adr** for decisions.
New feature work starts from a story with Given/When/Then ACs. If there isn't one, offer the chain rather than coding from a vague request. Every AC needs at least one test, except in a documentation story (see Workflow): `test-auditor` checks the mapping at review, and the PR lists which test covers each AC.

**batch-stories** (`/batch-stories on <feature>` / `off` / `status`) is a user-only toggle. It temporarily lets you build one feature's stories on one branch, committing and pushing each, with a single PR at the end. Then it restores the harness. Only the user can start it.

## Review loop (subagents, `.claude/agents/`)

Run after the gate is green, before a story is `done` or a PR is opened. **Skip it entirely** for a documentation story (see Workflow), or any change whose diff touches only `*.md` files: no reviewers run. Launch the relevant reviewers **in parallel**, passing the story path if there is one.

**Hand each reviewer the change**, so they don't each fetch it again. Run `git diff main...HEAD` (plus `git diff` for uncommitted work) once, and paste it into every reviewer's prompt, with the story path. Give `infra-reviewer` and `ux-reviewer` only the part of the diff in their own area. If `git diff --shortstat main...HEAD -- . ':!*.md'` reports over ~1,500 changed lines, paste `git diff --stat main...HEAD` instead, and say which files matter most. Reviewers already have CLAUDE.md, so don't paste it. Skip any reviewer whose row below doesn't match the diff; that's intended.

| Reviewer | Run when the diff (`git diff main...HEAD`) touches |
|---|---|
| `code-reviewer` | always |
| `test-auditor` | a story is being implemented |
| `security-reviewer` | non-test code in `apps/api` (including `routes.ts` and `dev-server.ts`) or `packages/shared`; `apps/web` code that touches sign-in, tokens, browser storage, `fetch` or other URLs, or renders raw HTML (`v-html`, `innerHTML`); or dependency changes in any `package.json` / `pnpm-workspace.yaml`. When unsure, run it |
| `infra-reviewer` | `infra/`, `tooling/src/release.ts`, or anything that changes how the API is packaged or deployed |
| `ux-reviewer` | `apps/web` (advisory: never blocks) |

1. Fix every `blocker`, re-run `pnpm check`, then re-run **only the reviewers that blocked**.
2. Allow at most **2 rounds**. If blockers remain, stop and show the user the findings. Don't keep looping.
3. `should-fix` and `nit` findings don't block. List them under "Review notes" in the PR.
4. If you disagree with a blocker, don't ignore it. Tell the user why.
5. `ux-reviewer` checks UI and UX consistency across the whole web app. Its findings never block and you don't act on them yourself. When the loop is done, list them and **ask the user** (one multi-select question) which to fix now, which to note in the PR, and which to leave. Batch mode asks too. Findings you fix go through the gate again; the rest go under "Review notes".

## Conventions

- Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any`, no `as` casts to silence errors, no non-null `!`.
- ESM everywhere; relative imports include the `.ts` extension.
- Biome owns formatting and lint — don't hand-format, run `pnpm format`.
- Tests live next to code: `foo.ts` → `foo.test.ts`.
- Keep handlers/adapters thin; logic goes in plain functions that are easy to test.
- Write for the next human reader: brief, intention-revealing names, small single-purpose functions, early returns, no speculative generality, comments that say *why*. `code-reviewer` checks this.

## Git

Trunk-based. `main` is always releasable.
- Branch per change: `feat/…`, `fix/…`, `chore/…`. Keep PRs small (aim < ~400 changed lines, not counting `.md` files or the lockfile).
- Conventional Commits, enforced by commitlint on every commit and on PR titles: `feat(api): add story endpoint`. Scopes: `web api infra shared tooling harness deps docs release` (see `commitlint.config.js`; `main` is also allowed, but only release-please uses it).
- **The type decides the version** (release-please, ADR 0004): `fix` → patch, `feat` → minor, `feat!` or a `BREAKING CHANGE:` footer → major. Below 1.0.0, breaking changes bump minor. `chore`/`ci`/`docs`/`test`/`refactor` don't release. Pick the type honestly; don't call a feature a `fix` or hide a breaking change.
- Commit when the gate is green. Squash-merge PRs: **the PR title becomes the commit on `main`**, so it must be a correct Conventional Commit.
- Never edit `CHANGELOG.md`, `.release-please-manifest.json` or `version` fields by hand; release-please owns them.

## Autonomy

You may, without asking: edit code, add/upgrade dev dependencies, run any `pnpm` script, `cdk synth`/`cdk diff`, create branches and commits.

Ask first: `git push`, opening/merging PRs, `cdk deploy`/`destroy`, `pnpm release` (it merges the release PR and deploys to the real AWS account, so run it only when the user asks, never as part of other work), anything touching real AWS accounts, deleting files you didn't create, changing CI or harness config (`.claude/`, `.github/`). Exception: while the user has switched on `batch-stories` for a feature, their "yes" to it covers the temporary `.claude/settings.json` change, and pushing that feature's branch and opening its single PR without asking. That PR may pass the ~400-line guideline; the skill says when to stop and check. Run `/batch-stories off` once the PR is open.

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
