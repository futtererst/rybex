# Persistence Phase 4 - Workflow Transaction Writes

Date: June 11, 2026

Status: narrow pilot implemented. This is not production persistence.

## What This Phase Adds

Phase 4 adds the first database-backed write path for RybexOS, scoped only to workflow transactions.

When both switches are enabled:

```text
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_TRANSACTION_STORE=database
```

workflow transaction actions can write to Supabase. Seed/local mode remains the default.

## Tables Written

The pilot writes only workflow operating records:

- `workflow_instances`
- `workflow_transactions`
- `audit_events`
- `status_history`
- `workflow_evidence_requirements` when matching evidence can be marked verified

The pilot does not write module records such as projects, RFIs, change events, pay applications, safety incidents, deficiencies, closeout packages, or lessons learned.

## Write Behavior

The server-side action:

1. Validates that database mode and database transaction store mode are enabled.
2. Applies the existing workflow transaction logic.
3. Resolves or creates the matching workflow instance.
4. Inserts a workflow transaction row.
5. Updates the workflow instance status and resolution state.
6. Inserts an audit event.
7. Inserts status history if status/resolution changed.
8. Marks matching evidence requirements verified when confirmed evidence matches existing requirement titles.

## Local vs Database Store

Default:

```text
RYBEXOS_DATA_SOURCE=seed
RYBEXOS_WORKFLOW_TRANSACTION_STORE=local
```

Behavior: the existing local transaction store remains active and uses browser local state.

Read pilot:

```text
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_TRANSACTION_STORE=local
```

Behavior: database read pilot may be available, but workflow actions remain local.

Write pilot:

```text
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_TRANSACTION_STORE=database
```

Behavior: workflow actions attempt database writes through the server-side pilot path.

## Verification

Run:

```powershell
npm run db:verify-workflow-transactions
```

The script requires local Supabase env vars and writes a clearly labeled verification transaction. It reports workflow instance, workflow transaction, audit event, and status history counts before and after.

## Auth / RBAC Enforcement

Workflow transaction writes now resolve the current user and role before a
transaction is accepted. In demo mode, the actor is the demo operations leader.
In future Supabase auth mode, the resolver will map a Supabase session to
`user_profiles` and `workspace_memberships`.

The server path checks the transaction type and workflow type against RBAC
permissions before writing:

- approval transactions require the matching approval permission.
- RFI/change transactions require edit permission on those modules.
- `resolve_workflow_action` uses workflow-specific edit permissions.

Denied actions return a clean authorization error and do not write
`workflow_transactions`, `audit_events`, or `status_history`.

## Known Limitations

- Full production login is not implemented.
- No RLS policies enabled.
- No production approval matrix.
- No file evidence uploads.
- No notifications or escalations.
- No broad module record persistence.
- No production rollback UI.

## Rollback / Fallback

Set:

```text
RYBEXOS_DATA_SOURCE=seed
RYBEXOS_WORKFLOW_TRANSACTION_STORE=local
```

This restores the safe seed/local behavior. The app does not require database env vars in seed mode.

## Next Step

Review the write pilot results, then add authentication, RBAC enforcement, and RLS policies before expanding production persistence.

## Action Completion Guard

Workflow cards now expose a visible action path instead of only linking to a module. In local mode, the card applies browser-local transaction state and shows the outcome. In database transaction mode, the same action path calls the server-side write pilot.

If `RYBEXOS_WORKFLOW_TRANSACTION_STORE=database` is enabled without a server-side Supabase secret, the UI must show:

```text
Database transaction store is enabled, but server-side Supabase secret is missing. Switch to local transaction store or configure SUPABASE_SECRET_KEY.
```

This prevents false success during the persistence pilot.
