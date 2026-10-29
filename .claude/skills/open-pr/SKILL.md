---
name: open-pr
description: Push the current branch and open a GitHub pull request using the repo's PR template. Use when the user asks to ship, open, raise or create a PR, or when a story is done and ready for review.
---

# Open a pull request

## Steps

1. **Preconditions.**
   - You're not on `main`. If you are, stop: the work belongs on a branch.
   - The working tree is clean (commit any remaining work first).
   - `pnpm check` is green.
2. **Check the size.** Run `git diff --stat main...HEAD -- . ':!pnpm-lock.yaml' ':!*.md'`. Markdown never counts. Over ~400 changed lines: tell the user and propose how to split it before going further.
3. **Review.** If the review loop in CLAUDE.md hasn't already run on this branch's current commit in this session (e.g. a quick fix that skipped `implement-story`), run it now. Skip it for a documentation story or a diff of only `*.md` files (CLAUDE.md). Never push with an unresolved `blocker`.
4. **Write the PR.**
   - **Title**: a Conventional Commit, e.g. `feat(api): save story drafts (story-capture.E1.S2)`. At most **100 characters**, counting the type, scope and story id (commitlint's `header-max-length`, which CI's PR title check applies). Shorten the summary, never drop the story id. Check it before pushing with `printf '%s\n' "<title>" | pnpm exec commitlint`, the same check CI runs, and fix anything it reports.
   - **Body**: fill in [.github/pull_request_template.md](../../../.github/pull_request_template.md). Link the story file(s) and any ADRs, and summarise *why*, not just what (the diff shows what). Base it on `git log main..HEAD` and the diff. Put the reviewers' `should-fix` and `nit` findings, and any `ux-reviewer` findings the user chose to note or leave, under "Review notes".
5. **Push**: `git push -u origin <branch>`. The user's yes to opening the PR covers this and step 6: don't ask again (ADR 0031).
6. **Create the PR.**
   - If `gh` is installed: write the body to a scratch file and run `gh pr create --title "<title>" --body-file <file>`.
   - Otherwise: give the user `https://github.com/<owner>/<repo>/compare/<branch>?expand=1` (from `git remote get-url origin`) and the title and body to paste.
7. **Report** the PR link. **Never merge.** Merging is the user's decision.
