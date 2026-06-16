# Persistence Technology Decision

## Recommendation

Use **Supabase Postgres with SQL migrations and a thin TypeScript repository layer**.
Use Supabase Auth/RLS when authentication is implemented. Do not introduce Prisma
or Drizzle until the schema stabilizes and the team confirms whether an ORM is
worth the extra abstraction.

## Options Compared

| Option | Strengths | Weaknesses | Fit For RybexOS |
| --- | --- | --- | --- |
| Supabase direct client | Fast setup, Auth/RLS/storage alignment, good local story, simple Postgres access. | Query typing must be managed; complex reporting can sprawl without repository discipline. | Best initial path if wrapped behind repositories. |
| Prisma + Postgres | Strong generated types, familiar model layer, good migrations. | Supabase RLS/Auth fit is less direct; edge/serverless complexity; generated client can be heavy. | Good later if team prioritizes ORM ergonomics over RLS-native access. |
| Drizzle + Postgres | Type-safe SQL, lighter than Prisma, migration discipline. | More schema/query code; RLS/Auth still needs deliberate design. | Strong candidate after schema review if Supabase client typing is insufficient. |
| Plain SQL migrations | Maximum clarity, excellent for RLS, reporting, and audit. | Requires disciplined TypeScript repository contracts; less generated typing. | Best for initial schema and RLS correctness. |

## Decision Rationale

- Type safety: repository contracts keep UI typed now; generated database types can be added from Supabase later.
- Migration discipline: SQL migrations make RLS, indexes, constraints, and reporting views explicit.
- Supabase compatibility: Auth, Storage, and RLS align with future RBAC and attachments.
- Query complexity: repositories can hide complex joins and reporting views from pages.
- Future reporting: Postgres views/materialized views can support Command Center and Optimize.
- Attachments: Supabase Storage maps cleanly to `attachments` metadata.
- Auditability: database triggers can write `audit_events` and `status_history`.
- Local development: Supabase local stack can run migrations and seed scripts.
- Maintainability: no runtime switch until each repository is ready and tested.

## Recommended Path

1. Keep seed mode as default.
2. Add Supabase project and local dev configuration in a future pass.
3. Write SQL migrations for Phase 1 core tables first.
4. Generate database types after migrations.
5. Implement repository adapters behind `lib/d5o/data/contracts.ts`.
6. Convert one low-risk read-only route to database mode behind `RYBEXOS_DATA_SOURCE=database`.
7. Keep demo seed fallback until live workflows are proven.
