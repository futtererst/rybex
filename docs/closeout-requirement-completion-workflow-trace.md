# Closeout Requirement Completion Workflow Trace

## Workflow Name

Closeout Requirement -> Acceptance / Final Billing Release

## Primary User

Project Manager / Closeout Owner

## Starting Points

- `/command-center`
- `/closeout`

## Business Story

A closeout package cannot be submitted, accepted, or used for final billing because a required closeout item is missing or incomplete. The user must attach, waive, or send the requirement to review, then resolve the blocker.

## Example Closeout Issue

Missing as-built redline package for Fiber Backbone Segment A.

## Business Impact

Acceptance, final billing, and retainage release may be delayed until this requirement is satisfied.

## Required States

- `waiting_on_evidence`
- `evidence_attached`
- `waived`
- `ready_for_review`
- `resolved`
- `cannot_complete`
- `reopened`

## Required Actions

- `mark_closeout_evidence_attached`
- `waive_closeout_requirement`
- `send_closeout_item_to_review`
- `resolve_closeout_blocker`
- `reopen_closeout_blocker`

## Local/Demo Completion Path

1. User opens `/closeout?focus=closeout-requirement-final-billing-release#focused-task`.
2. Focused task says: `You are here to: Complete closeout requirement`.
3. User enters and saves a `Closeout evidence note`.
4. Saved note remains visible.
5. User clicks `Mark closeout evidence attached`.
6. Evidence becomes uploaded and state becomes `evidence_attached`.
7. User clicks `Send closeout item to review`.
8. State becomes `ready_for_review` and a closeout package update appears.
9. User clicks `Resolve closeout blocker`.
10. State becomes `resolved` and a final billing release note appears.
11. Result banner confirms: `Closeout blocker resolved. Acceptance and final billing can proceed for this item.`

## Pilot Mode Human-Execution Proof

`npm run pilot-field-closeout:qa` starts from `/pilot`, opens `Complete closeout requirement`, saves the closeout evidence note, attaches evidence, sends the item to review, resolves the blocker, returns to Pilot Mode, and confirms the Closeout card is complete/resolved.

## Result Messages

- `Closeout evidence marked attached.`
- `Closeout requirement waived with reason.`
- `Closeout item sent to review.`
- `Closeout blocker resolved. Acceptance and final billing can proceed for this item.`
- `This closeout item cannot be completed yet because [reason].`

## Not Production-Backed

This proof flow is local/demo state by default. The opt-in completion persistence bridge can record completion events, evidence status, and linked-output metadata in Supabase pilot tables, but it does not enable production storage, RLS, external notifications, or production approval controls.

## Editable Field Proof

Closeout completion now requires visible saved inputs before the evidence and resolution actions unlock:

- `Closeout evidence note`: required before `Mark closeout evidence attached`.
- `Evidence reference`: required before `Mark closeout evidence attached`.
- `Acceptance note`: required before `Resolve closeout blocker`.

The saved values remain visible and appear in local/demo history.
