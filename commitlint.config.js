// Conventional Commits, enforced on every commit (Lefthook) and on PR titles (CI).
// Squash merges make the PR title the commit on main, which is what release-please versions.
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Scope is optional; when given it must name a package or area of the repo.
    "scope-enum": [
      2,
      "always",
      // `main`: release-please titles its PRs `chore(main): release …` (scope = target branch).
      ["web", "api", "infra", "shared", "tooling", "harness", "deps", "docs", "release", "main"],
    ],
  },
};
