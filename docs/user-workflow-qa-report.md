# User Workflow QA Report

Generated from local workflow QA against `http://127.0.0.1:3120`.

Standard: every CTA must navigate, open a modal/drawer, expand/focus details, apply a meaningful filter, start a transaction, create a draft/new flow, mark local/demo state with feedback, or show a clear unavailable message.

CTA outcome clarity follow-up: `docs/cta-outcome-clarity-qa-report.md` verifies that primary and important secondary CTAs produce understandable outcomes, including route changes, expanded details, highlighted focus targets, modals, or visible feedback.

## Manual Founder Review Failures

- Observed behavior: Command Center `Open priority` routed generically to `/projects`; Pipeline `Open action details` only highlighted the Pipeline Details bar.
- Why it failed: both CTAs technically moved somewhere, but neither landed on an exact task with a visible next-step instruction.
- Fix implemented: primary cockpit CTAs now use concrete task labels and route/focus through the task outcome contract with a `You are here to` focused task panel.
- Verification: this QA fails vague labels, generic route-only outcomes, generic section-only highlights, and missing focused task instructions.

## Scenario 1 - Executive priority review

- Route: `/command-center`
- User intent: Identify the top operating priority and act on it.
- Expected: No CTA should route to /command-center with no state change.
- Pass/fail: Pass
- Tested CTAs: 2
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Open details | Pass | /command-center | /command-center#details-records | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Review At-Risk Work | Pass | /command-center | /command-center#leadership-attention | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 2 - Pipeline go/no-go decision

- Route: `/pipeline`
- User intent: Resolve a pursuit decision or intake blocker.
- Expected: Decision CTA should open or focus a meaningful go/no-go action path.
- Pass/fail: Pass
- Tested CTAs: 3
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Review go/no-go decision | Pass | /pipeline | /pipeline#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Review go/no-go decision | Pass | /pipeline | /pipeline#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Review go/no-go decision | Pass | /pipeline | /pipeline#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 3 - Project baseline clearance

- Route: `/projects`
- User intent: Clear a D2 contract or baseline blocker.
- Expected: Clear baseline must expose the blocker or route to an existing setup flow.
- Pass/fail: Pass
- Tested CTAs: 2
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Open details | Pass | /projects | /projects#details-records | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| New Project Setup | Pass | /projects | /projects/new | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 4 - Mobilization field-start blocker

- Route: `/mobilization`
- User intent: Identify what blocks field start and clear or inspect it.
- Expected: Field-start CTA should open details or a relevant action path.
- Pass/fail: Pass
- Tested CTAs: 3
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Review blocked field start | Pass | /mobilization | /mobilization#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Review blocked field start | Pass | /mobilization | /mobilization#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Open details | Pass | /mobilization | /mobilization#details-records | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 5 - Field execution daily report / issue escalation

- Route: `/field-execution`
- User intent: Submit today’s report or escalate a field issue.
- Expected: New Daily Report should route to the creation flow; escalation should expose a relevant path.
- Pass/fail: Pass
- Tested CTAs: 3
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Review blocked field start | Pass | /field-execution | /mobilization#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Open details | Pass | /field-execution | /field-execution#details-records | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| New Daily Report | Pass | /field-execution | /field-execution/daily-report/new | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 6 - RFI/Submittal blocker

- Route: `/rfis-submittals`
- User intent: Resolve information control blocking field work.
- Expected: CTAs should route to RFI/submittal creation or focus the register.
- Pass/fail: Pass
- Tested CTAs: 3
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Review field issue | Pass | /rfis-submittals | /rfis-submittals#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Open details | Pass | /rfis-submittals | /rfis-submittals#details-records | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| New RFI | Pass | /rfis-submittals | /rfis-submittals/rfi/new | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 7 - Change recovery protection

- Route: `/changes`
- User intent: Protect change recovery before notice or backup is missed.
- Expected: Protect recovery should open a notice, backup, details, or change action path.
- Pass/fail: Pass
- Tested CTAs: 3
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Protect change recovery | Pass | /changes | /changes#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Open details | Pass | /changes | /changes#details-records | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| New Change Event | Pass | /changes | /changes/new | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 8 - Billing cash blocker

- Route: `/billing`
- User intent: Clear billing backup or pay application blocker.
- Expected: Billing CTA should not route back to /billing without focus or detail exposure.
- Pass/fail: Pass
- Tested CTAs: 3
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Review field issue | Pass | /billing | /billing#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Protect change recovery | Pass | /billing | /closeout#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Open details | Pass | /billing | /billing#details-records | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 9 - Safety action closure

- Route: `/safety`
- User intent: Close or inspect a safety blocker.
- Expected: Safety CTA should open close/resolve workflow or details.
- Pass/fail: Pass
- Tested CTAs: 3
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Review blocked field start | Pass | /safety | /safety#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Review blocked field start | Pass | /safety | /safety#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Review blocked field start | Pass | /safety | /safety#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 10 - Quality deficiency/test blocker

- Route: `/quality`
- User intent: Close a quality action or test gap.
- Expected: Quality CTA should resolve, route, or focus the relevant action.
- Pass/fail: Pass
- Tested CTAs: 3
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Clear billing blocker | Pass | /quality | /quality#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Close quality action | Pass | /quality | /quality#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Clear billing blocker | Pass | /quality | /quality#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 11 - Closeout acceptance blocker

- Route: `/closeout`
- User intent: Clear closeout, final billing, or retainage blocker.
- Expected: Closeout CTA should focus or open requirement details.
- Pass/fail: Pass
- Tested CTAs: 2
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Open details | Pass | /closeout | /closeout#details-records | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| New Closeout Package | Pass | /closeout | /closeout/package/new | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 12 - Optimize learning loop

- Route: `/reports`
- User intent: Act on a lesson learned or production-rate update.
- Expected: Learning CTA should open or focus improvement actions.
- Pass/fail: Pass
- Tested CTAs: 3
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Review field issue | Pass | /reports | /reports#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Review go/no-go decision | Pass | /reports | /reports#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |
| Review go/no-go decision | Pass | /reports | /reports#focused-task | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

## Scenario 13 - Admin readiness review

- Route: `/admin`
- User intent: Understand system status and verify readiness.
- Expected: Admin CTAs should scroll, focus, open a section, or route to a real reference.
- Pass/fail: Pass
- Tested CTAs: 1
- Dead ends found: 0

| CTA | Outcome | Before | After | Notes |
| --- | --- | --- | --- | --- |
| Command Center | Pass | /admin | /command-center | CTA produced a focused task, specific navigation, modal, detail expansion, or visible feedback outcome. |

Recommended fix: No must-fix CTA issue detected in safe-click QA.

