---
id: casting-rules.E1.S1
title: Serve the app on a demo show
epic: E1
status: ready
---

## Story

As a member of the production team, I want to run the app on a full made-up show with one command, so that I can see the casting rules at work, and cause and fix clashes, without touching the real cast.

## Acceptance criteria

### AC1: One command starts the demo
Given the app is installed
When I run `pnpm demo` and open the address it prints
Then I see the demo show's running order, with two halves of about 10 items each and an interval

### AC2: The demo show is a realistic full show
Given the demo is running
When I look at the Cast page and the casting pages
Then there are about 60 cast members across Scouts, Explorers, Network and no section
And every item has a length
And there are roles of every size, including at least one ensemble of 10 or more

### AC3: Every page says it's demo data
Given the demo is running
When I open any page
Then I see a clear "Demo data" label

### AC4: The real app has no demo label
Given `pnpm dev` is running on the real data
When I open any page of the real app
Then there is no "Demo data" label

### AC5: Changes last while the demo runs
Given the demo is running
When I cast "Sam Example" in a role and refresh the page
Then Sam is still cast in that role

### AC6: Each start begins afresh
Given I changed the casting in the demo and then stopped it
When I run `pnpm demo` again
Then the casting is back as it was in the committed demo show

### AC7: The demo runs alongside the real app
Given `pnpm dev` is running
When I run `pnpm demo`
Then both are running at once, on different addresses
And the real app still shows only the real data

### AC8: The real data is never touched
Given the demo is running
When I change the cast, roles and running order in the demo
Then the real data is unchanged

### AC9: The planted clashes are listed
Given the demo show
When I read the demo's short guide
Then it names, for each kind of clash, the people and items set up to show it: a back-to-back error, a back-to-back warning, a timing warning and a quick-change info

## Notes

- FRs: PRD NFR "Demo data for trying the rules".
- Depends on: none. The rules arrive in E2 and E3; the demo show is built with every kind of clash from the start, so each rule shows up as it lands.
- All names are made up (CLAUDE.md safeguarding). The demo uses its own ports and a fresh temporary copy of the committed show, like the browser layout tests (ADR 0011).
- Out of scope: showing clashes (E2, E3); hosting the demo anywhere but the developer's machine.
