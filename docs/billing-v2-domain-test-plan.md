# Billing v2 Domain Test Plan

Billing v2 tests must be written before UI work begins. This is specification only. No tests or runtime behavior are implemented by this document.

## 1. State Machine Tests

- Initial package starts in `blocked`.
- `startBackupPackage` moves `blocked` to `backup_package_in_progress`.
- Save commands preserve state unless readiness validation intentionally changes state.
- Readiness becomes true only when required data and evidence are complete.
- `requestCommercialReviewChanges` prevents blocker clearance.
- `rejectCommercialReview` prevents blocker clearance.
- `approveCommercialReview` enables the blocker-clearance path.
- `reopenBillingBlocker` works from terminal or review-returned states.

## 2. Evidence Tests

- Required evidence starts missing.
- `saveEvidenceReference` changes item status to referenced.
- `waiveEvidenceRequirement` requires waiver reason.
- Missing required evidence prevents review.
- Structured evidence references appear in outcome and historical record.
- Evidence requirements cannot be satisfied by a general package note.

## 3. Review Tests

- `sendPackageToCommercialReview` creates a review task.
- Review cannot be approved without decision note.
- Request changes creates user-facing update requirement.
- Rejection blocks clearance.
- Approval is required before clearance.

## 4. Blocker Clearance Tests

- Cannot clear before review approval.
- Cannot clear without resolution note.
- Clearance generates blocker resolution.
- Clearance generates outcome record.
- Clearance generates historical record.

## 5. Regression Tests

- No raw technical state labels in user-facing output.
- No generic resolved-only outcome.
- No Pay App 003 hardcoded in domain service logic.
- Demo data can use Pay App 003, but service must support any package.
- Phase 1A does not create UI components, routes, persistence, auth/RLS changes, Pilot Mode changes, or Field/Closeout changes.

## Phase 1A Test Gate

Phase 1A is accepted only when domain tests prove readiness gating, review approval gating, rejection/request-changes behavior, waiver reason validation, blocker clearance, outcome record generation, and historical record generation.
