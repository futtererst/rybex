# Billing v2 Domain Command Contract

This document defines the future Billing v2 domain command contract. It is specification only. No Billing v2 code, UI, route, persistence, auth, RLS, Pilot Mode, Field, or Closeout behavior is implemented by this document.

## Required Domain Events

- `BillingBackupPackageStarted`
- `BillingBackupSummarySaved`
- `BillingSourceRecordSaved`
- `BillingAmountAffectedSaved`
- `BillingEvidenceReferenceSaved`
- `BillingEvidenceRequirementWaived`
- `BillingPackageReadinessValidated`
- `BillingCommercialReviewTaskCreated`
- `BillingCommercialReviewApproved`
- `BillingCommercialReviewChangesRequested`
- `BillingCommercialReviewRejected`
- `BillingResolutionNoteSaved`
- `BillingBlockerCleared`
- `BillingBlockerReopened`
- `BillingOutcomeRecordGenerated`
- `BillingHistoricalRecordGenerated`

## Command Contract

| Command | Business Purpose | Input Shape | Allowed States | Validation Rules | Produced Event | State Transition | History Entry | Success Message | Failure Message | QA Requirement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `startBackupPackage` | Begin work on a blocked billing backup package. | `{ packageId, actorId, startedAt }` | `blocked`, `reopened` | Package exists and is not cleared. | `BillingBackupPackageStarted` | `blocked` or `reopened` -> `backup_package_in_progress` | Backup package started by actor. | "Billing backup package started." | "This billing blocker is already cleared." | Prove initial blocked package can start and cleared package cannot restart without reopen. |
| `saveBackupSummary` | Capture what backup is being assembled and why. | `{ packageId, actorId, summary }` | `backup_package_in_progress`, `evidence_required`, `reopened` | Summary must not be blank. | `BillingBackupSummarySaved` | Preserve current state unless readiness validation moves it later. | Backup summary saved and displayed. | "Backup summary saved." | "Enter a backup summary before saving." | Prove saved summary appears in package, outcome, and history. |
| `saveRelatedSourceRecord` | Link the package to a source record such as CE-004, daily report, or stored material support. | `{ packageId, actorId, sourceRecordId?, sourceRecordLabel, sourceRecordType }` | `backup_package_in_progress`, `evidence_required`, `reopened` | Source record label/type must not be blank. | `BillingSourceRecordSaved` | Preserve current state unless readiness validation moves it later. | Source record saved. | "Source record linked." | "Link a source record before saving." | Prove missing source record blocks readiness. |
| `saveAmountAffected` | Record the cash impact associated with the backup blocker. | `{ packageId, actorId, amountAffected, currency }` | `backup_package_in_progress`, `evidence_required`, `reopened` | Amount must be numeric and greater than zero. | `BillingAmountAffectedSaved` | Preserve current state unless readiness validation moves it later. | Amount affected saved. | "Amount affected saved." | "Enter the amount affected before saving." | Prove amount is required and supports values beyond Pay App 003 demo data. |
| `saveEvidenceReference` | Satisfy an evidence requirement by recording a structured reference or attachment pointer. | `{ packageId, actorId, evidenceRequirementId, referenceText, referenceType, linkedRecordId?, storagePointer? }` | `backup_package_in_progress`, `evidence_required`, `reopened`, `commercial_review_changes_requested` | Requirement exists; reference text must not be blank; reference type must be valid. | `BillingEvidenceReferenceSaved` | Preserve current state until readiness validation. | Evidence reference saved with requirement label. | "Evidence reference saved." | "Enter an evidence reference before saving this item." | Prove structured reference changes evidence status to referenced and appears in history. |
| `waiveEvidenceRequirement` | Allow an evidence requirement to be waived when accepted by the process. | `{ packageId, actorId, evidenceRequirementId, waiverReason }` | `backup_package_in_progress`, `evidence_required`, `reopened`, `commercial_review_changes_requested` | Requirement exists; waiver allowed; waiver reason is not blank. | `BillingEvidenceRequirementWaived` | Preserve current state until readiness validation. | Evidence requirement waived with reason. | "Evidence requirement waived with reason." | "Waiver reason is required before this evidence requirement can be waived." | Prove required waiver reason and historical record capture. |
| `validatePackageReadiness` | Determine whether the package can be sent to commercial review. | `{ packageId, actorId }` | `backup_package_in_progress`, `evidence_required`, `reopened`, `commercial_review_changes_requested` | Summary, source record, amount, and required evidence must be complete or waived. | `BillingPackageReadinessValidated` | Pass -> `package_ready_for_review`; fail -> `evidence_required`. | Readiness validated with missing items or ready status. | "Package is ready for commercial review." | "Complete backup summary, source record, amount affected, and required evidence before review." | Prove readiness true only when all required items are satisfied. |
| `sendPackageToCommercialReview` | Create a review task and hand the package to commercial review. | `{ packageId, actorId, assignedRole, dueDate? }` | `package_ready_for_review` | Readiness must be true; no pending review task exists. | `BillingCommercialReviewTaskCreated` | `package_ready_for_review` -> `commercial_review_pending` | Commercial review task created with assigned role. | "Commercial review task created." | "Complete required evidence references before sending to commercial review." | Prove send creates `BillingReviewTask` and cannot run before readiness. |
| `approveCommercialReview` | Approve the backup package for blocker clearance path. | `{ packageId, reviewTaskId, reviewerId, decisionNote }` | `commercial_review_pending` | Review task pending; decision note is not blank. | `BillingCommercialReviewApproved` | `commercial_review_pending` -> `commercial_review_approved` | Review approved with note. | "Commercial review approved." | "Enter a commercial review decision note before approving." | Prove approval is required before blocker clearance. |
| `requestCommercialReviewChanges` | Return the package for correction without rejecting it. | `{ packageId, reviewTaskId, reviewerId, decisionNote }` | `commercial_review_pending` | Review task pending; decision note is not blank. | `BillingCommercialReviewChangesRequested` | `commercial_review_pending` -> `commercial_review_changes_requested` | Changes requested with note. | "Changes requested. Update the package before resubmitting." | "Enter a change request note before returning the package." | Prove request changes prevents blocker clearance. |
| `rejectCommercialReview` | Reject the package and prevent blocker clearance until reopened. | `{ packageId, reviewTaskId, reviewerId, decisionNote }` | `commercial_review_pending` | Review task pending; decision note is not blank. | `BillingCommercialReviewRejected` | `commercial_review_pending` -> `commercial_review_rejected` | Review rejected with note. | "Commercial review rejected." | "Enter a rejection note before rejecting the package." | Prove rejection blocks clearance. |
| `saveResolutionNote` | Capture why the blocker is being cleared after approval. | `{ packageId, actorId, resolutionNote }` | `commercial_review_approved` | Resolution note must not be blank. | `BillingResolutionNoteSaved` | Preserve `commercial_review_approved`. | Resolution note saved. | "Resolution note saved." | "Enter a resolution note before saving." | Prove resolution note is required before clear. |
| `clearBillingBlocker` | Move the business object to blocker-cleared outcome after approved review. | `{ packageId, actorId }` | `commercial_review_approved` | Review approved; readiness true; resolution note exists; no remaining blockers. | `BillingBlockerCleared`, `BillingOutcomeRecordGenerated`, `BillingHistoricalRecordGenerated` | `commercial_review_approved` -> `billing_blocker_cleared` | Billing blocker cleared; outcome and historical record generated. | "Billing backup blocker resolved. Pay app backup is ready for commercial review." | "Commercial review must be approved before the billing blocker can be cleared." or "Enter a resolution note before clearing this blocker." | Prove outcome and historical record generation after clearance. |
| `reopenBillingBlocker` | Reopen a cleared, rejected, or changes-requested package for additional work. | `{ packageId, actorId, reopenReason }` | `billing_blocker_cleared`, `commercial_review_rejected`, `commercial_review_changes_requested` | Reopen reason must not be blank. | `BillingBlockerReopened` | Current state -> `reopened` | Billing blocker reopened with reason. | "Billing backup package reopened." | "Enter a reopen reason before reopening this package." | Prove terminal and review-returned states can reopen safely. |

## Contract Rules

- Commands must return updated domain state plus produced events.
- Commands must not mutate UI-specific state directly.
- User-facing messages must be derived from command results or known guard failures.
- Demo data may seed Pay App 003, but service logic must not hardcode Pay App 003.
- Outcome and historical record generation belongs to the domain layer or a domain service boundary, not to a button handler.
