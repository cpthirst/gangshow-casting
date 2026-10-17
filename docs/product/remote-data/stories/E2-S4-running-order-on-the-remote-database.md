---
id: remote-data.E2.S4
title: Keep running-order versions in the remote database
epic: E2
status: ready
---

## Story

As a maintainer, I want every running-order version kept in the remote database, so that the show's order and its history survive the loss of my laptop.

## Acceptance criteria

### AC1: The latest version is read and a new one saved
Given the API is configured for the remote database, and the latest running order is version 4
When I save from version 4
Then version 5 is saved, and reading the running order returns version 5

### AC2: Saves from an old version are refused
Given the latest running order is version 5
When a save arrives from version 4
Then it is refused as a conflict, and version 5 is still the latest

### AC3: Two saves at once can't both win
Given two saves from version 5 arrive at the same time
When both are saved
Then exactly one becomes version 6 and the other is refused as a conflict

### AC4: Every version is kept
Given versions 1 to 6 have been saved
When any earlier version is read from the store
Then it comes back exactly as saved

### AC5: The same rules are tested against both stores
Given the shared running-order-store tests
When `pnpm check` and the database CI job run
Then they pass against the in-memory store and against the remote store on the emulator

## Notes

- FRs: FR5 (running order), FR6 (running order)
- Depends on: remote-data.E1.S1
- Out of scope: restoring an old version in the app (running-order FR11's "recover").
