# RybexOS Migration Sequence

## Phase 0 - Preserve Demo Mode

- Tables added: none.
- Routes affected: none.
- Tests: current typecheck, lint, build, audit, smoke routes.
- Rollback risk: none.
- Demo fallback: seed mode remains default through `RYBEXOS_DATA_SOURCE=seed`.

## Phase 1 - Core Identity, Workspace, Project Foundation

- Tables added: organizations, users, user_profiles, workspace_memberships, projects, opportunities, attachments, audit_events, comments, activity_events, status_history.
- Routes affected: Admin, Command Center, Pipeline, Projects.
- Tests: repository unit tests, route smoke, RLS policy checks once auth exists.
- Rollback risk: low if read-only adapters are introduced first.
- Demo fallback: seed provider remains available.

## Phase 2 - D1/D2

- Tables added: opportunity_documents, go_no_go_scores, opportunity_reviews, d5o_gates, gate_artifacts, contract_baselines, scope_matrix_items, budget_baselines, schedule_baselines, flow_down_obligations, notice_requirements, project_setup_artifacts.
- Routes affected: Pipeline, Pipeline New, Projects, Projects New.
- Tests: go/no-go evaluator parity, D2 gate evaluator parity, create-flow preview tests.
- Rollback risk: medium because opportunity-to-project conversion crosses modules.
- Demo fallback: keep seed D1/D2 records.

## Phase 3 - D3/D4

- Tables added: mobilization_plans, crew_plans, equipment_readiness_items, material_readiness_items, permit_access_items, utility_locate_records, work_packages, daily_reports, daily_report_crew_members, labor_hour_entries, equipment_usage_entries, material_receipts, installed_quantities, field_safety_observations, field_quality_checks, field_delays, field_blockers, changed_conditions, field_photo_records, supervisor_signoffs.
- Routes affected: Mobilization, Field Execution.
- Tests: D3 readiness parity, D4 control parity, mobile workflow smoke, daily report creation validation.
- Rollback risk: medium/high because field records feed many downstream workflows.
- Demo fallback: keep seed D3/D4 and daily report records.

## Phase 4 - RFIs/Submittals/Changes

- Tables added: rfis, submittals, rfi_links, submittal_links, change_events, change_event_links, change_event_backups, change_pricing_records.
- Routes affected: RFIs/Submittals, Changes, Field Execution prompts.
- Tests: overdue/control evaluator parity, link integrity, notice deadline checks.
- Rollback risk: medium because change events feed billing and closeout.
- Demo fallback: seed control logs remain.

## Phase 5 - Billing/Safety/Quality

- Tables added: pay_applications, schedule_of_value_lines, billing_backup_items, lien_waivers, commercial_exposure_items, safety_plans, jha_records, toolbox_talks, safety_observations, safety_incidents, corrective_actions, quality_inspections, quality_deficiencies, test_records, punch_items.
- Routes affected: Billing, Safety, Quality, Field Execution, Projects.
- Tests: billing readiness parity, safety/quality control parity, attachment requirement tests.
- Rollback risk: high for billing if live payment records are entered.
- Demo fallback: seed billing/safety/quality records remain.

## Phase 6 - Closeout/Optimize

- Tables added: closeout_packages, closeout_requirements, acceptance_records, as_built_records, warranty_records, archive_package_items, project_performance_scorecards, lessons_learned, production_rate_records, gc_performance_profiles, vendor_performance_profiles, improvement_actions, risk_library_items.
- Routes affected: Closeout, Optimize, Command Center.
- Tests: D5 readiness parity, Optimize evaluator parity, closeout-to-lessons workflow checks.
- Rollback risk: medium for read-only; high if acceptance/final billing is live.
- Demo fallback: seed closeout/optimize records remain.

## Phase 7 - RBAC/RLS Enforcement And Audit Expansion

- Tables added: roles, permissions if custom roles are needed.
- Routes affected: all.
- Tests: RLS policy tests by role, permission helper parity, audit-event write tests.
- Rollback risk: high because bad policies can block users or expose records.
- Demo fallback: demo role context remains for non-auth demo mode.

## Phase 8 - File Storage And Attachments Hardening

- Tables added: none beyond attachments unless versioning is needed.
- Routes affected: all modules with evidence/backup.
- Tests: upload/download authorization, storage path isolation, file retention checks.
- Rollback risk: medium/high for evidence workflows.
- Demo fallback: attachment metadata can remain seeded.

## Phase 9 - Reporting Optimization

- Tables/views added: reporting views, materialized views, aggregates for Command Center and Optimize.
- Routes affected: Command Center, Reports, Admin.
- Tests: aggregate parity, performance thresholds, refresh strategy.
- Rollback risk: low if reporting views are additive.
- Demo fallback: seed aggregate derivation remains available.
