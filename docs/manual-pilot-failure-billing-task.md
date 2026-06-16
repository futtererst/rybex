# Manual Pilot Failure: Billing Task Was Not Visibly Executable

## Observed Failure

From `/pilot`, the user selected `Add missing billing backup` and landed on:

`/billing?focus=billing-billing-backup-cash-recovery&pilot=1#focused-task`

The route was technically correct, but the user did not see an obvious executable workflow. The focused task felt informational, and the completion controls were not presented as a clear sequence.

## Root Cause

The Workflow Completion Engine rendered a completion panel, but it exposed completion actions as general controls inside a technical workflow panel. It did not show a human-friendly step path with visible state, disabled-step reasons, and a clear result/return path.

The QA proved that buttons existed and worked, but it did not prove a real user could immediately understand the task.

## Fix Applied

Added `GuidedCompletionFlow` as the primary completion surface for registered workflow completion items.

For Billing Backup, the focused task now shows:

1. `Mark backup attached`
2. `Send to review`
3. `Resolve billing blocker`

Each step has a visible status, an enabled/disabled action button, and a short reason when a later step is not yet available.

After resolution, the page shows:

`Billing blocker resolved. Return to Pilot Mode to continue.`

And a visible `Return to Pilot Mode` link.

## Before / After Expected Behavior

Before:

- User landed on Billing.
- Focused task was visible.
- Completion controls existed but did not read as a guided workflow.
- User could not confidently complete the task.

After:

- User lands on Billing.
- A guided flow titled `Complete billing backup task` appears immediately.
- The user sees the exact three-step sequence.
- Step buttons unlock in order.
- Pilot Mode progress updates after returning.

## QA Coverage

`npm run pilot-mode:qa` now includes the manual failure regression:

- Open `/pilot`.
- Click `Add missing billing backup`.
- Confirm guided completion flow is visible.
- Complete all three steps.
- Return to Pilot Mode.
- Confirm Billing is complete/resolved.

## Editable Field Contract Update

Manual review later exposed that Billing still needed human-editable documentation before completion. The guided Billing task now requires:

- `Backup note`
- `Evidence reference`
- `Resolution note`

`Mark backup attached` stays disabled until the backup note and evidence reference are saved. `Resolve billing blocker` stays disabled until the resolution note is saved. Saved values remain visible and appear in local completion history.
