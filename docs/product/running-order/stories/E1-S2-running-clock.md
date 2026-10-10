---
id: running-order.E1.S2
title: See the running clock
epic: E1
status: done
---

## Story

As a member of the production team, I want to see when each item starts and when the show will finish, so that I can judge the effect of the running order on the evening.

## Acceptance criteria

### AC1: Each item shows its start time
Given the show starts at 7:15 pm
And the first half opens with "Curtain Up" (5 minutes) then "Pirate Panic" (18 minutes)
When I open the Running order page
Then "Curtain Up" starts at 7:15 pm and "Pirate Panic" starts at 7:20 pm

### AC2: Each half shows its total
Given the first-half items' timings add up to 67 minutes
When I open the Running order page
Then the first half shows a total of 67 minutes

### AC3: The interval is placed after the first half
Given the show starts at 7:15 pm, the first half totals 67 minutes and the interval is 20 minutes
When I open the Running order page
Then I see "Interval 8:22 pm – 8:42 pm"
And the second half's first item starts at 8:42 pm

### AC4: The projected finish is shown
Given the second half starts at 8:42 pm and totals 62 minutes
When I open the Running order page
Then I see "Projected finish 9:44 pm"

### AC5: Untimed items are flagged and count as zero
Given "Big Finish" has no timing
When I open the Running order page
Then its row is marked "Untimed"
And the next item starts at the same time as "Big Finish"

### AC6: Items not in the printed programme still take time
Given "Producers' Call" is not printed and lasts 4 minutes
When I open the Running order page
Then the half's total includes its 4 minutes

## Notes

- FRs: FR3
- Depends on: running-order.E1.S1
- The clock is calculated from the version's start time and interval minutes, which aren't editable in the app (PRD). Check it against Draft 6: interval 8:22 pm, second half 8:42 pm, finish 9:44 pm.
- Times are shown in 12-hour UK style ("7:15 pm").
- Out of scope: editing the start time or interval.
