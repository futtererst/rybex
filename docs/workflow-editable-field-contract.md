# Workflow Editable Field Contract

## Purpose

Pilot workflow steps must be executable by a human user, not only by completion buttons. A workflow action is valid only when the user can enter the needed note, save it visibly, see it later, and understand how it unlocks the next step.

## Field Standard

Each required editable field must be visible in the guided workflow, clearly labeled, saved with an explicit button, shown after save, included in local history or completion summary, and used to gate downstream actions.

Required fields are stored in local/demo workflow completion state. This is not production persistence.

## Billing Backup

Workflow: `billing-backup-cash-recovery`

- `Backup note`: required before `Mark backup attached`.
- `Evidence reference`: required before `Mark backup attached`.
- `Resolution note`: required before `Resolve billing blocker`.

Example backup note: `Signed T&M ticket and supervisor backup are available for CE-004.`

## Field Issue

Workflow: `field-issue-escalation`

- `Escalation note`: required before creating an RFI or change event.
- `Recommended control path`: required before creating an RFI or change event.
- `RFI draft title` and `RFI question`: required when the path is RFI.
- `Change event title` and `Change impact note`: required when the path is Change event.
- `Control reason`: required before marking the issue controlled.
- `Resolution note`: required before resolving the field issue.

## Closeout

Workflow: `closeout-requirement-final-billing-release`

- `Closeout evidence note`: required before marking evidence attached.
- `Evidence reference`: required before marking evidence attached.
- `Acceptance note`: required before resolving the closeout blocker.

## Validation Rules

- Required fields block the action they support until saved.
- Disabled actions show the missing-field reason.
- Saved values remain visible in the guided workflow.
- Saved values appear in the completion summary and local history.
- Pilot reset clears saved field values for the three pilot workflows only.

## QA Coverage

`npm run workflow-execution:qa` starts at `/pilot` and completes all three workflows through visible human UI controls. It fails if fields are missing, values are not visibly saved, actions unlock too early, history is missing, or Pilot Mode progress does not update.

`npm run workflow-execution:verify` checks the contract files, selectors, save actions, guided UI support, and QA coverage.

`npm run runtime:qa` also preloads local/demo completion state before visiting focused workflow pages. This guards against hydration mismatches where saved field or history state would render differently on the client than the server.

Guided workflow controls now call React handlers from `useWorkflowCompletion()`. The client provider owns saved fields, visible history, result banners, and Pilot progress without a DOM bridge.

## Manual Runtime Failure: Pilot Progress Hydration Mismatch

Pilot progress now follows the same rule as editable fields: server and first client render use deterministic baseline markup, and browser-local demo state is applied only after hydration. `npm run pilot-progress:qa` verifies the progress title remains a full stable string and still updates after Billing is completed from Pilot Mode.

## Not Production Persistence

This contract proves local/demo execution. Database completion persistence remains opt-in, RLS is not enabled, and production document or evidence storage is not claimed.

## State Ownership Model

Server renders definitions/static shell. The client provider owns live completion state.

Local/demo persistence is adapter-driven. Pilot progress derives from provider state. Editable fields are saved through the provider and rehydrated only after React mounts.

## Pilot Slice Lockdown

The editable field contract is part of the locked Pilot acceptance gate. `npm run pilot:acceptance` verifies that Billing, Field Issue, and Closeout still require saved human inputs before downstream actions unlock. `npm run pilot:acceptance-visual` is the visual companion when screenshots are required.

The local dev runtime caveat is handled by running acceptance on the production build server. This remains a Controlled internal pilot candidate — not production ready.

## Business Outcome Records

Saved editable fields now feed the business outcome record generated at terminal completion. The record shows captured inputs, evidence/document references, linked outputs, business impact, remaining blockers, next business step, and historical record label. This remains local/demo behavior unless database pilot mode is explicitly enabled.
