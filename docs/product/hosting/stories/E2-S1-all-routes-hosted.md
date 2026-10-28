---
id: hosting.E2.S1
title: Host every API route on the remote data
epic: E2
status: done
---

## Story

As a production team member, I want the whole API online and working on the show's data, so that the app no longer depends on the maintainer's laptop being on.

## Acceptance criteria

### AC1: Every route is hosted
Given the routes list in the API
When the infrastructure code is synthesised
Then the hosted API has exactly one route for each entry, with the same method and path

### AC2: Every route needs sign-in
Given the infrastructure code
When it is synthesised
Then every route on the hosted API requires a valid sign-in token
And no route is public

### AC3: A signed-in request reads the show's data
Given the hosted API is deployed against the remote table holding the cast of production 2027
When a signed-in team member requests `GET /api/productions/2027/cast`
Then the response is 200 with the same cast list the API returns locally against that table

### AC4: Saves work through the hosted API
Given a signed-in team member
When they save a note on an item through the hosted API
Then the response is 200
And reading the item notes again returns the saved note

### AC5: The function can only reach the data table
Given the infrastructure code
When it is synthesised
Then the data function may read and write the data table and nothing else in the data store

### AC6: The check covers every route
Given the hosted API's address
When the maintainer runs the post-deploy check
Then it reports a pass only if every route in the routes list returns 401 without a sign-in token
And it prints no cast data

## Notes

- FRs: FR2, FR15, FR17
- Depends on: hosting.E1.S2
- Before this is deployed against the real table, the maintainer must have run the remote-data move (copy, verify, remove) for the 2027 production. Done on 2026-10-17; the move command has since been removed.
- AC3 and AC4 are verified after deploy with a check account. In tests, the entry point is called directly with a fake signed-in event.
- Out of scope: admin-only actions (E2.S2), the pages (E3).
