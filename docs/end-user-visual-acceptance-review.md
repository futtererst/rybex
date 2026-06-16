# End-User Visual Acceptance Review

Review source: regenerated screenshots in `visual-qa-output`.

Acceptance standard: each major page should feel like a focused action workspace with one clear job before the user opens details.

## Summary

The action workspace pattern is visually effective across the major pages. The biggest remaining visual competition was the page header action row, which looked like a second set of primary CTAs above the workspace. That has been subtracted by capping header utilities at two and making them visually quiet.

Final recommendation: pass for controlled pilot visual acceptance with minor caveats. Admin remains intentionally information-rich but scannable.

Expanded details QA note: a separate capture mode exists for opening dense
details and reviewing the full-page record layout. Those screenshots are for QA
only and do not represent the default end-user view.

Single action cockpit update: the top-level pattern has moved from a multi-panel
action workspace to one dominant ActionCockpit. Status, primary action, owner,
due date, blocker, evidence, secondary actions, and Open details now live in one
surface so the first viewport no longer reads like a compressed dashboard.

User workflow QA update: safe-click CTA testing now covers the 13 primary
workflow scenarios. Same-page cockpit CTAs focus details, module workflow CTAs
focus workflow sections, and the latest automated run found no primary-path
dead-end CTAs.

| Page | Visual simplicity score | Primary action clarity | Density above fold | Competing panels | Final status |
| --- | --- | --- | --- | --- | --- |
| /command-center | 4/5 | Pass | Pass | No | Pass |
| /pipeline | 4/5 | Pass | Pass | No | Pass |
| /projects | 4/5 | Pass | Pass | No | Pass |
| /mobilization | 4/5 | Pass | Pass | No | Pass |
| /field-execution | 4/5 | Pass | Pass | No | Pass |
| /rfis-submittals | 4/5 | Pass | Pass | No | Pass |
| /changes | 4/5 | Pass | Pass | No | Pass |
| /billing | 4/5 | Pass | Pass | No | Pass |
| /safety | 4/5 | Pass | Pass | No | Pass |
| /quality | 4/5 | Pass | Pass | No | Pass |
| /closeout | 4/5 | Pass | Pass | No | Pass |
| /reports | 4/5 | Pass | Pass | No | Pass |
| /admin | 3/5 | Pass | Pass with caveats | Yes | Pass with caveats |

## Page Notes

### /command-center

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; header actions were visually competing.
- Recommended subtraction: keep leadership review details collapsed.
- Final status: pass.

### /pipeline

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; pursuit creation link is now a quiet utility.
- Recommended subtraction: keep scoring detail and opportunity board collapsed.
- Final status: pass.

### /projects

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; project setup action is subordinate to the D2 blocker.
- Recommended subtraction: keep project register and baseline detail collapsed.
- Final status: pass.

### /mobilization

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; field-start workspace now dominates.
- Recommended subtraction: keep readiness matrix and work package records collapsed.
- Final status: pass.

### /field-execution

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; daily report utility is quiet.
- Recommended subtraction: keep production, billing support, and D5 signals collapsed.
- Final status: pass.

### /rfis-submittals

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; RFI/submittal create links no longer compete visually.
- Recommended subtraction: keep RFI and submittal registers collapsed.
- Final status: pass.

### /changes

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; new change link is a quiet utility.
- Recommended subtraction: keep change log and billing handoff collapsed.
- Final status: pass.

### /billing

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; pay app and exposure links are no longer dominant.
- Recommended subtraction: keep SOV, pay apps, backup, and exposure details collapsed.
- Final status: pass.

### /safety

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; safety create links are visually secondary.
- Recommended subtraction: keep safety registers collapsed.
- Final status: pass.

### /quality

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; inspection/deficiency create links are quiet utilities.
- Recommended subtraction: keep inspections, tests, deficiencies, and punch lists collapsed.
- Final status: pass.

### /closeout

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; package creation link no longer competes with acceptance blocker.
- Recommended subtraction: keep package requirements and archive detail collapsed.
- Final status: pass.

### /reports

- Visual simplicity score: 4/5.
- Primary action clarity: pass.
- Density above fold: pass.
- Competing panels: no.
- Visible clutter to remove: completed; lessons learned and production-rate links are quieter.
- Recommended subtraction: keep scorecards, analytics, and rate libraries collapsed.
- Final status: pass.

### /admin

- Visual simplicity score: 3/5.
- Primary action clarity: pass.
- Density above fold: pass with caveats.
- Competing panels: yes.
- Visible clutter to remove: none before pilot; Admin is intentionally a readiness dashboard.
- Recommended subtraction: later collapse deeper readiness diagnostics by category.
- Final status: pass with caveats.

## Task Outcome Contract Follow-Up

Manual founder review identified two weak CTA outcomes: Command Center routed a
priority to a generic Projects page, and Pipeline highlighted only the generic
details bar. The task outcome contract now requires concrete primary CTA
labels, focus metadata, and a focused task panel with `You are here to`, owner,
due date, blocker, evidence, and next step. This preserves the visually simple
cockpit while making the post-click outcome explicit.
