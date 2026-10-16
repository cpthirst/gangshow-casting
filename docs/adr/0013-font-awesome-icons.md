# 0013. Font Awesome for the app's icons

- **Status**: Accepted
- **Date**: 2026-10-16
- **Deciders**: Nick Hirst

## Context

The web app's icons grew one at a time with no library:
- a hand-drawn bin SVG;
- hand-drawn clash shapes (octagon, triangle and circle);
- an inline two-people SVG on the Items list;
- text characters for edit (✎), drag (⠿) and moving rows (↑ ↓ ⇄);
- CSS chevrons (‹ ›).

Drawing one icon was always the smallest change, but the result is a mixed set. A text glyph next to a drawn SVG looks different on every phone, and `ux-reviewer` flagged the mismatch. More icons are coming (casting-rules E3 adds clash icons to the Items list and the Overview), so the app needs one consistent set. The user asked for a library.

## Options considered

1. **Keep drawing our own**: no dependency / we draw and match every icon by hand, and text glyphs stay inconsistent.
2. **Lucide (`lucide-vue-next`)**: one line style, tree-shaken components, no dependencies / considered first, then set aside by the user in favour of Font Awesome.
3. **Font Awesome (`@fortawesome/vue-fontawesome` with `fontawesome-svg-core` and `free-solid-svg-icons`)**: the most widely known set, with a large free solid style. It renders inline SVG through Vue components, imports icons one by one so only those used are bundled, and is `aria-hidden` by default. It has no install scripts. The code is MIT and the icons are CC BY 4.0 (the attribution is carried in the icon files) / three packages, and the free set lacks a few shapes (no octagon).

## Decision

We will use **Font Awesome's free solid icons** through `@fortawesome/vue-fontawesome`.
- **One place to name them:** `apps/web/src/icons.ts` names each icon by its meaning (edit, remove, cast, drag, move, previous and next, and the three clash severities), so every page uses the same icon for the same job.
- **Accessibility unchanged:** icons stay decorative (`aria-hidden`), and buttons keep their accessible names and tooltips.
- **Stylesheet:** Font Awesome's CSS is imported with the app's other styles rather than injected at runtime.
- **Clash shapes:** errors use **square-xmark**, warnings **triangle-exclamation** and info **circle-info**, so each severity keeps its own shape (casting-rules FR11). There is no free octagon.

## Consequences

- **Easier**: adding an icon is one import, and icons match in weight and style across pages.
- **Harder**: three new runtime dependencies to keep updated. Icons outside the free set need a substitute.
- **Bundle size**: unused icons are left out, but Font Awesome's core library is a fixed cost. The app's script grew from 277 kB to 381 kB (92 kB to 119 kB gzipped) for its first 12 icons. Further icons add little. Lucide would have cost a few kB.
- **Revisit if**: the free set lacks an icon we need, or load time on phones at rehearsal becomes a problem.
