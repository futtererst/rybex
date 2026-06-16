# Database Local Setup

## Current Status

RybexOS has Phase 1-3 persistence scaffolding. The application runtime remains
seed-backed by default and no route requires database environment variables.
The optional evidence upload pilot also has a private Storage bucket scaffold at
`supabase/storage/rybexos-evidence-bucket.sql`, but it is not required for seed
mode or normal demo verification.

The current SQL schema scaffolds live at:

- `supabase/migrations/0001_core_foundation.sql`
- `supabase/migrations/0002_d1_d2_pipeline_projects.sql`
- `supabase/migrations/0003_workflow_transactions.sql`

The first migration defines the core foundation tables, audit/status infrastructure,
attachment metadata links, opportunities, projects, D5O gates, gate artifacts,
and optional early project risk/issue/decision plus go/no-go score tables.

The second migration adds D1 opportunity documents/reviews and D2 contract,
scope, budget, schedule, flow-down, notice, and setup artifact tables. It also
extends the existing go/no-go score tables without duplicating them.

The third migration adds workflow transaction persistence scaffolding for
workflow instances, signals, transactions, evidence requirements, and source
links.

## Keep Seed Mode Active

Use seed mode for current development and demos:

```env
RYBEXOS_DATA_SOURCE=seed
RYBEXOS_WORKFLOW_TRANSACTION_STORE=local
RYBEXOS_EVIDENCE_STORE=local
```

Leave database variables blank unless a future persistence phase explicitly
requires them. Seed mode must continue to pass typecheck, lint, build, audit,
and route smoke checks without a database.

## Local Supabase Read Pilot

`.env.example` contains placeholders only. Real values belong in `.env.local`,
which is ignored by git and must not be packaged or committed.

```env
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_TRANSACTION_STORE=local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Compatibility aliases are supported if needed:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is preferred over the anon alias.
`SUPABASE_SECRET_KEY` is preferred over the service-role alias and is server-only.
Never expose secret keys to client components, screenshots, logs, source files,
or demo packages.

Stripe is not part of RybexOS. Do not add Stripe environment variables, docs,
scripts, or code.

## Inspecting The Schema

Review the Phase 1, Phase 2, and Phase 3 migrations before applying them anywhere:

```powershell
Get-Content .\supabase\migrations\0001_core_foundation.sql
Get-Content .\supabase\migrations\0002_d1_d2_pipeline_projects.sql
Get-Content .\supabase\migrations\0003_workflow_transactions.sql
```

Confirm the migrations only include Phase 1 core tables, Phase 2 D1/D2 tables,
and Phase 3 workflow transaction tables. Mobilization, field execution, billing,
safety, quality, closeout, and optimize domain tables are reserved for later
migrations.

Optional local D1/D2 pilot seed:

- `supabase/seed/phase2_d1_d2_demo_seed.sql`

## Applying Later With Supabase/Postgres

Do not apply this migration as part of the current seed-backed runtime. In a
future database implementation pass, use the selected Supabase/Postgres workflow
from `docs/persistence-technology-decision.md`.

Expected future steps:

1. Create or use a reviewed Supabase/Postgres project.
2. Add Supabase values to `.env.local`.
3. Keep seed mode for demos unless intentionally testing the read-only pilot.
4. Apply the Phase 1, Phase 2, and Phase 3 migrations in an isolated database.
5. Verify the schema manually.
6. Keep `RYBEXOS_WORKFLOW_TRANSACTION_STORE=local` unless testing the approved
   workflow transaction write pilot.
7. Test `RYBEXOS_DATA_SOURCE=database` only for read-only diagnostics and pilot
   reads.

## Database Mode Boundaries

`lib/d5o/data/database-client.ts` safely returns `null` in seed mode. If database
mode is requested without Supabase URL/key values, it throws a controlled error.
The database repository currently supports a narrow read-only Supabase pilot and
workflow transaction write pilot.

Workflow transaction persistence remains local by default. Set
`RYBEXOS_WORKFLOW_TRANSACTION_STORE=database` only when intentionally testing
the workflow transaction write pilot.

## Workflow Transaction Write Pilot

To test the only current database write path:

```env
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_TRANSACTION_STORE=database
```

Then run:

```powershell
npm run db:verify-workflow-transactions
```

The pilot writes workflow transaction infrastructure rows only. It does not
persist source module records or enable auth, RLS, uploads, notifications, or
production approval routing.

## Rollback And Demo Fallback

If a future database pilot fails:

- Set `RYBEXOS_DATA_SOURCE=seed`.
- Remove local database-only variables from `.env.local` if needed.
- Run the normal verification commands.
- Continue demos using the seed-backed provider layer.

The seed-backed app is the protected fallback until every converted route has
repository parity and route smoke coverage.
