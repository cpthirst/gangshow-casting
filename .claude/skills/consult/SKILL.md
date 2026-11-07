---
name: consult
description: User-only. Brings in a read-only consultant to recommend 3–4 epics of simplification across iCUE's UX, DX and AX, then turns the user's picks into questions for the next PRD. Run as /consult, optionally with a focus (e.g. /consult casting pages).
disable-model-invocation: true
---

# Consult: where to simplify next

For a rare break in sprint planning, with room for **3–4 epics** of improvement. The bar is the one set for new projects:

> As perfect as Linear's website or Apple's Notes: simple purpose, simple architecture, simple design, simple implementation. Cut taglines, helper text and secondary labels. If a screen needs them to make sense, fix the layout. Every decision should improve the user experience (UX), developer experience (DX) and agent experience (AX) at once, without breaking anything.

iCUE wasn't built to that bar from the start, so the consultant looks for where the app can move towards it at a price worth paying, and doesn't recommend change for its own sake.

Only the user can start this skill: `disable-model-invocation` stops the agent invoking it. The consultant's brief lives in this folder, not in `.claude/agents/`, so no agent can call it on its own initiative either.

Arguments: an optional focus (a page, area or kind of work). Without one, the whole app is in scope.

## Steps

1. **Brief the consultant.** Spawn one `Plan` subagent (read-only: no Edit or Write) with `model: "opus"`. Its prompt is the whole of [consultant.md](consultant.md), followed by the user's focus if they gave one. Don't add a summary of the repo: the consultant reads it for itself.
2. **Show the shortlist.** Relay the report's recommended epics, the ones it held back and the decisions it would revisit, in brief, keeping the evidence and its `file:line` links. Don't add recommendations of your own.
3. **Let the user choose.** In one multi-select question, ask which epics to take forward (up to 4). If the user picks a "decision to revisit", say that it needs an ADR via the `adr` skill before any story can build on it.
4. **Ask the PRD questions.** For each chosen epic, ask the consultant's open questions for it, at most 4 per question call, and offer its suggested answer first, marked "(Recommended)". Leave out any question the user has already answered in this conversation.
5. **Hand off.** Summarise the chosen epics and the answers in a few lines, then offer the `write-prd` skill for one feature that holds the chosen epics, passing the summary along so its interview only asks what's still open. Nothing is written to the repo until `write-prd` does it.
