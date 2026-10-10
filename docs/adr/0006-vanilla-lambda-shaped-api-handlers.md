# 0006. Vanilla, Lambda-shaped API handlers

- **Status**: Accepted
- **Date**: 2026-10-06
- **Deciders**: Nick Hirst

## Context

The first API story (platform.E1.S1) needs HTTP. We expect to move to AWS API Gateway + Lambda soon, and want the closest thing to vanilla TypeScript, without a framework we'd later have to adapt or remove. ADR 0005 left this choice to the first story that needed it.

## Options considered

1. **A framework (Hono, Fastify, Express)**: routing, middleware and ecosystem / a dependency and an abstraction layer between our code and Lambda, plus an adapter to run on it.
2. **Vanilla handlers in the Lambda shape**: each endpoint is an `async` function returning `APIGatewayProxyStructuredResultV2`, and a small `node:http` server routes to them locally / validation, auth and middleware are ours to build.

## Decision

We will write API handlers as plain functions with the AWS Lambda / API Gateway HTTP API (payload v2) signature, typed with `@types/aws-lambda` (types only, no runtime code). `apps/api/src/dev-server.ts` maps routes to handlers for local development using `node:http`, and Vite proxies `/api` to it. On AWS, each handler becomes a Lambda behind an HTTP API route with no code change.

## Consequences

- **Easier**: no framework to learn or migrate off; handlers deploy to Lambda as they are; tests call handlers directly.
- **Harder**: no middleware or routing library. Cross-cutting concerns (validation, errors, auth) are ours to write, and the dev server must build a realistic `event` once handlers need request input.
- **Revisit if**: the number of routes or cross-cutting concerns grows enough that we're rebuilding a framework by hand.
