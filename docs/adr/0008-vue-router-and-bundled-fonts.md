# 0008. Client-side routing with Vue Router, and bundled web fonts

- **Status**: Accepted
- **Date**: 2026-10-10
- **Deciders**: Nick Hirst

## Context

The app shell (app-shell.E1.S1) needs a page for each menu item. Each page needs its own URL, so that refresh, back and forward, and bookmarks work (PRD FR3). It also needs the Scouts brand typeface, Nunito Sans (FR8). Most of the cast are under 18, and the PRD rules out third-party requests, so visitor IP addresses don't go to outside providers (UK GDPR). ADR 0005 says new dependencies arrive with a story and an ADR.

## Options considered

1. **Vue Router, with HTML5 history URLs** (`/cast`): the official Vue router, and what Vue developers expect. It provides links that mark the active page, history handling and lazy-loaded pages. It adds one runtime dependency. A future host must fall back to `index.html` for unknown paths, otherwise a refresh returns 404.
2. **Vue Router, with hash URLs** (`/#/cast`): works on any static host with no fallback. The URLs are uglier and harder to read aloud or share.
3. **A hand-rolled router** (`popstate` plus a component map): no dependency. We'd be re-implementing active links, history and focus handling, and testing them ourselves.
4. **Fonts from the Google Fonts CDN**: simplest, but every visit sends the viewer's IP address to Google.
5. **Fonts bundled with `@fontsource-variable/nunito-sans`**: the font files ship inside the app and are served from our own origin. Adds one small runtime dependency.

## Decision

We will use **Vue Router with HTML5 history URLs** (option 1) and **bundle Nunito Sans with `@fontsource-variable/nunito-sans`** (option 5). The app loads nothing from third-party origins.

## Consequences

- **Easier**: adding a page means a route entry and a component. The menu's current-page marker comes from the router. Pages are linkable.
- **Harder**: the hosting decision must include an SPA fallback, rewriting unknown paths to `index.html`. Vite's dev server already does this.
- **Revisit if**: the chosen host can't rewrite to `index.html` (then switch to hash URLs), or the font's licence or weight becomes a problem.
