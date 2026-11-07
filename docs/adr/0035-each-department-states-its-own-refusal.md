# 0035. Each department states its own refusal, and refusals say which department

- **Status**: Accepted
- **Date**: 2026-11-07
- **Deciders**: Nick Hirst

## Context

ADR 0029 has a refused change use the line of the **first** permission its route names. That breaks once a permission belongs to several departments: Tech's line is about the scenery, so the SFX and Mic plot routes each needed a patch naming their own line, and Scenery's permissions had to be listed Tech first so as not to say "props". The order of a list decided what a person was told.

The app also spots a read-only refusal by matching its exact wording against every line it knows, so rewording a line silently stops the "wasn't saved" alert (simplify PRD, FR3 and FR4).

## Options considered

1. **Do nothing**: keep the route patches and the careful ordering. / Each new department sharing a permission adds another patch, and wording stays load-bearing.
2. **Each department states its permissions and refusal line once, and each change route names its department** rather than a list of permissions. A refusal carries the department as a field beside its message, and the app recognises a read-only refusal by that field. / The route table changes shape, and every refusal body gains a field. Every refusal's wording stays the same.
3. **Keep routes naming permissions, but look the department up from the list's identity.** / Hidden coupling: two departments with the same permissions (SFX and Mic plot) can't be told apart.

## Decision

We will use option 2.

- `packages/shared` holds one list of departments: Casting, Props, Scenery, SFX, Mic plot and Wardrobe, each with the permissions any one of which may change it and the line a refusal says.
- Each change route in the shared table names a department or `"admin"`. Who may use it is that department's permissions; the order they are listed in no longer matters.
- A refused department change answers `403 { message, department }`. The message is the department's line, worded exactly as before. The app treats a 403 carrying a known department as read-only, whatever its message says.
- The general line ("You can view this, but not change it.") and the per-route patches go: every department route names a department, so no refusal falls back.

This amends ADR 0029's refusal clause. Everything else in ADR 0029 stands, including Director's reach and the fail-safe for routes missing from the table.

## Consequences

- **Easier**:
  - A new department is one entry in the list; its routes name it, and its refusal follows.
  - Rewording a refusal can't break the read-only alert.
- **Harder**:
  - Every refusal body carries a `department` field the API and app must agree on.
- **Revisit if**: one department's routes need different permissions from each other.
