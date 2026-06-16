# Relationship Model Review

The schema supports the major D5O relationships. Recommendation: use direct
foreign keys for ownership and high-cardinality parent/child records; use link
tables for cross-module references; reserve polymorphic links for attachments,
comments, activity, audit, and closeout/source references where many modules can
be involved.

| Relationship | Recommended Model | Tables | Status | Tradeoff / Notes |
| --- | --- | --- | --- | --- |
| Project-to-opportunity conversion | Direct FK plus immutable source snapshot | projects.source_opportunity_id -> opportunities.id | Ready | Keeps project linked to pursuit while allowing project baseline to diverge from opportunity. |
| Project-to-D5O gates | Direct FK | d5o_gates.project_id | Ready | Simple and auditable. Gate history uses status_history/audit_events. |
| Gate artifacts | Direct FK to gate plus attachments | gate_artifacts.gate_id, attachments | Ready | Evidence files stay generic. |
| Mobilization to project | Direct FK | mobilization_plans.project_id | Ready | One project can have multiple plans/segments if needed. |
| Work packages to mobilization and daily reports | Direct FKs | work_packages.plan_id, daily_reports.work_package_id | Ready | WorkPackage is the D3/D4 bridge. |
| Daily reports to RFIs | Link table | rfi_links linked_entity_type=daily_report | Ready | Avoids adding many nullable FK fields. |
| Daily reports to change events | Link table | change_event_links linked_entity_type=daily_report | Ready | Supports multiple changes from one report and vice versa. |
| RFIs to change events | Link table both sides or one canonical link | rfi_links/change_event_links | Needs decision | Prefer `change_event_links` as canonical for commercial source, with helper reads for RFI view. |
| Submittals to work packages/materials/closeout | Link table | submittal_links | Ready | Material entity may be introduced later; use linked_entity_type for now. |
| Change events to billing | Direct billing fields plus links to pay app/SOV if needed | change_events.billing_status, pay app inclusion joins later | Partial | Add `pay_application_change_events` when billing becomes persistent. |
| Billing to SOV/daily reports/quantities/changes | Direct FKs plus link/source fields | SOV lines, billing_backup_items, installed_quantities | Ready | Backup items should link to source records through type/id fields. |
| Safety observations to daily reports/work packages | Direct FK for promoted safety record plus optional source link | safety_observations.work_package_id, source daily report link | Partial | Add `source_daily_report_id` or generic source fields. |
| Quality deficiencies to inspections/work packages/closeout | Direct FKs | quality_deficiencies.work_package_id, linked inspection/action | Ready | Closeout linkage through closeout_requirements source fields. |
| Punch items to closeout | Direct FK optional plus closeout requirement source link | punch_items, closeout_requirements | Ready | Punch can exist before closeout package; link when package assembled. |
| Closeout requirements to source records | Polymorphic source link plus attachments | closeout_requirements.source_module/source_record_ids | Ready with validation | DB cannot easily enforce all source FKs; repository validation required. |
| Optimize records to completed projects | Direct FK to project | scorecards/lessons project_id | Ready | Production rates may use sample-project join table later. |
| Attachments to records | Polymorphic owner link | attachments.owner_entity_type/id | Ready | Needs RLS and storage path validation. |
| Comments/activity/audit to records | Polymorphic entity link | comments, activity_events, audit_events | Ready | Good generic pattern; indexes are critical. |

## Link Strategy Recommendation

- Direct FKs for ownership: organization, project, gate, plan, package, daily report.
- Join/link tables for operational relationships: RFI/change/submittal/source relationships.
- Polymorphic links for universal infrastructure: attachments, audit, comments, activity, status history.
- Repository validation for polymorphic links until/if module-specific constrained link tables are introduced.

## Decisions Before Implementation

- Choose canonical RFI-to-change link direction.
- Add `source_daily_report_id` or generic source fields to promoted safety/quality records.
- Add pay-application/change join table when billing persistence starts.
- Decide whether production rate sample projects should be a join table in Phase 6.
