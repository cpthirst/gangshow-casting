---
id: hosting.E3.S1
title: Serve the pages at one address with the API
epic: E3
status: done
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

### AC3: Reloading a page deep in the app works
Given the hosted app is deployed
When a team member reloads, or opens a bookmark to, a page such as `/cast` or `/cast/123`
Then the app loads and shows that page
And a missing file such as `/assets/missing.js` still returns 404, not the app's page

### AC4: API errors keep their status
Given the hosted app is deployed
When a request to `/api/...` returns 401, 403 or 404
Then the browser receives that status and the API's body, not the app's page

### AC5: API responses aren't cached between the browser and the API
Given the infrastructure code
When it is synthesised
Then requests to `/api/...` are never cached at the edge
And the sign-in header is passed through to the API

### AC6: Browsers don't keep API responses
Given any API response
When it reaches the browser
Then it carries `Cache-Control: no-store`

### AC7: The stored pages aren't reachable directly
Given the infrastructure code
When it is synthesised
Then the files behind the pages can be read only through the app's address
And they aren't public

### AC8: Pages carry security headers
Given the hosted app is deployed
When a page is loaded
Then the response forbids framing the page, limits where scripts may load from, and tells browsers to use HTTPS only

### AC9: A new release is picked up on the next load
Given a team member has the app open
And the maintainer deploys a new version
When they reload the app
Then they get the new version

### AC10: No data without sign-in
Given someone opens the app's address without signing in
When a page loads
Then no production data is shown
And the page says they need to sign in

## Notes

- FRs: FR1, FR3, FR4, FR15, FR16
- Depends on: hosting.E2.S1
- ADR 0017: the default CloudFront address. `index.html` isn't cached, and hashed assets are cached long.
- AC3 and AC4 together rule out a distribution-wide error-page fallback. A viewer-request function on the pages' behaviour sends extension-less paths to `/index.html` and leaves `/api/*` alone.
- The routes already start with `/api`, so CloudFront forwards them without rewriting. After this story, the post-deploy check also runs through the app's address, because that is the path users hit.
- AC6 is set by the API's entry point and unit-tested there.
- AC10 needs only a "you need to sign in" state when the API returns 401. The sign-in itself is E3.S2.
- Ask before adding any browser test for the new state (CLAUDE.md).
- Out of scope: signing in (E3.S2), a custom domain.
- Follow-up for E3.S2: a 401 replaces the page with the sign-in message, so a sign-in that runs out mid-edit loses an unsaved draft (such as a running order). Signing in again should keep it, or warn first.
