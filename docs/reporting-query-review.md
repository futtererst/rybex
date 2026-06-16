# Reporting And Query Performance Review

RybexOS can support the required reporting model if core tables include
organization/project/status/date indexes from the start. Do not optimize with
materialized views until live data volume proves the need.

## Reporting Needs

| View | Source Tables | Initial Indexes | Strategy |
| --- | --- | --- | --- |
| Command Center metrics | projects, opportunities, gates, daily reports, changes, billing, safety, quality, closeout, optimize | org, project, status, due/date fields | Start with repository aggregation; move to views later. |
| Project health summaries | projects, risks, issues, RFIs, changes, billing, safety, quality | projects(org, health), child(project,status) | Query by project and status. |
| D5O phase status | projects, d5o_gates, gate_artifacts | projects(org, d5o_phase), gates(project, phase) | Direct joins. |
| Gate readiness | d5o_gates, gate_artifacts | artifacts(gate,status,due) | Compute current readiness; snapshot approvals. |
| Pipeline summary | opportunities, go_no_go_scores, reviews | opportunities(org,status,bid_due_date) | Direct filters. |
| Mobilization blockers | mobilization_plans, readiness child tables, work_packages | plans(project,status,field_start), work_packages(project,status) | Aggregate blockers per plan. |
| Field compliance | daily_reports, signoffs, installed_quantities | daily_reports(project,report_date,status) | Date-window queries. |
| RFI/submittal aging | rfis, submittals | project/status/due indexes | Direct aging queries. |
| Change exposure | change_events, pricing, backups | change_events(project,status,notice_deadline,billing_status) | Sum exposure by project/status. |
| Billing cash at risk | pay_applications, SOV, backups, lien waivers, commercial exposure | pay_applications(project,status,payment_due_date) | Finance repository aggregate. |
| Safety/quality overdue | corrective_actions, incidents, deficiencies, tests, punch | project/status/due/severity | Direct filters. |
| Closeout blockers | closeout_packages, requirements, acceptance, billing | packages(project,status), requirements(package,status,category) | D5 repository aggregate. |
| Optimize scorecards | scorecards, lessons, production rates, profiles, actions | project/status/category indexes | Direct query plus reporting views later. |

## Initial Index Recommendations

- Every tenant table: `(organization_id)`.
- Project-scoped tables: `(project_id)`, `(project_id, status)`.
- Due-date records: `(project_id, status, due_date)`.
- Date-window records: `(project_id, report_date)` or `(organization_id, created_at)`.
- Cross-module link tables: `(linked_entity_type, linked_entity_id)` and owner-side ID.
- Audit/activity/status: `(entity_type, entity_id)`, `(project_id, created_at)`.
- Attachments: `(owner_entity_type, owner_entity_id)`, `(project_id)`.

## Aggregation Strategy

1. Start with repository-level aggregation against indexed normalized tables.
2. Add SQL views for common read models once query shapes stabilize.
3. Add materialized views only for expensive Command Center/Optimize summaries at real data volume.
4. Keep derived scores recalculable from source records; store snapshots only for approvals/audit.

## What Not To Optimize Prematurely

- Do not build a warehouse before live usage exists.
- Do not materialize every dashboard metric.
- Do not denormalize status fields everywhere before measuring query cost.
- Do not persist operating action items as source-of-truth records initially.

## Query Risks To Watch

- Command Center joining too many module tables on every request.
- Polymorphic link tables without indexes.
- Attachments table growth without owner/project indexes.
- Status history and audit volume affecting Admin/reporting views.
- Optimize production rate queries needing sample project join tables.
