# 0016. Database tests against an emulator, in CI

- **Status**: Accepted
- **Date**: 2026-10-17
- **Deciders**: Nick Hirst

## Context

The production data is moving to DynamoDB (ADR 0015). Each store gets a DynamoDB implementation that must keep the same rules as the file stores: stale saves refused, ids never reused, unique role names, and all-or-nothing deletes. Those rules rest on DynamoDB's condition expressions and transactions, which an in-memory fake can't prove. The tests need a real DynamoDB engine, and must never reach AWS or real data. DynamoDB Local, AWS's emulator, needs Java or Docker. The maintainer's machine has neither, and chose not to install one.

## Options considered

1. **Mock the AWS SDK**: no emulator needed / only checks the calls we make, not whether DynamoDB enforces the conditions we rely on.
2. **DynamoDB Local inside `pnpm check`**: every gate run covers the database / every local gate needs Java or Docker, which the maintainer declined.
3. **DynamoDB Local as its own CI job, on demand locally** (`pnpm test:dynamo`): real condition and transaction behaviour, no AWS account / failures show only after a push, not in the local gate.
4. **A test table in AWS**: the real service / needs an account and credentials in CI, costs money, and puts CI one step from real data.

## Decision

We will run the database tests against **DynamoDB Local** as a **separate CI job** (`database`), and keep them out of `pnpm check`.

- **Contract suites:** each store's rules are written once as a shared suite (for example `item-note-store.contract.ts`). `pnpm check` runs it against the in-memory and file stores, and the CI job runs the same suite against the DynamoDB store. So red/green still happens locally, and the emulator confirms the DynamoDB implementation keeps the same rules.
- **Files:** tests that need the emulator end in `.dynamo.test.ts`. The normal Vitest config excludes them, and `apps/api/vitest.dynamo.config.ts` runs only them.
- **Isolation:**
  - each test creates its own randomly named table and drops it afterwards;
  - the fixture refuses to run unless the DynamoDB endpoint is on localhost;
  - the credentials are dummies the emulator accepts;
  - the normal tests set `DATA_TABLE` to empty, so they can never reach a remote table, even when the shell has it set.
- **Supply chain:** the emulator image is pinned by digest in `.github/workflows/ci.yml`.

## Consequences

- **Easier**: the DynamoDB stores are tested against real condition and transaction behaviour, with no AWS account, cost or credentials, and no route to real data.
- **Harder**: a third CI job. A DynamoDB-only bug shows only after a push. Locally, running `pnpm test:dynamo` needs DynamoDB Local started by hand (Java or Docker).
- **Revisit if**: the maintainer installs Java or Docker (then fold the tests into `pnpm check`), the emulator drifts from DynamoDB in a way that matters, or the hosting story needs tests against a real AWS account.
