# 0033. The Mic Plot workbook: built in the browser with `write-excel-file`, loaded only when used

- **Status**: Accepted
- **Date**: 2026-11-05
- **Deciders**: Nick Hirst

## Context

The production-mics PRD (FR14, FR16) adds **Generate Mic Plot** to the Overview, beside Generate Props List: an Excel workbook of the whole show's mic plot, laid out like the one the sound desk already prints. Every signed-in team member may generate it, whatever their role. It holds children's names, so each file is a copy outside the app's access control, as every export is (ADR 0019, ADR 0022).

The app already makes files two ways:
- the casting grid's Excel file on the server, with `write-excel-file`, behind a `POST` route that the read-only rule names as its one exception (ADR 0019, ADR 0021);
- the Word exports in the browser, with `docx` loaded only when a button is pressed (ADR 0022).

`write-excel-file` (MIT, one dependency, `fflate`) has a browser build. It writes everything the workbook needs: bold text, centred cells, thin borders, fills, merged cells, column widths, and A4 portrait page setup.

## Options considered

1. **Build it in the browser with `write-excel-file`, loaded on demand, as the Word exports are**:
   - Pros: no new route, so no second exception to the read-only rule; nothing added to the Lambda bundle; the page fetches the latest running order, casting, mics and notes itself, as Generate Props List does; one way to make a file for every new export.
   - Cons: a second copy of `write-excel-file`'s code, in the web app; Excel is then made in two places until the casting grid moves too.
2. **Build it on the server, as the casting grid is**: the page sends the plot to a new `POST` route.
   - Pros: one place for Excel files.
   - Cons: another route the read-only rule must name as an exception, a strict schema for content the page already holds, and nothing gained, because no role is refused.
3. **Write the `.xlsx` XML ourselves with `fflate`**: no library, but we would own the file format (styles, shared strings, merges, page setup).

## Decision

We will use option 1.

- **Library**: `write-excel-file`, added to `apps/web` at the version the API already uses (`write-excel-file/browser`). It makes no network calls.
- **Loaded only when used**: the page imports the workbook code with a dynamic `import()` when Generate Mic Plot is pressed, so Vite puts it in its own chunk (about 72 kB minified, 20 kB gzipped, measured when added) and the first page load is unchanged.
- **Who may generate it**: every signed-in team member, as for the Props List. The data is what the signed-in API already gives them.
- **What the file may hold**: the production's id (its year); each item's title in running order under ACT 1 and ACT 2; each channel's cast member (first name and surname) and their roles' names in the item; and each item's Mic plot notes. Never anything else about the cast (ADR 0010, ADR 0014). Text goes in as plain text, never a formula.
- **Shape of the code**: one plain function gathers the show's mic plot, and another lays it out as the workbook; tests read the file's XML back. `write-excel-file` only sets up landscape pages, so the workbook adds A4 portrait, fitted to one page wide, through the library's own plug-in hook (a "feature").
- **The casting grid**: the maintainer wants its Excel export moved to the web app too, so there's one pattern. That is a separate story; until then ADR 0019 and ADR 0021 stand.

## Consequences

- **Easier**: no API, infrastructure or permission change; the workbook is a tested function of the saved show; the read-only rule keeps its single exception.
- **Harder**: `write-excel-file` is in both the API and the web app, and must be kept at one version in both; a reader has to know Excel is made in two places until the casting grid moves.
- **Revisit if**: the workbook must be refused to some role; the lazy chunk or the build on an old phone becomes noticeably slow; `write-excel-file` stops being maintained or can't produce a layout the sound desk needs.
