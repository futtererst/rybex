# Persistence Phase 3 - Workflow Transactions

Phase 3 adds database schema scaffolding for the RybexOS workflow transaction model:

Signal -> Decision -> Action -> Evidence -> Gate Movement

This pass does not enable database runtime, write persistence, auth, RLS, or file upload. The app remains seed-backed by default and workflow transactions remain local/demo state.

## What Phase 3 Added

- `supabase/migrations/0003_workflow_transactions.sql`
- Workflow transaction repository contracts in `lib/d5o/data/contracts.ts`
- Safe database repository stubs in `lib/d5o/data/database-repository.ts`
- Local-to-database mapping helpers in `lib/d5o/workflow/persistence-adapter.ts`
- Transaction store mode helper in `lib/d5o/workflow/transaction-store.ts`
- Admin readiness status for workflow transaction persistence

## Tables Added

### `workflow_instances`

Stores the durable workflow envelope derived from operating records. It captures workflow type, D5O phase, source module/record, status, resolution state, owner, due date, value at risk, target module, and next gate/status movement.

### `workflow_signals`

Stores detected operating signals that caused a workflow to require attention.

### `workflow_transactions`

Stores completed transaction history such as approve go/no-go, hold D2, submit daily report, create RFI/change, or resolve workflow action.

### `workflow_evidence_requirements`

Stores the evidence checklist needed to move a workflow forward.

### `workflow_source_links`

Stores controlled source links between workflow instances and source records. High-value canonical domain relationships should still use explicit domain join tables when those tables exist.

## Relationship To Audit And Status History

Phase 1 already added:

- `audit_events`
- `status_history`

Future production transaction writes should create:

1. One `workflow_transactions` row.
2. One `audit_events` row.
3. One `status_history` row when current status or resolution state changes.

This pass defines the relationship but does not implement database writes.

## Why Persist Workflow Transactions First

RybexOS is not only a record system. Its product claim is operating movement. Persisting workflow transactions first proves the most valuable behavior before every module record is database-backed:

- decisions are explicit
- actions are owned
- evidence is required
- gate/status movement is recorded
- audit and status history have a clear source event

## Local-To-Database Mapping

`lib/d5o/workflow/persistence-adapter.ts` maps local workflow objects into future database insert shapes:

- `mapWorkflowToWorkflowInstanceInsert`
- `mapSignalToWorkflowSignalInsert`
- `mapTransactionResultToWorkflowTransactionInsert`
- `mapEvidenceToWorkflowEvidenceRequirementInsert`
- `mapWorkflowSourceLinks`

These helpers return plain objects only. They do not write to a database.

## Store Mode

`RYBEXOS_WORKFLOW_TRANSACTION_STORE` is reserved for future use.

Default:

```env
RYBEXOS_WORKFLOW_TRANSACTION_STORE=local
```

Database transaction store mode is not enabled in this phase.

## What Remains Local Only

- Workflow transaction UI state
- Local transaction history
- Outcome banners
- Demo audit event objects
- Reset demo transaction action

## What Is Not Implemented

- Database writes
- Authenticated actor identity
- Active RLS policies
- File uploads or attachment persistence
- Production audit writes
- Production status-history writes
- Notifications or escalations

## Next Steps

Recommended next phase:

Enable a DB-backed workflow transaction pilot only after local database verification and human review. Start with a very small path, such as go/no-go or D2 gate transactions, and keep seed/local fallback active.
