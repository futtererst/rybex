# Billing v2 State Transition Matrix

This document is an engineering guardrail for the future Billing v2 implementation. It is specification only. No Billing v2 runtime, UI, route, persistence, auth, RLS, Pilot Mode, Field, or Closeout behavior is implemented by this document.

## Business Object

Billing v2 moves a `BillingBackupPackage` for a pay application backup blocker. Demo data may use Pay App 003 and the $84,000 cash recovery impact, but domain logic must support any billing backup package.

## States

| State | Business Meaning | UI Display Label |
| --- | --- | --- |
| `blocked` | Pay application backup is missing or incomplete, and cash recovery is blocked. | Blocked |
| `backup_package_in_progress` | User has started building the backup package. | Backup package in progress |
| `evidence_required` | Required evidence, source record, amount, or summary is missing. | Evidence required |
| `package_ready_for_review` | Required fields and evidence requirements are satisfied or waived. | Ready for commercial review |
| `commercial_review_pending` | A commercial review task exists and awaits decision. | Commercial review pending |
| `commercial_review_approved` | Reviewer approved the package. | Commercial review approved |
| `commercial_review_changes_requested` | Reviewer requested changes before approval. | Changes requested |
| `commercial_review_rejected` | Reviewer rejected the package. | Commercial review rejected |
| `billing_blocker_cleared` | The billing blocker was cleared after approved review and resolution note. | Billing blocker cleared |
| `reopened` | A previously terminal or review-returned package was reopened for more work. | Reopened |

## Package Readiness Rule

Package readiness is true only when:

- backup summary exists
- related source record exists
- amount affected exists and is greater than zero
- every required evidence item is referenced, attached, verified, or waived with reason
- no required evidence item is missing

User cannot send package to commercial review until package readiness is true.

## Transition Matrix

| Current State | Command | Guard | Next State | Blocked/Error Message | Event And History |
| --- | --- | --- | --- | --- | --- |
| `blocked` | `startBackupPackage` | Package exists and is not cleared. | `backup_package_in_progress` | "This billing blocker is already cleared." | `BillingBackupPackageStarted`; history: backup package started. |
| `backup_package_in_progress`, `evidence_required`, `reopened` | `saveBackupSummary` | Summary is not blank. | Current state, or `evidence_required` if readiness still fails. | "Enter a backup summary before saving." | `BillingBackupSummarySaved`; history: summary saved. |
| `backup_package_in_progress`, `evidence_required`, `reopened` | `saveRelatedSourceRecord` | Source record label/reference is not blank. | Current state, or `evidence_required` if readiness still fails. | "Link a source record before saving." | `BillingSourceRecordSaved`; history: source record saved. |
| `backup_package_in_progress`, `evidence_required`, `reopened` | `saveAmountAffected` | Amount is numeric and greater than zero. | Current state, or `evidence_required` if readiness still fails. | "Enter the amount affected before saving." | `BillingAmountAffectedSaved`; history: amount affected saved. |
| `backup_package_in_progress`, `evidence_required`, `reopened`, `commercial_review_changes_requested` | `saveEvidenceReference` | Evidence requirement exists and reference text is not blank. | Current state, or `evidence_required` if readiness still fails. | "Enter an evidence reference before saving this item." | `BillingEvidenceReferenceSaved`; history: evidence reference saved. |
| `backup_package_in_progress`, `evidence_required`, `reopened`, `commercial_review_changes_requested` | `waiveEvidenceRequirement` | Evidence requirement allows waiver and waiver reason is not blank. | Current state, or `evidence_required` if readiness still fails. | "Waiver reason is required before this evidence requirement can be waived." | `BillingEvidenceRequirementWaived`; history: evidence requirement waived with reason. |
| `backup_package_in_progress`, `evidence_required`, `reopened`, `commercial_review_changes_requested` | `validatePackageReadiness` | Readiness rule passes. | `package_ready_for_review` | "Complete required evidence references before sending to commercial review." | `BillingPackageReadinessValidated`; history: package readiness validated. |
| `backup_package_in_progress`, `evidence_required`, `reopened`, `commercial_review_changes_requested` | `validatePackageReadiness` | Readiness rule fails. | `evidence_required` | "Complete backup summary, source record, amount affected, and required evidence before review." | `BillingPackageReadinessValidated`; history: readiness failed with missing items. |
| `package_ready_for_review` | `sendPackageToCommercialReview` | Readiness is true and no active pending review task exists. | `commercial_review_pending` | "Complete required evidence references before sending to commercial review." | `BillingCommercialReviewTaskCreated`; history: commercial review task created. |
| `backup_package_in_progress`, `evidence_required`, `reopened`, `commercial_review_changes_requested` | `sendPackageToCommercialReview` | Readiness is false. | Current state or `evidence_required` | "Complete required evidence references before sending to commercial review." | No state-changing event; history may record blocked attempt only if QA requires it. |
| `commercial_review_pending` | `approveCommercialReview` | Decision note exists. | `commercial_review_approved` | "Enter a commercial review decision note before approving." | `BillingCommercialReviewApproved`; history: commercial review approved. |
| `commercial_review_pending` | `requestCommercialReviewChanges` | Decision note exists. | `commercial_review_changes_requested` | "Enter a change request note before returning the package." | `BillingCommercialReviewChangesRequested`; history: changes requested. |
| `commercial_review_pending` | `rejectCommercialReview` | Decision note exists. | `commercial_review_rejected` | "Enter a rejection note before rejecting the package." | `BillingCommercialReviewRejected`; history: commercial review rejected. |
| `commercial_review_approved` | `saveResolutionNote` | Resolution note is not blank. | `commercial_review_approved` | "Enter a resolution note before saving." | `BillingResolutionNoteSaved`; history: resolution note saved. |
| `commercial_review_approved` | `clearBillingBlocker` | Review is approved, readiness is true, resolution note exists, and no remaining package blockers exist. | `billing_blocker_cleared` | "Enter a resolution note before clearing this blocker." | `BillingBlockerCleared`, `BillingOutcomeRecordGenerated`, `BillingHistoricalRecordGenerated`; history: blocker cleared, outcome and historical record generated. |
| `blocked`, `backup_package_in_progress`, `evidence_required`, `package_ready_for_review`, `commercial_review_pending`, `commercial_review_changes_requested`, `commercial_review_rejected`, `reopened` | `clearBillingBlocker` | Review is not approved. | Current state | "Commercial review must be approved before the billing blocker can be cleared." | No state-changing event; history may record blocked attempt only if QA requires it. |
| `commercial_review_rejected` | `clearBillingBlocker` | Review was rejected. | `commercial_review_rejected` | "Rejected billing packages cannot clear the blocker. Reopen the package to continue." | No state-changing event. |
| `billing_blocker_cleared` | `reopenBillingBlocker` | Reopen reason exists. | `reopened` | "Enter a reopen reason before reopening this billing blocker." | `BillingBlockerReopened`; history: cleared blocker reopened. |
| `commercial_review_rejected`, `commercial_review_changes_requested` | `reopenBillingBlocker` | Reopen reason exists. | `reopened` | "Enter a reopen reason before reopening this package." | `BillingBlockerReopened`; history: review-returned package reopened. |
| `reopened` | `startBackupPackage` | Package is reopened and not cleared. | `backup_package_in_progress` | "This package is already active." | `BillingBackupPackageStarted`; history: reopened package moved back to active work. |

## Required Invariants

- User cannot send package to commercial review until package readiness is true.
- Package readiness requires backup summary, source record, amount affected, and all required evidence either referenced, attached, verified, or waived with reason.
- Sending to review creates a `BillingReviewTask`.
- User cannot clear billing blocker until commercial review is approved.
- User cannot clear billing blocker until resolution note exists.
- Request changes moves package to `commercial_review_changes_requested`.
- Rejection moves package to `commercial_review_rejected` and prevents clearance.
- Reopen moves a cleared, rejected, or requested-changes package to `reopened`; `startBackupPackage` may then move `reopened` to `backup_package_in_progress`.

## Required User-Facing Blocked Messages

- "Complete required evidence references before sending to commercial review."
- "Commercial review must be approved before the billing blocker can be cleared."
- "Enter a resolution note before clearing this blocker."
- "Waiver reason is required before this evidence requirement can be waived."
