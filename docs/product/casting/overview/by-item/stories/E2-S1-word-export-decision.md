---
id: casting-overview-by-item.E2.S1
title: Record how the Word documents are built
epic: E2
status: done
---

## Story

As a maintainer, I want the choice of how the Word documents are built recorded in an ADR, so that the exports add no surprise dependency, hosting cost or data exposure.

This is a documentation story: its ACs are met by writing docs, so it needs no tests.

## Acceptance criteria

### AC1: An ADR records the decision
Given the PRD for casting-overview-by-item
When the ADR is written with the `adr` skill
Then `docs/adr` has a new numbered ADR that adopts the `docx` library (github.com/dolanmiu/docx), with its exact version, licence and dependencies
And it says whether the browser or the server builds the documents, with the alternatives considered and why they lost

### AC2: It relates the choice to the Excel export
Given ADR 0019 builds the Excel file on the server and ADR 0021 lets every team role export it
When the ADR is read
Then it says how the Word exports differ from or follow those decisions, including any new API route and whether a Read-Only Team Member may use it

### AC3: It covers data exposure
Given the documents copy children's names outside the app's access control
When the ADR is read
Then it lists the only fields the documents may hold: first name, surname, section, Scout group or Explorer unit, role name and role size, and item titles and numbers (ADR 0010)
And it says age band and Singing and Acting notes are never included

### AC4: It covers size and hosting
Given the library adds to the web bundle or the API package
When the ADR is read
Then it records the effect on that bundle or package and on the hosting model (ADR 0017), that no new AWS resource is needed, and how the no-third-party test is kept

### AC5: The docs point to it
Given the new ADR
When the PRD and this story are read
Then both link to it

## Notes

- FRs: none (non-functional: security, safeguarding, performance)
- Decision: [ADR 0022](../../../../adr/0022-word-exports-built-in-the-browser.md), accepted 2026-10-19.
- Depends on: none
- Review loop is skipped: the change is docs only.
