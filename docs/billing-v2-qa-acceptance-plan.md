# Billing v2 QA Acceptance Plan

## Purpose

This plan defines future automated and manual QA for Billing v2. It does not implement tests or change app behavior.

## Automated QA

Future automated QA must verify:

- Pay App 003 blocker visible.
- $84K impact visible.
- backup package builder visible.
- evidence requirements visible.
- cannot send to review until readiness complete.
- commercial review task created.
- cannot clear blocker until review approved.
- approval/request changes/reject paths work.
- outcome record generated.
- historical record generated.
- no hydration/runtime issues.

## Automated Test Scenarios

### Scenario 1 — Initial Blocker Visibility

- Open Billing v2 focused task.
- Verify Pay App 003 is visible.
- Verify $84K or $84,000 impact is visible.
- Verify missing backup problem is visible.
- Verify local/demo caveat is visible if applicable.

### Scenario 2 — Package Builder And Required Fields

- Verify backup summary field is visible.
- Verify evidence reference/source record/amount affected requirements are visible.
- Verify saved values remain visible after save.
- Verify history captures saved values.

### Scenario 3 — Evidence Requirement Gating

- Verify evidence checklist is visible.
- Verify missing required evidence blocks package readiness.
- Verify reference or waiver satisfies the requirement.
- Verify waiver requires risk reason.

### Scenario 4 — Package Readiness

- Try sending to review before required data is complete.
- Verify send-to-review is disabled or blocked with a business-language message.
- Complete backup summary, source record, amount affected, and evidence requirements.
- Verify package readiness passes.

### Scenario 5 — Commercial Review Task

- Send package to commercial review.
- Verify review task is created.
- Verify assigned role is Commercial reviewer / Finance/Admin.
- Verify review package includes Pay App 003, blocked amount, evidence, source record, and review note.

### Scenario 6 — Approval Path

- Approve package with decision note.
- Verify state becomes commercial_review_approved.
- Verify blocker clearance unlocks only after resolution note is saved.
- Clear blocker.
- Verify outcome and historical record are generated.

### Scenario 7 — Request Changes Path

- Request changes with decision note.
- Verify state becomes commercial_review_changes_requested.
- Verify blocker clearance remains blocked.
- Update package and resubmit.
- Verify prior decision appears in history.

### Scenario 8 — Rejection Path

- Reject package with decision note.
- Verify state becomes commercial_review_rejected.
- Verify blocker clearance remains blocked.
- Verify user sees next step to reopen/rework package.

### Scenario 9 — Outcome Record

- Complete approval and clearance.
- Verify outcome record includes Pay App 003, blocked amount, evidence/documents captured, review decision, approval note, blocker cleared, remaining blockers, next step, and local/demo or database-backed status.

### Scenario 10 — Historical Record

- Verify historical record includes user inputs, evidence references, review task, decision, state transitions, outcome, audit summary, and record label.
- Verify user can identify where to find it later.

### Scenario 11 — Runtime Stability

- Run focused route through runtime QA.
- Fail on hydration mismatch, duplicate key warnings, script tag warnings, uncaught browser errors, missing client handlers, or route loops.

## Manual QA

Manual QA must verify:

- business problem understandable
- business object clear
- evidence expectations clear
- review handoff clear
- blocker clearance meaningful
- final outcome business-specific
- next step clear
- historical record referenceable

## Manual Acceptance Script

1. Start from the Billing v2 focused task.
2. Explain what business process is being executed.
3. Identify Pay App 003 as the business object.
4. Explain why the $84K backup blocker matters.
5. Enter backup summary.
6. Add or reference required evidence.
7. Confirm package readiness.
8. Send package to commercial review.
9. Approve, request changes, and reject in separate runs.
10. Confirm blocker cannot clear until approval.
11. Clear blocker after approval and resolution note.
12. Review final outcome record.
13. Review historical record.
14. Confirm next step is pay app review/submission.

## Acceptance Standard

Billing v2 is accepted only when a Billing / Commercial user can say:

"I understand why Pay App 003 is blocked, what backup package I changed, what evidence is required, who reviews it, why approval matters, what blocker was cleared, what remains open, what happens next, and where the record lives."

No Billing v2 implementation occurred in this QA acceptance plan.

## Phase 1A Domain Test Gate

Before any Billing v2 UI work begins, Phase 1A domain tests must prove:

- readiness gating
- review approval gating
- structured evidence references
- waiver reason validation
- request changes and rejection paths
- blocker clearance rules
- outcome record generation
- historical record generation

No UI implementation should occur in Phase 1A. No route, persistence, auth/RLS, Pilot Mode, Field, or Closeout behavior should change. Existing `WorkflowCompletionProvider` remains the shared architecture boundary for later integration, and Billing v2 domain logic must not hardcode Pay App 003 except in demo data.
