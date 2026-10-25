# 0025. Group the web app's source into folders by kind

- **Status**: Accepted
- **Date**: 2026-10-24
- **Deciders**: Nick Hirst

## Context

`apps/web/src` has grown to about 80 files, and all but the pages sit in one flat folder. Shared components such as `HelpButton.vue` sit next to the router, the sign-in code, the show logic (`clashes.ts`, `overview.ts`), the Word builders and the stylesheet. Some components only one page uses (`ItemEditor.vue`, `RoleForm.vue`) live in `pages/`, so `pages/` isn't only pages either. A newcomer can't tell from a file's place what kind of thing it is. That gets worse as Props, SFX and the Mic plot arrive.

[vue-starter](https://github.com/suradet-ps/vue-starter) shows a common Vue layout: `assets`, `components`, `layouts`, `router`, `services`, `stores`, `types`, `utils` and `views`, with tests in a separate `tests/` tree. This isn't strictly an architectural decision, but it changes where every web file lives and how they import each other, so it's recorded here for approval first.

## Options considered

1. **Leave it flat.** No churn, and links in older ADRs keep working. But the folder keeps growing, and nothing tells a reader what a file is.
2. **Copy vue-starter exactly**, including `views/`, `stores/` (Pinia), `types/` and a separate `tests/` tree. This is a familiar layout, but it adds a dependency (Pinia) and empty folders we don't need: `@app/shared` already owns the types. It would also move tests away from their code, which the repo's convention (and the maintainer) rule out.
3. **Take vue-starter's folders where we have something to put in them, and keep tests beside their code** (chosen).

## Decision

We will move every file (with `git mv`, so history follows) into these folders. Each `*.test.ts` and `*.fixture.ts` moves with the file it tests or fakes.

| Folder | Holds | Files today |
|---|---|---|
| `src/` (top) | Start-up and the app shell | `main.ts`, `App.vue`, `env.d.ts`, `no-third-party.test.ts` (it checks `index.html`) |
| `assets/` | Images and the stylesheet | `logo.jpg`, `logo-small.jpg`, `styles.css`, `grid-colours.test.ts` (it checks `styles.css`) |
| `router/` | Routes and the menu's structure | `router.ts` → `router/index.ts` |
| `pages/` | One component per route, and nothing else | the 11 `*Page.vue` files |
| `components/app/` | The sidebar's parts | `MainMenu`, `HealthStatus`, `LocalAccessSwitch` |
| `components/common/` | Used across the app's areas | `HelpButton`, `PageHelp`, `ReadOnlyNotice`, `ClashIcon` |
| `components/show/` | Parts of the SHOW pages | `CastMemberForm`, `ItemEditor` |
| `components/casting/` | Parts of the CASTING pages | `CastingGrid`, `ShowByItem`, `ShowTimeline`, `ItemNotes`, `RoleForm`, `CastMemberPicker` |
| `services/` | Code that calls the API or the browser | `sign-in`, `cognito-sign-in`, `latest-show`, `usage` (recording), `casting-grid-export`, `word-export`, `export-file` |
| `utils/` | Plain show logic, with no calls out | `cast`, `roles`, `running-order`, `clashes`, `overview`, `accounts`, `item-notes`, `help`, `icons`, `usage-report` |
| `utils/word/` | The Word documents' builders | `casting-sheets-document`, `item-overview-document`, `word-styles`, `docx.fixture` |
| `composables/` | Reusable `use…` functions | `useMediaQuery` |
| `directives/` | Vue directives | `sortable-rows` (`vSortableRows`) |

The one file split is `usage.ts`. It both records usage (a service) and formats the Usage page's report (plain logic). Recording stays in `services/usage.ts`, and `dayOf`, `whenOf`, `whatHappened`, `featureName`, `usesOf` and `usageByAccount` move to `utils/usage-report.ts`.

Imports across folders use a `@/` alias for `src/`, as vue-starter does: `import { sortCast } from "@/utils/cast.ts"`, not `../../utils/cast.ts`. Imports within a folder stay relative (`./cast.ts`). The alias goes in `apps/web/tsconfig.json` and `vite.config.ts`, which Vitest shares.

We won't add:
- **`views/`**, keeping `pages/`. The app, its Help and the Usage records all say "page", so renaming to "view" would mean more churn and an extra word for the same thing.
- **`layouts/`**. There's one layout, and `App.vue` is it. A layouts folder can come when a second layout does.
- **`stores/`**. There's no Pinia, and the shared state (sign-in) is a few module-level refs in `services/sign-in.ts`.
- **`types/`**, because `@app/shared` owns the types. The route-meta typing stays with the router.
- **A `tests/` tree**, because tests stay beside their code.

Nothing changes behaviour. The change is one `chore(web)` PR, since moves aren't releases. The same PR updates `CLAUDE.md` (Layout table and the import convention), `README.md` (repository layout), and the paths `ux-reviewer` reads (`.claude/agents/ux-reviewer.md`). Accepted ADRs keep their old links: we don't edit their substance, and the files are still easy to find.

## Consequences

- **Easier**: a file's folder says what it is, and where a new one goes. Props, SFX and the Mic plot get `components/production/`. The show logic in `utils/` is easy to find and test, and so is the code that reaches out, in `services/`.
- **Harder**: every web import changes once, and open branches touching `apps/web/src` will need rebasing. Links in ADRs 0013 and 0015 point to old paths. The PR will be large by line count, though almost all of it is renames.
- **Revisit if**: an area grows enough that grouping by feature (`features/casting/{pages,components,utils}`) reads better than grouping by kind, or shared state outgrows module refs and a store is worth a dependency.
