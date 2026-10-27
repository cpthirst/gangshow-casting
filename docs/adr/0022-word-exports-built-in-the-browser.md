# 0022. The Word exports: built in the browser with `docx`, loaded only when used

- **Status**: Accepted
- **Date**: 2026-10-19
- **Deciders**: Nick Hirst

## Context

The casting-overview-by-item PRD (FR7–FR15) adds two Word downloads, both for every team role:
- **Export Item Overview**, on the By item view: the show's casting as headed sections with a roles table under each item.
- **Export Casting Sheets**, on the By person view: one page per cast member, with a table of the printed items and a tick where they're cast.

The maintainer chose the `docx` library (github.com/dolanmiu/docx). Each file is a copy of children's names outside the app's access control, as the Excel export already is (ADR 0019, ADR 0021).

ADR 0019 built the Excel file on the server for one reason: the export was admin-only, and only the server can enforce that. ADR 0021 then opened that export to every role. It did so through a `POST` route that the read-only rule names as its one exception: a route that changes nothing. These Word exports are for every role from the start, so nothing needs a server to enforce who may export.

`docx` 9.x is MIT-licensed and released often. It runs in Node and in the browser (`Packer.toBlob`). It depends on `jszip`, `xml`, `xml-js`, `nanoid` and `hash.js`. It also lists `@types/node` as a runtime dependency, which is types only and never bundled. It's about 20 MB unpacked, mostly type definitions and source maps.

## Options considered

1. **Build the files in the browser from what the page already shows**:
   - Pros:
     - No new route, so no second exception to "only a `GET` is a read" (ADR 0021).
     - No change to the Lambda bundle or its cold start (ADR 0017).
     - The By item view (`showByItem`) and the By person view's section order already hold exactly what each document shows, so the file matches the screen with no second copy of the rules.
     - The data never leaves the browser, except as the downloaded file.
   - Cons:
     - `docx` adds weight to the web app.
     - The Excel export is built on the server, so the app has two ways to make a file.
2. **Build them on the server, as for Excel**: the page sends the document's content to new `POST` routes, and the server turns it into a file.
   - Pros: one pattern for every export.
   - Cons:
     - Two more routes the read-only rule has to name as exceptions.
     - `docx` and its dependencies in the API bundle.
     - A binary response.
     - A strict schema per document, for content the page already holds.
     - None of this buys anything, because no role is refused.
3. **Write the `.docx` XML ourselves** (with `fflate`, in either place):
   - Pros: no new library.
   - Cons: we would own and test hundreds of lines of WordprocessingML (styles, numbering, tables, page breaks), which is what the maintainer chose `docx` to avoid.

## Decision

We will use option 1.

- **Library**: `docx`, added to `apps/web` only, pinned to an exact version at least two weeks old when it's added (9.8.1, released 2026-09-28). The version is pinned because the package releases often and its documents should only change when we choose. It makes no network calls.
- **Loaded only when used**: the page imports the document-building code with a dynamic `import()` when an export button is pressed. Vite puts it in its own chunk, served from our origin with the rest of the app.
  - Measured before adding it, `docx` 9.8.1 bundles to about 396 kB minified, 116 kB gzipped. That's nearly the size of today's whole app (488 kB, 148 kB gzipped), so it must not go in the main chunk.
  - Loaded on demand, the first page load stays the same size. CloudFront serves the chunk like any other static file, and the no-third-party test still holds.
- **Who may export**: every signed-in team member, whatever their role, as for Excel (ADR 0021). There's no API route to refuse anyone. The data is what the page has already loaded through the signed-in API.
- **What the files may hold**:
  - Item Overview: the production's title; each half's name; each item's title, programme number and whether it's printed; and each role's name, size and cast (first name and surname).
  - Casting Sheets: the production's title; each cast member's first name, surname, section and Scout group or Explorer unit; the printed items' titles and numbers; and a tick where they're cast.
  - Never age band, Singing or Acting notes, or anything else about the cast (ADR 0010, ADR 0014).
  - Text goes into the documents as plain text runs, never as fields or HTML.
- **Shape of the code**: one plain function per document turns the view's data into a `docx` document. The page saves the result as a file, named for the production and the date, as the Excel file is. Tests build each document and read its XML back.

This leaves ADRs 0019 and 0021 as they are: the Excel export stays on the server.

## Consequences

- **Easier**:
  - No API, infrastructure or permission change, and no new AWS resource.
  - Each document is a tested function of what the view already shows, so screen and file can't drift.
  - The read-only rule keeps its single exception.
- **Harder**:
  - A large dependency in the web app to keep up to date by hand, since the version is pinned.
  - Two export patterns side by side: a reader has to know Excel is made on the server and Word in the browser, and why.
  - More copies of the children's names outside the app, as with Excel. A casting sheet holds only one person's details, so a sheet handed to a young person shows nobody else's.
  - The browser builds the file, so a very large show takes longer on an old phone.
- **Revisit if**:
  - an export must be refused to some role (it would then need a server route, as ADR 0019 did);
  - the lazy chunk grows past about 500 kB gzipped, or exports become noticeably slow on phones;
  - `docx` stops being maintained;
  - the team wants the Excel export built the same way, so there's one pattern.

## Later changes

Recorded as later stories were built, so this record stays true without rewriting the decision above.

- **production-props.E5.S1**: a third Word export, the **Props List**, from the Generate Props List button in the Stage page's Props view, for every role and built the same way. It may hold the production's title; each half's name; each item's title, programme number, whether it's printed, and its props notes; and each prop's name, its characters (role names) and who plays them (first name and surname). Never anything else about the cast.
- **Logo in every Word export** (at the maintainer's request, with production-props.E5.S1): each page's header in the Item Overview, the Casting Sheets and the Props List carries the Chester Gang Show logo on the left (`apps/web/src/assets/logo-small.jpg`, about 15 kB). It's inlined into the lazily loaded chunk, so a document needs no network call to make. The Casting Sheets' logo is half the size (about 2.4 cm across) and a quarter inch from the top of the page, so it takes little room from their items.
