# Workflow Transactions MVP

RybexOS now includes a narrow workflow transaction MVP. It proves that operating signals can move forward through local/demo actions without enabling production persistence.

Runtime status:

- Seed-backed runtime remains default.
- Transactions update local browser state only.
- Seed data is not modified.
- Database runtime is not enabled.
- Auth, RLS, file uploads, notifications, and production audit persistence are not implemented.

## What Was Implemented

The transaction layer adds:

- Transaction definitions in `lib/d5o/workflow/transactions.ts`
- Pure application logic in `lib/d5o/workflow/apply-transaction.ts`
- Local browser transaction store in `lib/d5o/workflow/local-transaction-store.ts`
- Transaction UI components in `components/d5o/workflow`
- Interactive workflow actions on workflow cards and queues
- Admin reset for local demo transaction state

## Supported Transaction Types

- `approve_go_no_go`
- `hold_go_no_go`
- `approve_d2_gate`
- `hold_d2_gate`
- `approve_d3_field_start`
- `hold_d3_field_start`
- `submit_daily_report`
- `create_rfi_from_signal`
- `create_change_event_from_signal`
- `resolve_workflow_action`

## How Local State Works

When a user completes a transaction:

1. The transaction modal collects notes, decision reason, owner, and evidence confirmation.
2. `applyWorkflowTransaction` returns an updated workflow state, transaction result, demo audit event, user message, and next recommended step.
3. The local transaction store overlays the updated workflow state in the browser.
4. The card shows an outcome banner and updated status/gate movement.

This local state may use browser storage for demo continuity. It is intentionally resettable and should not be treated as production persistence.

## What It Proves

The MVP proves that RybexOS is not only a dashboard. It can now demonstrate the product loop:

Signal -> Decision -> Action -> Evidence -> Gate Movement

Examples:

- Approve go/no-go: pursuit can move toward D2 setup.
- Hold D2 gate: contract baseline blocker remains controlled.
- Approve D3 field start: mobilization can move toward D4 execution.
- Submit daily report: D4 evidence moves toward review.
- Create RFI/change from signal: field uncertainty moves into formal control.
- Resolve workflow action: local workflow state closes the required action.

## Intentional Limits

In default local mode, this MVP does not:

- write to a database
- enforce authenticated identity
- upload files
- send notifications
- create production audit rows
- implement a full approval matrix
- persist across environments
- replace future repository/database work

## Admin Reset

Admin includes a local reset action:

`Reset Demo Workflow Transactions`

This clears local browser transaction state only. It does not modify seed data.

## Next Step

After stakeholder review of this interaction model, the next technical step is to harden the workflow transaction persistence pilot:

1. Review the workflow transaction write rows.
2. Review the Auth/RBAC foundation now enforcing workflow transaction permissions.
3. Add production Supabase auth/session resolution.
4. Add RLS policies and tests.
4. Expand only after the workflow transaction path is stable.

## Phase 3 Persistence Scaffold

The persistence scaffold now exists, but runtime behavior is unchanged.

- Schema: `supabase/migrations/0003_workflow_transactions.sql`
- Repository contracts: `lib/d5o/data/contracts.ts`
- Database stubs: `lib/d5o/data/database-repository.ts`
- Mapping adapter: `lib/d5o/workflow/persistence-adapter.ts`
- Store mode helper: `lib/d5o/workflow/transaction-store.ts`

Default transaction storage remains local. `RYBEXOS_WORKFLOW_TRANSACTION_STORE`
defaults to `local` when omitted.

Future database-backed transaction writes should create a workflow transaction
row, an audit event row, and a status history row when status changes.

## Phase 4 Write Pilot

A narrow database write pilot now exists for workflow transactions only.

Enable it locally with:

```text
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_TRANSACTION_STORE=database
```

When enabled, workflow actions can write `workflow_transactions`, update
`workflow_instances`, create `audit_events`, create `status_history`, and mark
matching evidence requirements verified. No source module records are persisted.

Verify with:

```powershell
npm run db:verify-workflow-transactions
```

## Action Completion Fix

Workflow action completion is now explicitly guarded by:

- `docs/workflow-action-completion-debug.md`
- `npm run workflow:verify-actions`

Command Center includes a transaction-enabled workflow card in the leadership path, so users can complete an action without first drilling into another module. The card opens the confirmation modal, applies local transaction state by default, shows the outcome banner, and records transaction history.

Evidence confirmation no longer blocks MVP transactions. Evidence can remain pending and should be described in the transaction notes until file upload and production evidence persistence are implemented.

The UI also mounts `WorkflowTransactionRuntime` globally. This fallback listens for workflow action clicks, opens the same confirmation modal pattern, calls `/api/workflow-transactions`, and writes the local transaction overlay if the normal React click binding is unavailable.

## Auth / RBAC Foundation

Workflow transaction actions now resolve the current actor and check role
permissions before accepting the transaction. Demo mode remains the default, so
the current actor is the non-persistent demo operations leader. Supabase auth
mode is scaffolded, but production login/session resolution and RLS are not
enabled.

If a role is not allowed to complete a transaction, the UI and server return a
clear permission-required message instead of pretending success.
