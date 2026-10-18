---
id: casting-overview-grid.E3.S1
title: Record how the Excel export is built and who may use it
epic: E3
status: ready
---

## Story

As a maintainer, I want the choice of how the Excel file is built and who may export recorded in an ADR, so that the export adds no surprise dependency, hosting cost or data exposure.

This is a documentation story: its ACs are met by writing docs, so it needs no tests.

## Acceptance criteria

### AC1: An ADR records the decision
Given the PRD decisions for casting-overview-grid
When the ADR is written with the `adr` skill
Then `docs/adr` has a new numbered ADR that says the server builds the file behind an admin-only route
And it names the spreadsheet library chosen, with the alternatives considered and why they lost

### AC2: It covers who may export and why
Given the exported file is a copy of children's names outside the app's access control
When the ADR is read
Then it says only admins may export, that the server refuses everyone else (ADR 0018), and why
And it lists the only fields allowed in the file: first name, last name, section and role size (ADR 0010)

### AC3: It covers cost and hosting
Given the library adds to the API package
When the ADR is read
Then it records the effect on the API bundle and on the hosting model (ADR 0017), and that no new AWS resource is needed

### AC4: The docs point to it
Given the new ADR
When the ADR index and the PRD are read
Then both link to it

## Notes

- FRs: none (non-functional: security and safeguarding)
- Depends on: none
- Check the library works in a Lambda-shaped handler, runs without outside network calls, and does not trip `apps/web/src/no-third-party.test.ts`.
- Out of scope: building the export (E3.S2).
