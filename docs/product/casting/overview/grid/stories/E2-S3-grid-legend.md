---
id: casting-overview-grid.E2.S3
title: Explain the dots with a legend
epic: E2
status: ready
---

## Story

As a member of the production team, I want a legend under the grid, so that I know what each colour and letter means, including if I can't tell the colours apart.

## Acceptance criteria

### AC1: The legend names each size
Given the Overview is showing the grid
When I look at the legend
Then I see a Lead dot with L, a Support dot with S, a Cameo dot with C and an Ensemble dot with E, each with its size written out

### AC2: Legend dots match the grid
Given a lead dot in the grid
When I compare it with the Lead dot in the legend
Then they use the same colour and the same letter

### AC3: No legend on the by-person view
Given the Overview is showing people by section
When I look at the page
Then there is no grid legend

### AC4: Legend is readable text
Given the grid legend
When a screen reader reads it
Then it hears each size spelled out in words

## Notes

- FRs: FR9
- Depends on: casting-overview-grid.E2.S1
- Out of scope: nothing further.
