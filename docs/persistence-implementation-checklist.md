# Persistence Implementation Checklist

## Required Pre-Implementation Gate

- Schema/security review complete and approved.
- Schema coverage review complete.
- Relationship model approved.
- Status history strategy approved.
- Audit requirements approved.
- RBAC/RLS strategy approved.
- Attachment strategy approved.
- Reporting/index strategy approved.
- Repository contract reconciled with schema plan.
- Rollback/demo fallback confirmed.

## Evidence Upload Pilot Gate

- Private `rybexos-evidence` bucket scaffold reviewed.
- `RYBEXOS_EVIDENCE_STORE=local` confirmed as default.
- Upload pilot tested only in isolated database mode.
- `attachments`, `entity_attachments`, `workflow_evidence_requirements`, `audit_events`, and `status_history` writes reviewed.
- Public bucket policy not added.
- RLS, signed URLs, malware scanning, retention, and production file governance remain required before production upload use.
- Human approval recorded before adding migrations, Supabase, Prisma, Drizzle, or database runtime adapters.

## Phase 1 Persistence Foundation

- Core foundation schema scaffolded in `supabase/migrations/0001_core_foundation.sql`.
- `.env.example` includes future database/Supabase variables without requiring them in seed mode.
- Data source fallback confirmed: `RYBEXOS_DATA_SOURCE=seed` remains the default.
- Database client placeholder added and safe in seed mode.
- Database repository skeleton added behind the repository selector.
- RLS/security considerations documented as SQL comments only; active RLS is not enabled.
- Audit/status-history tables scaffolded; workflow audit writes are not database-backed yet.
- Routes verified while seed mode remains active.
- Next required phase: Persistence Phase 2 - D1/D2 Tables + Read Repository Pilot.

## Phase 2 D1/D2 Read Pilot

- D1/D2 schema scaffolded in `supabase/migrations/0002_d1_d2_pipeline_projects.sql`.
- Existing Phase 1 go/no-go score tables extended without duplication.
- Opportunity document/review tables added.
- Contract baseline, scope matrix, budget baseline, schedule baseline, flow-down, notice, and setup artifact tables added.
- Optional local pilot seed added at `supabase/seed/phase2_d1_d2_demo_seed.sql`.
- Pipeline database read pilot scaffolded behind database mode.
- Projects database read pilot scaffolded behind database mode.
- Seed mode remains default and requires no database variables.
- Write persistence remains intentionally unimplemented.
- Auth and active RLS remain intentionally unimplemented.
- Next required decision: D1/D2 write pilot or D3 migration after human review.

## Phase 3 Workflow Transaction Persistence Scaffold

- Workflow transaction schema scaffolded in `supabase/migrations/0003_workflow_transactions.sql`.
- `workflow_instances`, `workflow_signals`, `workflow_transactions`, `workflow_evidence_requirements`, and `workflow_source_links` are represented.
- Future RLS/security expectations are documented as SQL comments only.
- Repository contracts include workflow transaction persistence methods.
- Database repository includes safe scaffold/stub methods.
- Local-to-persistence mapping adapter added at `lib/d5o/workflow/persistence-adapter.ts`.
- Workflow transaction store mode helper defaults to local.
- Audit/status-history linkage documented: future writes should create workflow transaction, audit event, and status history rows together.
- Seed runtime and local transaction MVP remain default.
- Next required decision: enable a DB-backed transaction pilot only after local database verification and human review.

## Supabase Read-Only Pilot Env Handling

- `.env.example` contains placeholders only.
- `.env.local` is local-only and ignored by git.
- `NEXT_PUBLIC_SUPABASE_URL` is supported.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is preferred for public/read pilot calls.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` remains a compatibility alias.
- `SUPABASE_SECRET_KEY` is supported server-side only.
- `SUPABASE_SERVICE_ROLE_KEY` remains a compatibility alias.
- Seed mode requires no Supabase variables.
- Database mode produces controlled diagnostics when Supabase env is incomplete.
- Stripe is not part of RybexOS and should not be added.
- Read-only pilot methods may read workflow instances, opportunities, projects, D5O gates, go/no-go scores, signals, and evidence requirements.
- Writes, auth, RLS, uploads, notifications, and production persistence remain intentionally unimplemented.

## Environment Setup

- Choose database provider and create local dev environment.
- Add `.env.local` variables without removing `RYBEXOS_DATA_SOURCE=seed`.
- Add database URL, service role handling, and storage bucket naming plan.

## Database Provider Decision

- Confirm Supabase Postgres + SQL migrations.
- Decide when, if ever, to add Prisma or Drizzle.
- Define local migration and seed commands.

## Migration Tool Setup

- Create migrations directory.
- Add schema lint/review process.
- Add rollback notes for each migration.

## Auth And RLS

- Decide Supabase Auth rollout.
- Map `UserRole` to workspace memberships.
- Implement organization-scoped RLS policies.
- Add role policy tests.

## Initial Tables

- Add organizations, users, profiles, memberships.
- Add projects, opportunities, attachments, audit events, activity events, comments, status history.
- Seed one organization and demo users.

## Seed Migration

- Preserve seed IDs where practical.
- Migrate projects and opportunities first.
- Backfill source links and relationship tables.
- Keep seed mode available until all route parity checks pass.

## Repository Implementation

- Implement database adapters matching `lib/d5o/data/contracts.ts`.
- Keep seed adapters for demo mode.
- Add environment-based repository selection.
- Convert read-only pages before mutating workflows.

## Route-By-Route Conversion

- Start with Admin and one read-only module.
- Convert Pipeline and Projects after core tables.
- Convert downstream modules by migration phase.
- Run smoke routes after every module conversion.

## Test Gates

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm audit --omit=dev`
- `npm run smoke:routes`
- Repository unit tests
- RLS policy tests
- Seed/database parity tests

## Backup And Rollback

- Export seed/demo data before migration.
- Snapshot database before destructive migrations.
- Keep seed fallback route demoable.
- Document rollback command per migration.

## Production Readiness Gates

- Auth enforced.
- RLS tested.
- Audit/status history writes verified.
- Attachments storage permissions verified.
- Backups configured.
- Reporting performance checked.
- Demo mode still available without live data risk.

## Phase 4 - Workflow Transaction Write Pilot

- [x] Server-side workflow transaction action added.
- [x] Workflow transaction write helper added.
- [x] `workflow_transactions` insert path implemented.
- [x] `workflow_instances` status/resolution update path implemented.
- [x] `audit_events` insert path implemented.
- [x] `status_history` insert path implemented when state changes.
- [x] Matching evidence requirements can be marked verified.
- [x] UI shows loading, success, and error states.
- [x] Admin reports workflow transaction, audit, and status counts when readable.
- [x] Verification script added: `npm run db:verify-workflow-transactions`.
- [x] Default mode remains seed/local.
- [ ] Auth/RBAC enforcement added.
- [ ] RLS policies enabled and tested.
- [ ] Production approval matrix added.
- [ ] Source module record writes implemented.
- [ ] File evidence uploads implemented.
