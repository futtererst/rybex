# Billing v2 Phase 1A — Domain Model, State Machine, Commands, Guards, and Tests

Use this prompt for the next future implementation pass only. Do not execute it during the documentation/specification pass that created this file.

## Prompt

You are working in the RybexOS D5O platform at:

`C:\Users\futte\OneDrive\Documents\Rybex 2`

Current direction:

Implement Billing v2 Phase 1A as a domain-only layer. Do not build UI yet.

Billing v2 must move a billing backup package through a tested domain state machine before any screen work begins. Demo data may use Pay App 003, but the domain service must support any billing backup package and must not hardcode Pay App 003 except in demo state.

## Read Before Coding

Review:

- `docs/adr/0001-billing-v2-local-demo-reference-first.md`
- `docs/adr/0002-billing-v2-domain-state-machine.md`
- `docs/adr/0003-billing-v2-commercial-review-simulation.md`
- `docs/adr/0004-billing-v2-evidence-reference-model.md`
- `docs/adr/0005-billing-v2-pilot-integration-boundary.md`
- `docs/billing-v2-state-transition-matrix.md`
- `docs/billing-v2-domain-command-contract.md`
- `docs/billing-v2-domain-test-plan.md`
- `docs/billing-v2-data-model-mapping.md`
- `docs/billing-v2-enterprise-workflow-implementation-spec.md`

## Implement Only

- `lib/d5o/billing-v2/types.ts`
- `lib/d5o/billing-v2/demo-state.ts`
- `lib/d5o/billing-v2/billing-v2-service.ts`
- `lib/d5o/billing-v2/billing-v2-reducer.ts` if needed
- `lib/d5o/billing-v2/billing-v2-events.ts` if needed
- `scripts/verify-billing-v2-domain.mjs`
- tests or scripts for Billing v2 domain behavior

## Explicitly Prohibited

Do not implement UI components.

Do not change routes.

Do not change persistence.

Do not change auth.

Do not enable RLS.

Do not change Pilot Mode behavior.

Do not modify Field or Closeout workflows.

Do not create a parallel workflow engine.

Do not claim users can run Billing v2.

## Required Domain Commands

- `startBackupPackage`
- `saveBackupSummary`
- `saveRelatedSourceRecord`
- `saveAmountAffected`
- `saveEvidenceReference`
- `waiveEvidenceRequirement`
- `validatePackageReadiness`
- `sendPackageToCommercialReview`
- `approveCommercialReview`
- `requestCommercialReviewChanges`
- `rejectCommercialReview`
- `saveResolutionNote`
- `clearBillingBlocker`
- `reopenBillingBlocker`

## Required Domain Tests

- readiness gating
- review approval gating
- rejection/request changes
- waiver reason
- blocker clearance
- outcome and historical record creation

## Acceptance Criteria

- Domain state machine implements commands, guards, events, and transitions from the state transition matrix.
- Package readiness requires backup summary, source record, amount affected, and required evidence references or waivers.
- Sending to review creates a `BillingReviewTask`.
- Clear blocker is impossible unless review is approved.
- Clear blocker is impossible unless resolution note exists.
- Request changes and rejection prevent blocker clearance.
- Clearance generates outcome and historical record objects.
- Domain logic is reusable and not hardcoded to Pay App 003 except demo data.
- Existing `WorkflowCompletionProvider` remains the shared architecture boundary for later integration.
- No UI, route, persistence, auth/RLS, Pilot Mode, Field, or Closeout changes occur.
