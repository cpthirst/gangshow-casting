# 0032. SFX files beside the scenery files

- **Status**: Accepted
- **Date**: 2026-11-02
- **Deciders**: Nick Hirst

## Context

The production-sfx-wardrobe PRD gives each item's SFX page the item's files and notes, laid out and behaving as its Scenery page does (FR1 to FR3, FR5, FR7 to FR9). ADR 0030 keeps scenery files in a private bucket, keyed `<production>/<item id>/scenery/<name>`, and lets the API function reach only those keys. It left room for other departments' folders under each item, but its access, its local folder and its routes are scenery's alone. The PRD asks for SFX's files to be reachable only through SFX's routes, with the API's access widened to SFX files and nothing else, and for no new AWS resource. That changes ADR 0030's scope, so it needs a record.

## Options considered

1. **The same bucket, under each item's `sfx/` folder, with the code that serves scenery taking a department.**
   - Pros: no new resource or cost line. Listing, links, uploads, deletes and the removal clean-up already work per folder, so SFX gets all of them, and the three pages stay alike (PRD constraint). An item's SFX files move and go with it as its scenery files do.
   - Cons: one bucket holds both, so the API's access names each department's folders, and a mistake in a key could reach the other department's files. The name rules (ADR 0030) and per-department stores guard against that.
2. **A second bucket for SFX.**
   - Pros: SFX files can't be reached by a scenery key at all.
   - Cons: a new AWS resource, a second CORS rule and Content-Security-Policy entry, and a second `FILES_BUCKET` for `pnpm dev`, for the same kind of file. Rejected: the PRD asks for no new resource.
3. **Copy Scenery's code for SFX.**
   - Pros: Scenery's code stays untouched.
   - Cons: two copies to keep alike, and Wardrobe would make three (E1.S2). Rejected by the story map.

## Decision

We will use option 1. It amends ADR 0030 as follows; everything else in ADR 0030 stands.

- **Keys**: `<production>/<item id>/sfx/<name>`, with the same name rules. Each department's store is made for one department, and builds every key from it, so an SFX route never reaches `scenery/`, nor a scenery route `sfx/`. A name holding `/` (such as `../scenery/set-plan.pdf`) is refused, as before.
- **Routes**: SFX has its own, named after it, beside Scenery's, which keep their addresses: `GET …/items/{itemId}/sfx-files`, `GET …/sfx-file-link`, `DELETE …/sfx-files`, `POST …/sfx-uploads`, and `GET …/sfx-notes` and `PUT …/items/{itemId}/sfx-notes`. The changes need Tech or Director, or an admin (PRD FR1). Their refusal says "You can view the SFX, but not change them.", named per route, since a refusal otherwise names its first permission's line, and Tech's is about the scenery (ADR 0029).
- **Access**: the API function's `s3:GetObject`, `s3:PutObject` and `s3:DeleteObject` cover `*/*/scenery/*` and `*/*/sfx/*`, and nothing else; `s3:ListBucket` is unchanged. `pnpm dev`'s AWS profile needs the same on SFX files.
- **Notes**: SFX notes are kept as scenery notes are, apart from them: in `sfx-notes.json` locally, and under the `SFXNOTE#` sort key prefix in the table.
- **Removal clean-up**: when the running order is saved without an item, its SFX files and SFX notes are deleted with its scenery files and casting, after the save, and repaired by the next save if it fails (production-scenery FR13). Scenery notes are left as they are today.
- **Local development**: the folder store and the dev server's `/api/local-files/` take `sfx/` beside `scenery/`, and nothing else.

## Consequences

- **Easier**:
  - Wardrobe (E1.S2) adds a department name, its routes and its access, and gets the rest.
  - A removed item's files go department by department, each from one listing of the production.
- **Harder**:
  - Each new department widens the API's access to one more folder, and needs its own refusal line.
  - The removal clean-up lists the production once per department.
- **Revisit if**:
  - a department's files need to be kept apart more strictly than by key, such as with their own encryption or retention;
  - listing the production once per department gets slow.
