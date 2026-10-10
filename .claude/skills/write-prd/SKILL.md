---
name: write-prd
description: Write a product requirements document (PRD) for a new feature or product idea. Use when the user describes something they want built, asks for a PRD, spec or requirements, or wants to story-map a feature that has no docs/product/<feature>/prd.md yet.
---

# Write a PRD

Output: `docs/product/<feature>/prd.md`, from [templates/prd.md](templates/prd.md). First link in the chain **write-prd → story-map → write-story → implement-story**.

## Steps

1. **Name the feature.** Propose a short kebab-case slug (e.g. `story-capture`). It becomes the prefix of every story ID, so keep it stable. Confirm it with the user.
2. **Interview, don't invent.** Ask about whatever the user hasn't told you, at most ~5 questions per round:
   - What problem does this solve, and for whom?
   - What does success look like, and how will we measure it?
   - What is explicitly out of scope?
   - Constraints: deadlines, compliance, cost, existing systems.
   - Known risks or unknowns.
3. **Write the PRD** from the template. Number functional requirements `FR1`, `FR2`, … (stories trace back to them). Anything still unknown goes under *Open questions*. Don't guess.
4. **Checkpoint.** Summarise the PRD in a few lines and ask the user to approve or amend it. Leave `status: draft` until they approve, then set `status: approved`.
5. **Hand off.** Offer to run the `story-map` skill.

## Quality bar

- Requirements describe *what* and *why*, never *how*. No framework or table names.
- Every goal has a measurable success metric.
- Non-goals are explicit; they're what stops scope creep later.
- Non-functional requirements cover at least: security, accessibility, performance.
