# Billing v2 UI Wireframe Specification

This is a section-by-section UI contract for a future Billing v2 focused task screen. It is not a design image and it does not implement UI. Phase 1A must not build these sections; the UI belongs to a later Phase 1B after the domain state machine and tests pass.

## 1. Business Process Header

Purpose: orient the user to the business process and object before showing controls.

Must show:

- title: "Billing Backup Package"
- business process: "Billing backup completion and pay application review readiness"
- business object: pay application backup package
- status: business label derived from domain state
- owner: Billing / Commercial user
- reviewer: Commercial reviewer / Finance/Admin
- local/demo caveat: "Local/demo package only. Evidence is referenced for pilot workflow review; production upload and pay application submission are not enabled."

## 2. Pay App Blocker Summary

Must show:

- Pay App 003
- $84,000 blocked
- blocker reason: missing or incomplete backup documentation
- related item: CE-004 / stored material support
- current state with business label

## 3. Billing Backup Package Builder

Must show editable controls for:

- backup summary
- related source record
- amount affected
- review note

Each saved value must remain visible after save and appear in the historical record.

## 4. Evidence Requirement Checklist

Must show:

- Signed T&M ticket
- Daily report reference
- Photo log reference
- Supervisor confirmation
- Product approval backup

Each evidence item must show:

- required/optional flag
- status
- reference field
- save reference button
- waive with reason if allowed
- saved value

Evidence cannot be represented only by a general note.

## 5. Package Readiness Panel

Must show:

- readiness status
- missing items
- why send-to-review is disabled or enabled

Required disabled message:

"Complete required evidence references before sending to commercial review."

## 6. Commercial Review Task Panel

Must show:

- review task status
- assigned role
- review package summary
- due placeholder
- send to review CTA

Sending to review must create a `BillingReviewTask`; it cannot only change a status label.

## 7. Review Decision Panel

Must show:

- approve package
- request changes
- reject package
- decision note
- review state

Review decision actions must be visible as local/demo controls only until production auth and role enforcement are approved.

## 8. Blocker Clearance Panel

Must show:

- resolution note
- clear billing blocker CTA
- disabled reason until review approved and resolution note exists

Required disabled messages:

- "Commercial review must be approved before the billing blocker can be cleared."
- "Enter a resolution note before clearing this blocker."

## 9. Outcome Record Panel

Must show after clearance:

- business outcome
- business object moved
- business impact
- evidence captured
- remaining blockers
- next business step

Required outcome copy:

"Billing backup blocker resolved. Pay App 003 is ready for commercial review. The $84,000 cash recovery path is no longer blocked by missing backup for this item."

## 10. Historical Record Panel

Must show:

- saved fields
- evidence references
- review task
- review decision
- state transitions
- outcome
- local/demo status

The user must be able to answer where the record can be found later.

## 11. Remaining Blockers Panel

Must show:

- none, or
- a clear list of unresolved package blockers

If there are no blockers, state "No remaining blockers for this backup package."

## 12. Next Business Step Panel

Must show clear next CTAs:

- Open billing records
- Return to Pilot Mode

The next step should not imply production pay app submission unless that scope is separately implemented and accepted.

## UI Density Guardrail

- Do not show all details above the fold.
- Lead with the business problem, package readiness, and next action.
- Dense historical details should be available but subordinate.
- Do not let Billing v2 become another dashboard.
- Do not introduce broad Billing module redesign in the Billing v2 focused task pass.
