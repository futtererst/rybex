# Workflow Completion Expansion Plan

## Summary

RybexOS has three local/demo completion proof flows:

1. Billing Backup Blocker -> Cash Recovery.
2. Field Issue -> RFI / Change Escalation.
3. Closeout Requirement -> Acceptance / Final Billing Release.

That proof shows the core operating pattern:

1. A focused CTA routes to the exact task.
2. The focused task panel explains why the user is there.
3. The workflow completion panel presents the required action.
4. Local/demo state updates visibly.
5. The result banner and history prove the workflow moved forward.

## Reusable Completion Pattern

Every completion flow should use the same architecture:

- `FocusedTaskPanel` for task landing and instruction.
- `WorkflowCompletionPanel` for completion controls.
- `local-completion-store` for local/demo state.
- `completion-service` for allowed transitions and result messages.
- QA selectors and browser tests for proof.

## Complete Workflow Criteria

A workflow is considered complete only when:

- the CTA lands on the exact work object;
- the user can take the required action;
- the workflow state changes visibly;
- the required output or evidence is visible;
- history records the change;
- the result banner explains the outcome;
- the user is not routed into a loop.

## Recommended Expansion Sequence

1. Billing Backup Blocker -> Cash Recovery: verified.
2. Field Issue -> RFI / Change Escalation: verified.
3. Closeout Requirement -> Acceptance / Final Billing Release: implemented as the third proof.
4. Safety Corrective Action -> Work Continuation.
5. Quality Deficiency -> Acceptance Control.
6. Change Notice -> Recovery Protection.
7. RFI Response -> Field Work Unblocked.
8. Mobilization Blocker -> Field Start Release.
9. Project Baseline Gap -> D2 Gate Release.
10. Go/No-Go Decision -> Pursuit Control.

Future workflows should be added through the workflow completion registry, definitions, QA contracts, and browser proof scripts. Do not add another workflow until the three proof flows remain green.

## Why Field Issue Is Second

Field issues are where subcontractor risk becomes real. If a field issue stays buried in a daily report, Rybex can miss clarification, notice, backup, schedule, cost, safety, quality, or closeout control.

The second proof asks:

Can a field supervisor or PM escalate an open field issue into RFI or change control and see the original issue move forward?

## Technical Guardrails

- Reuse the existing Workflow Completion Engine.
- Keep local/demo state as the default.
- Do not add broad persistence.
- Do not create a separate completion UI system.
- Do not claim production readiness.
- Keep browser QA as the proof standard.

## Not Implemented Yet

- Database persistence for field issue completion.
- Real RFI/change record creation.
- File uploads from the completion flow.
- External notifications.
- Production approval matrix.
- RLS-backed production security.
