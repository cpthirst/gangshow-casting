---
id: simplify.E5.S3
title: Switch to a past production, view only
epic: E5
status: draft
---

## Story

As someone on the team, I want to switch to last year's production to look something up, so that I can check what we did before without any risk of changing it.

## Acceptance criteria

### AC1: Anyone can switch
Given productions 2027 and 2028
When "jo", with no permissions, chooses 2027
Then the app shows 2027's pages, and the sidebar shows 2027

### AC2: Back to the newest
Given "jo" has switched to 2027
When jo chooses 2028
Then the app shows 2028's pages again

### AC3: A past production is view only, even for admins
Given an admin has switched to 2027
When they open Cast and the Props page for an item
Then each shows the "View only" badge, with no controls to change anything

### AC4: The API refuses every change to a past production
Given 2028 is the newest
When anyone, an admin included, asks the API to change anything in 2027
Then the API refuses, saying the production is a past one that can be viewed but not changed

### AC5: Nobody can reopen it
Given 2027 is a past production
When an admin looks for a way to make it changeable
Then there is none

### AC6: Exports still work
Given someone has switched to 2027
When they generate the Excel casting grid, the Word props list and the Mic Plot
Then each downloads 2027's data

### AC7: Switching works by keyboard
Given someone using only a keyboard
When they reach the production switch
Then they can choose a production and confirm it without a mouse

## Notes

- FRs: FR20, FR21
- Depends on: simplify.E5.S2, simplify.E3.S2
- AC4's refusal wording is new: agree it in the story's PR, shaped like the department refusals.
- The production switch is a new control: ask the maintainer whether the browser layout walks should cover it.
