# Chester Gang Show casting

A web app for the **Chester Gang Show production team** to plan and visualise casting: which Scouts and Explorers are in which items, and when, across the whole show. It helps the team spot clashes (such as back-to-back appearances with no time for a costume change) and see who is overused or underused, so stage time is spread fairly.

Chester Gang Show is a volunteer-led Scouting variety show: comedy, music, dance, sketches and production numbers, created and performed by the local Scouting community for a family audience. The current production is the **70th anniversary show**.

## The domain

**The show is a sequence of items, not one play.** Production numbers, sketches, songs and dances each have their own cast, so casting is done per item.
- Opening and finale numbers usually involve the whole cast; large ensemble numbers are normal.
- Smaller items (sketches, featured songs, dance pieces) use a subset of the cast, and some have named or featured parts.
- Each cast member appears in many items. *Who is in what, and when* matters more than one role per person.

**The cast** is aged 10 to 25, drawn from Scouts (about 10½–14), Explorers (14–18) and Scout Network (18–25). This app focuses on **Scouts and Explorers**, so most of the cast is under 18. Age and ability vary a lot, and casting has to suit the performers.

**Production realities that affect casting:**
- **Quick changes.** A performer in two consecutive items may not have time to change costume. Back-to-back appearances are the most common clash to spot.
- **Stage space, entrances and exits** affect who can be in adjacent items.
- **Simple costume additions** are preferred over full changes, partly to make quick changes possible.
- **Reliability in a live show** matters more than ambition on paper.
- **Rehearsal availability is patchy**: many cast members and volunteers have other Scouting commitments.

**Each year is a fresh production.** Items, characters, scripts, costumes and sets don't carry over unless explicitly brought back. Each production is its own self-contained set of items and casting, even when cast members return.

**Who uses it:** adult volunteers on the production team (directors, item leaders, choreographers, wardrobe and stage management). They aren't necessarily technical and often work on this in the evenings around jobs and other Scouting roles, so the interface must be clear at a glance and quick to update during or after a rehearsal.

### Safeguarding and data protection

Most of the cast are under 18 and this is a Scouting activity, so the app is built with **youth safeguarding and UK GDPR** in mind:
- **Store only what casting needs**: first name, surname initial, section and age band. No dates of birth, addresses, contact details, photos or medical information unless there is a clear, agreed need.
- **Prefer age band or section** over exact age.
- **Access is limited to the production team.** Casting data must never be publicly reachable.

## Getting started

```bash
pnpm install   # Node 26, pnpm 12 (also installs the git hooks)
pnpm dev       # web on :5173 + API dev server on :3000 (Vite proxies /api)
pnpm check     # lint + docs lint + typecheck + tests + cdk synth: the definition of "done"
```

Open http://localhost:5173 and you should see **"API: ok (dev)"**: the Vue app calling the API's health endpoint end to end. That walking skeleton is where casting features start; each one arrives as a story (see [How a change flows](#how-a-change-flows)).

The repo is built on an opinionated **TypeScript monorepo scaffold** with a **layered agent harness** for [Claude Code](https://claude.com/claude-code): instructions, skills, reviewers, hooks and pipelines that let coding agents work here autonomously without quality slipping. The rest of this README describes that engineering setup.

---

## Contents

- [The domain](#the-domain)
- [Repository layout](#repository-layout)
- [The harness](#the-harness)
- [How a change flows](#how-a-change-flows)
- [Conventions](#conventions)
- [The journey so far](#the-journey-so-far)
- [Known trade-offs](#known-trade-offs)
- [Origin](#origin)

---

## Repository layout

```
.
├── apps/
│   ├── web/                 Vue 3 + Vite SPA (HealthStatus component calls /api/health)
│   └── api/                 Framework-free API: Lambda-shaped handlers (ADR 0006)
│       └── src/
│           ├── health.ts        GET /api/health handler (the future Lambda)
│           ├── routes.ts        "<METHOD> <path>" → handler table
│           └── dev-server.ts    node:http stand-in for API Gateway, loopback only
├── packages/shared/         zod schemas + inferred types: the API contract
├── infra/                   AWS CDK app with one empty AppStack (ADR 0005)
├── tooling/                 Repo scripts: validate-docs.ts (story structure) + harness tests
├── docs/
│   ├── adr/                 Architecture decision records 0001–0007
│   └── product/<feature>/   PRD, story map and stories written by the planning skills
├── .claude/
│   ├── settings.json        Permissions (allow / ask / deny) + hook registration
│   ├── hooks/               guard, post-edit and stop-gate hooks (TypeScript; logic unit-tested)
│   ├── skills/              Delivery workflows: write-prd … open-pr, adr
│   └── agents/              Reviewer subagents: code, test, security, infra
├── .github/
│   ├── workflows/           ci.yml, pr-title.yml, release-please.yml
│   ├── dependabot.yml
│   └── pull_request_template.md
├── .lefthook/pre-push/      protect-main.sh
├── lefthook.yml             Git hooks: pre-commit, commit-msg, pre-push
├── commitlint.config.js     Conventional Commits rules and allowed scopes
├── release-please-config.json, .release-please-manifest.json, CHANGELOG.md
├── biome.json               Formatter + linter
└── CLAUDE.md                The agents' operating manual (useful for humans too)
```

The app is intentionally minimal. The API uses **no framework**: each endpoint is a plain `async` function with the AWS Lambda / API Gateway (HTTP API, payload v2) signature, so it can deploy to Lambda unchanged. The CDK stack has **no resources** until a story needs them. Frameworks, hosting and AWS resources each arrive through a story and an ADR, never by default.

---

## The harness

The design principle (ADR 0002): **instructions advise, hooks enforce, reviewers judge, and CI is the final authority.** No single layer has to be perfect, because each one backs up the one before it.

| Layer | Runs | What it does | Can it be skipped? |
|---|---|---|---|
| `CLAUDE.md` + ADRs | every session | Commands, workflow, conventions, autonomy limits, decision history | Yes (advisory) |
| Skills | on demand | Repeatable procedures with approval checkpoints and templates | Yes (advisory) |
| Permissions | every tool call | Allow, ask or deny specific commands and files | No |
| Claude Code hooks | before and after every action, and on finish | Block risky actions, give instant feedback, push back on "done" while the gate is red | No (for agents) |
| Reviewer subagents | before every PR | Independent, read-only review: code, tests, security, infra | Yes (standing rule to run them) |
| Git hooks (Lefthook) | commit and push | Format, commit-message rules, no pushes to `main`, gate before push | Only deliberately |
| CI | every push and PR | The same gate on GitHub's machines, plus PR-title checks | No |

### 1. Instructions: `CLAUDE.md` and ADRs
[CLAUDE.md](CLAUDE.md) is loaded into every agent session, so it stays short and holds only what an agent would otherwise get wrong:
- the commands, the TDD loop and the definition of done;
- the git rules;
- what agents may do alone, what needs asking, and what is never allowed;
- the review loop, and a list of gotchas.

[docs/adr](docs/adr) records *why* things are the way they are, so agents don't "fix" deliberate choices:

| ADR | Decision |
|---|---|
| [0001](docs/adr/0001-record-architecture-decisions.md) | Record architecture decisions |
| [0002](docs/adr/0002-layered-agent-harness.md) | Layered agent harness |
| [0003](docs/adr/0003-independent-subagent-review.md) | Independent subagent review before done |
| [0004](docs/adr/0004-versioning-with-release-please.md) | Conventional Commits + release-please versioning |
| [0005](docs/adr/0005-framework-free-sandbox-scaffold.md) | Framework-free sandbox scaffold |
| [0006](docs/adr/0006-vanilla-lambda-shaped-api-handlers.md) | Vanilla, Lambda-shaped API handlers |
| [0007](docs/adr/0007-behaviour-named-tests-coverage-at-review.md) | Behaviour-named tests; AC coverage checked at review |

### 2. Skills (`.claude/skills/`)
A skill is a packaged procedure. Only its one-line description is always in context; the steps load when it's used. They form a delivery chain:

```
write-prd ──► story-map ──► write-story ──► implement-story ──► open-pr
 prd.md       epics →        Given/When/     test-first per AC,   PR template,
 FR1..n       stories        Then ACs        gate + review loop   push asks first
                                   adr ◄── records significant decisions along the way
```

| Skill | Produces | Checkpoints |
|---|---|---|
| `write-prd` | `docs/product/<feature>/prd.md` (problem, goals and metrics, FR1..n) | User approves the PRD |
| `story-map` | `story-map.md`: epics → small vertical-slice stories, FR coverage table | User approves the map |
| `write-story` | One story with Gherkin acceptance criteria | Definition of ready |
| `implement-story` | Code, test-first per acceptance criterion; gate, review loop, story marked `done` | Stops and asks if an AC is ambiguous |
| `open-pr` | Conventional PR title, filled template, push | Push needs approval; never merges |
| `adr` | `docs/adr/NNNN-*.md` | Proposed → Accepted by the user |

`pnpm lint:docs` validates every story's structure, so a malformed story fails the gate.

### 3. Reviewer subagents (`.claude/agents/`)
Subagents run in their own context and report back. Fresh context matters: the agent that wrote the code is a poor judge of it. All four reviewers have **no Edit or Write tools**, so they can report problems but can't "fix" them by weakening a test. A harness test enforces that. They run on Sonnet to keep cost down.

| Reviewer | Runs when the diff touches | Focus |
|---|---|---|
| `code-reviewer` | always | Correctness, scope against the story, conventions, ADR conformance, changed or deleted tests, **brevity and clean code** for the next human reader |
| `test-auditor` | a story is being implemented | Maps each acceptance criterion to the test(s) covering it, by behaviour. Would the test fail if the behaviour broke? |
| `security-reviewer` | `apps/`, `packages/shared`, any `package.json` or `pnpm-workspace.yaml` | Input validation, auth, secrets, data exposure, frontend injection, dependencies |
| `infra-reviewer` | `infra/`, or API packaging and deployment | IAM, public exposure, destructive replacement, removal policies, cost |

**The review loop** (defined once, in CLAUDE.md): the routed reviewers run in parallel. Every `blocker` must be fixed, and only the reviewers that blocked re-run, for at most 2 rounds before escalating to a human. `should-fix` and `nit` findings go into the PR's "Review notes". Every reviewer returns the same format (`Verdict: PASS | BLOCKED` plus `[severity] file:line` findings), so findings can be processed mechanically.

### 4. Claude Code hooks (`.claude/hooks/`, registered in `.claude/settings.json`)
These are hooks in Claude Code's agent loop, not git hooks. Their output goes back to the agent, which acts on it. The logic is TypeScript that plain `node` runs directly, with unit tests in the gate.

| Hook | Event | Behaviour |
|---|---|---|
| `guard.ts` | **PreToolUse**, before every edit or command | **Denies** hand-editing `pnpm-lock.yaml`, writing `.env*` files, adding `.skip`/`.only`/`.todo` to test files, bypassing git hooks, and committing or pushing while on `main` |
| `post-edit.ts` | **PostToolUse**, after every edit | Runs Biome on the file, then typechecks the package that owns it. Errors go straight back to the agent (with a note that type errors are expected during the TDD red phase) |
| `stop-gate.ts` | **Stop**, when the agent tries to finish | Runs `pnpm check` if the tree is dirty or the branch is ahead of `main`. **Blocks the first attempt to finish while the gate is red**; on the retry it lets the agent stop, so it reports the failure instead of looping |

Alongside the hooks, [permissions](.claude/settings.json) let agents run `pnpm`, local git commands and `cdk synth`/`diff` freely. They **ask** before `git push`, `gh pr`, `cdk deploy`, `aws` commands and edits to `.claude/` or `.github/`. They **deny** force-pushes, pushes to `main`, `cdk destroy` and reading `.env` files.

### 5. Git hooks (Lefthook)
These cover humans and agents alike, and `pnpm install` installs them.

| Hook | Checks |
|---|---|
| `pre-commit` | Biome on staged files |
| `commit-msg` | commitlint: a Conventional Commit with an allowed scope |
| `pre-push` | `protect-main.sh` rejects any push to `main` (including `HEAD:main`), then `pnpm check` runs |

The `pre-push` hook stands in for GitHub branch protection, which the free plan doesn't enforce on private repos.

### 6. CI, Dependabot and releases (`.github/`)

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | push to any branch except release branches | `pnpm check`, the same gate as local |
| `pr-title.yml` | `pull_request_target` | commitlint on the PR title. With squash merges, the title becomes the commit on `main` |
| `release-please.yml` | push to `main` | Keeps a release PR open (version bump + CHANGELOG). Merging it creates the `vX.Y.Z` tag and a GitHub Release |
| `dependabot.yml` | weekly | Grouped updates: `fix(deps)` for runtime dependencies (patch release), `chore(deps)` for dev dependencies, `ci(deps)` for GitHub Actions |

Every action is **pinned to a commit SHA**, and workflows use least-privilege tokens.

**The type decides the version:**

| Commit type | Release |
|---|---|
| `fix` | patch |
| `feat` | minor |
| `feat!` or a `BREAKING CHANGE:` footer | major (minor while below 1.0.0) |
| `chore`, `ci`, `docs`, `test`, `refactor` | none |

---

## How a change flows

1. **Idea** → `write-prd` → you approve the PRD.
2. `story-map` → you approve the epics and story slices → `write-story` creates stories with Given/When/Then ACs.
3. `implement-story` on a branch. For each AC: **red** (a failing, behaviour-named test) → **green** → **refactor**. The hooks format and typecheck every edit as it happens.
4. **Gate:** `pnpm check`. The Stop hook pushes back if the agent tries to finish while it's red.
5. **Review loop:** the routed reviewers run in parallel and every blocker is fixed. The story is marked `done`.
6. `open-pr`: push (you approve it, and the `pre-push` hook runs the gate again) → PR with a Conventional Commit title.
7. **CI** re-runs the gate and checks the title → **you squash-merge**.
8. release-please updates the release PR → **you merge it when you want to release** → tag, GitHub Release and CHANGELOG.

---

## Conventions

- **TDD, strict gates:** no production code without a test that exercised it first. `pnpm check` green is the definition of done.
- **Tests are named after behaviour** (`it("returns 404 for unknown routes")`), never after stories or tickets. Changing or deleting a test is fine when the behaviour or design changes; say why in the commit.
- **Strict TypeScript:** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and no `any`, `as` casts or `!`. ESM, with `.ts` import extensions.
- **The API contract lives in `packages/shared`** as zod schemas, used by both the API and the web app.
- **Code is written for the next human reader:** brief, intention-revealing names, small functions, no speculative generality, and comments that explain *why*.
- **Trunk-based development:** short-lived branches, small PRs (aim for under 400 lines) and squash merges. Conventional Commits with scopes `web api infra shared tooling harness deps docs release` (`main` is also allowed, for release-please only).

---

## The journey so far

This repo was built iteratively, as a coaching exercise in harness engineering. Each iteration added one layer, then tested it against reality.

| Step | What was built | What we learned |
|---|---|---|
| **0. Scaffold** | pnpm monorepo, strict TS, Biome, Vitest, CLAUDE.md, permissions | A good CLAUDE.md is short: only what an agent would otherwise get wrong. Version clashes (TS 7 vs `vue-tsc`, CDK vs `exactOptionalPropertyTypes`) belong in Gotchas |
| **1. Hooks** | guard / post-edit / stop-gate, Lefthook | Hooks catch their author too: the guard blocked a test command, and the Stop gate caught unformatted hook files. **A guard you haven't seen block something isn't a guard yet** |
| **2. Skills** | PRD → story map → story → implement → PR, ADRs, docs validator | A template is only a suggestion until a check enforces it. Approval checkpoints sit where mistakes are expensive: scope and slicing |
| **3. Subagents** | Four read-only reviewers + the review loop | Restricting tools enforces separation of duties. The clean-code standard went into *both* the author's rules and the reviewer's checks |
| **4. CI** | `pnpm check` on GitHub, Dependabot | We **dropped** an AI PR review in CI: it repeated the local review loop at extra token cost. *Gate where risk enters, not everywhere* |
| **5. Versioning** | commitlint, PR-title check, release-please | Real releases exposed real bugs: a first release proposed as 1.0.0 (missing `initial-version`), release PR titles failing commitlint, Biome rejecting release-please's manifest, and bot PRs waiting for approval (fixed by triggering CI on `push` and title checks on `pull_request_target`) |
| **6. Branch protection** | `pre-push` hook | GitHub doesn't enforce rulesets on free private repos. Lefthook silently skipped the check on already-pushed branches, so the protection moved into a script |
| **7. Reset** | Removed the assumed Hono / Lambda / CloudFront stack (ADR 0005) | Agents copy whatever patterns they find. Unmade decisions shouldn't sit in the code looking like made ones |
| **8. Walking skeleton** | Lambda-shaped health handler, `node:http` dev server, Vue health status (ADR 0006) | `security-reviewer` caught the dev API listening on every network interface; it now binds to loopback |
| **9. Releases** | Plain `vX.Y.Z` tags | Changing the tag format risks release-please losing track of the previous release. `bootstrap-sha` was the safety net while moving to the new format |
| **10. Test naming** | Behaviour-named tests; AC coverage judged by `test-auditor` (ADR 0007) | A name proves nothing about what a test checks. Reviewers mapped every AC to its test from behaviour alone, and found a real gap in the process |

Two process lessons recur throughout. First, **watch every check fail once before trusting it**. Second, **run the review loop before every PR**: skipping it "to save tokens" defeats the harness, so it's now a standing rule.

---

## Known trade-offs

- **Reviewers have `Bash`**, which they need for `git diff`, `cdk diff` and running tests. "Read-only" therefore relies on the prompts plus permissions and hooks, not on a hard sandbox.
- **AC coverage is a review judgement** (ADR 0007), not a deterministic gate. A coverage threshold is the fallback if reviewers ever miss uncovered ACs.
- **Release PRs skip CI and the title check by design.** They only bump the version and CHANGELOG of already-gated commits.
- **CI on `push` tests the branch head**, not the branch merged with `main`. That's fine for short-lived branches; `main` is checked again after every merge.
- **Nothing is deployed yet.** The CDK stack is empty until a story adds resources, and deploying from CI will need OIDC and a token that can start workflows.

---

## Origin

This repo was created from the [dev-project-template-opinionated-harness](https://github.com/cpthirst/dev-project-template-opinionated-harness) template. "The journey so far" above records how that harness was built. The example walking-skeleton story lives in `docs/product/platform/`.

New casting features start with the `write-prd` skill.
