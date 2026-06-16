# Persistence Phase 2 - D1/D2 Tables + Read Repository Pilot

## What Phase 2 Added

Persistence Phase 2 adds schema scaffolding for the D1 Pipeline and D2 Project
Setup domains while keeping RybexOS seed-backed by default.

Runtime behavior did not change:

- `RYBEXOS_DATA_SOURCE=seed` remains the default.
- No route requires Supabase env values in seed mode.
- No write persistence is implemented.
- No auth, active RLS, ORM, or Supabase client dependency was added.

## Tables Added

Migration:

- `supabase/migrations/0002_d1_d2_pipeline_projects.sql`

D1 Pipeline tables:

- `opportunity_documents`
- `opportunity_reviews`

D1 score updates:

- `go_no_go_scores` gains `decision` and `decision_date` if missing.
- `go_no_go_score_dimensions` gains optional `weight` if missing.

`go_no_go_scores` and `go_no_go_score_dimensions` were created in Phase 1, so
Phase 2 does not recreate them.

D2 Project Setup tables:

- `contract_baselines`
- `scope_matrix_items`
- `budget_baselines`
- `budget_baseline_items`
- `schedule_baselines`
- `schedule_milestones`
- `flow_down_obligations`
- `notice_requirements`
- `project_setup_artifacts`

Every table follows the Phase 1 scoping standard where applicable:

- `organization_id`
- `workspace_id`
- `project_id`
- `opportunity_id`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

RLS expectations are documented as comments only. Active policies are not
enabled.

## Optional Demo Seed SQL

Optional local database pilot seed:

- `supabase/seed/phase2_d1_d2_demo_seed.sql`

It inserts a small controlled set:

- 1 organization
- 1 workspace
- 2 opportunities
- 2 projects
- 1 go/no-go score with dimension rows
- D2 contract, scope, budget, schedule, flow-down, notice, and artifact records

This file is not required for app build or seed-mode demos.

## Read Pilot Boundary

Database read-pilot methods exist in:

- `lib/d5o/data/database-repository.ts`

Pilot methods:

- `pipeline.getPipelineData()`
- `projects.getProjectsData()`

Because the project intentionally has no database client dependency yet, these
methods validate database mode/env and return a structured scaffold response
instead of querying Postgres. This proves the repository selection boundary
without pretending the runtime is database-backed.

The next approved persistence pass can replace these scaffold responses with
real SQL/Supabase reads.

## Seed Fallback

The seed fallback remains the protected runtime:

- `lib/d5o/data/repository.ts` selects seed unless
  `RYBEXOS_DATA_SOURCE=database`.
- Existing pages continue to use seed-backed providers by default.
- The app builds and route-smokes without database variables.

## Enabling Database Mode Later

Do not enable database mode for normal demos yet.

Future pilot sequence:

1. Review and apply migrations `0001` and `0002` to an isolated database.
2. Optionally apply `supabase/seed/phase2_d1_d2_demo_seed.sql`.
3. Add Supabase URL/read-key values to `.env.local`.
4. Set `RYBEXOS_DATA_SOURCE=database` only for the read-pilot test.
5. Replace scaffold read methods with real read adapters.
6. Run seed/database parity checks before any route is converted.

## Known Limitations

- No database write methods exist.
- Pipeline and Projects pages are not converted to database runtime.
- No active RLS/auth exists.
- No attachment storage provider exists.
- Read-pilot methods are scaffolded because no SQL/Supabase client dependency is
  installed.

## Rollback / Fallback

To return to the current demo-safe path:

```env
RYBEXOS_DATA_SOURCE=seed
```

Then run the normal checks. Seed mode is the source of truth until a future
database pilot passes route, parity, and security checks.

## Next Recommended Phase

Persistence Phase 3 should be chosen after human review:

- Option A: D1/D2 write pilot for opportunity/project setup records.
- Option B: D3 mobilization schema migration.

Either path must preserve seed fallback and avoid broad runtime conversion.
