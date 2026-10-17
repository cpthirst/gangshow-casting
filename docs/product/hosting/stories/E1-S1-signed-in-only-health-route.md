---
id: hosting.E1.S1
title: Deploy the API so it refuses anyone not signed in
epic: E1
status: ready
---

## Story

As a maintainer, I want the first hosted API to refuse every request without a valid sign-in, so that nothing is ever reachable online before access control is in place.

## Acceptance criteria

### AC1: The health route is hosted behind sign-in
Given the infrastructure code
When it is synthesised
Then it defines a hosted API with the health route, served by a function that runs the existing health handler
And every route on that API requires a valid sign-in token from the team's user pool

### AC2: A request without sign-in is refused
Given the hosted API is deployed
When a request to `GET /api/health` is made with no sign-in token
Then the response is 401
And the body contains no data from the app

### AC3: A request with a made-up token is refused
Given the hosted API is deployed
When a request to `GET /api/health` is made with a token that wasn't issued by the team's user pool
Then the response is 401

### AC4: Accounts are username-only and can't be self-created
Given the infrastructure code
When it is synthesised
Then the user pool signs people in by username, ignoring case
And it doesn't allow anyone to create their own account
And it holds no email or phone attribute and offers no account recovery by message

### AC5: The accounts survive removing the stack
Given the infrastructure code
When it is synthesised
Then the user pool is kept when the stack is removed

### AC6: The API can't be flooded
Given the infrastructure code
When it is synthesised
Then the hosted API limits requests to about 20 a second, with bursts of up to 40
And its logs are kept for at most 30 days

### AC7: The post-deploy check confirms the refusal
Given the hosted API's address
When the maintainer runs the post-deploy check
Then it reports a pass only if every route on the API returns 401 without a sign-in token
And it prints no response bodies

## Notes

- FRs: FR2, FR15, FR17
- Depends on: none
- ADR 0017 (hosting) and ADR 0018 (access control). The function's code is the existing handler, behind a thin entry point that dispatches with `matchRoute`.
- AC2, AC3 and AC7 run against a real deploy, so they're verified by the post-deploy check. Its logic is unit-tested against a fake fetch, and infra assertions cover the authorizer.
- `pnpm dev` and the demo are unchanged: they still need no sign-in.
- Out of scope: any data route (E2.S1), creating accounts (E1.S2), the pages (E3.S1).
