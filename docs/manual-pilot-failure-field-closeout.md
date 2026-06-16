# Manual Pilot Failure Review: Field and Closeout Tasks

## Observed Field Issue Flow State

From `/pilot`, the user can route to:

`/field-execution?focus=field-issue-escalation&pilot=1#focused-task`

Before this pass, the Field Issue proof flow was technically executable, but it did not require or preserve an explicit human escalation note in the visible guided path. A real field supervisor could still wonder what context should be captured before choosing RFI or change control.

## Observed Closeout Flow State

From `/pilot`, the user can route to:

`/closeout?focus=closeout-requirement-final-billing-release&pilot=1#focused-task`

Before this pass, the Closeout proof flow was technically executable, but it did not require or preserve a visible evidence note before marking closeout evidence attached. A real closeout owner could still wonder what evidence was being represented.

## Defects Found

- Field Issue needed a visible `Escalation note` input before the RFI/change path decision.
- Closeout needed a visible `Closeout evidence note` input before evidence attachment.
- Saved human input needed to remain visible and appear in local completion history.
- Field and Closeout needed the same Pilot Mode progress confidence already proven for Billing.

## Root Cause

The Workflow Completion Engine was definition-driven and the proof flows passed browser QA, but the guided surface was still action-first rather than context-first for Field and Closeout. These workflows need a short user-entered note because the completion action represents a real operating judgment.

## Fix Applied

- `GuidedCompletionFlow` now renders workflow-specific human paths for Field Issue and Closeout while still using the shared completion registry actions.
- Field Issue now shows:
  - `Escalation note`
  - `Save escalation note`
  - `Create RFI from field issue`
  - `Create change event from field issue`
  - `Mark issue controlled`
  - `Resolve field issue`
- Closeout now shows:
  - `Closeout evidence note`
  - `Save closeout note`
  - `Mark closeout evidence attached`
  - `Send closeout item to review`
  - `Resolve closeout blocker`
- Saved notes are written to local demo state and local history.
- Pilot Mode progress continues to update from the shared completion state.

## Final Expected Behavior

From `/pilot`, a normal user can complete Field Issue and Closeout without knowing the architecture:

- The guided workflow appears above dense details.
- The user enters and saves the required note.
- The saved note remains visible.
- Action buttons unlock in sequence.
- Linked output, state, result banner, and history update visibly.
- Returning to Pilot Mode shows the workflow as complete/resolved.

## Editable Field Contract Update

Field Issue now requires saved human inputs before downstream actions:

- `Escalation note`
- `Recommended control path`
- RFI or change details for the selected path
- `Control reason`
- `Resolution note`

Closeout now requires:

- `Closeout evidence note`
- `Evidence reference`
- `Acceptance note`

The fields are visible in the guided workflow, saved values remain visible, and completion buttons stay disabled until the required saved values exist.
