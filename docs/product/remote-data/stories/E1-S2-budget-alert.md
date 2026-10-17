---
id: remote-data.E1.S2
title: Email the maintainer when AWS spend looks high
epic: E1
status: ready
---

## Story

As a maintainer of a charity's app, I want an email if the AWS bill is heading over a few pounds a month, so that a mistake can't quietly run up costs.

## Acceptance criteria

### AC1: A monthly budget with a forecast alert
Given the infrastructure code
When it is synthesised
Then it defines a monthly cost budget of £5 that emails an alert when the forecast spend passes it

### AC2: The address isn't in the repository
Given the infrastructure code is synthesised with an alert email supplied at deploy time
When the template is inspected
Then the alert goes to that address
And no email address appears anywhere in the repository

### AC3: It refuses to deploy without an address
Given no alert email is supplied
When the infrastructure code is synthesised for a deploy
Then it stops with a message saying how to supply one

## Notes

- FRs: FR13
- Depends on: remote-data.E1.S1
- The address comes from the maintainer at deploy time (see the PRD's resolved questions). Tests use a made-up address such as alerts@example.com.
- AWS budgets are billed in US dollars, so "£5" is set as the nearest whole-dollar amount and noted in the code. Confirm the figure with the user if it needs to be exact.
- Out of scope: alerts for anything other than cost.
