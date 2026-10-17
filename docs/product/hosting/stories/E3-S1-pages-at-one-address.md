---
id: hosting.E3.S1
title: Serve the pages at one address with the API
epic: E3
status: ready
---

## Story

As a production team member, I want the app at one web address I can bookmark on my phone, so that I can open it anywhere, at a rehearsal or at home.

## Acceptance criteria

### AC1: Pages and API share one HTTPS address
Given the hosted app is deployed
When the app's address is opened
Then the pages load over HTTPS
And requests to `/api/...` on the same address reach the hosted API

### AC2: Plain HTTP doesn't serve the app
Given the hosted app is deployed
When the app's address is opened over plain HTTP
Then the browser is redirected to HTTPS

### AC3: API responses aren't cached on the way
Given the infrastructure code
When it is synthesised
Then requests to `/api/...` are never cached between the browser and the API
And the sign-in header is passed through to the API

### AC4: The stored pages aren't reachable directly
Given the infrastructure code
When it is synthesised
Then the files behind the pages can be read only through the app's address
And they aren't public

### AC5: Pages carry security headers
Given the hosted app is deployed
When a page is loaded
Then the response forbids framing the page, limits where scripts may load from, and tells browsers to use HTTPS only

### AC6: A new release is picked up on the next load
Given a team member has the app open
And the maintainer deploys a new version
When they reload the app
Then they get the new version

### AC7: No data without sign-in
Given someone opens the app's address without signing in
When a page loads
Then no production data is shown
And the page says they need to sign in

## Notes

- FRs: FR1, FR3, FR4, FR15, FR16
- Depends on: hosting.E2.S1
- ADR 0017: the default CloudFront address. `index.html` isn't cached, and hashed assets are cached long.
- AC7 needs only a "you need to sign in" state when the API returns 401. The sign-in itself is E3.S2.
- Ask before adding any browser test for the new state (CLAUDE.md).
- Out of scope: signing in (E3.S2), a custom domain.
