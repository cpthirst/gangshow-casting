# 0011. Browser layout tests with Playwright, in CI

- **Status**: Accepted
- **Date**: 2026-10-16
- **Deciders**: Nick Hirst

## Context

The production team mostly uses the app on phones, often at rehearsal. Sideways scrolling on small screens has been the most common layout regression: the Cast table, an ensemble's editor and long names have each pushed pages wider than a 360px screen. Unit and component tests run in happy-dom, which has no layout engine, so they can't see any of this. Until now it was checked by hand with a throwaway headless-Chrome script, which nobody else could run and nothing ran in CI.

## Options considered

1. **Keep checking by hand**: no new dependency / easy to forget, not repeatable, and invisible to CI.
2. **Playwright, inside `pnpm check`**: every gate run covers layout / every local gate and the Stop hook would need a browser installed and start two servers, making each check slower.
3. **Playwright, as its own CI job and on demand locally** (`pnpm test:e2e`): a real browser engine, with the servers started by Playwright and failures that name the elements that stick out / a second CI job, and a regression is only caught when CI runs (on push), not by the local gate.
4. **Visual snapshot testing**: catches more than width / brittle across fonts and platforms, and needs reviewing baselines by hand.

## Decision

We will use **Playwright** (`@playwright/test`, Chromium only) as a **separate CI job**, runnable locally with `pnpm test:e2e`, kept out of `pnpm check`.

- **What the tests do:** happy-path walks through each page and its forms at 320px and 360px. After each step they assert that neither the page nor any box on it scrolls sideways.
- **Data:** the tests start their own API and Vite on separate ports (3100 and 5180). The API reads a committed, made-up data set (`apps/web/e2e/data`), copied to a temporary folder for each run. They never connect to `pnpm dev`, which serves real cast data.
- **Who adds them:** these tests are not part of AC coverage. `test-auditor` doesn't ask for them, and the agent asks the user before adding a new page, form or kind of browser check.

## Consequences

- **Easier**: sideways-scroll regressions fail CI with the offending elements named. The checks are repeatable by anyone, with no real data involved.
- **Harder**: a second CI job, and roughly 100MB of browser download per run. Locally, `playwright install chromium` is needed once. Pages added later aren't covered until the user agrees to add them.
- **Revisit if**: the job becomes slow or flaky, or regressions slip through that a wider set of checks (desktop widths, keyboard flows, visual snapshots) would have caught.
