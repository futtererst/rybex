# Billing v2 Phase 1A Domain Review

## Executive Summary

Billing v2 Phase 1A domain review is complete.

Recommendation: **Accepted for Phase 1B UI**.

This recommendation applies only to a future UI implementation pass that consumes the accepted domain layer. Billing v2 is not user-facing yet. No UI components, routes, `app/billing/page.tsx`, Pilot Mode behavior, persistence, auth, RLS, Field workflow, or Closeout workflow changed in Phase 1A.

## Files Implemented

- `lib/d5o/billing-v2/types.ts`
- `lib/d5o/billing-v2/demo-state.ts`
- `lib/d5o/billing-v2/billing-v2-events.ts`
- `lib/d5o/billing-v2/billing-v2-readiness.ts`
- `lib/d5o/billing-v2/billing-v2-outcomes.ts`
- `lib/d5o/billing-v2/billing-v2-history.ts`
- `lib/d5o/billing-v2/billing-v2-service.ts`
- `lib/d5o/billing-v2/index.ts`
- `scripts/qa-billing-v2-domain.mjs`
- `scripts/verify-billing-v2-domain.mjs`

## Separation Of Concerns Decision

The original domain service has been split so Billing v2 is easier to reason about before UI work begins.

- Events live in `billing-v2-events.ts`.
- Readiness and evidence completeness live in `billing-v2-readiness.ts`.
- Outcome and blocker resolution generation live in `billing-v2-outcomes.ts`.
- History and historical record generation live in `billing-v2-history.ts`.
- Command orchestration remains in `billing-v2-service.ts`.
- Public exports are centralized in `index.ts`.

This keeps business commands visible while preventing readiness, event creation, outcome assembly, and historical record construction from becoming mixed into one catch-all file.

## Command List Verified

Verified domain commands:

- `startBackupPackage`
- `saveBackupSummary`
- `saveRelatedSourceRecord`
- `saveAmountAffected`
- `saveReviewNote`
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

Each command validates allowed state, validates required input, calls helper functions where appropriate, appends business-readable history, and returns a `BillingCommandResult`.

## State Lifecycle Verified

Verified states:

- `blocked`
- `backup_package_in_progress`
- `evidence_required`
- `package_ready_for_review`
- `commercial_review_pending`
- `commercial_review_approved`
- `commercial_review_changes_requested`
- `commercial_review_rejected`
- `billing_blocker_cleared`
- `reopened`

The state machine follows the Billing v2 state transition matrix. Request changes and rejection prevent blocker clearance. Reopen is available from cleared, rejected, or changes-requested states.

## Readiness Rules Verified

Package readiness requires:

- backup summary
- related source record
- amount affected greater than zero
- every required evidence item referenced, attached, verified, or waived with reason

QA verifies the package cannot be sent to review when any readiness requirement is missing.

## Evidence Rules Verified

Evidence requirements are structured records, not a general note. QA verifies:

- required evidence starts missing
- evidence reference changes the item to referenced
- waiver requires a reason
- missing required evidence blocks commercial review
- evidence references appear in outcome and historical records

## Review Rules Verified

Commercial review is represented by a `BillingReviewTask` and `BillingReviewDecision`.

QA verifies:

- sending to review creates a review task
- approval requires a decision note
- request changes moves to `commercial_review_changes_requested`
- rejection moves to `commercial_review_rejected`
- approval is required before blocker clearance

## Blocker-Clearance Rules Verified

Billing blocker clearance requires:

- commercial review approved
- readiness still valid
- resolution note saved
- no remaining package blockers

QA verifies the blocker cannot clear before approval, after request changes, after rejection, without a resolution note, or if readiness becomes invalid after approval.

## Outcome And Historical Record Verified

Outcome record verification confirms:

- business object included
- $84,000 blocked amount included
- evidence references included
- review decision included
- next business step included
- final outcome is business-specific, not generic resolved-only language

Historical record verification confirms:

- saved fields included
- evidence references included
- review decision included
- state transitions included
- outcome included

## Negative-Path QA Coverage

`npm run billing-v2:qa-domain` explicitly tests:

- missing backup summary blocks review
- missing source record blocks review
- missing or zero amount affected blocks review
- missing required evidence blocks review
- evidence waiver without reason fails
- review approval without decision note fails
- request changes prevents clearance
- rejection prevents clearance
- clearance before review approval fails
- clearance without resolution note fails
- clearance fails if readiness is no longer valid
- outcome record completeness
- historical record completeness
- reusable service logic does not hardcode Pay App 003

## Risks Remaining

- Phase 1B UI must consume the domain state machine rather than recreate business rules in components.
- Pilot Mode integration must remain separate and must not refactor Field or Closeout.
- Local/demo reference-first behavior must stay clearly labeled in the future UI.
- Future persistence must not be added without a separate schema, auth, RLS, and storage review.

## Recommendation

**Accepted for Phase 1B UI**.

Phase 1B may begin only as a separate UI implementation pass that consumes this domain layer. Phase 1B must not claim production readiness, production document storage, production pay application submission, auth/RLS hardening, or Pilot Mode redesign unless those scopes are separately approved.
