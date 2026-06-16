# Schema Risk Review

| Risk | Why It Matters | Mitigation |
| --- | --- | --- |
| Over-normalization | Too many tiny tables can slow development and make forms expensive to query. | Normalize durable child records, but use JSON for low-value metadata until workflows stabilize. |
| Under-normalization | Keeping everything as blobs would make reporting, RLS, audit, and status history weak. | Core status-bearing records get real tables; derived dashboards use views. |
| Polymorphic linking complexity | RFIs, changes, attachments, comments, and closeout requirements link across modules. | Use generic link tables with `entity_type` plus strong application validation; add constrained link tables later for high-risk flows. |
| Attachment sprawl | Every module needs evidence, photos, backup, and documents. | Store files in object storage and metadata in one `attachments` table with project/entity indexes. |
| Status history design | Gate approvals, pay apps, changes, incidents, and closeout acceptance need history. | Use one generic `status_history` table and require writes through repository functions. |
| Audit event volume | Daily reports and field actions can create many events. | Audit sensitive transitions; use `activity_events` for lower-sensitivity user-visible feeds. |
| RBAC/RLS mismatch | TypeScript permissions can drift from database policies. | Treat `lib/d5o/rbac.ts` as UI intent only; implement RLS policy tests by role before live data. |
| Reporting performance | Command Center and Optimize aggregate many records. | Add indexed project/status/date columns first; use reporting views/materialized views in Phase 9. |
| Seed/demo drift | Seed data can stop matching real schema. | Maintain `seed-to-database-mapping.md` and seed scripts generated from schema-aware fixtures. |
| Cross-module circular dependencies | Field reports create RFIs/changes; changes feed billing; billing blocks closeout; closeout feeds Optimize. | Migrate in phases and use link tables so modules can connect without circular table ownership. |
| Migration order mistakes | Moving downstream modules before core projects/gates risks broken references. | Follow the documented phase sequence and keep seed fallback until parity tests pass. |
| Derived vs stored scores | Readiness/control scores can become stale if stored. | Store optional snapshots for audit, but calculate current scores from source records. |
| Multi-workspace isolation | Future org support requires tenant scoping from day one. | Add `organization_id` to every tenant table and include it in RLS policies and indexes. |
| Closeout evidence integrity | Acceptance packages depend on evidence from many modules. | Link closeout requirements to source records and attachments; avoid copying evidence into disconnected records. |
