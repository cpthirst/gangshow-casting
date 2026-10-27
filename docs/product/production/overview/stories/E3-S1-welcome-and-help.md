---
id: production-overview.E3.S1
title: Describe the Overview on the Welcome and Help pages
epic: E3
status: done
---

## Story

As a volunteer new to the app, I want the Welcome and Help pages to explain the Overview and its buttons, so that I know which button opens my department's page and whether I can change it.

## Acceptance criteria

### AC1: Welcome describes the Overview
Given someone opens the Welcome page
When they read about Production
Then it says the Overview lists the show's items in running order, with a button on each to open each department's page

### AC2: Help names each button and its icon
Given someone opens the Help page
When they read about the Overview
Then it names each of the five buttons, in row order, with its icon and what its page is for
And it says which are "Coming soon"

### AC3: Help says who can change what
Given someone reads the Overview's help
When they read about changing a department's pages
Then it says Stage changes Scenery and Props, Tech changes SFX and Mic plot, and Wardrobe changes Wardrobe, as do admins
And that everyone else can open every page to view it

### AC4: Help describes the export
Given someone reads the Overview's help
When they read about printable lists
Then it describes Generate Props List and who can use it

### AC5: The Overview's help button opens its help
Given someone on the Overview
When they choose the page's help button
Then it shows the Overview's help, as other pages' help buttons do

## Notes

- FRs: FR12
- Depends on: production-overview.E2.S2, so Help describes buttons that exist
- AC2 is what stands in for an icon legend on the page (E2.S2 notes).
- Plain words for non-technical volunteers. Name things as the page labels them.
- Out of scope: help for the department pages' content, which comes with each department's feature.
