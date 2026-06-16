# Billing Backup Workflow Trace

## Registry Status

Registered workflow id: `billing-backup-cash-recovery`. This trace is executed through the shared Workflow Completion Engine definition model.

## Signal

Missing product approval backup is blocking stored material billing.

## Source Object

- Billing backup item: `bb-lake-001`
- Evidence requirement: `evidence-billing-bb-lake-001`
- Project: Lake Norman Underground Conduit Package
- Pay application: `PA-001`
- Owner: Mina Patel
- Due: 2026-06-14

## Decision

Can the pay application move forward with adequate backup, or must evidence be waived with a reason?

## Actions

1. Mark backup attached.
2. Waive evidence with a reason if accepted backup is unavailable.
3. Send the item to review.
4. Resolve the billing blocker.

## Evidence

Vault and handhole product approval.

## Gate / Status Movement

Waiting on evidence -> Evidence attached or waived -> Ready for review -> Resolved.

## Verified Browser Flow

1. Command Center CTA opens the Billing focused task.
2. Billing shows `Complete billing backup task` above dense details.
3. Mark backup attached changes completion status to evidence attached.
4. Send to review changes completion status to ready for review.
5. Resolve billing blocker changes completion status to resolved.
6. The result banner and local demo history update after each action.

Verification: `npm run workflow-completion:qa`.

## Manual Pilot Failure Remediation

Manual review found that the Billing focused task was technically present but not visibly executable. The fix adds `GuidedCompletionFlow` so the user sees three clear steps, status indicators, unlock order, completion banner, and return-to-pilot link.

## Cash Impact

Stored material billing may be rejected if backup remains missing.

## Demo Limitation

This trace completes in local browser state by default. The opt-in completion persistence bridge can record the completion event and state transition in Supabase pilot tables, but production storage, RLS, and external notification delivery are not enabled by this pass.

## Editable Field Proof

Billing completion now requires visible saved inputs before the action sequence can finish:

- `Backup note`: required before `Mark backup attached`.
- `Evidence reference`: required before `Mark backup attached`.
- `Resolution note`: required before `Resolve billing blocker`.

The user-entered values remain visible in the guided flow and are written to local/demo completion history.
