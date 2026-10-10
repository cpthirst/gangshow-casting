# 0004. Versioning with Conventional Commits and release-please

- **Status**: Accepted
- **Date**: 2026-10-06
- **Deciders**: Nick Hirst

## Context

We already ask for Conventional Commits, but nothing enforced the format or derived versions from it, so the commit types carried no meaning. We want SemVer releases and a changelog without anyone hand-editing versions. The packages are private and deployed together as one app.

## Options considered

1. **Manual versions**: no tooling / easy to forget, and the changelog drifts.
2. **semantic-release**: fully automatic release on every merge / no human control over release timing.
3. **Changesets**: per-package versions from hand-written change files / built for published libraries; overkill for one deployed app.
4. **release-please, single repo version**: keeps a release PR open from commits on `main`, and merging it tags the release / relies on accurate commit types.

## Decision

We will use release-please with a single root version (starting at 0.0.0, with the first release at 0.1.0). Commit types are enforced by commitlint at two points: a Lefthook `commit-msg` hook, and a CI check on PR titles (squash merges make the PR title the commit on `main`). Dependabot uses `fix(deps)` for runtime and `chore(deps)` for dev dependencies.

Tags are plain `vX.Y.Z` (`include-component-in-tag: false`), the usual form for a single-package repo.

## Consequences

- **Easier**: versions and the CHANGELOG come from history; release timing stays a human decision (merge the release PR).
- **Harder**: a wrong commit type means a wrong version, so reviewers should check PR titles. Release PRs skip CI and the PR-title check by design: they only bump the version and CHANGELOG, and every commit they summarise was gated when it merged. (GitHub holds `pull_request` runs on bot-created PRs for manual approval, so CI triggers on `push` and the title check on `pull_request_target`, neither of which `GITHUB_TOKEN` events start.) If release PRs ever need checks, switch release-please to a GitHub App token.
- **Revisit if**: we publish packages independently (consider Changesets), or want continuous release on merge.
