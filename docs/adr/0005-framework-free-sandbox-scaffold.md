# 0005. Framework-free sandbox scaffold

- **Status**: Accepted
- **Date**: 2026-10-06
- **Deciders**: Nick Hirst

## Context

The first scaffold chose an API framework (Hono), a runtime (Lambda behind API Gateway) and hosting (S3 + CloudFront) before any product requirement existed. Those choices were assumptions, not decisions. Agents treat whatever is in the repo as the pattern to follow, so leaving them in would quietly lock them in.

## Options considered

1. **Keep the Hono / Lambda / CloudFront scaffold**: a working end-to-end path now / commits to choices nobody has made.
2. **Strip back to a sandbox**: Vue SPA, a framework-free API package, shared zod contracts, an empty CDK stack, and the full harness / nothing is deployable until a story adds it.

## Decision

We will keep the scaffold framework-free. `apps/api` holds plain functions (currently a `getHealth` placeholder), and `infra` holds one empty `AppStack`. The API framework, runtime, hosting and any AWS resources are chosen when a story needs them, each recorded in its own ADR.

## Consequences

- **Easier**: real requirements drive the architecture; agents have no implicit pattern to copy.
- **Harder**: the first deployable story has to make several infrastructure decisions at once.
- **Revisit if**: we settle on a standard stack for this repo; record it in a new ADR and update CLAUDE.md.
