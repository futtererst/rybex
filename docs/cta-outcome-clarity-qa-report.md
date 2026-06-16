# CTA Outcome Clarity QA Report

Generated against `http://127.0.0.1:3120`.

A CTA passes when the user can clearly see the outcome: route change, modal/drawer, expanded details, highlighted/focused section, transaction feedback, or clear unavailable/demo messaging.

## Manual Founder Review Failures

- Observed behavior: Command Center `Open priority` routed to `/projects` without a task instruction.
- Observed behavior: Pipeline `Open action details` highlighted the Pipeline Details bar without an exact object or next step.
- Why it failed: both outcomes worked mechanically but left the user guessing.
- Fix implemented: cockpit CTAs now use concrete labels, focus metadata, and a focused task panel with `You are here to` and `Do next` instructions.
- Verification: this QA fails vague labels, generic route-only outcomes, generic section-only highlights, and missing focused task panels.

## Command Center

- Route: `/command-center`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Add missing billing backup | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Billing cash blocker

- Route: `/billing`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Add missing billing backup | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Closeout acceptance blocker

- Route: `/closeout`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Complete closeout requirement | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Daily report / field escalation

- Route: `/field-execution`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Escalate field issue | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Change recovery protection

- Route: `/changes`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Resolve information blocker | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Information-control blocker

- Route: `/rfis-submittals`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Resolve contract baseline gap | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Pipeline go/no-go

- Route: `/pipeline`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Review go/no-go decision | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Project baseline clearance

- Route: `/projects`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Resolve contract baseline gap | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Mobilization field-start blocker

- Route: `/mobilization`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Review blocked field start | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Safety action closure

- Route: `/safety`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Review blocked field start | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Quality deficiency / test blocker

- Route: `/quality`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Clear billing blocker | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Optimize learning loop

- Route: `/reports`
- Tested CTAs: 2
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| Review field issue | cockpit | yes | 5/5 | Pass | Opens a focused task panel with clear next-step instructions. |
| Open details | cockpit | no | 5/5 | Pass | Expands details and highlights the target section. |

Recommended fix: No safe fix required by automated outcome QA.

## Admin readiness review

- Route: `/admin`
- Tested CTAs: 0
- Outcome clarity: Pass
- Confusing outcomes: 0

| CTA | Area | Primary | Score | Pass/fail | Outcome observed |
| --- | --- | --- | --- | --- | --- |
| No important CTAs detected | - | - | 1/5 | Fail | Page needs a primary outcome path. |

Recommended fix: No safe fix required by automated outcome QA.

