# RybexOS Database Schema Plan

Recommended target: Postgres with UUID primary keys, `organization_id` on all tenant-owned tables, `project_id` on project records, `created_at`, `updated_at`, `created_by`, and soft-delete fields where operational history must be preserved.

## Global Design Rules

- Use normalized module tables for durable records.
- Use generic link tables only where records can connect across multiple modules.
- Keep `audit_events`, `status_history`, `attachments`, and `activity_events` generic.
- Preserve D5O phase/gate relationships explicitly instead of deriving them from page state.
- Use Postgres enums or checked text values for statuses after the schema stabilizes.
- For Supabase later, every tenant table should have RLS scoped by `organization_id` and membership role.

## Schema Groups

| Table | Purpose | Key Columns | Relationships | Indexes | Audit | Attachments | Status History | RLS/Security | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| organizations | Tenant boundary. | id, name, slug, status | Owns all workspace data. | slug unique | High | No | Yes | Members only. | 1 |
| users | Auth identity reference. | id, email, auth_provider_id | Has profile and memberships. | email unique | High | No | Yes | User can read self. | 1 |
| user_profiles | Rybex user display/profile. | user_id, name, title, default_role | Belongs to user. | user_id | Medium | Optional | Yes | Self/admin. | 1 |
| workspace_memberships | Org membership and role. | organization_id, user_id, role | Joins users/orgs. | org+user unique | High | No | Yes | Admin manages. | 1 |
| roles | Role definitions. | id, organization_id, role_key, label | Used by memberships. | org+role_key | High | No | Yes | Admin. | 7 |
| permissions | Optional custom permissions. | id, role_id, permission_key | Role permission map. | role_id, key | High | No | Yes | Admin. | 7 |
| audit_events | Immutable sensitive action trail. | entity_type, entity_id, actor_id, action, summary | Links any record. | entity, project_id, created_at | High | No | No | Admin and authorized project roles. | 1 |
| attachments | File metadata. | owner_entity_type, owner_entity_id, storage_path, file_name | Links any record. | owner, project_id | Medium | File | Yes | Owner/module roles. | 1 |
| comments | User comments. | entity_type, entity_id, body, created_by | Links any record. | entity, project_id | Medium | Optional | No | Project roles. | 1 |
| activity_events | Human-readable activity feed. | entity_type, entity_id, event_type, summary | Links any record. | entity, project_id, created_at | Medium | Optional | No | Project roles. | 1 |
| status_history | Status transition log. | entity_type, entity_id, from_status, to_status, changed_by | Links any status-bearing record. | entity, changed_at | High | No | N/A | Project/module roles. | 1 |

## D5O And Project Core

| Table | Purpose | Key Columns | Relationships | Indexes | Audit | Attachments | Status History | RLS/Security | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| opportunities | D1 opportunity intake. | name, gc_client, location, status, bid_due_date, estimated_value | May convert to project. | org, status, bid_due_date | Medium | Yes | Yes | Pipeline roles. | 2 |
| projects | Project system of record. | project_number, name, gc_client, d5o_phase, health_status | Owns module records. | org, phase, health | High | Yes | Yes | Project roles. | 1 |
| d5o_gates | Phase gate state. | project_id, phase_id, gate_name, readiness_percent, status | Belongs to project. | project+phase | High | Yes | Yes | Approver roles. | 1 |
| gate_artifacts | Required gate evidence. | gate_id, name, status, owner, due_date | Belongs to gate. | gate, status, due | Medium | Yes | Yes | Project roles. | 1 |
| project_risks | Risk register. | project_id, title, severity, status, owner | Belongs to project. | project, status, severity | Medium | Optional | Yes | Project roles. | 1 |
| project_issues | Issue register. | project_id, title, status, owner, due_date | Belongs to project. | project, status, due | Medium | Optional | Yes | Project roles. | 1 |
| project_decisions | Decision queue. | project_id, title, owner, due_date, status | Belongs to project. | project, due, status | Medium | Optional | Yes | Project roles. | 1 |

## Pipeline

| Table | Purpose | Key Columns | Relationships | Indexes | Audit | Attachments | Status History | RLS/Security | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| opportunity_documents | Intake document register. | opportunity_id, document_type, received, status | Belongs to opportunity. | opportunity, status | Medium | Yes | Yes | Pipeline roles. | 2 |
| go_no_go_scores | Pursuit scoring snapshot. | opportunity_id, total_score, recommendation, risk_level | Belongs to opportunity. | opportunity, recommendation | High | No | Yes | Approver roles. | 2 |
| opportunity_reviews | Required reviewer status. | opportunity_id, reviewer_role, owner_id, status | Belongs to opportunity. | opportunity, status | Medium | Optional | Yes | Pipeline roles. | 2 |

## Project Setup / D2

| Table | Purpose | Key Columns | Relationships | Indexes | Audit | Attachments | Status History | RLS/Security | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| contract_baselines | Contract/commercial baseline. | project_id, contract_status, value, retainage, payment_terms | One per project version. | project, status | High | Yes | Yes | PM/finance. | 2 |
| scope_matrix_items | Included/excluded/dependency scope. | project_id, category, description, owner | Belongs to project. | project, category | Medium | Optional | Yes | PM. | 2 |
| budget_baselines | Budget baseline. | project_id, status, total_budget, margin | Belongs to project. | project, status | High | Yes | Yes | PM/finance. | 2 |
| schedule_baselines | Schedule baseline. | project_id, status, start_date, finish_date | Belongs to project. | project, status | High | Yes | Yes | PM/ops. | 2 |
| flow_down_obligations | Contract obligations. | project_id, obligation_type, description, owner, status | Belongs to project. | project, status | High | Optional | Yes | PM/ops. | 2 |
| notice_requirements | Notice windows and rules. | project_id, trigger, notice_window_days, recipient | Belongs to project. | project, trigger | High | Optional | Yes | PM/ops. | 2 |
| project_setup_artifacts | D2 required artifacts. | project_id, artifact_type, status, owner | Belongs to project. | project, status | Medium | Yes | Yes | PM. | 2 |

## Workflow Transactions / Operating Movement

| Table | Purpose | Key Columns | Relationships | Indexes | Audit | Attachments | Status History | RLS/Security | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| workflow_instances | Durable workflow envelope for Signal -> Decision -> Action -> Evidence -> Gate Movement. | workflow_type, d5o_phase, source_module, source_record_type, source_record_id, current_status, resolution_state, severity, due_date | Links organization/workspace/project and source records. | organization, workspace, project, workflow_type, d5o_phase, resolution_state, severity, due_date | High | Via evidence requirements | Yes | Project/module scoped. | 3 |
| workflow_signals | Detected operating signal that triggered workflow attention. | workflow_instance_id, signal_type, severity, source_module, source_record_type, source_record_id | Belongs to workflow instance. | workflow_instance | Medium | No | No | Inherits workflow access. | 3 |
| workflow_transactions | Completed workflow decision/action event. | workflow_instance_id, transaction_type, actor_role, decision_reason, action_taken, resulting_status | Belongs to workflow instance; future writes create audit/status rows. | workflow_instance, transaction_type, created_at | High | Optional through evidence | Yes through status_history | Append-only except admin. | 3 |
| workflow_evidence_requirements | Evidence needed to complete the workflow or gate/status movement. | workflow_instance_id, requirement_type, status, source_module, attachment_id | Links workflow and attachment/source evidence. | workflow_instance | Medium | Yes | Yes | Inherits workflow and attachment access. | 3 |
| workflow_source_links | Controlled cross-module links for workflow context. | workflow_instance_id, source_module, source_record_type, source_record_id, link_type | Links workflow to source records. | workflow_instance, source tuple | Medium | No | No | Inherits workflow access. | 3 |

## Mobilization / D3

| Table | Purpose | Key Columns | Relationships | Indexes | Audit | Attachments | Status History | RLS/Security | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mobilization_plans | D3 readiness plan. | project_id, readiness_status, dates, owner, readiness_percent | Belongs to project. | project, status, field_start | High | Yes | Yes | Ops/superintendent. | 3 |
| crew_plans | Crew readiness. | mobilization_plan_id, crew_type, supervisor, status | Belongs to plan. | plan, status | Medium | Optional | Yes | Ops. | 3 |
| equipment_readiness_items | Equipment/tooling readiness. | plan_id, name, status, owner | Belongs to plan. | plan, status | Medium | Optional | Yes | Ops. | 3 |
| material_readiness_items | Material readiness. | plan_id, material, delivery_status, owner | Belongs to plan. | plan, status | Medium | Yes | Yes | Ops/PM. | 3 |
| permit_access_items | Access/permit readiness. | plan_id, item_type, status, due_date | Belongs to plan. | plan, status, due | High | Yes | Yes | Ops/PM. | 3 |
| utility_locate_records | Locate confirmations. | plan_id, ticket_number, status, expires_at | Belongs to plan. | plan, status, expires | High | Yes | Yes | Ops/safety. | 3 |
| work_packages | Field-executable package. | project_id, plan_id, name, status, dates, supervisor | Belongs to project/plan. | project, status, dates | High | Yes | Yes | Field/PM. | 3 |

## Field Execution / D4

| Table | Purpose | Key Columns | Relationships | Indexes | Audit | Attachments | Status History | RLS/Security | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| daily_reports | Daily proof of work. | project_id, work_package_id, report_date, status, supervisor | Links project/work package. | project+date, status | High | Yes | Yes | Field/PM. | 3 |
| daily_report_crew_members | Crew roster. | daily_report_id, name, role | Belongs to daily report. | report | Medium | No | No | Field/PM. | 3 |
| labor_hour_entries | Labor hours. | daily_report_id, worker, role, hours | Belongs to daily report. | report | Medium | No | No | Field/PM. | 3 |
| equipment_usage_entries | Equipment usage. | daily_report_id, equipment, hours | Belongs to daily report. | report | Medium | No | No | Field/PM. | 3 |
| material_receipts | Material deliveries/issues. | daily_report_id, material, quantity, status | Belongs to daily report. | report, status | Medium | Yes | Yes | Field/PM. | 3 |
| installed_quantities | Production quantities. | daily_report_id, work_package_id, quantity, uom | Links report/package/SOV later. | package, report | High | Optional | No | Field/PM/finance. | 3 |
| field_safety_observations | Daily safety signals. | daily_report_id, severity, description | May promote to safety module. | report, severity | High | Yes | Yes | Field/safety. | 3 |
| field_quality_checks | Daily quality checks. | daily_report_id, status, description | May promote to quality module. | report, status | High | Yes | Yes | Field/quality. | 3 |
| field_delays | Delay records. | daily_report_id, reason, schedule_impact | May link to RFI/change. | report, impact | High | Yes | Yes | Field/PM. | 3 |
| field_blockers | Work blockers. | daily_report_id, blocker_type, owner, status | May link to RFI/change/safety/quality. | report, status | High | Optional | Yes | Field/PM. | 3 |
| changed_conditions | Changed condition prompts. | daily_report_id, description, rfi_needed, change_needed | Links change/RFI. | report, flags | High | Yes | Yes | Field/PM. | 3 |
| field_photo_records | Photo evidence. | daily_report_id, title, required, status | Links attachment. | report, status | Medium | Yes | Yes | Field/PM. | 3 |
| supervisor_signoffs | Daily report approval. | daily_report_id, status, signed_by, signed_at | Belongs to report. | report, status | High | No | Yes | Supervisor/PM. | 3 |

## RFI/Submittal And Change Control

| Table | Purpose | Key Columns | Relationships | Indexes | Audit | Attachments | Status History | RLS/Security | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rfis | Formal clarification log. | project_id, rfi_number, title, status, due_date, priority | Links project and many records. | project, status, due | High | Yes | Yes | PM. | 4 |
| submittals | Submittal register. | project_id, submittal_number, title, status, review_due_date | Links project/material/work packages. | project, status, due | High | Yes | Yes | PM. | 4 |
| rfi_links | RFI relationship links. | rfi_id, linked_entity_type, linked_entity_id | Links daily reports, work packages, changes. | rfi, linked | Medium | No | No | PM. | 4 |
| submittal_links | Submittal relationship links. | submittal_id, linked_entity_type, linked_entity_id | Links materials, work packages, closeout. | submittal, linked | Medium | No | No | PM. | 4 |
| change_events | Commercial recovery record. | project_id, change_number, status, notice_deadline, pricing_status, billing_status | Links project/RFI/daily reports. | project, status, notice | High | Yes | Yes | PM/finance. | 4 |
| change_event_links | Change relationship links. | change_event_id, linked_entity_type, linked_entity_id | Links source records. | change, linked | Medium | No | No | PM. | 4 |
| change_event_backups | Backup requirements. | change_event_id, backup_type, status, owner | Links attachments. | change, status | High | Yes | Yes | PM/finance. | 4 |
| change_pricing_records | Pricing snapshots. | change_event_id, amount, status, submitted_at | Belongs to change. | change, status | High | Yes | Yes | PM/finance. | 4 |

## Billing, Safety, Quality, Closeout, Optimize

| Table | Purpose | Key Columns | Relationships | Indexes | Audit | Attachments | Status History | RLS/Security | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pay_applications | Pay application cycle. | project_id, number, period, status, requested, approved, paid | Links SOV/backups/waivers. | project, status, due | High | Yes | Yes | Finance/PM. | 5 |
| schedule_of_value_lines | Progress billing lines. | project_id, pay_application_id, description, current_billed | Belongs to pay app/project. | project, pay_app | High | Optional | Yes | Finance/PM. | 5 |
| billing_backup_items | Billing support records. | project_id, pay_application_id, type, status, owner | Links source records. | project, status | Medium | Yes | Yes | Finance/PM. | 5 |
| lien_waivers | Waiver tracking. | project_id, pay_application_id, waiver_type, status, amount | Belongs to pay app/project. | project, status | High | Yes | Yes | Finance. | 5 |
| commercial_exposure_items | Commercial risk queue. | project_id, source_type, estimated_value, status | Links changes/billing. | project, status | High | Optional | Yes | Finance/exec. | 5 |
| safety_plans | Project safety plan. | project_id, status, owner, effective_date | Belongs to project. | project, status | High | Yes | Yes | Safety. | 5 |
| jha_records | Hazard analysis. | project_id, work_package_id, status, date | Links work package. | project, package, status | High | Yes | Yes | Safety/field. | 5 |
| toolbox_talks | Toolbox talk/acknowledgement. | project_id, topic, date, status | Links work packages. | project, date | Medium | Yes | Yes | Safety/field. | 5 |
| safety_observations | Safety observation. | project_id, work_package_id, severity, status | May create corrective action. | project, status, severity | High | Yes | Yes | Safety. | 5 |
| safety_incidents | Incident/near miss. | project_id, incident_type, severity, status | Creates corrective actions. | project, status, severity | High | Yes | Yes | Safety/admin. | 5 |
| corrective_actions | Safety/quality correction. | project_id, source_type, source_id, status, due_date | Links safety/quality/punch. | project, status, due | High | Yes | Yes | Source module. | 5 |
| quality_inspections | Inspection record. | project_id, work_package_id, status, result | Links deficiencies/tests. | project, status, date | High | Yes | Yes | Quality. | 5 |
| quality_deficiencies | Quality issue. | project_id, work_package_id, severity, status | Links correction/inspection. | project, status, severity | High | Yes | Yes | Quality. | 5 |
| test_records | Required test evidence. | project_id, work_package_id, test_type, status, result | Links closeout. | project, status, type | High | Yes | Yes | Quality. | 5 |
| punch_items | Acceptance issue. | project_id, work_package_id, status, due_date | Links closeout. | project, status, due | High | Yes | Yes | PM/quality. | 5 |
| closeout_packages | D5 acceptance package. | project_id, package_number, status, readiness, acceptance_status | Owns requirements. | project, status | High | Yes | Yes | PM/quality/finance. | 6 |
| closeout_requirements | Required D5 item. | package_id, category, status, owner, source_module | Links evidence records. | package, category, status | High | Yes | Yes | PM. | 6 |
| acceptance_records | GC/client review. | package_id, reviewer, status, response_date | Belongs to package. | package, status | High | Yes | Yes | PM. | 6 |
| as_built_records | As-built/redline control. | package_id, title, status, drawing_reference | Belongs to package. | package, status | High | Yes | Yes | PM/quality. | 6 |
| warranty_records | Warranty/O&M/certification. | package_id, title, vendor, status, dates | Belongs to package. | package, status | Medium | Yes | Yes | PM/quality. | 6 |
| archive_package_items | Archive index item. | package_id, title, category, status | Belongs to package. | package, status | Medium | Yes | Yes | PM/admin. | 6 |
| project_performance_scorecards | Completed project outcomes. | project_id, scores, variance metrics | Links project. | project, score | Medium | Optional | Yes | Ops/exec. | 6 |
| lessons_learned | Actionable lesson. | project_id, category, status, owner, target_module | Links improvement actions. | project, status, category | Medium | Optional | Yes | Ops. | 6 |
| production_rate_records | Estimating production intelligence. | work_type, service_line, estimated_rate, actual_rate | Links sample projects. | work_type, service_line | Medium | No | Yes | Estimating/ops. | 6 |
| gc_performance_profiles | GC/client posture. | gc_client, overall_score, pursuit_posture | Links projects/opportunities. | gc_client, posture | Medium | No | Yes | Exec/estimating. | 6 |
| vendor_performance_profiles | Vendor posture. | vendor_name, type, overall_score, use_posture | Links projects. | vendor, posture | Medium | No | Yes | Ops. | 6 |
| improvement_actions | Operating-system update task. | source_type, source_id, owner, status, due_date | Links lessons/risks. | status, due, owner | Medium | Optional | Yes | Ops. | 6 |
| risk_library_items | Reusable risk/mitigation. | risk_category, title, severity, affected_modules | Feeds go/no-go/planning. | category, severity | Medium | No | Yes | Ops/estimating. | 6 |

## Phase 4 Workflow Transaction Write Pilot

The workflow transaction schema now supports a narrow write pilot. When
explicitly enabled, the pilot writes `workflow_instances`,
`workflow_transactions`, `audit_events`, `status_history`, and matching
`workflow_evidence_requirements` status updates.

The pilot does not write source module records. Auth, RLS, policy tests,
production audit review, file storage, and approval matrix design remain
required before production persistence.
