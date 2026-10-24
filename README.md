# iCUE

**iCUE** is the **Chester Gang Show**'s online show management app. It helps the show's departments co-ordinate, with one consistent system of record that everyone works from instead of documents and spreadsheets passed around.

Today iCUE covers **casting**: the production team uses it to plan the running order, keep the cast list, and record who is in which item, and when. It helps them spot clashes (such as back-to-back appearances with no time for a costume change) and see who is overused or underused, so stage time is spread fairly.

Next, iCUE will grow to cover more of the show's departments, such as **props lists**, **sound effects for each item** and **mic plots**. Each arrives as its own feature, planned and built story by story (see [How a change flows](#how-a-change-flows)).

Chester Gang Show is a volunteer-led Scouting variety show: comedy, music, dance, sketches and production numbers, created and performed by the local Scouting community for a family audience. The current production is the **70th anniversary show**.

---

## Contents

- [What iCUE does today](#what-icue-does-today)
- [The domain](#the-domain)
- [How it's built](#how-its-built)
- [Getting started](#getting-started)
- [Repository layout](#repository-layout)
- [The harness](#the-harness)
- [How a change flows](#how-a-change-flows)
- [Conventions](#conventions)
- [Decisions](#decisions)
- [The journey so far](#the-journey-so-far)
- [Known trade-offs](#known-trade-offs)

---

## What iCUE does today

iCUE is hosted on AWS and is open only to the production team. Everyone signs in with an account an admin gives them. Each page has a help button, and the Help page brings all the help together. The menu has three areas: **Show**, **Production** and **Casting**.

| Page | What it's for | Product docs |
|---|---|---|
| **Show → Running order** | The show's items in performance order, in two halves, with timings, stage and notes. Drag to reorder, then save a new version, so everyone knows which order is current. Items left out of the printed programme still take stage time | [running-order](docs/product/running-order) |
| **Show → Cast** | The Scouts, Explorers and Network members in this production: name, section, Scout group or Explorer unit, age band, and short Singing and Acting notes. Search and filter, add, edit and remove | [cast-management](docs/product/cast-management) |
| **Casting → Overview** | The whole cast at once, three ways: **By person** (who carries how many parts, and of what size, section by section), **By item** (each item's parts in show order) and **Grid** (people against items). Clashes are flagged. Export the grid to Excel and the other two views to Word | [casting/overview](docs/product/casting/overview) |
| **Casting → Items** | Every item in running order, with how far its casting has got | [casting/items](docs/product/casting/items) |
| **Production → Mic plot, Props, Scenery, SFX** | Placeholders that say "Coming soon", open to every role, until each is built as its own feature | none yet |
| **An item's page** | The item's parts (lead, supporting, cameo, ensemble), who plays each, warnings about quick changes and short gaps between appearances, and the item's notes. Step to the previous or next item | [casting/item-overview](docs/product/casting/item-overview), [roles](docs/product/casting/roles), [rules](docs/product/casting/rules) |
| **Help** | What each page is for and what its buttons do, with who can use each | [in-app-help](docs/product/in-app-help) |
| **Accounts** (admins) | Create the team's sign-in accounts, choose each one's role, reset passwords, and disable or enable accounts | [hosting](docs/product/hosting), [team-roles](docs/product/team-roles) |
| **Usage** (admins) | Who on the team uses iCUE and how often, so admins can see who might need help getting started | [usage-tracking](docs/product/usage-tracking) |

**Team roles** ([team-roles](docs/product/team-roles)):
- **Admin:** everything, plus Accounts and Usage.
- **Casting Team Member:** changes the running order, cast and casting.
- **Read-Only Team Member:** sees every page but changes nothing, which suits reviewers such as the director.

The API checks the role on every request, not just the menu.

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

Most of the cast are under 18 and this is a Scouting activity, so iCUE is built with **youth safeguarding and UK GDPR** in mind:
- **Cast data:** iCUE stores only what casting needs. That's first name, surname, section, Scout group or Explorer unit and age band ([ADR 0010](docs/adr/0010-cast-member-personal-data.md)), plus short Singing and Acting notes ([ADR 0014](docs/adr/0014-cast-singing-and-acting-notes.md)). It stores no dates of birth, addresses, contact details, photos or medical information unless there is a clear, agreed need, recorded in an ADR.
- **Age:** iCUE uses age band or section, not exact age.
- **Access:** only the production team can sign in, and casting data is never publicly reachable ([ADR 0018](docs/adr/0018-access-control-with-cognito.md)).
- **Data about the team:** each account's username, and a record of each person's use of the app, kept for 90 days and visible only to admins ([ADR 0023](docs/adr/0023-usage-records-in-the-data-table.md)).
- **Test data:** tests, fixtures and the demo use made-up names only.

---

## How it's built

A TypeScript monorepo, hosted on AWS in eu-west-2 ([ADR 0017](docs/adr/0017-hosting-on-lambda-and-cloudfront.md)):
- **Web:** a Vue 3 single-page app ([ADR 0008](docs/adr/0008-vue-router-and-bundled-fonts.md)), served from a private S3 bucket through CloudFront.
- **API:** framework-free handlers in the AWS Lambda / API Gateway shape ([ADR 0006](docs/adr/0006-vanilla-lambda-shaped-api-handlers.md)), run on Lambda behind an API Gateway HTTP API. The same handlers run locally under a small `node:http` server.
- **Data:** one DynamoDB table, with each production in its own partition ([ADR 0015](docs/adr/0015-dynamodb-for-production-data.md)).
- **Sign-in:** a Cognito user pool. Every API route needs its token, and team roles are user pool groups ([ADR 0018](docs/adr/0018-access-control-with-cognito.md), [ADR 0020](docs/adr/0020-team-roles-as-user-pool-groups.md)).
- **Infrastructure:** one AWS CDK stack. The maintainer deploys it from their own machine; CI never deploys.

The API contract is defined once, as zod schemas in `packages/shared`, and both the API and the web app use it.

---

## Getting started

```bash
pnpm install   # Node 26, pnpm 12 (also installs the git hooks)
pnpm demo      # iCUE on a made-up demo show (:5190), fresh each start: needs no AWS
pnpm dev       # web on :5173 + API on :3000 (Vite proxies /api), on the real remote table: needs your AWS profile
pnpm check     # lint + typecheck + tests + cdk synth: the definition of "done"
```

`pnpm dev` and `pnpm demo` start you as an admin, and the sidebar's "Local role" switch lets you try the other roles.

**Guides:**
- **The real data:** [the remote database guide](docs/guides/remote-data.md) covers setting up `pnpm dev` against it.
- **Running the hosted app:** [the hosting guide](docs/guides/hosting.md) covers deploying, handing out accounts, releasing with `pnpm release`, rolling back, and the post-deploy check.

**Other test suites:**
- `pnpm test:e2e`: the browser layout tests, which check every page at phone widths.
- `pnpm test:dynamo`: the database tests, against DynamoDB Local.

CI runs both of these as separate jobs.

---

## Repository layout

```
.
├── apps/
│   ├── web/                 Vue 3 + Vite SPA; Playwright layout tests in e2e/
│   │   └── src/                 By kind (ADR 0025); tests sit beside their code
│   │       ├── pages/               One component per route
│   │       ├── components/          app/ (sidebar), common/, show/, casting/
│   │       ├── services/            Calls to the API or the browser: sign-in, usage, exports
│   │       ├── utils/               Plain show logic: cast, roles, running order, clashes; word/
│   │       ├── router/              Routes and the menu
│   │       └── assets/              Logos and styles.css
│   └── api/                 Framework-free API: Lambda-shaped handlers (ADR 0006)
│       └── src/
│           ├── routes.ts        "<METHOD> <path>" → handler table
│           ├── dev-server.ts    node:http stand-in for API Gateway, loopback only
│           └── *-store.ts       In-memory and DynamoDB stores, one contract each
├── packages/shared/         zod schemas + inferred types: the API contract
├── infra/                   AWS CDK app: one AppStack (pages, API, functions, table, user pool, budget)
├── tooling/                 Repo scripts: demo.ts, release.ts + harness tests
├── docs/
│   ├── adr/                 Architecture decision records (see Decisions)
│   ├── guides/              Running the hosted app; moving to the remote database
│   └── product/<feature>/   PRD, story map and stories written by the planning skills
├── .claude/
│   ├── settings.json        Permissions (allow / ask / deny) + hook registration
│   ├── hooks/               guard, post-edit and stop-gate hooks (TypeScript; logic unit-tested)
│   ├── skills/              Delivery workflows: write-prd … open-pr, adr, batch-stories
│   └── agents/              Reviewer subagents: code, test, security, infra, UX
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

Frameworks, hosting choices and AWS resources each arrive through a story and an ADR, never by default.

---

## The harness

iCUE is built almost entirely by coding agents ([Claude Code](https://claude.com/claude-code)), inside a **layered harness**: instructions, skills, reviewers, hooks and pipelines that let agents work autonomously without quality slipping.

The design principle (ADR 0002): **instructions advise, hooks enforce, reviewers judge, and CI is the final authority.** No single layer has to be perfect, because each one backs up the one before it.

| Layer | Runs | What it does | Can it be skipped? |
|---|---|---|---|
| `CLAUDE.md` + ADRs | every session | Commands, workflow, conventions, autonomy limits, decision history | Yes (advisory) |
| Skills | on demand | Repeatable procedures with approval checkpoints and templates | Yes (advisory) |
| Permissions | every tool call | Allow, ask or deny specific commands and files | No |
| Claude Code hooks | before and after every action, and on finish | Block risky actions, give instant feedback, push back on "done" while the gate is red | No (for agents) |
| Reviewer subagents | before every PR | Independent, read-only review: code, tests, security, infra, UX | Yes (standing rule to run them) |
| Git hooks (Lefthook) | commit and push | Format, commit-message rules, no pushes to `main`, gate before push | Only deliberately |
| CI + GitHub ruleset | every push and PR | The same gate on GitHub's machines, plus browser, database and PR-title checks; `main` takes only PRs that pass them | No |

### 1. Instructions: `CLAUDE.md` and ADRs
[CLAUDE.md](CLAUDE.md) is loaded into every agent session, so it stays short and holds only what an agent would otherwise get wrong:
- the domain rules, including safeguarding;
- the commands, the TDD loop and the definition of done;
- the git rules;
- what agents may do alone, what needs asking, and what is never allowed;
- the review loop, and a list of gotchas.

[docs/adr](docs/adr) records *why* things are the way they are, so agents don't "fix" deliberate choices (see [Decisions](#decisions)).

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
| `batch-stories` | One feature's stories on one branch, with a single PR at the end | Only the user can switch it on; it restores the harness afterwards |

### 3. Reviewer subagents (`.claude/agents/`)
Subagents run in their own context and report back. Fresh context matters: the agent that wrote the code is a poor judge of it. The reviewers have **no Edit or Write tools**, so they can report problems but can't "fix" them by weakening a test, and a harness test enforces that. They run on smaller models to keep cost down.

| Reviewer | Runs when the diff touches | Focus |
|---|---|---|
| `code-reviewer` | always | Correctness, scope against the story, conventions, ADR conformance, changed or deleted tests, **brevity and clean code** for the next human reader |
| `test-auditor` | a story is being implemented | Maps each acceptance criterion to the test(s) covering it, by behaviour. Would the test fail if the behaviour broke? |
| `security-reviewer` | the API, the shared contract, web code touching sign-in, tokens, storage or URLs, or dependencies | Input validation, auth, secrets, data exposure, frontend injection, dependencies |
| `infra-reviewer` | `infra/`, the release script, or how the API is packaged or deployed | IAM, public exposure, destructive replacement, removal policies, cost |
| `ux-reviewer` | `apps/web` | UI and UX consistency across the whole app (ADR 0012). **Advisory**: the user decides what to fix |

**The review loop** (defined once, in CLAUDE.md):
- **Who runs:** the routed reviewers run in parallel.
- **Blockers:** every `blocker` must be fixed. Only the reviewers that blocked re-run, for at most 2 rounds before escalating to a human.
- **Other findings:** `should-fix` and `nit` findings go into the PR's "Review notes". The user chooses what to do with each UX finding.
- **When it's skipped:** documentation stories, and changes to `.md` files only, skip the loop and need no tests.

### 4. Claude Code hooks (`.claude/hooks/`, registered in `.claude/settings.json`)
These are hooks in Claude Code's agent loop, not git hooks. Their output goes back to the agent, which acts on it. The logic is TypeScript that plain `node` runs directly, with unit tests in the gate.

| Hook | Event | Behaviour |
|---|---|---|
| `guard.ts` | **PreToolUse**, before every edit or command | **Denies** hand-editing `pnpm-lock.yaml`, writing `.env*` files, adding `.skip`/`.only`/`.todo` to test files, bypassing git hooks, and committing or pushing while on `main` |
| `post-edit.ts` | **PostToolUse**, after every edit | Runs Biome on the file, then typechecks the package that owns it. Errors go straight back to the agent (with a note that type errors are expected during the TDD red phase) |
| `stop-gate.ts` | **Stop**, when the agent tries to finish | Runs `pnpm check` if the tree is dirty or the branch is ahead of `main`. **Blocks the first attempt to finish while the gate is red**; on the retry it lets the agent stop, so it reports the failure instead of looping |

**Permissions** ([settings](.claude/settings.json)):
- **Allowed freely:** `pnpm`, local git commands, and `cdk synth` or `cdk diff`.
- **Asked first:** `git push`, `gh pr`, deploys and releases, `aws` commands, and edits to `.claude/` or `.github/`.
- **Denied:** force-pushes, pushes to `main`, `cdk destroy`, and reading `.env` files.

### 5. Git hooks (Lefthook)
These cover humans and agents alike, and `pnpm install` installs them.

| Hook | Checks |
|---|---|
| `pre-commit` | Biome on staged files |
| `commit-msg` | commitlint: a Conventional Commit with an allowed scope |
| `pre-push` | `protect-main.sh` rejects any push to `main` (including `HEAD:main`), then `pnpm check` runs |

### 6. CI, branch protection, Dependabot and releases (`.github/`)

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | push to any branch except release branches | `check` (`pnpm check`, the same gate as local), `browser` (the layout tests) and `database` (the DynamoDB tests) |
| `pr-title.yml` | `pull_request_target` | `commitlint` on the PR title. With squash merges, the title becomes the commit on `main` |
| `release-please.yml` | push to `main` | Keeps a release PR open (version bump + CHANGELOG). Merging it creates the `vX.Y.Z` tag and a GitHub Release |
| `dependabot.yml` | weekly | Grouped updates: `fix(deps)` for runtime dependencies (patch release), `chore(deps)` for dev dependencies, `ci(deps)` for GitHub Actions |

**Branch protection:** a GitHub ruleset protects `main` (the repo is public, so rulesets are free).
- **What gets in:** changes arrive only through PRs that pass all four checks.
- **How they merge:** merges are squash-only.
- **What's blocked:** force-pushes and deletion.

**Workflow security:** every action is **pinned to a commit SHA**, and workflows use least-privilege tokens.

**Releases:** merging the release PR doesn't deploy anything. The maintainer runs `pnpm release`, which merges the release PR, waits for its tag, then diffs and deploys that tag from their own machine. It refuses a diff that would replace the table or the user pool.

**The type decides the version:**

| Commit type | Release |
|---|---|
| `fix` | patch |
| `feat` | minor |
| `feat!` or a `BREAKING CHANGE:` footer | major |
| `chore`, `ci`, `docs`, `test`, `refactor` | none |

---

## How a change flows

1. **Idea** → `write-prd` → you approve the PRD.
2. `story-map` → you approve the epics and story slices → `write-story` creates stories with Given/When/Then ACs.
3. `implement-story` on a branch. For each AC: **red** (a failing, behaviour-named test) → **green** → **refactor**. The hooks format and typecheck every edit as it happens.
4. **Gate:** `pnpm check`. The Stop hook pushes back if the agent tries to finish while it's red.
5. **Review loop:** the routed reviewers run in parallel, and every blocker is fixed. You decide on the UX findings. The story is marked `done`.
6. `open-pr`: push (you approve it, and the `pre-push` hook runs the gate again) → PR with a Conventional Commit title.
7. **CI** re-runs the gate, the browser and database tests and the title check → **you squash-merge**.
8. release-please updates the release PR → **`pnpm release` when you want to ship**: tag, GitHub Release, CHANGELOG and deploy.

---

## Conventions

- **TDD, strict gates:** no production code without a test that exercised it first. `pnpm check` green is the definition of done.
- **Tests are named after behaviour** (`it("returns 404 for unknown routes")`), never after stories or tickets. Changing or deleting a test is fine when the behaviour or design changes; say why in the commit.
- **Strict TypeScript:** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and no `any`, `as` casts or `!`. ESM, with `.ts` import extensions.
- **The API contract lives in `packages/shared`** as zod schemas, used by both the API and the web app.
- **Code is written for the next human reader:** brief, intention-revealing names, small functions, no speculative generality, and comments that explain *why*.
- **Trunk-based development:** short-lived branches, small PRs (aim for under 400 lines, not counting `.md` files) and squash merges. Conventional Commits with scopes `web api infra shared tooling harness deps docs release` (`main` is also allowed, for release-please only).

---

## Decisions

| ADR | Decision |
|---|---|
| [0001](docs/adr/0001-record-architecture-decisions.md) | Record architecture decisions |
| [0002](docs/adr/0002-layered-agent-harness.md) | Layered agent harness |
| [0003](docs/adr/0003-independent-subagent-review.md) | Independent subagent review before done |
| [0004](docs/adr/0004-versioning-with-release-please.md) | Versioning with Conventional Commits and release-please |
| [0005](docs/adr/0005-framework-free-sandbox-scaffold.md) | Framework-free sandbox scaffold |
| [0006](docs/adr/0006-vanilla-lambda-shaped-api-handlers.md) | Vanilla, Lambda-shaped API handlers |
| [0007](docs/adr/0007-behaviour-named-tests-coverage-at-review.md) | Behaviour-named tests; AC coverage checked at review |
| [0008](docs/adr/0008-vue-router-and-bundled-fonts.md) | Client-side routing with Vue Router, and bundled web fonts |
| [0009](docs/adr/0009-drag-and-drop-with-sortablejs.md) | Drag and drop with SortableJS, used directly |
| [0010](docs/adr/0010-cast-member-personal-data.md) | Cast member personal data: full surname and Scout group |
| [0011](docs/adr/0011-browser-layout-tests-in-ci.md) | Browser layout tests with Playwright, in CI |
| [0012](docs/adr/0012-advisory-ux-reviewer.md) | An advisory UI and UX consistency reviewer |
| [0013](docs/adr/0013-font-awesome-icons.md) | Font Awesome for the app's icons |
| [0014](docs/adr/0014-cast-singing-and-acting-notes.md) | Short Singing and Acting notes on cast members |
| [0015](docs/adr/0015-dynamodb-for-production-data.md) | DynamoDB for production data |
| [0016](docs/adr/0016-database-tests-against-an-emulator-in-ci.md) | Database tests against an emulator, in CI |
| [0017](docs/adr/0017-hosting-on-lambda-and-cloudfront.md) | Hosting on Lambda, API Gateway and CloudFront |
| [0018](docs/adr/0018-access-control-with-cognito.md) | Access control with Cognito: assigned usernames and an admin group |
| [0019](docs/adr/0019-server-built-excel-export-for-admins.md) | The casting grid's Excel export: made by the server for admins, from the grid they send |
| [0020](docs/adr/0020-team-roles-as-user-pool-groups.md) | Team roles as user pool groups, with read-only as the fail-safe |
| [0021](docs/adr/0021-excel-export-for-every-team-role.md) | The casting grid's Excel export for every team role |
| [0022](docs/adr/0022-word-exports-built-in-the-browser.md) | The Word exports: built in the browser with `docx`, loaded only when used |
| [0023](docs/adr/0023-usage-records-in-the-data-table.md) | Usage records in the data table, recorded through our own API |
| [0024](docs/adr/0024-limit-usage-recording-and-count-sign-ins.md) | Usage recording limited at API Gateway, and a session counted per sign-in |
| [0025](docs/adr/0025-web-source-folders.md) | The web app's source grouped into folders by kind, with a `@/` import alias |

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
| **11. The app** | Running order, cast, casting, clashes, exports, hosting, sign-in, team roles, help and usage, story by story (ADRs 0008–0023) | Each new kind of risk earned its own check: browser layout tests for phones (0011), an advisory UX reviewer (0012), database tests against an emulator (0016), and an infra reviewer before anything deploys |

Two process lessons recur throughout. First, **watch every check fail once before trusting it**. Second, **run the review loop before every PR**: skipping it "to save tokens" defeats the harness, so it's now a standing rule.

---

## Known trade-offs

- **Reviewers have `Bash`**, which they need for `git diff`, `cdk diff` and running tests. "Read-only" therefore relies on the prompts plus permissions and hooks, not on a hard sandbox.
- **AC coverage is a review judgement** (ADR 0007), not a deterministic gate. A coverage threshold is the fallback if reviewers ever miss uncovered ACs.
- **Release PRs skip CI and the title check by design.** They only bump the version and CHANGELOG of already-gated commits, and admins bypass the ruleset to merge them.
- **CI on `push` tests the branch head**, not the branch merged with `main`. That's fine for short-lived branches; `main` is checked again after every merge.
- **Deploys are manual**, from the maintainer's machine with their own AWS profile. Deploying from CI would need OIDC and a deploy role, and isn't wanted yet.

---

## Origin

This repo was created from the [dev-project-template-opinionated-harness](https://github.com/cpthirst/dev-project-template-opinionated-harness) template. "The journey so far" records how that harness was built and how the app grew on it. The first walking-skeleton story lives in `docs/product/platform/`.

New features, such as props lists, sound effects or mic plots, start with the `write-prd` skill.

## Credits

The web app's icons are from [Font Awesome Free](https://fontawesome.com) by Fonticons, Inc., licensed under [CC BY 4.0](https://fontawesome.com/license/free) (icons) and MIT (code). See ADR 0013.
