# 0014. Short Singing and Acting notes on cast members

- **Status**: Accepted
- **Date**: 2026-10-16
- **Deciders**: Nick Hirst

## Context

ADR 0010 limits what the app stores about a cast member, mostly under-18s, to first name, full surname, section, group, and (when needed) age band. Anything more needs a story and an ADR.

The production team cast parts partly on how people sing and act. Today those judgements live in their heads or on paper. The product owner wants two short free-text fields, **Singing** and **Acting**, on each cast member, so they're visible beside the cast list when casting (cast-management FR9).

Free-text notes about children's abilities are new, more personal data. They are assessments of a child, and free text can drift into things the app must not hold, such as health.

## Options considered

1. **Keep ADR 0010 as it is**: no new data. The team keeps these notes elsewhere, outside the app's safeguards, which is worse for safeguarding.
2. **Fixed ratings** (for example a 1–5 scale): less free text to go wrong, but it doesn't capture what the team actually notes, such as "strong alto, can solo". It also reads as a score of a child.
3. **Two short free-text notes, Singing and Acting**: each up to 100 characters, optional, and shown only to the production team. It captures what the team needs in a form short enough to keep focused.

## Decision

We will store two optional free-text notes per cast member, **Singing** and **Acting**, each up to **100 characters**, for casting decisions only.

- **Storage:** they're kept with the cast member in the same local, owner-only, git-ignored store. They're deleted with the cast member, and never logged or put in error messages.
- **Still excluded:** date of birth, exact age, address, contact details, photos and medical or health information. The notes must not hold them.
- **Unchanged from ADR 0010:** casting data is for the production team only and must never be publicly reachable, and real cast data stays out of git, tests, fixtures and seed data.

This extends ADR 0010; its other decisions stand. The safeguarding rule in CLAUDE.md is updated to list the two notes.

## Consequences

- **Easier**: casting decisions see the team's notes beside the cast list, with no separate list kept elsewhere.
- **Harder**: each record holds judgements about a child, which raises the stakes on access control before any hosting. The team needs to keep the notes about ability, not health or personal circumstances.
- **Revisit if**: the app is hosted or shared beyond the production team, notes start holding excluded details, or the team finds a fixed scale would do.
