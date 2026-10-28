# 0028. Group the API's source into folders by area

- **Status**: Accepted
- **Date**: 2026-10-28
- **Deciders**: Nick Hirst

## Context

`apps/api/src` is one flat folder of 135 files. Each file does one thing, but nothing groups them: `add-prop.ts` sits beside `admin-account.ts`, and a store's file and database versions (`prop-store.ts`, `dynamo-prop-store.ts`) are alphabetically apart. A reader can't see which handlers belong to Props, what the shared HTTP plumbing is, or which files are command-line tools. Props, SFX and the Mic plot will each add another handful.

ADR 0025 grouped the web's source by kind, with its components split by area (`show`, `casting`, `production`) and its tests beside its code. The API has no components, pages or services to group by kind: nearly every file is a handler, a store or a rule about one part of the show. Grouping those by the part of the show they serve, and keeping each store's interface, both its versions and its contract tests together, is the common domain-driven ("vertical slice") layout for a service of this size.

## Options considered

1. **Leave it flat.** No churn, and older ADRs' links keep working. But the folder keeps growing, and a file's place says nothing about it.
2. **Group by kind**, as the web does (`handlers/`, `stores/`, `rules/`). Familiar from the web, but Props would be spread across three folders, and every change to it touches all three.
3. **One folder per area, flat at the top** (`cast/`, `roles/`, `props/` …). Shallow, but it doesn't follow the web's show, casting and production split, so the two halves of the app read differently.
4. **One folder per area, nested in the web's areas** (chosen). The API reads like the app's sidebar: a reader who knows where the Props page lives knows where its routes live.

## Decision

We will move every file with `git mv`, keeping its name, so history and search by file name both still work. Each `*.test.ts`, `*.dynamo.test.ts`, `*.contract.ts` and `*.fixture.ts` moves with the file it tests or fakes.

| Folder | Holds | Files today |
|---|---|---|
| `src/` (top) | The entry points and the route table | `routes`, `lambda`, `accounts-lambda`, `dev-server`, `health`, `test-isolation.test` |
| `http/` | Requests and responses, shared by every route | `handler`, `json`, `params`, `match-route`, `caller`, `admin-only`, `lambda-entry` |
| `storage/` | Where data is kept, shared by every store | `data-stores`, `dynamo-table`, `files`, `private-file`, `dynamo.fixture` |
| `show/running-order/` | The running order | `get-`/`save-running-order`, `running-order-changes`, both stores |
| `show/cast/` | The cast list | `get-cast`, `add-`/`update-`/`delete-cast-member`, `cast-members`, both cast stores, both `remove-cast-member`s |
| `casting/roles/` | Who is in which item | `get-roles`, `add-`/`update-`/`remove-role`, both stores |
| `casting/casting-grid/` | The Excel export (ADR 0019) | `export-casting-grid`, `xlsx.fixture` |
| `production/props/` | Props and their carriers | `get-props`, `add-`/`update-`/`remove-prop`, `prop-links`, both stores |
| `item-notes/` | Notes per item, which casting and props each keep | `get-item-notes`, `save-item-note`, both stores |
| `accounts/` | The team's accounts (ADR 0018) | the five account handlers, `account-routes`, `find-account`, `password`, `user-directory`, `cognito-user-directory`, `local-accounts`, `account.fixture` |
| `usage/` | Usage records (ADR 0023) | `usage-routes`, both stores |
| `cli/` | The maintainer's commands | `account-cli`, `admin-account`, `hosted-check`, `cognito-sign-in` |

As in the web, a folder used by more than one area (`item-notes`, `http`, `storage`) sits outside the areas. The entry points stay at the top, so infra's bundling, `pnpm demo` and the browser tests' server keep their paths. The `account` and `check:hosted` scripts point into `cli/`.

Imports across folders use a `#/` alias for `src/`, declared in `apps/api/package.json`'s `imports` field: `import { parseJson } from "#/http/json.ts"`. Imports within a folder stay relative (`./cast-store.ts`). This is the web's `@/` rule. It has to be a package import, not a tsconfig path, because Node runs the API's source directly; Node, TypeScript, Vitest and esbuild all read it with no extra setup.

The change is renames and import lines only, in one `chore(api)` PR. It updates `CLAUDE.md` (Layout and the import rule), `README.md`, and infra's comments that name API files. Accepted ADRs keep their old links, as in ADR 0025. Tidying the code inside the files comes in a later `refactor(api)` PR.

## Consequences

- **Easier**: a file's folder says which part of the show it serves, and where a new one goes. Props, SFX and the Mic plot each get a folder under `production/`. A store's interface, its two versions and the contract both must meet sit side by side.
- **Harder**: every API import changes once, and open branches touching `apps/api/src` need rebasing. ADRs 0006, 0015 and 0017 link to old paths. A folder two levels down (`production/props/`) is one more click than a flat one. The PR is large by line count, though almost all of it is renames.
- **Revisit if**: an area outgrows one folder, or a part of the API stops matching a web area, as `item-notes` already doesn't, and more follow it.
