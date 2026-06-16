# Auth + RBAC Foundation

RybexOS now has a minimal authentication and role-resolution foundation for workflow transaction enforcement.

## What Was Added

- Auth mode architecture in `lib/d5o/auth/auth-mode.ts`.
- Current user and workspace membership resolver in `lib/d5o/auth/current-user.ts`.
- Workflow transaction permission mapping in `lib/d5o/auth/workflow-transaction-permissions.ts`.
- Server-side permission guard in `lib/d5o/auth/permission-guard.ts`.
- RBAC enforcement before workflow transaction writes.
- Admin readiness reporting for auth mode, current role, permission count, and RBAC status.

## Auth Modes

### Demo

Default mode:

```env
RYBEXOS_AUTH_MODE=demo
```

Demo mode uses the existing non-persistent demo user:

- Name: Alyssa Morgan
- Role: operations_leader
- Source: demo

This keeps seed/local demos working without login or database requirements.

### Supabase

Future mode:

```env
RYBEXOS_AUTH_MODE=supabase
```

Supabase auth mode is scaffolded only. It is expected to resolve:

- Supabase auth user/session
- `user_profiles`
- `workspace_memberships`
- role key
- role permissions

The login/session resolver is not implemented yet.

## Workflow Transaction Enforcement

Workflow transaction writes now check role permissions before applying or writing a transaction.

Examples:

- `approve_go_no_go` requires `approve_go_no_go`.
- `approve_d2_gate` requires `approve_d2_gate`.
- `approve_d3_field_start` requires `approve_d3_gate`.
- `submit_daily_report` requires `submit_daily_report`.
- `create_rfi_from_signal` requires `edit_rfis_submittals`.
- `create_change_event_from_signal` requires `edit_changes`.
- `resolve_workflow_action` uses workflow-specific permissions.

If permission is denied, the server returns a clean authorization error and does not write the transaction.

## Actor Metadata

Allowed workflow transactions include actor metadata:

- actor name
- actor role
- actor user id when a database-safe UUID is available

Demo user ids are intentionally not written as Supabase UUIDs.

## What Is Not Implemented

- Production login UI
- Supabase session resolver
- External users
- Invitations
- MFA
- Active RLS policies
- Production approval matrix
- Route-level authorization middleware

## Next Step

Production Supabase auth/session resolution and RLS should be implemented only after this foundation is reviewed.

RLS/security update: `docs/rls-storage-security-foundation.md` and
`supabase/migrations/0004_rls_security_scaffold.sql` now define helper
functions and policy-family scaffolds. Broad RLS enforcement is still not
enabled, and production login/session resolution remains pending.
