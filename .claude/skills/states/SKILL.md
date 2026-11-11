---
name: states
description: User-only. Renders every state of one iCUE component or page (loading, empty, error, not found, each permission) on a throwaway page with made-up data and a switcher, in a separate worktree, so the user can see and work on each. Run as /states <component>.
disable-model-invocation: true
---

# States: every state of one component, one click apart

Adapted from `state-machine` in [jakubkrehel/skills](https://github.com/jakubkrehel/skills) (MIT, © 2026 Jakub Krehel; ADR 0040).

A workbench, not a review: it issues no findings and changes no production component. The throwaway route and page it adds exist only in a worktree. Only the user can start it, because only the person working on the visuals knows when the page is wanted and when it's done.

Arguments: one component or page, such as `ItemPageFrame` or the Casting overview grid. If the request spans several, list them and ask which.

## Steps

1. **Scope it.** Say in one sentence what the component shows, where it renders and where its data comes from.
2. **Find the states in the code.** They're the branches the component and its loader already have:
   - **Data:** loading, loaded, empty, one item, a full show (the demo's 20 items and 76 cast), not found, error.
   - **Access:** Admin, each department permission, and none, which is view only.
   - **Show:** no running order yet, an item cut from it, clashes of each kind.

   A state the code can't reach isn't a state: list it as missing rather than adding a branch. Write the list down, named as the app talks about it, and say which kinds you dropped and why.
3. **Work in a worktree.** Use `EnterWorktree`, then `pnpm install`. The harness never touches the user's branch and is never committed. The hooks still apply inside the worktree: the guard's rules hold, and the stop gate runs `pnpm check` there because the worktree is dirty. So keep the throwaway route and page typed and formatted, and fix whatever the gate reports. Never work around it.
4. **Feed each state at its seam, without editing the component**, in this order:
   1. Its props. `ItemPageFrame`'s `load` is one: a promise that never settles holds *loading*, and one that rejects shows *error*.
   2. The demo show. `pnpm demo` serves made-up data on :5190, and the sidebar's "Local role" switch gives each permission.
   3. A stub of the one service the component calls.

   If none of these reaches the component, say so and ask before adding a seam. Use the demo's made-up names and its real counts, never real cast data (CLAUDE.md safeguarding). A loading state holds still until the switcher moves.
5. **Build the page.** A throwaway route in the router and a page under `pages/__states/<name>`, an exception to ADR 0025 that lives only in the worktree. The page imports the real component, inside the app's own layout and styles. Beside it goes a switcher: a grouped list of links that set `?__state=<name>`, deliberately unlike iCUE, so nobody mistakes it for the app. On a phone the list becomes a select above the component.
6. **Look at every state** at 360px and at desktop width. Each shows the made-up data, not a blank region. Then hand over the URL, the state list and anything listed as missing, and stop. Changing how a state looks is the user's next request.
7. **After each visual change**, flip through every state again: a fix for one often breaks another.
8. **Remove it when the user says.** Exit the worktree and remove it. Then check that the user's branch has nothing of `__states` in it.

A design choice found here goes into a story (`write-story`), and `implement-story` builds it test-first in the real code.
