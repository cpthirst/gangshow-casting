---
id: hosting.E5.S1
title: Write the guide to running the hosted app
epic: E5
status: done
---

## Story

As a maintainer, I want a step-by-step guide to deploying and running the hosted app, so that I, or whoever takes over, can release, recover and hand out accounts without guessing.

## Acceptance criteria

### AC1: Deploy from scratch
Given a maintainer who has followed the remote-data guide
When they follow the hosting guide's deploy section
Then it tells them, in order, how to deploy the hosted app, find its address and run the post-deploy check

### AC2: Create the first admin and hand out accounts
Given a fresh deploy
When the maintainer follows the guide
Then it shows how to create the first admin from the repo, sign in, choose a password, and create accounts for the team in the app

### AC3: Release and roll back
Given a new version on `main`
When the maintainer follows the guide
Then it shows how to release it, and how to go back to the previous version without touching data or accounts

### AC4: Recover a locked-out admin
Given no admin can sign in
When the maintainer follows the guide
Then it shows how to restore an admin from the repo

### AC5: The guide is checked
Given the repository
When `pnpm check` runs
Then it fails if the guide is missing, or a command it names isn't a real script in the repo

## Notes

- FRs: FR19
- Depends on: hosting.E1.S2, hosting.E3.S2, hosting.E4.S3
- Extend the remote-data maintainer's guide (remote-data.E4.S1) rather than starting a separate one, if that reads better.
- No usernames, passwords, addresses or account ids in the guide. Use placeholders such as `<your username>`.
- Out of scope: deploying from CI.
