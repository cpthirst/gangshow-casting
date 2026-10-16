---
name: batch-stories
description: User-only toggle for batch mode. While it's on, the agent builds one feature's stories on one branch, commits and pushes each, and opens a single PR without push/PR prompts. Run as /batch-stories on <feature>, off, or status.
disable-model-invocation: true
---

# Batch stories: a temporary harness override

Normally `git push` and `gh pr` are on the **ask** list in `.claude/settings.json`, and each story gets its own PR. Batch mode lifts those two prompts for **one feature**, so the agent can work through its stories on one branch and open one PR at the end.

Only the user can start it: `disable-model-invocation` stops the agent invoking this skill itself. The user's "yes" in `on` step 2 is the authorisation to change `.claude/settings.json` and to push and open the PR without asking. The harness **must** return to its committed state afterwards, and a memory note makes sure later sessions remember.

Arguments: `on <feature> [story IDs…]`, `off`, or `status`.

## The override, exactly

In `.claude/settings.json`, batch mode:
- **removes** two entries from `"ask"`: `"Bash(git push:*)"` and `"Bash(gh pr:*)"`;
- **adds** these to `"deny"` (deny always wins), so the most common destructive commands stay blocked once the ask rule is gone:

  ```
  "Bash(gh pr merge:*)",
  "Bash(gh pr close:*)",
  "Bash(gh pr reopen:*)",
  "Bash(git push --force-with-lease:*)",
  "Bash(git push --delete:*)",
  "Bash(git push -d:*)",
  "Bash(git push origin +:*)"
  ```

Nothing else changes. These stay in force throughout:
- the existing deny rules (force-push, push to `main`);
- every hook: the guard, post-edit, the stop gate, and the pre-push gate that blocks `main`;
- the review loop.

**What's enforced and what isn't.** Deny rules match the start of a command, so they block the forms listed but not every variant: for example, flags after the branch name, `--mirror`, refspec deletes like `origin :branch`, or `gh pr edit` / `review --approve`. The pre-push hook still blocks any push to `main`, whatever its form. Beyond that, keeping to this feature's branch and never merging, editing or approving PRs is **instruction, not enforcement**. Don't run those commands while batch mode is on. (Narrow *allow* rules can't do the job instead: an **ask** rule outranks an allow, which is why the two ask entries have to be removed.)

A harness test reads the *committed* settings, so an override that's accidentally committed fails the pre-push gate and CI before it can reach the remote.

## `status`

1. Read `batch-stories.md` in your auto-memory directory. If it exists, batch mode is **on**. Report the feature, branch and date it records.
2. Check whether `.claude/settings.json` differs from the commit: `git diff --quiet HEAD -- .claude/settings.json`.
3. Report the combination:
   - **note and diff:** batch mode is on, as expected;
   - **neither:** batch mode is off;
   - **note but no diff:** the override was already undone. Offer to run `off` to tidy the note;
   - **diff but no note:** an **unknown change** to the harness, possibly from another session or a manual edit. Show the diff and ask the user. Never revert it without asking.

## `on <feature> [story IDs…]`

1. **Check it's safe to start.** If any check fails, stop and say why.
   - Auto-memory is available. Without it, a lost session couldn't know to restore.
   - Batch mode isn't already on, and `git diff --quiet HEAD -- .claude/settings.json` exits 0.
   - `docs/product/<feature>/` has an approved PRD and story map. The stories to build are `ready`, or listed by the user.
   - Leave unrelated uncommitted work alone, and never stage or reformat it.
2. **Confirm the scope with the user in one line:** the feature, the stories, the branch `feat/<feature>`, and "one PR at the end". Wait for a yes.
3. **Create or switch to the branch** `feat/<feature>`, from an up-to-date `main` if it's new. The guard blocks commits and pushes on `main`.
4. **Write the memory note first**, so a lost session still knows to restore. Create `batch-stories.md` in the auto-memory directory:

   ```markdown
   ---
   name: batch-stories
   description: MUST RESTORE: batch mode is on for <feature>; .claude/settings.json ask/deny rules are temporarily changed
   metadata:
     type: project
   ---

   Batch mode turned on <YYYY-MM-DD> at the user's request for feature `<feature>`, branch `feat/<feature>`, stories <IDs>.

   **How to apply:**
   - Never stage or commit `.claude/settings.json` while batch mode is on.
   - Once the feature's PR is open, or if the work stops or is abandoned, run `/batch-stories off`.
   - The override covers only this feature and branch. Ask before pushing or opening PRs for anything else.
   ```

   Add one line to the memory index (`MEMORY.md`): `- [MUST RESTORE: batch mode on for <feature>](batch-stories.md): run /batch-stories off when the PR is open`.
5. **Apply the override** exactly as above. Check the file is still valid JSON, and that `git diff HEAD -- .claude/settings.json` shows only those removals and additions.
6. **Tell the user** batch mode is on, and that you'll switch it off when the PR is open.

### While batch mode is on: the per-story loop

For each story, in story-map order (respecting `Depends on`):
1. Follow the `implement-story` skill on `feat/<feature>`. Don't create a branch per story.
2. Work test-first, get `pnpm check` green, then run the CLAUDE.md review loop: fix blockers, at most 2 rounds. Batch mode doesn't skip the user's say on `ux-reviewer` findings: ask about them after each story's review, as CLAUDE.md describes.
3. Mark the story `done` in the story and the map, then commit. **Stage only the story's files**, never `.claude/settings.json` and never unrelated work: `git add -A -- . ':!.claude/settings.json'`, or explicit paths. Check with `git diff --cached --name-only`. Never use `git commit -a`. Format only the files you changed, not the whole repo.
4. Push: `git push -u origin feat/<feature>` the first time, then `git push`. The pre-push hook re-runs the gate.

When every story is done, open **one** PR with the `open-pr` skill. List every story's ACs and their tests, and every review's non-blocking notes. Then run `off` straight away.

**Stop and ask the user** (and leave batch mode on until they decide) if:
- a blocker is still open after 2 review rounds;
- an AC is ambiguous;
- a new dependency or ADR seems necessary;
- anything would touch work outside the feature;
- the branch's diff passes about 1,500 changed lines (excluding the lockfile). Agree with the user whether to carry on or split the PR.

## `off`

Run this as soon as the batch PR is open, or when the user asks, or if the work is abandoned.

1. **Check what will be undone.** Run `git diff HEAD -- .claude/settings.json`. If it shows anything besides the override above (another edit made during the batch), stop and show the user. Restoring would throw that edit away.
2. **Restore from the commit:** `git checkout HEAD -- .claude/settings.json`. This restores from HEAD, not the staging area.
3. **Verify:** `git diff --quiet HEAD -- .claude/settings.json` exits 0. If it doesn't, stop and tell the user, and keep the memory note.
4. **Clean up:** delete `batch-stories.md` and its line in `MEMORY.md`.
5. **Tell the user** the harness is back to its committed state.
