---
id: platform.E1.S1
title: Show API health in the web app
epic: E1
status: done
---

## Story

As a developer, I want the web app to show the API's health, so that I can confirm the frontend, API and shared contract work together end to end.

## Acceptance criteria

### AC1: Healthy API is shown
Given the API is running with version "1.2.3"
When I open the web app
Then I see "API: ok (1.2.3)"

### AC2: Unreachable API is reported
Given the API is not reachable
When I open the web app
Then I see "API: unavailable"
And the page still renders

### AC3: Health endpoint follows the contract
Given the API is running
When a client requests GET /api/health
Then the response is 200 with a JSON body that satisfies the shared HealthResponse schema

## Notes

- Walking skeleton: the thinnest path browser → HTTP → handler → shared contract.
- Handlers use the AWS Lambda / API Gateway HTTP API shape, run locally by a node:http dev server (ADR 0006).
- Out of scope: deployment to AWS, authentication.
