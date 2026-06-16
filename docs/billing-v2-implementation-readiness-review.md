# Billing v2 Implementation Readiness Review

## 1. Executive Summary

Recommendation: **Ready with conditions**.

The Billing v2 Enterprise Workflow Implementation Specification is clear enough to begin a scoped implementation planning pass, but it should not move straight into code without resolving several implementation decisions. The business process, object model, required evidence, review/decision paths, blocker-clearance rule, outcome record, historical record, and non-goals are sufficiently defined. The remaining gaps are mostly implementation-shaping decisions: exact local/demo representation, how review decisions are simulated without overbuilding a full approval service, whether any future Supabase pilot mapping is included in the first build, and how dense UI sections are staged so Billing v2 feels like a guided process rather than another large dashboard.

This review is documentation/specification-only. No Billing v2 UI, workflow runtime, route, persistence, auth, RLS, Pilot Mode behavior, Field/Closeout workflow, or production readiness changed in this pass.

## 2. Business-Process Clarity Review

| Area | Assessment | Readiness |
| --- | --- | --- |
| Business problem | Clear. Pay App 003 is blocked because required backup is missing or incomplete. | Ready |
| Business process | Clear. Billing backup completion and pay application review readiness. | Ready |
| Business object | Clear enough. Pay App 003 backup package is the object moving through the workflow. | Ready with mapping condition |
| User role | Clear. Primary user is Billing / Commercial user; supporting user is Project Manager. | Ready |
| Handoff/review owner | Clear. Commercial reviewer / Finance/Admin receives the review. | Ready |
| Outcome | Clear. Billing backup blocker is resolved and the $84,000 cash recovery path is no longer blocked by missing backup for this item. | Ready |
| Next business step | Clear. Open pay app review/submission. | Ready |
| Historical record | Clear. The record must include inputs, evidence, review task, decision, transitions, outcome, audit summary, and mode. | Ready |

Conclusion: The business process is strong enough to implement after the conditions in this review are resolved. The main product risk is not missing business intent; it is implementing too much infrastructure at once.

## 3. Business Object Completeness Review

| Object | Definition Clarity | Required Fields | Relationships | Current Schema Mapping If Known | Implementation Risk |
| --- | --- | --- | --- | --- | --- |
| BillingBackupPackage | Clear as the central package object for Pay App 003 readiness. | packageId, payApplicationId, payApplicationNumber, projectId, blockedAmount, status, owner, sourceRecordId, backupSummary, readinessStatus, reviewStatus, resolutionStatus. | Owns requirements, references, review task, decisions, resolution, outcome, historical record. | Current concepts exist in `payApplications`, `billingBackupItems`, completion item seed data, and `billing_backup_items` schema plan. | Medium. Needs a local/demo package model before adding durable tables. |
| BillingEvidenceRequirement | Clear. Defines required proof. | requirementId, packageId, evidenceType, required, status, waiverAllowed, verifierRole. | Belongs to package; satisfied by references, uploads, waivers, or verification. | Current evidence concepts exist in local evidence model and `workflow_evidence_requirements`; schema plan also references `attachments`. | Medium. Need to avoid implying production upload in first build. |
| BillingEvidenceReference | Clear. Captures where proof can be inspected. | referenceId, packageId, requirementId, label, referenceType, referenceValue, sourceRecordId, savedBy, savedAt. | Satisfies evidence requirement and feeds outcome/historical records. | Current local/demo evidence reference can map to saved editable fields/outcome evidence references; future table may be `evidence_references`. | Low to medium. Reference-only path is implementable; upload path should be deferred. |
| BillingReviewTask | Clear conceptually. Creates review handoff. | taskId, packageId, assignedRole, assignedOwner, status, dueDate, reviewPackageSummary, createdBy, createdAt. | Belongs to package and receives review decisions. | Future mapping may use workflow tasks/review tasks; current workflow completion does not have full review task object. | Medium high. Risk of overbuilding review service if not kept local/demo first. |
| BillingReviewDecision | Clear. Records approve/request changes/reject. | decisionId, taskId, packageId, decision, decisionNote, decidedBy, decidedAt, nextState. | Belongs to review task; controls blocker clearance. | Future mapping may use `review_decisions` or `approval_events`; local/demo can store decision in workflow/package state. | Medium. Need role simulation and required note validation. |
| BillingBlockerResolution | Clear. Records final clearance after approval. | resolutionId, packageId, resolutionNote, clearedBy, clearedAt, priorState, nextState, remainingBlockers. | Requires approved decision and satisfied/waived evidence; feeds outcome/historical records. | Current completion transitions/outcome records can simulate this; future `workflow_state_transitions` or `workflow_transactions`. | Low. The enforceable approval dependency is the key implementation requirement. |
| BillingOutcomeRecord | Clear. Summarizes achieved business outcome. | outcomeId, packageId, payApplicationNumber, blockedAmount, finalOutcome, evidenceSummary, reviewDecision, remainingBlockers, nextBusinessStep, mode. | Generated by clearance and visible in workflow/Pilot summaries if connected. | Current `WorkflowOutcomeRecord` exists locally; future durable outcome record may be needed. | Low. Existing outcome pattern can be extended. |
| BillingHistoricalRecord | Clear. Referenceable record of what happened. | historicalRecordId, packageId, workflowName, inputsCaptured, evidenceReferences, reviewTask, decision, stateTransitions, outcome, auditSummary, storageMode. | Aggregates package, evidence, review, resolution, outcome, audit, status history. | Current historical panel exists; future durable record may map to audit/status/history tables. | Low to medium. Need visible location/caveat to avoid production-record confusion. |

Object readiness conclusion: Conceptual objects are sufficient for a local/demo implementation. They are not yet sufficient for production persistence without a schema mapping and security pass.

## 4. State Lifecycle Review

| State | Entry Conditions | Allowed Actions | Required Data | Exit Conditions | UI Display Label | Gaps Or Ambiguity |
| --- | --- | --- | --- | --- | --- | --- |
| blocked | Pay App 003 backup issue exists and package has not started. | Open package, begin summary, add initial evidence/source data. | Pay app, blocked amount, owner, blocker reason. | User starts package. | Blocked: backup package needed | Need exact source of initial blocker from seed/current billing item. |
| backup_package_in_progress | User begins building package. | Edit summary, link source record, add evidence references, save review note. | Package owner, backup summary draft. | Evidence requirements evaluated. | Package in progress | Need decide whether this is a distinct displayed state or internal phase. |
| evidence_required | Required proof is missing/unwaived. | Add reference, upload/reference evidence, waive with reason, edit package. | Requirement list and status. | All required evidence satisfied or waived. | Evidence required | Upload must be clearly optional/future if not implemented. |
| package_ready_for_review | Readiness checklist passes. | Send to review, continue edits before handoff. | Summary, amount, source record, evidence satisfied/waived. | User sends package to review. | Ready for commercial review | Need define whether edits after readiness reset status. |
| commercial_review_pending | Review task created. | Reviewer approves, requests changes, or rejects. | Review task, reviewer role/owner, due date, package summary. | Reviewer decision. | Commercial review pending | Need role simulation in local/demo without auth expansion. |
| commercial_review_approved | Reviewer approves package. | Enter resolution note, clear blocker. | Decision note, reviewer, timestamp. | Resolution note saved and no blockers remain. | Review approved | Clear rule is strong; implement as hard gate. |
| commercial_review_changes_requested | Reviewer asks for package updates. | Edit package, add evidence, respond/resubmit. | Decision note and change request. | Updated package resubmitted. | Changes requested | Need define if previous approval is invalidated on edit. |
| commercial_review_rejected | Reviewer rejects package. | Reopen/rework package or leave blocker open. | Rejection note. | User reopens package or accepts blocked status. | Review rejected | Need define whether rejected can resubmit directly or must reopen. |
| billing_blocker_cleared | Approval, evidence satisfaction/waiver, and resolution note are complete. | View outcome/historical record, open pay app review. | Approval, resolution note, evidence summary, outcome record. | Terminal unless reopened. | Billing blocker cleared | Ready. |
| reopened | User reopens after decision/clearance/reset. | Edit, add evidence, resubmit. | Reopen reason. | Re-enters in-progress/evidence/review path. | Reopened | Need define who can reopen and what history entry is required. |

State readiness conclusion: The lifecycle is complete enough to implement the happy path and decision branches. Before build, define edit-after-review behavior and reopen permission/history requirements.

## 5. Evidence/Document Readiness Review

- Required evidence list: Strong enough. Signed T&M ticket, daily report reference, photo log reference, supervisor confirmation, product approval backup, and related change event if applicable are clearly named.
- Upload/reference/waiver behavior: Clear enough for local/demo if the first implementation treats upload as future or simulated. Reference and waiver behavior are ready.
- Evidence validation: Clear at the package-readiness level: required items block review until satisfied or waived. The exact per-evidence applicability rules need implementation detail.
- Evidence display: Clear. Evidence should appear in checklist, review package, outcome record, and historical record.
- Historical record capture: Clear. References, waivers, statuses, and reviewer decisions must be captured.
- Local/demo limitations: Clear. The spec repeats that production upload/storage is not claimed.
- Future production document handling: Correctly deferred. Production storage, signed access, malware scanning, RLS, retention, and external submission must remain outside the first build unless explicitly approved later.

Evidence readiness conclusion: Ready for reference-first local/demo implementation. Not ready for production upload/storage.

## 6. Commercial Review Readiness Review

- Review task creation: Clear enough for local/demo. The task should be created only after readiness passes.
- Assigned reviewer role: Clear. Commercial reviewer / Finance/Admin.
- Approval action: Clear. Approval permits blocker clearance after resolution note.
- Request-changes action: Clear. Returns package to correction path and blocks clearance.
- Rejection action: Clear. Leaves blocker open.
- Review notes: Clear. Decision note should be required for approve/request changes/reject.
- Review status: Clear state values exist, but UI labels should remain plain language.
- Blocker-clearance dependency: Strong. Clearance is blocked until commercial review approved.
- Implementation gaps: Need decide whether reviewer actions are same-screen local/demo controls or role-switched panel; need avoid auth/RLS expansion; need ensure request-changes/reject branches have visible recovery paths.

Commercial review readiness conclusion: Ready with conditions. The first build should simulate review in local/demo and avoid introducing a full approval-service platform.

## 7. UX Readiness Review

| Section | Assessment | Recommendation |
| --- | --- | --- |
| Business Process Header | Clear and necessary. | Keep. |
| Pay App Blocker Summary | Clear and necessary. | Keep. |
| Billing Backup Package Builder | Core section. | Keep. |
| Evidence Requirement Checklist | Core section. | Keep. |
| Package Readiness Panel | Necessary for gating. | Keep, but make compact. |
| Commercial Review Task | Necessary. | Keep as a focused handoff panel. |
| Review Decision Panel | Necessary for approval gate. | Keep, but avoid making it feel like admin tooling. |
| Blocker Clearance Panel | Necessary. | Keep after approval only or visibly locked before approval. |
| Outcome Record | Required by acceptance standard. | Keep. |
| Historical Record | Required by acceptance standard. | Keep. |
| Remaining Blockers | Required, but can be part of outcome/clearance. | Merge into Outcome Record unless it needs its own section. |
| Next Business Step | Required, but can be part of outcome/footer. | Merge into Outcome Record and final CTA. |

UX readiness conclusion: The structure is clear but could become dense. First implementation should prioritize a guided vertical workflow and avoid turning Billing v2 into a large dashboard inside Billing.

## 8. Copy/Readability Review

- Clarity: Strong. Pay App 003, $84,000, missing backup, commercial review, and blocker clearance are plain.
- Business language: Strong. The spec uses cash recovery, package readiness, review, evidence, and blocker clearance instead of generic task language.
- Action language: Mostly strong. "Send package to commercial review" and "Clear billing blocker" are clear.
- Disabled button messages: Strong but slightly long. They should remain specific but may need line breaks or shorter variants in UI.
- Success messages: Clear. "Backup package saved for Pay App 003" and "Evidence reference saved for Pay App 003" work.
- Outcome language: Strong. The final copy is business-specific.
- Local/demo caveat: Clear. It should be visible near review/outcome/historical record, not repeated so often that it overwhelms the workflow.

Copy needing refinement before implementation:

- "Commercial Review" should be consistently written as "commercial review" except in labels.
- "Upload" should be avoided in user-facing copy if upload is not implemented; use "reference evidence" first.
- "Package readiness" may need a one-sentence explanation for non-system users: "Ready means the reviewer has enough backup to decide whether this item can move into pay app review."

## 9. QA Readiness Review

Future QA is sufficiently defined to test:

- required fields
- evidence requirements
- package readiness
- review task creation
- review decision
- blocker clearance
- outcome record
- historical record
- no runtime errors
- manual acceptance

Required QA additions before implementation is accepted:

- A focused Billing v2 browser QA that proves the user cannot send to review until readiness passes.
- A decision-path QA for approve, request changes, and reject.
- A blocker-clearance QA proving approval is required before clearance.
- A historical-record QA proving review decision and evidence references appear in the record.
- Runtime QA coverage for the future Billing v2 focused route/state with no hydration mismatch.
- Manual QA checklist specifically for Billing / Commercial users.

QA readiness conclusion: Ready to design tests before implementation. The current QA suite should not be weakened; old Billing proof tests can remain regression checks or be replaced only after Billing v2 acceptance is explicit.

## 10. Implementation Risk Review

- Scope creep: High risk. Billing v2 could accidentally become a full billing module rewrite.
- Adding too many tables too soon: High risk. Current schema should be mapped before introducing package/review tables.
- Overbuilding review workflow: Medium high risk. The first build should simulate review locally unless persistence scope is approved.
- Confusing local/demo vs database-backed behavior: High risk. The local/demo caveat must remain visible.
- Existing Pilot Mode expectations: Medium risk. Pilot Mode is locked to the current slice; Billing v2 should not silently change Pilot Mode behavior unless a later pass approves it.
- UI density returning: Medium high risk. The many required sections need progressive disclosure and clear hierarchy.
- Runtime/hydration regression: High risk. Existing standards require provider-owned state and deterministic server/client baseline.
- Unclear evidence upload boundaries: Medium high risk. Reference-first evidence is ready; production upload is not.

## 11. Go/No-Go Recommendation

Recommendation: **Ready with conditions**.

Conditions before implementation:

1. Confirm Billing v2 first build is local/demo reference-first, not production document upload.
2. Confirm review decisions are simulated in local/demo and do not require auth/RLS expansion.
3. Define exact edit-after-review and reopen behavior before code.
4. Define how old Billing proof QA is preserved or intentionally replaced after Billing v2 acceptance.
5. Keep Pilot Mode behavior unchanged unless a separate Pilot Mode change is explicitly approved.
6. Keep implementation scoped to Billing v2 only; no Field/Closeout refactor yet.
7. Write QA before or alongside implementation for readiness, review decision, blocker clearance, outcome, historical record, and runtime stability.

No Billing v2 implementation occurred in this review.

## Engineering Readiness Guardrail

After this readiness review, Billing v2 was further constrained by the engineering-readiness package:

- `docs/adr/0001-billing-v2-local-demo-reference-first.md`
- `docs/adr/0002-billing-v2-domain-state-machine.md`
- `docs/adr/0003-billing-v2-commercial-review-simulation.md`
- `docs/adr/0004-billing-v2-evidence-reference-model.md`
- `docs/adr/0005-billing-v2-pilot-integration-boundary.md`
- `docs/billing-v2-state-transition-matrix.md`
- `docs/billing-v2-domain-command-contract.md`
- `docs/billing-v2-ui-wireframe-spec.md`
- `docs/billing-v2-domain-test-plan.md`
- `docs/billing-v2-phase-1a-domain-implementation-prompt.md`

Billing v2 is ready for implementation only after these guardrails are reviewed and accepted. The first implementation pass must be Billing v2 Phase 1A domain layer only: state machine, commands, guards, events, local/demo state, and domain tests.

No UI implementation should occur in Phase 1A. Do not create a parallel workflow engine. Existing `WorkflowCompletionProvider` remains the shared architecture boundary for later integration. Billing v2 domain logic must be reusable and must not hardcode Pay App 003 except in demo data. Phase 1B may implement UI only after Phase 1A passes.
