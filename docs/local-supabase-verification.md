# Local Supabase Verification

This guide verifies the narrow read-only Supabase pilot. It does not enable
write persistence, auth, RLS, file uploads, notifications, or production
database runtime.

## Security Boundary

- Supabase keys belong only in `.env.local`.
- `.env.local` must not be committed, packaged, screenshotted, logged, or shared.
- Development keys must be rotated before anything public.
- `SUPABASE_SECRET_KEY` is server-side only.
- Stripe is not part of RybexOS. Do not add Stripe keys, docs, scripts, or code.

## Seed Mode Baseline

Seed mode must work without Supabase values:

```powershell
npm run demo:check
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
npm run verify
```

## Local Database Pilot Env

`.env.local` should contain local/private values only:

```env
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_TRANSACTION_STORE=local
NEXT_PUBLIC_SUPABASE_URL=https://fcawktdjoxvahhgvkebx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Use the actual publishable and secret keys only on the local machine.

## What The Pilot Reads

The read-only repository pilot can query:

- `workflow_instances`
- `workflow_signals`
- `workflow_evidence_requirements`
- `opportunities`
- `go_no_go_scores`
- `projects`
- `d5o_gates`

The Admin page reports readiness and counts without showing key values.

## Expected Admin Signals

Admin should show:

- current data source mode
- seed fallback status
- Supabase URL present/missing
- publishable key present/missing
- server-side secret key present/missing
- database read pilot status
- workflow instance count when readable
- opportunity/project counts when readable
- warning that writes, auth, and RLS are not enabled

## If Reads Fail

Use seed fallback:

```env
RYBEXOS_DATA_SOURCE=seed
RYBEXOS_WORKFLOW_TRANSACTION_STORE=local
```

Then rerun normal verification. The app should remain fully demoable in seed
mode.

## Workflow Transaction Write Pilot

The first write pilot is scoped only to workflow transactions.

To verify it locally:

```env
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_TRANSACTION_STORE=database
```

Then run:

```powershell
npm run db:verify-workflow-transactions
```

The script writes a clearly labeled verification transaction and reports counts
before and after for:

- `workflow_instances`
- `workflow_transactions`
- `audit_events`
- `status_history`

This does not enable broad module record writes, auth, RLS, uploads, or
notifications.
