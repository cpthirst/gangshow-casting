# 0017. Hosting on Lambda, API Gateway and CloudFront

- **Status**: Accepted
- **Date**: 2026-10-17
- **Deciders**: Nick Hirst

## Context

The hosting PRD needs the app reachable from anywhere, for 5–20 volunteers with long idle periods, at close to £0 (budget alert at about £5 a month). ADR 0005 left hosting to the first story that needed it. ADR 0006 already writes every handler in the API Gateway HTTP API (payload v2) shape so that it can run on Lambda unchanged. The data is in DynamoDB in eu-west-2 (ADR 0015). The pages call the API on the same origin under `/api` (for example `CAST_PATH` in `apps/web/src/cast.ts`), and Vite proxies that path locally. Sign-in is decided separately (ADR 0018) but has to be in place from the first deploy.

## Options considered

1. **Lambda behind an HTTP API, with the built SPA in a private S3 bucket behind one CloudFront distribution that also routes `/api/*` to the HTTP API**: pay-per-use, nothing to run when idle; the handlers deploy as they are; one origin, so there's no CORS and the web code doesn't change. Cons: cold starts, and several AWS services to wire.
2. **One container on App Runner or Fargate serving the pages and the API**: one moving part, and the dev server could be reused. Cons: always-on cost (roughly £5–£20 a month), and it throws away the Lambda shape ADR 0006 chose.
3. **Lambda function URLs instead of API Gateway**: one service fewer. Cons: no managed JWT authorizer or throttling, so auth and rate limits move into our code.
4. **Amplify Hosting**: a quick start for the SPA. Cons: another service with its own build conventions, and it duplicates what CDK already gives us.

## Decision

We will host on option 1, all in `AppStack` (eu-west-2):

- **API**: an API Gateway HTTP API with one route per entry in `apps/api/src/routes.ts`. Two Lambda functions (Node, bundled with esbuild):
  - one for the data routes, with read/write access to the table only;
  - one for user management, the only one allowed to call the sign-in service's admin actions (ADR 0018).

  One function per group rather than per route keeps cold starts and IAM simple. The handlers keep the ADR 0006 signature. A thin entry point dispatches with the existing `matchRoute`.
- **Pages**: `pnpm --filter web build` output in a private S3 bucket, reachable only through CloudFront (origin access control). `index.html` isn't cached, so a deploy is picked up on the next load. Hashed assets are cached long. The router uses HTML5 history, so a CloudFront Function (viewer request) on the pages' behaviour only sends extension-less paths to `/index.html`. There is no distribution-wide error-page fallback, which would turn the API's 401/403/404 into the app's page with a 200.
- **One address**: the default CloudFront domain, HTTPS only. Its default behaviour serves S3 with security headers (CSP, no framing, HSTS). The CSP allows the Cognito login domain for navigation, form posts and token requests (ADR 0018). `/api/*` goes to the HTTP API with caching disabled and the `Authorization` header forwarded. The routes already start with `/api`, so nothing is rewritten. API responses also carry `Cache-Control: no-store`.
- **Limits**: HTTP API stage throttling (about 20 requests a second, burst 40), and CloudWatch log retention of 30 days with no request bodies logged.
- **Deploys**: manual `cdk deploy` from the maintainer's machine, which builds the SPA and bundles the Lambdas. A rollback means deploying the previous commit.

When the first hosting story lands, CLAUDE.md "Scaffold status" is updated: the stack has resources and a hosting model.

## Consequences

- **Easier**: near-zero idle cost; handlers and web code stay as they are; one address for the team to bookmark.
- **Harder**: cold starts on the first request after a quiet spell. The HTTP API's own `execute-api` URL is also reachable directly. That's acceptable because the authorizer guards it too (ADR 0018), but it isn't behind CloudFront's headers. Once the pages are hosted, the post-deploy check also runs through the CloudFront address. Throttling is shared by all callers, so a flood of unauthenticated requests could slow the team down. That's acceptable at this scale. Local development still uses `dev-server.ts`, which has to keep mirroring API Gateway's behaviour.
- **Revisit if**: cold starts miss the PRD's 4-second goal, the bill passes the budget alert, or we need a custom domain (that adds ACM and DNS).
