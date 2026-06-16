# Workflow Business Outcome Layer

## Why Completion Alone Was Not Enough

The Pilot workflows were executable, but execution by itself did not fully explain what business process was completed, what object moved, what evidence was captured, or what the next business step should be. The outcome layer turns workflow completion into a business record.

## Business Process Standard

Every Pilot workflow now defines the business process name, business object, starting problem, required captured inputs, evidence/document references, expected business outcome, business impact, remaining blockers, next business step, and historical reference label.

## Outcome Record Model

Each terminal completion generates a business outcome record with workflow and completion item ids, business process and business object, project, owner, completed by, completed at, saved editable fields, evidence and document references, linked outputs, state changes, business outcome and impact, remaining blockers, next business step, historical record label, and local/demo or database pilot status.

## Evidence / Document Reference Model

This pass does not add production file upload. It captures structured references:

- Billing evidence reference becomes a workflow evidence reference.
- Field RFI/change details become linked output metadata and document reference text.
- Closeout evidence reference becomes a workflow document reference.

These references appear in the outcome record, historical record panel, and local/demo history.

## Current Examples

Billing outcome:

- Process: Billing backup completion and pay application readiness.
- Object: Pay App 003 / billing backup item.
- Outcome: Billing backup blocker resolved. Pay App 003 is ready for commercial review.
- Next: Open pay application review.

Field outcome:

- Process: Field issue control and escalation.
- Object: Field issue from daily execution.
- Outcome: Field issue is controlled through linked RFI or change event.
- Next: Monitor RFI/change response and update field execution plan.

Closeout outcome:

- Process: Closeout requirement completion and acceptance readiness.
- Object: Closeout requirement / closeout package item.
- Outcome: Closeout requirement resolved. Acceptance and final billing can proceed for this item.
- Next: Open closeout package review.

## Local / Demo Behavior

Outcome records are stored in the Workflow Completion Provider state and local/demo adapter snapshot. They persist across local route transitions and reloads, and they reset only when Pilot demo state is reset.

## Database Pilot Metadata Path

The Supabase completion bridge remains opt-in. In database mode, outcome records should be included in completion event metadata where safely supported. This is metadata-only pilot behavior and is not production persistence.

## Future Production Persistence Needs

Production use still requires production auth/session resolution, tested RLS, durable outcome record tables or metadata strategy, retention policy, audit reporting, signed file/document access, and backup/restore procedures.

Status: Controlled internal pilot candidate — not production ready.

