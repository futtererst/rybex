# Billing v2 Enterprise Workflow Implementation Specification

## 1. Executive Summary

Billing v2 is the future implementation specification for a true enterprise billing backup package process. It replaces a button/state workflow with a business process that takes a blocked pay application backup package through evidence completion, commercial review, approval, blocker clearance, outcome creation, and historical record creation.

Workflow: **Billing Backup Package → Commercial Review → Billing Blocker Cleared**

Business object: **Pay App 003 backup package**

Business process: **Billing backup completion and pay application review readiness**

Starting problem: Pay App 003 is blocked because required backup documentation is missing or incomplete.

Business impact: The $84,000 cash recovery path is blocked until the backup package is documented, evidenced, reviewed, and approved.

Primary user: Billing / Commercial user.

Supporting user: Project Manager.

Reviewer: Commercial reviewer / Finance/Admin.

This document is an implementation specification only. It does not implement code, UI, workflow runtime behavior, routes, persistence, auth, RLS, Pilot Mode changes, Field/Closeout refactors, or production readiness.

## 2. Business Problem

Pay App 003 contains a billing item that cannot move cleanly to review because required backup is missing or incomplete.

- Pay application: Pay App 003.
- Blocked amount: $84,000.
- Missing backup: product approval backup and supporting billing evidence for the affected item.
- Business risk: the pay application may be rejected, delayed, disputed, or excluded from review if the backup package is not complete and traceable.
- Current state: blocked until the package is documented, evidence is referenced or uploaded, commercial review approves the package, and the blocker is cleared.

The workflow must make clear that the user is not merely resolving a task. The user is preparing a billing backup package that supports cash recovery and commercial review readiness.

## 3. Business Object Model

### BillingBackupPackage

- Purpose: The central business object for Pay App 003 backup readiness.
- Key fields: packageId, payApplicationId, payApplicationNumber, projectId, blockedAmount, status, owner, sourceRecordId, backupSummary, readinessStatus, reviewStatus, resolutionStatus.
- Relationships: owns evidence requirements, evidence references, review task, review decisions, blocker resolution, outcome record, and historical record.
- Schema status: current billing backup and pay application seed/domain concepts exist; future schema may be needed for a durable package object.

### BillingEvidenceRequirement

- Purpose: Defines what proof is required for the package.
- Key fields: requirementId, packageId, evidenceType, required, status, waiverAllowed, verifierRole.
- Relationships: belongs to BillingBackupPackage; can be satisfied by evidence references, uploads, verifications, or waivers.
- Schema status: current evidence requirement concepts exist; future schema may be needed for Billing-specific requirement policies.

### BillingEvidenceReference

- Purpose: Captures where the reviewer can inspect proof.
- Key fields: referenceId, packageId, requirementId, label, referenceType, referenceValue, sourceRecordId, savedBy, savedAt.
- Relationships: satisfies one or more BillingEvidenceRequirements and appears in outcome/historical records.
- Schema status: current local/demo references exist conceptually; future schema may be needed for durable references and attachments.

### BillingReviewTask

- Purpose: Creates the commercial review handoff.
- Key fields: taskId, packageId, assignedRole, assignedOwner, status, dueDate, reviewPackageSummary, createdBy, createdAt.
- Relationships: belongs to BillingBackupPackage; receives BillingReviewDecision records.
- Schema status: future schema likely needed unless mapped to existing workflow/review task tables.

### BillingReviewDecision

- Purpose: Records reviewer action.
- Key fields: decisionId, taskId, packageId, decision, decisionNote, decidedBy, decidedAt, nextState.
- Relationships: belongs to BillingReviewTask and controls whether blocker clearance is allowed.
- Schema status: future schema likely needed or mapped to review_decisions / approval_events.

### BillingBlockerResolution

- Purpose: Records the final clearance of the billing blocker after approval.
- Key fields: resolutionId, packageId, resolutionNote, clearedBy, clearedAt, priorState, nextState, remainingBlockers.
- Relationships: follows approved BillingReviewDecision and feeds outcome/historical records.
- Schema status: may map to workflow state transition and outcome records; future durable object may be useful.

### BillingOutcomeRecord

- Purpose: Summarizes the business outcome achieved.
- Key fields: outcomeId, packageId, payApplicationNumber, blockedAmount, finalOutcome, evidenceSummary, reviewDecision, remainingBlockers, nextBusinessStep, mode.
- Relationships: generated by BillingBlockerResolution and shown in workflow/Pilot surfaces.
- Schema status: current outcome record model exists for local/demo; durable storage may be needed for pilot/production.

### BillingHistoricalRecord

- Purpose: Creates the referenceable record of what happened.
- Key fields: historicalRecordId, packageId, workflowName, inputsCaptured, evidenceReferences, reviewTask, decision, stateTransitions, outcome, auditSummary, storageMode.
- Relationships: aggregates package, evidence, review, resolution, outcome, audit, and status history.
- Schema status: current local/demo historical record panel exists; future database-backed historical records may be needed.

## 4. State Lifecycle

### blocked

- Meaning: Pay App 003 backup package cannot move to review.
- Allowed actions: open package, enter backup summary, add evidence reference, upload/reference evidence, link source record.
- Required data: pay app, blocked amount, blocker reason, owner.
- Transition conditions: backup package work begins.

### backup_package_in_progress

- Meaning: User is building the package but it is not ready.
- Allowed actions: edit summary, add references, attach/upload evidence, link source records, save review note.
- Required data: backup summary draft and package owner.
- Transition conditions: evidence requirement evaluation begins.

### evidence_required

- Meaning: Required evidence is missing, incomplete, unverified, or unwaived.
- Allowed actions: add evidence reference, upload evidence, waive evidence with reason, return to package editing.
- Required data: evidence requirement list.
- Transition conditions: all required evidence is satisfied or waived.

### package_ready_for_review

- Meaning: The package passes readiness checks and can be handed off.
- Allowed actions: send to commercial review, continue editing before handoff.
- Required data: backup summary, amount affected, source record, required evidence satisfied/waived.
- Transition conditions: user sends package to review.

### commercial_review_pending

- Meaning: Commercial reviewer / Finance/Admin has a review task.
- Allowed actions: approve package, request changes, reject package.
- Required data: review task, assigned role/owner, review package, due date.
- Transition conditions: reviewer decision.

### commercial_review_approved

- Meaning: Reviewer approved the package for blocker clearance.
- Allowed actions: enter resolution note, clear blocker.
- Required data: decision note, reviewer, decision timestamp.
- Transition conditions: resolution note saved and no remaining package blockers exist.

### commercial_review_changes_requested

- Meaning: Reviewer requires changes before approval.
- Allowed actions: edit package, add evidence, respond to decision note, resubmit.
- Required data: decision note and requested changes.
- Transition conditions: package is updated and resubmitted to review.

### commercial_review_rejected

- Meaning: Reviewer rejected the package and blocker cannot be cleared.
- Allowed actions: reopen package, create corrective task, leave blocker open.
- Required data: rejection note.
- Transition conditions: user reopens and reworks package or accepts blocked status.

### billing_blocker_cleared

- Meaning: Missing backup is no longer the blocker for this Pay App 003 item.
- Allowed actions: view outcome record, view historical record, open pay app review/submission.
- Required data: approval, resolution note, satisfied/waived evidence, outcome record.
- Transition conditions: terminal unless reopened.

### reopened

- Meaning: Package was reopened after clearance or review due to new issue, rejected evidence, or manual reset.
- Allowed actions: edit package, add evidence, resubmit to review.
- Required data: reopen reason.
- Transition conditions: package re-enters in-progress/evidence-required/review states.

## 5. Required User Flow

1. User sees Pay App 003 blocked.
2. User opens Billing Backup Package.
3. User enters backup summary.
4. User references or uploads evidence.
5. System validates package readiness.
6. User sends package to commercial review.
7. Commercial review task is created.
8. Reviewer approves, requests changes, or rejects.
9. User clears billing blocker only after approval.
10. Outcome record is generated.
11. Historical record is visible.
12. Next step is pay app review/submission.

## 6. Required Fields

| Field | Label | Helper Text | Placeholder | Required | Validation | State Unlocked | Saved Display | History Impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| backupSummary | Backup summary | Explain what backup supports Pay App 003 and the $84,000 blocked amount. | Signed T&M ticket and product approval backup are available for CE-004. | Required | Minimum meaningful text before readiness. | backup_package_in_progress / evidence_required | Package builder, readiness panel, review package, outcome, historical record | Backup summary saved. |
| evidenceReference | Evidence reference | Point to the ticket, daily report, photo log, approval backup, or file/package location the reviewer should inspect. | Daily Report 2026-06-24, Photo Log PL-18, approval package in Billing/Pay App 003/CE-004. | Required unless satisfied by upload or waiver | Must link to at least one required evidence item. | package_ready_for_review | Evidence checklist, review package, outcome, historical record | Evidence reference saved. |
| relatedSourceRecord | Related source record | Link the package to the billing item, change event, stored material item, or support record. | CE-004 / stored material billing support. | Required | Must identify source of entitlement/support. | package_ready_for_review | Business object card, review task, historical record | Source record linked. |
| amountAffected | Amount affected | Confirm the cash value affected by this backup blocker. | $84,000 | Required | Must be positive and match or explain variance from source amount. | package_ready_for_review | Problem summary, review task, outcome record | Amount affected recorded. |
| reviewNote | Review note | Add context for the commercial reviewer. | Please verify stored material backup before including in Pay App 003 review. | Optional | Required only if future policy requires it. | commercial_review_pending | Review task and history | Review note added if provided. |
| resolutionNote | Resolution note | State why the billing backup blocker can be cleared for this item. | Commercial review approved the backup package for Pay App 003. | Required | Required after approval before clearance. | billing_blocker_cleared | Outcome, historical record, final banner | Resolution note saved. |
| waiverReason | Waiver reason | Explain why required backup is waived and what commercial risk remains. | Finance/Admin approved temporary waiver; risk remains if GC requests product approval backup before payment. | Required only for waiver path | Must identify accepted risk and approving role. | package_ready_for_review only if waiver policy allows | Evidence checklist, review task, outcome, historical record | Evidence waiver recorded. |

## 7. Evidence/Document Requirements

| Evidence | Required | Status Values | Upload/Reference/Waiver Behavior | Validation Behavior | Historical Record Behavior |
| --- | --- | --- | --- | --- | --- |
| Signed T&M ticket | Required when T&M support applies | missing, referenced, uploaded, verified, waived | Upload or reference ticket; waiver requires reason and risk. | Blocks review if required and missing/unwaived. | Record reference/upload/waiver and reviewer decision. |
| Daily report reference | Required | missing, referenced, verified, waived | Reference daily report or upload support. | Blocks review if absent. | Record daily report reference. |
| Photo log reference | Required when photo support applies | missing, referenced, uploaded, verified, waived | Reference photo log or attach photos. | Blocks review if required and absent. | Record photo log or waiver reason. |
| Supervisor confirmation | Required | missing, referenced, uploaded, verified, waived | Reference confirmation note or attach signoff. | Blocks review if required and absent. | Record confirmation and verifier. |
| Product approval backup | Required for this Pay App 003 blocker | missing, referenced, uploaded, verified, waived | Reference approval package or upload approved backup; waiver requires risk language. | Blocks review/clearance if missing/unwaived. | Record approval reference or waiver. |
| Related change event if applicable | Optional unless the billed item depends on change recovery | not_required, missing, linked, verified | Link change event or mark not required. | Blocks review only when applicable and missing. | Record linked change event or not-required status. |

## 8. Package Readiness Rules

Readiness checklist:

- backup summary complete
- evidence requirements satisfied or waived
- evidence references present
- amount affected recorded
- source record linked
- review note optional/complete
- no missing required evidence

User cannot send to review until readiness passes. Readiness failure must show the exact missing item and why it matters for Pay App 003 review.

## 9. Commercial Review Task

The commercial review task is created when the package is ready and the user sends it to review.

- Task creation behavior: create local/demo or database pilot review task tied to BillingBackupPackage.
- Assigned role: Commercial reviewer / Finance/Admin.
- Status: pending_review, approved, changes_requested, rejected.
- Due date: default from policy or package due date.
- Review package: problem, Pay App 003, blocked amount, backup summary, evidence checklist, references/uploads, waiver reasons, source record, review note.
- Approval decision: permits blocker clearance.
- Request changes: returns package to in-progress/evidence-required with decision note.
- Rejection: leaves blocker open and records rejection reason.
- Decision note: required for all decisions.
- Audit/history behavior: create activity, status transition, review decision, and historical trace entries.

## 10. Review Decision Model

### Approve Package

- Who can do it: Commercial reviewer / Finance/Admin.
- Required fields: decision note.
- State transition: commercial_review_pending -> commercial_review_approved.
- User feedback: package approved; blocker can be cleared after resolution note.
- Historical record: approval, reviewer, note, timestamp, reviewed evidence package.

### Request Changes

- Who can do it: Commercial reviewer / Finance/Admin.
- Required fields: decision note describing required changes.
- State transition: commercial_review_pending -> commercial_review_changes_requested.
- User feedback: package returned for correction; clearance remains blocked.
- Historical record: requested changes, reviewer, timestamp, next required edits.

### Reject Package

- Who can do it: Commercial reviewer / Finance/Admin.
- Required fields: rejection note.
- State transition: commercial_review_pending -> commercial_review_rejected.
- User feedback: package rejected; Pay App 003 remains blocked by backup issue.
- Historical record: rejection, reviewer, timestamp, reason, remaining blocker.

## 11. Blocker Clearance Rules

Billing blocker can be cleared only when:

- commercial review approved
- required evidence satisfied or waived
- resolution note entered
- no remaining package blockers

The user cannot clear the blocker from blocked, in-progress, evidence-required, pending-review, changes-requested, or rejected states.

## 12. Outcome Record

Final outcome record content:

- Pay App 003
- blocked amount: $84,000
- backup package status
- evidence/documents captured
- review decision
- approval note
- blocker cleared
- remaining blockers
- next business step
- local/demo vs database-backed status

Required final copy:

**“Billing backup blocker resolved. Pay App 003 is ready for commercial review. The $84,000 cash recovery path is no longer blocked by missing backup for this item.”**

## 13. Historical Record

Record label: Pay App 003 billing backup package historical record.

The historical record must include:

- user inputs captured
- evidence references
- review task
- decision
- state transitions
- outcome
- audit summary
- local/demo, Supabase pilot, or future production status

The user should reference it later from the Billing workflow record, Pay App 003 package history, workflow history, and any future pay application review screen.

## 14. Required UI Structure

Billing v2 UI should contain:

- Business Process Header
- Pay App Blocker Summary
- Billing Backup Package Builder
- Evidence Requirement Checklist
- Package Readiness Panel
- Commercial Review Task
- Review Decision Panel
- Blocker Clearance Panel
- Outcome Record
- Historical Record
- Remaining Blockers
- Next Business Step

This section defines future UI structure only. No UI is implemented by this specification.

## 15. Exact User-Facing Copy

- Workflow title: Billing Backup Package -> Commercial Review -> Billing Blocker Cleared
- Business problem statement: Pay App 003 is blocked because required backup documentation is missing or incomplete. The $84,000 cash recovery path cannot move to commercial review until the backup package is documented, evidenced, reviewed, and approved.
- Field label: Backup summary
- Helper text: Explain what backup supports Pay App 003 and the $84,000 blocked amount.
- Field label: Evidence reference
- Helper text: Point to the ticket, daily report, photo log, product approval backup, or file/package location the reviewer should inspect.
- Field label: Related source record
- Helper text: Link the backup package to the billing item, change event, stored material item, or support record.
- Field label: Amount affected
- Helper text: Confirm the cash value affected by this backup blocker.
- Field label: Review note
- Helper text: Add context for the commercial reviewer.
- Field label: Resolution note
- Helper text: State why the billing backup blocker can be cleared for this item.
- Field label: Waiver reason
- Helper text: Explain why required backup is waived and what commercial risk remains.
- Disabled button message: Complete backup summary, amount affected, source record, and required evidence before sending this package to review.
- Disabled button message: Commercial review approval is required before clearing this billing blocker.
- Disabled button message: Save a resolution note before clearing the Pay App 003 billing blocker.
- Success message: Backup package saved for Pay App 003.
- Success message: Evidence reference saved for Pay App 003.
- Handoff message: Pay App 003 backup package was sent to Commercial Review. The reviewer should inspect the backup summary, evidence references, source record, amount affected, and any waiver risk.
- Review message: Commercial review approved the Pay App 003 backup package.
- Review message: Commercial review requested changes. Update the package and resubmit before clearance.
- Review message: Commercial review rejected the package. Pay App 003 remains blocked by backup requirements.
- Final outcome message: Billing backup blocker resolved. Pay App 003 is ready for commercial review. The $84,000 cash recovery path is no longer blocked by missing backup for this item.
- Next CTA: Open pay app review.
- Local/demo caveat: This is local/demo workflow history only. It does not submit Pay App 003, upload production documents, notify external reviewers, or create production persistence.

## 16. Data And Persistence Strategy

### Local/demo implementation

Required for Billing v2 initial implementation unless a later product decision changes scope. It should simulate package state, evidence references, review task, review decision, outcome, and historical record in the existing local/demo pattern. It must clearly label local/demo behavior.

### Supabase pilot persistence

Future pilot option. It may write workflow instance, package metadata, evidence references, review task, decision, outcome, historical record, audit events, and status history after schema mapping and security review.

### Future production persistence

Future hardening only. Requires production auth, RLS, secure document storage, durable audit logs, backups/recovery, monitoring, support process, data governance, and role enforcement.

Billing v2 initial implementation requires only the approved scope selected after manual review of this specification. This spec does not enable persistence.

## 17. QA Requirements

Automated QA must verify:

- fields visible
- required validation
- evidence requirements visible
- evidence references saved
- package readiness blocks review until complete
- review task created
- approval required before clearance
- outcome generated
- historical record generated
- pilot progress if connected
- no hydration/runtime errors

Manual QA must verify:

- user understands business problem
- user understands Pay App 003
- user understands cash impact
- user understands evidence requirements
- user understands review handoff
- final outcome is meaningful

## 18. Non-Goals

- no production pay app submission
- no external GC submission
- no production document storage claim
- no RLS/auth expansion
- no broad billing module rewrite
- no new workflow beyond Billing v2
- no Field/Closeout refactor yet

## 19. Implementation File Map

Likely files/categories a future implementation pass may touch:

- workflow registry: completion workflow definitions and QA contracts
- completion definitions: Billing v2 states, actions, fields, review decisions
- business object model: BillingBackupPackage and related conceptual types
- billing package state: local/demo adapter and future persistence mapping
- UI components: Billing package builder, readiness panel, review task panel, decision panel, blocker clearance panel, outcome/historical record panels
- QA scripts: Billing v2 execution QA, review/approval QA, outcome/historical QA, runtime QA
- docs: implementation notes, acceptance report, manual review checklist

Do not modify these files/categories in this specification pass.

## 20. Acceptance Criteria

Future Billing v2 implementation is accepted only when:

- Billing v2 feels like a real billing backup package process.
- User cannot clear blocker without review approval.
- Evidence/reference requirements are meaningful.
- Business outcome is explicit.
- Historical record is referenceable.
- Manual acceptance passes.
- Acceptance gate: manual acceptance passes.

This specification creates no implementation. The next step is manual review of this document before code is written.

## Engineering Guardrail Addendum

Billing v2 must not be implemented directly from this broad specification. The implementation must first pass through the engineering-readiness guardrails:

- ADRs for local/demo reference-first behavior, domain state machine, commercial review simulation, evidence reference model, and Pilot integration boundary.
- Billing v2 state transition matrix.
- Billing v2 domain command contract.
- Billing v2 domain test plan.
- Billing v2 UI wireframe specification.
- Future Phase 1A domain implementation prompt.

The first implementation pass must be Billing v2 Phase 1A domain layer only. No UI implementation should occur in Phase 1A. Do not create a parallel workflow engine. Existing `WorkflowCompletionProvider` remains the shared architecture boundary for later integration. Billing v2 domain logic must be reusable and must not hardcode Pay App 003 except in demo data. Phase 1B may implement UI only after Phase 1A domain tests pass.

This addendum is specification only. No implementation occurred.
