# 0010. Cast member personal data: full surname and Scout group

- **Status**: Accepted
- **Date**: 2026-10-15
- **Deciders**: Nick Hirst

## Context

Most of the cast are under 18, and this is a Scouting activity. The safeguarding rule in CLAUDE.md and the README allowed only first name, surname **initial**, section and age band, with anything more needing a story and an ADR.

The cast-management PRD needs a cast list. The production team's starting list (`cast.csv`, 56 members) records **full surnames** and each member's **Scout group or Explorer unit**. The product owner wants both kept (accepted 2026-10-15): full surnames tell apart members who share a first name and initial, and they match the names on group registration lists. The group lets the team organise rehearsals and contact the right leaders.

## Options considered

1. **Keep the original rule** (surname initial, no group): the least personal data. Initials alone can't reliably tell members apart, and the team would keep a second list elsewhere, which is worse for safeguarding.
2. **Full surname and group**: matches how the team already works. Each record becomes more identifying, so access control matters more before the app is hosted.
3. **Full surname, no group**: tells members apart, but loses the link to leaders and rehearsal groups that the team relies on.

## Decision

We will store, per cast member: an app-assigned ID, **first name, full surname, section** (Scouts, Explorers, Network, or not set) and **group** (Scout group or Explorer unit). Age band remains allowed but isn't stored yet. Date of birth, exact age, address, contact details, photos and medical data remain excluded.

The safeguarding rule in CLAUDE.md and the README is updated to match.

These rules don't change:
- casting data is for the production team only and must never be publicly reachable;
- real cast data stays out of git, tests, fixtures and seed data;
- deleting a cast member removes their data permanently.

## Consequences

- **Easier**: one cast list the team recognises, with no second copy kept elsewhere.
- **Harder**: the stakes on access control are higher. Hosting this data requires a sign-in or access-control story and ADR first. Logs and error messages must never include names.
- **Revisit if**: the app is to be hosted or shared beyond the production team, or the team finds initials are enough.
