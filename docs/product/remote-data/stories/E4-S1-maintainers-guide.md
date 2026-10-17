---
id: remote-data.E4.S1
title: Guide the maintainer from a new AWS account to the files removed
epic: E4
status: done
---

## Story

As a maintainer who hasn't done this before, I want one guide that takes me through every step in order, so that I can move the data safely without help.

## Acceptance criteria

### AC1: Every step, in order
Given the guide
When I read it
Then it covers, in order: creating the AWS account with MFA, a least-privilege profile on my machine, deploying with my alert email, backing up the data folder, copying, verifying, switching the API to the remote database, removing the local files, and removing the backup

### AC2: Going back is explained
Given I'm part-way through the move
When I look for how to go back
Then the guide says how to switch the API back to the files, and that this is only possible until the files are removed

### AC3: Restoring from backup is explained
Given data was deleted or damaged in the last 7 days
When I look in the guide
Then it explains how to restore the table to an earlier point

### AC4: Nothing secret is in it
Given the guide
When anyone reads the repository
Then it holds no account ids, credentials or email addresses, only where to put them

## Notes

- FRs: FR12
- Depends on: remote-data.E3.S3, remote-data.E1.S2
- Docs-only, at `docs/guides/remote-data.md`, linked from the README. Checked by the user following it for the real move, not by tests.
- AC1's order changed at review (2026-10-17): the API moves to the remote database after the copy is verified, not before, since until then the table doesn't hold the show.
- Out of scope: hosting the API.
