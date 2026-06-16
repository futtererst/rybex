# Workflow Completion Engine

## Purpose

The workflow completion engine proves that a RybexOS signal can become a completed operating action, not just a highlighted card.

## Standardization Status

Completion workflows are now registry-driven. Billing Backup, Field Issue escalation, and Closeout Requirement completion are registered in `workflow-completion-registry.ts`, rendered by the shared `WorkflowCompletionPanel`, and protected by workflow QA contracts.

## Proof Workflow

Billing Backup Blocker -> Cash Recovery.

## Local Demo Scope

- Command Center shows the concrete action: Add missing billing backup.
- The CTA routes to Billing with focus metadata.
- Billing opens a focused task panel with "You are here to".
- Billing shows a guided completion flow with visible steps for attaching backup, sending to review, and resolving the blocker.
- The user can mark backup attached, waive evidence with a reason, send to review, and resolve the blocker.
- The completion panel records local demo history.

## Manual Pilot Failure: Billing Task Was Not Visibly Executable

Manual review showed that a correct route and working hidden controls were not enough. The user needed a visible task path. `GuidedCompletionFlow` now renders the human workflow before dense details, and `npm run pilot-mode:qa` completes the Billing task from Pilot Mode as a regression test.

## Hydration / Browser QA Fix

Browser QA found that the focused task rendered but the completion controls did
not reliably update completion state in the Playwright run. The fix keeps the
React local store path and adds a scoped completion-panel runtime that binds only
to the Billing Backup proof panel. It sets a readiness marker, handles the three
proof actions, updates local demo state, updates evidence/status/result/history
text, and avoids any database or production write behavior.

Verified by:

- `npm run workflow-completion:diagnose`
- `npm run workflow-completion:qa`

## What It Updates

- Local workflow completion state.
- Local evidence state for the linked billing backup requirement.
- Visible completion result and history.

## What It Does Not Do

- It does not add broad module persistence.
- It does not enable RLS.
- It does not change auth behavior.
- It does not upload production files.
- It does not claim production cash recovery readiness.

## Future Persistence

The local completion item is shaped so it can later map to workflow transaction rows, evidence requirement updates, audit events, and status history after the production workflow write path is hardened.

## Persistence Bridge Pilot

`docs/workflow-completion-persistence-bridge.md` defines the opt-in Supabase pilot for completion persistence. When `RYBEXOS_WORKFLOW_COMPLETION_STORE=database` and database mode are both enabled, completion actions can be written server-side to workflow transaction, workflow instance, evidence, audit, and status-history tables.

Local/demo completion remains the default. The bridge is not production-ready and does not enable RLS, external notifications, production linked records, or production file security.
## Field Issue Escalation Proof

The second workflow completion proof is Field Issue -> RFI / Change Escalation.

It reuses the same completion engine, focused task panel, local completion store, result banner, and history pattern as the Billing Backup proof. The local/demo path starts at `/field-execution?focus=field-issue-escalation#focused-task`, creates a demo RFI or change output from the field issue, marks the issue controlled, and resolves it.

Pilot Mode human-execution QA now requires a visible `Escalation note`, saved note display, linked RFI/change output, controlled/resolved state changes, result banner, history updates, and Pilot progress update.

## Closeout Requirement Completion Proof

The third workflow completion proof is Closeout Requirement -> Acceptance / Final Billing Release.

It reuses the same registry-driven completion engine and starts at `/closeout?focus=closeout-requirement-final-billing-release#focused-task`. The local/demo path marks closeout evidence attached, sends the item to review, creates a closeout package update, resolves the blocker, and creates a final billing release note. This is not database-backed yet and does not claim production closeout document management.

Pilot Mode human-execution QA now requires a visible `Closeout evidence note`, saved note display, evidence-attached/review/resolved state changes, linked closeout/final-billing output, result banner, history updates, and Pilot progress update.

This is not database-backed yet. Production RFI/change writes remain future work.
## Editable Field Contract

The completion engine now supports visible editable fields for the three Pilot Mode workflows. Field values are saved in local/demo completion state, shown back to the user, written to completion history or summary, and used to gate downstream actions. This proves human workflow execution; it is not production persistence.

## State Ownership Model

Server renders definitions/static shell. The client provider owns live completion state.

The engine no longer relies on a DOM runtime bridge for workflow controls. `WorkflowCompletionProvider` owns local/demo state after hydration, and Pilot progress derives from provider state.
## Business Outcome Records

The completion engine now produces a business outcome record after Billing, Field Issue, or Closeout reaches terminal completion. The record is shown near the result banner and mirrored on the Pilot Mode card after return.

Outcome records make completion understandable to a human reviewer: what business process completed, what object moved, what inputs and references were captured, what remains unresolved, and what the next business step is.
