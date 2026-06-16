# Workflow Completion Persistence Bridge

## Purpose

The Workflow Completion Persistence Bridge is a narrow Supabase pilot for persisting completion state transitions from the standardized Workflow Completion Engine.

It is not broad production persistence. It only covers registered completion workflows and only when explicitly enabled.

Pilot Mode at `/pilot` uses the same local/demo completion engine by default. If the completion store is intentionally set to database mode, Pilot Mode labels the slice as database pilot mode but still does not claim production readiness.

## Local/Demo Mode

Default mode remains local:

```env
RYBEXOS_WORKFLOW_COMPLETION_STORE=local
```

In local/demo mode:

- Billing Backup, Field Issue, and Closeout Requirement proof flows keep using browser-local state.
- No Supabase write is attempted.
- Existing browser QA remains the source of local interaction proof.
- Seed fallback remains intact.

## Database Pilot Mode

Database completion pilot mode is opt-in:

```env
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_COMPLETION_STORE=database
```

Required Supabase environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

Server-side writes must use the server-side secret only. Client components must never receive the secret key.

## Supported Workflows

- `billing-backup-cash-recovery`
- `field-issue-escalation`
- `closeout-requirement-final-billing-release`

The first database verifier uses the Billing Backup completion path as the deterministic pilot write.

## Tables Used

The bridge uses existing tables:

- `workflow_instances`
- `workflow_transactions`
- `workflow_evidence_requirements`
- `audit_events`
- `status_history`

No new migration is required for this pilot. Completion-specific details are stored in workflow transaction and workflow instance metadata using `rybexos_completion_pilot=true`.

## Persisted Objects

Database mode persists:

- completion action/event as a `workflow_transactions` row
- completion state transition on `workflow_instances`
- evidence status update when matching requirements exist
- linked output metadata in transaction/instance metadata
- completion history equivalent through transaction/audit/status rows
- `audit_events` row
- `status_history` row

If a matching optional evidence row is missing, the pilot records evidence update metadata rather than failing the whole completion action.

## Server Boundary

`app/actions/workflow-completions.ts` is the server-side entry point.

It validates:

- workflow id exists in the registry
- action exists in the workflow definition
- current user/demo user is resolved
- role has at least one required action permission
- database mode and completion database store are explicitly enabled

## What Is Not Production-Ready

- RLS is not enabled.
- Supabase Auth login is not production-ready.
- Completion writes are not append-only hardened.
- External notifications are not sent.
- Production file upload/security is separate.
- Linked outputs are pilot metadata, not canonical RFI/change/closeout records.
- No production approval matrix is enforced.

## Rollback / Fallback

Set:

```env
RYBEXOS_WORKFLOW_COMPLETION_STORE=local
```

or return to:

```env
RYBEXOS_DATA_SOURCE=seed
```

Local/demo completion continues to work without Supabase env vars.

## Verification

Local proof:

```bash
npm run workflow-completion:qa-all
```

Database pilot proof:

```bash
npm run workflow-completion:verify-db
```

Optional database QA wrapper:

```bash
npm run workflow-completion:qa-db
```

## State Ownership Model

Server renders definitions/static shell. The client provider owns live completion state.

Local/demo persistence is adapter-driven. The Supabase completion bridge remains an opt-in database adapter path and is not made default by the state architecture refactor.
