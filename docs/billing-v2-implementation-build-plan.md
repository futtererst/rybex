# Billing v2 Implementation Build Plan

## 1. Build Objective

Create a real Billing Backup Package workflow that moves Pay App 003 from blocked to commercial review readiness and blocker clearance.

This is a future implementation roadmap only. Do not implement it in this pass. No UI, workflow runtime, route, persistence, auth, RLS, Pilot Mode behavior, Field/Closeout workflow, or production readiness changes are created by this plan.

## 2. Implementation Phases

### Phase 1A — Domain Model, State Machine, Commands, Guards, And Tests

Phase 1A is the first approved implementation pass. It is domain-only.

- Define BillingBackupPackage domain object.
- Define BillingEvidenceRequirement.
- Define BillingEvidenceReference.
- Define BillingReviewTask.
- Define BillingReviewDecision.
- Define BillingBlockerResolution.
- Define BillingOutcomeRecord.
- Define BillingHistoricalRecord.
- Define local/demo state model.
- Implement the Billing v2 state machine, command contract, guards, events, and domain tests.
- Keep Billing v2 domain logic reusable and do not hardcode Pay App 003 except in demo data.
- Keep the first build reference-first unless production upload/storage scope is separately approved.
- Reuse the existing `WorkflowCompletionProvider` architecture boundary for later integration.
- Do not create a parallel workflow engine.

Phase 1A must not implement UI components, route changes, persistence changes, auth/RLS changes, Pilot Mode behavior changes, or Field/Closeout changes.

Exit criteria:

- Domain tests pass for readiness gating, review approval gating, evidence waiver reason, request changes, rejection, blocker clearance, outcome record generation, and historical record generation.
- Local/demo model can represent package status, evidence status, review task, decision, resolution, outcome, and historical record.
- No new durable schema is added unless the schema mapping is separately approved.

### Phase 1B — Focused Billing v2 UI Integration

Phase 1B may begin only after Phase 1A passes.

- Render the accepted domain state and command results.
- Integrate Billing v2 with the current Billing focused task experience.
- Keep Pilot Mode structure unchanged unless a separate Pilot Mode change is explicitly approved.
- Preserve the existing shared workflow architecture.

### Phase 1 — Data/Domain Model

- Define BillingBackupPackage domain object.
- Define BillingEvidenceRequirement.
- Define BillingEvidenceReference.
- Define BillingReviewTask.
- Define BillingReviewDecision.
- Define BillingBlockerResolution.
- Define BillingOutcomeRecord.
- Define BillingHistoricalRecord.
- Define local/demo state model.
- Keep the first build reference-first unless production upload/storage scope is separately approved.

Superseded sequencing note: this broad Phase 1 is now split into Phase 1A domain-only and Phase 1B UI integration. Start with Phase 1A.

Exit criteria:

- Local/demo model can represent package status, evidence status, review task, decision, resolution, outcome, and historical record.
- No new durable schema is added unless the schema mapping is separately approved.

### Phase 2 — Workflow Definition Update

- Update completion registry for Billing v2.
- Replace old mechanical Billing flow with package/review/blocker lifecycle.
- Preserve old QA only as regression if needed.
- Add states: blocked, backup_package_in_progress, evidence_required, package_ready_for_review, commercial_review_pending, commercial_review_approved, commercial_review_changes_requested, commercial_review_rejected, billing_blocker_cleared, reopened.
- Add actions for package save, evidence reference/waiver, readiness evaluation, send to review, approve/request changes/reject, clear blocker, reopen.
- Keep state ownership in the client provider / adapter model.

Exit criteria:

- User cannot send to review until package readiness passes.
- User cannot clear blocker until commercial review is approved.

### Phase 3 — UI Implementation

- Business Process Header.
- Pay App Blocker Summary.
- Backup Package Builder.
- Evidence Requirement Checklist.
- Package Readiness Panel.
- Commercial Review Task Panel.
- Review Decision Panel.
- Blocker Clearance Panel.
- Outcome Record Panel.
- Historical Record Panel.

UX guidance:

- Keep a guided vertical workflow.
- Avoid rebuilding Billing as a dense dashboard.
- Merge Remaining Blockers and Next Business Step into Outcome Record where possible.
- Keep local/demo caveat visible without overwhelming the user.

### Phase 4 — Local/Demo Execution

- User builds backup package.
- User references evidence.
- Package readiness computed.
- User sends to review.
- Review task created.
- Reviewer approves/request changes/rejects.
- Blocker can clear only after approval.
- Outcome and historical record generated.
- Records persist through route transitions in local/demo mode and reset through the accepted reset path.

Exit criteria:

- Happy path and three review decisions work in local/demo.
- Request changes and rejection do not allow blocker clearance.
- Approval plus resolution note allows blocker clearance.

### Phase 5 — QA And Acceptance

- Automated QA.
- Runtime QA.
- Manual acceptance checklist.
- Visual capture.

Automated QA should cover:

- Pay App 003 blocker visibility.
- $84,000 impact visibility.
- required fields and saved values.
- evidence requirement readiness.
- review task creation.
- approve/request changes/reject paths.
- blocker clearance approval gate.
- outcome record.
- historical record.
- no hydration/runtime errors.

Manual QA should confirm:

- Billing user understands the business problem.
- Pay App 003 backup package is clear.
- Evidence requirements make sense.
- Commercial review handoff is understandable.
- Final outcome is meaningful.
- Historical record is findable.

## 3. Files Likely To Change

Do not edit these files in this pass. This list is a future implementation map.

### lib/d5o/workflow-completion

- `lib/d5o/workflow-completion/workflow-completion-registry.ts`
- `lib/d5o/workflow-completion/definition-types.ts`
- `lib/d5o/workflow-completion/types.ts`
- `lib/d5o/workflow-completion/editable-field-contracts.ts`
- `lib/d5o/workflow-completion/completion-service.ts`
- `lib/d5o/workflow-completion/completion-reducer.ts`
- `lib/d5o/workflow-completion/completion-state-model.ts`
- `lib/d5o/workflow-completion/business-outcomes.ts`
- `lib/d5o/workflow-completion/business-outcome-types.ts`
- `lib/d5o/workflow-completion/adapters/local-demo-completion-adapter.ts`
- `lib/d5o/workflow-completion/database-completion-store.ts` only if database pilot scope is separately approved.

### components/d5o/workflow-completion

- `components/d5o/workflow-completion/WorkflowCompletionPanel.tsx`
- `components/d5o/workflow-completion/WorkflowCompletionProvider.tsx`
- `components/d5o/workflow-completion/GuidedCompletionFlow.tsx`
- `components/d5o/workflow-completion/WorkflowOutcomeRecordPanel.tsx`
- `components/d5o/workflow-completion/WorkflowHistoricalRecordPanel.tsx`
- Future Billing v2 package/review panels if created.

### components/d5o/pilot

- `components/d5o/pilot/PilotWorkflowCard.tsx`
- `components/d5o/pilot/PilotProgressSummary.tsx`
- `components/d5o/pilot/PilotCompletionTimeline.tsx`

Only touch Pilot files if a separate Pilot Mode update is explicitly approved.

### app/billing

- `app/billing/page.tsx`
- `app/billing/pay-application/new/page.tsx` only if the final CTA needs a better review destination.

### scripts

- Future `scripts/qa-billing-v2-workflow.mjs`
- Future `scripts/verify-billing-v2-workflow.mjs`
- `scripts/qa-workflow-completion.mjs`
- `scripts/qa-workflow-execution.mjs`
- `scripts/qa-workflow-business-outcomes.mjs`
- `scripts/qa-runtime-stability.mjs`
- `scripts/verify-runtime-stability.mjs`
- `scripts/verify-all.mjs` only after the Billing v2 gate is approved.

### docs

- Future Billing v2 implementation notes.
- Future Billing v2 manual acceptance checklist.
- Future Billing v2 QA report.
- Existing Billing v2 blueprint/spec/readiness docs as reference, not implementation claims.

## 4. Non-Goals

- no production pay app submission
- no external GC submission
- no broad billing rewrite
- no RLS/auth expansion
- no new workflows
- no Field/Closeout refactor yet
- no production document storage claim
- no production readiness claim

No Billing v2 implementation occurred in this build plan.

Engineering readiness package created: ADRs, state transition matrix, command contract, UI wireframe spec, domain test plan, and future Phase 1A implementation prompt now constrain this plan. No implementation occurred.
