---
name: batch-stories
description: User-only toggle for batch mode. While it's on, the agent builds one feature's stories on one branch, commits and pushes each, and opens a single PR at the end. Run as /batch-stories on <feature>, off, or status.
disable-model-invocation: true
---

# Batch stories: one feature, one branch, one PR

Normally each story gets its own branch and PR, and the user says yes before each PR opens (ADR 0031). Batch mode lets the agent work through **one feature's** stories on one branch, pushing after each, and open one PR at the end.

Only the user can start it: `disable-model-invocation` stops the agent invoking this skill itself. The user's "yes" in `on` step 2 is the go-ahead to push that feature's branch after each story and to open its PR without asking again. It changes nothing in `.claude/settings.json`: `git push` and `gh pr create` are already allowed, and merging, closing, reopening, editing and reviewing PRs still ask. A memory note records that batch mode is on, so a later session knows the scope of that yes.

Arguments: `on <feature> [story IDs…]`, `off`, or `status`.

Keeping to this feature's branch, and never merging, editing or approving PRs, is **instruction, not enforcement**. The deny rules (force-pushes, deleting a remote branch, pushing to `main`) and every hook stay in force, and the pre-push hook blocks any push to `main`, whatever its form.

## `status`

Read `batch-stories.md` in your auto-memory directory. If it exists, batch mode is **on**: report the feature, branch and date it records. Otherwise it's off.

## `on <feature> [story IDs…]`

1. **Check it's safe to start.** If any check fails, stop and say why.
   - Auto-memory is available. Without it, a later session couldn't know batch mode is on.
   - Batch mode isn't already on.
   - `docs/product/<feature>/` has an approved PRD and story map. The stories to build are `ready`, or listed by the user.
   - Leave unrelated uncommitted work alone, and never stage or reformat it.
2. **Confirm the scope with the user in one line:** the feature, the stories, the branch `feat/<feature>`, and "one PR at the end". Wait for a yes.
3. **Create or switch to the branch** `feat/<feature>`, from an up-to-date `main` if it's new. The guard blocks commits and pushes on `main`.
4. **Write the memory note.** Create `batch-stories.md` in the auto-memory directory:

   ```markdown
   ---
   name: batch-stories
   description: Batch mode is on for <feature>: push its branch after each story, one PR at the end
   metadata:
     type: project
   ---

   Batch mode turned on <YYYY-MM-DD> at the user's request for feature `<feature>`, branch `feat/<feature>`, stories <IDs>.

   **How to apply:**
   - The user's yes covers pushing only this feature's branch, and opening its one PR.
   - Once the feature's PR is open, or if the work stops or is abandoned, run `/batch-stories off`.
   - Ask before pushing or opening PRs for anything else.
   ```

   Add one line to the memory index (`MEMORY.md`): `- [Batch mode on for <feature>](batch-stories.md): run /batch-stories off when the PR is open`.
5. **Tell the user** batch mode is on, and that you'll switch it off when the PR is open.

### While batch mode is on: the per-story loop

Each story runs in a **fresh subagent**. A whole feature in one session means every turn re-reads the stories before it, so cost grows with the square of the batch's length. The main session only directs: it keeps the plan, the review notes, and the user's say. It never reads the stories' code or diffs itself.

For each story, in story-map order (respecting `Depends on`):
1. **Build it in a subagent.** Launch a `general-purpose` agent in the foreground with this brief:
   - the story's path, the branch `feat/<feature>` (already checked out; don't create a branch per story), and that it's in batch mode;
   - follow the `implement-story` skill up to a green `pnpm check`, and stop there: no review loop, no commit and no push;
   - if an AC is ambiguous, or a new dependency or ADR seems necessary, stop and report back without guessing: subagents can't ask the user;
   - reply in under ~15 lines: the files changed, which test covers each AC, and the gate's result.
   A documentation story skips test-first (CLAUDE.md); the subagent writes the docs and runs the gate.
2. **Review.** Write the diff to a scratch file (`git diff > <scratchpad>/<story>.diff`) and give each routed reviewer the file's path and the story path, not the diff's text. A documentation story skips the review loop. For each `blocker`, send the findings to the **same** subagent with `SendMessage` (its context is still there) to fix, and to re-run the gate. Then re-run only the reviewers that blocked, at most 2 rounds. Batch mode doesn't skip the user's say on `ux-reviewer` findings: ask about them after each story's review, as CLAUDE.md describes.
3. **Commit.** Mark the story `done` in the story and the map, then commit. **Stage only the story's files**, never unrelated work: explicit paths. Check with `git diff --cached --name-only`. Never use `git commit -a`. Format only the files you changed, not the whole repo.
4. Push: `git push -u origin feat/<feature>` the first time, then `git push`. The pre-push hook re-runs the gate.

The next story gets a **new** subagent, not the last one: its fresh context is the point.

When every story is done, open **one** PR with the `open-pr` skill. List every story's ACs and their tests, and every review's non-blocking notes. Then run `off` straight away.

**Stop and ask the user** (and leave batch mode on until they decide) if:
- a blocker is still open after 2 review rounds;
- an AC is ambiguous;
- a new dependency or ADR seems necessary;
- anything would touch work outside the feature;
- the branch's diff passes about 1,500 changed lines (excluding the lockfile and `.md` files). Agree with the user whether to carry on or split the PR.

## `off`

Run this as soon as the batch PR is open, or when the user asks, or if the work is abandoned.

1. Delete `batch-stories.md` and its line in `MEMORY.md`.
2. **Tell the user** batch mode is off: each story gets its own PR again, each after its own yes.
