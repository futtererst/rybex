# Billing v2 Replacement UI Implementation Plan

## Objective

Replace the rejected Billing v2 Phase 1B form-and-button UI with a guided business workflow that helps a Billing / Commercial user move Pay App 003 backup package from blocked to commercial review readiness and blocker clearance.

This is a future implementation plan only. No replacement UI implementation occurred in this pass, no app behavior changed, and the failed UI should not be committed as accepted UI.

## Principles

- Preserve the accepted Phase 1A domain layer.
- Discard/rework the failed Phase 1B section-dashboard approach.
- Implement the UI as a guided workflow shell.
- React components must render domain state and call domain commands.
- Business rules stay in the Billing v2 domain layer.
- Do not create a second workflow engine.
- Do not refactor Field or Closeout.
- Do not change persistence, auth, RLS, Supabase schema, or Pilot Mode behavior.

## Replacement UI Shape

Implement a guided Billing v2 shell with three major zones:

- ProcessRail
- ActiveStepWorkspace
- ReadinessContextPanel

## Future Component Plan

Likely future components:

- `GuidedBillingV2Workflow`
- `BillingV2ProcessRail`
- `BillingV2ActiveStepWorkspace`
- `BillingV2ReadinessContextPanel`
- `UnderstandBlockerStep`
- `BuildBackupPackageStep`
- `AddRequiredProofStep`
- `SubmitCommercialReviewStep`
- `RecordReviewDecisionStep`
- `ClearBillingBlockerStep`
- `BillingOutcomeRecordStep`

This list is an implementation map, not work completed in this pass.

## Implementation Phases

### Phase 1 — Guided Shell

- Implement the shell layout.
- Add the process rail.
- Add active-step routing/state for the seven UI steps.
- Add readiness/context panel.
- Keep first render deterministic.

### Phase 2 — Active Step Components

- Implement Understand blocker.
- Implement Build backup package.
- Implement Add required proof.
- Implement Submit for commercial review.
- Implement Record review decision.
- Implement Clear billing blocker.
- Implement View outcome record.

### Phase 3 — Domain Command Wiring

- Wire step actions to existing Phase 1A domain commands.
- Use domain results for feedback and validation.
- Use domain readiness for review gating.
- Use domain review decision state for blocker clearance gating.
- Use domain outcome and history generation for final record display.

### Phase 4 — QA

Add step-by-step QA that proves:

- user starts at the blocker explanation
- only current-step fields are visible
- package details unlock evidence
- evidence readiness unlocks review
- review task is created
- approval is required before clearance
- resolution note is required before clearance
- outcome record is visible and business-specific
- historical record is referenceable

### Phase 5 — Manual Review

Manual review must confirm:

- the screen feels like a guided business workflow
- the user understands Pay App 003
- the $84,000 blocked impact is obvious
- evidence feels like a package
- review feels like a handoff
- blocker clearance feels like a business movement
- outcome is meaningful

## Non-Goals

- No production pay app submission.
- No external GC submission.
- No production document upload claim.
- No RLS/auth expansion.
- No persistence change.
- No Pilot Mode redesign.
- No Field or Closeout refactor.
- No new workflow engine.
