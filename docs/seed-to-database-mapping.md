# Seed To Database Mapping

Current seed exports remain the demo baseline. Initial database seeding should
preserve IDs where possible so cross-module demo links stay intact.

Phase 2 includes an optional tiny local pilot seed at
`supabase/seed/phase2_d1_d2_demo_seed.sql`. It is intentionally smaller than the
full seed dataset and only covers D1/D2 records needed to prove future read
adapters.

| Seed Export | Target Tables | Transformations | Relationship Keys | Priority | Known Gaps |
| --- | --- | --- | --- | --- | --- |
| opportunities | opportunities, opportunity_documents, go_no_go_scores, opportunity_reviews | Split document/review arrays from opportunity object. | id, sourceOpportunityId | 2 | Current score dimensions may need score history. |
| projects | projects, d5o_gates, gate_artifacts, contract_baselines, scope_matrix_items, budget_baselines, schedule_baselines, flow_down_obligations, notice_requirements, project_setup_artifacts | Extract nested baseline/gate/scope records. | project.id, gate.id | 1 | Some baseline fields are denormalized for cards. |
| workPackages | work_packages | Keep projectId and mobilization linkage. | projectId, workPackage.id | 3 | Work package execution state may need separate progress table later. |
| mobilizationPlans | mobilization_plans, crew_plans, equipment_readiness_items, material_readiness_items, permit_access_items, utility_locate_records | Split readiness child arrays. | plan.id, projectId | 3 | Traffic control can become separate table if complex. |
| dailyReports | daily_reports, daily_report_crew_members, labor_hour_entries, equipment_usage_entries, material_receipts, installed_quantities, field_safety_observations, field_quality_checks, field_delays, field_blockers, changed_conditions, field_photo_records, supervisor_signoffs | Split report child collections. | report.id, projectId, workPackageId | 3 | Photo attachments are metadata only in seed data. |
| rfis | rfis, rfi_links, attachments | Move linked IDs into link table. | rfi.id, projectId | 4 | Link type should be explicit during migration. |
| submittals | submittals, submittal_links, attachments | Move linked work/material/closeout IDs into links. | submittal.id, projectId | 4 | Supplier/vendor normalization optional later. |
| changeEvents | change_events, change_event_links, change_event_backups, change_pricing_records | Split source/link/backup/pricing data. | change.id, projectId | 4 | Current backup fields are summary-level. |
| scheduleOfValues | schedule_of_value_lines | Preserve cost code and linked quantity IDs. | projectId, payApplicationId | 5 | Need final SOV versioning decision. |
| payApplications | pay_applications, schedule_of_value_lines, billing_backup_items, lien_waivers | Preserve included/excluded change IDs as links or join table. | payApp.id, projectId | 5 | Approval/payment event history should move to status_history. |
| billingBackupItems | billing_backup_items, attachments | Preserve linked source IDs. | payApplicationId, projectId | 5 | Source type enum should be tightened. |
| lienWaivers | lien_waivers | Direct migration. | payApplicationId, projectId | 5 | Final waiver release workflow may need approvals. |
| commercialExposureItems | commercial_exposure_items | Direct migration with source links. | projectId, sourceId | 5 | Exposure source polymorphism needs constraints. |
| safetyPlans | safety_plans | Direct migration. | projectId | 5 | Training requirements could normalize later. |
| jhaRecords | jha_records, toolbox_talks | Split by record type where needed. | projectId, workPackageId | 5 | Current toolboxTalks derived from jhaRecords. |
| toolboxTalks | toolbox_talks | Deduplicate if derived. | projectId, workPackageIds | 5 | Confirm source of truth before seeding. |
| safetyObservations | safety_observations, attachments | Direct migration. | projectId, workPackageId | 5 | Corrective action linkage may need backfill. |
| safetyIncidents | safety_incidents, corrective_actions | Direct migration plus linked actions. | projectId | 5 | Incident reporting regulatory fields may expand. |
| correctiveActions | corrective_actions | Direct migration. | projectId, sourceId | 5 | Source type must map cleanly to safety/quality. |
| qualityInspections | quality_inspections, attachments | Direct migration. | projectId, workPackageId | 5 | Checklist items may normalize if they become templates. |
| qualityDeficiencies | quality_deficiencies, corrective_actions | Direct migration plus action links. | projectId, workPackageId | 5 | Reinspection history may need child table. |
| testRecords | test_records, attachments | Direct migration. | projectId, workPackageId | 5 | Attachments should point to storage objects. |
| punchItems | punch_items, attachments | Direct migration. | projectId, workPackageId | 5 | Acceptance owner fields may expand. |
| closeoutPackages | closeout_packages, acceptance_records | Direct migration. | package.id, projectId | 6 | Readiness score should be derived, not manually trusted. |
| closeoutRequirements | closeout_requirements, attachments | Direct migration with source module links. | packageId, projectId | 6 | Source record constraints needed. |
| acceptanceRecords | acceptance_records | Direct migration. | packageId, projectId | 6 | Exceptions may normalize later. |
| asBuiltRecords | as_built_records, attachments | Direct migration. | packageId, projectId | 6 | Redline source may need file versioning. |
| warrantyRecords | warranty_records, attachments | Direct migration. | packageId, projectId | 6 | Vendor normalization optional later. |
| projectPerformanceScorecards | project_performance_scorecards | Direct migration from completed projects. | projectId | 6 | Some metrics should be derived from live records. |
| lessonsLearned | lessons_learned | Direct migration. | projectId | 6 | Published/verified workflow needs status history. |
| productionRateRecords | production_rate_records | Direct migration. | sampleProjectIds | 6 | Sample projects should become join table later. |
| gcPerformanceProfiles | gc_performance_profiles | Direct migration. | gcClient | 6 | GC/client master table optional. |
| vendorPerformanceProfiles | vendor_performance_profiles | Direct migration. | vendorName | 6 | Vendor master table optional. |
| improvementActions | improvement_actions | Direct migration. | sourceId, targetModule | 6 | Completion evidence may use attachments. |
| riskLibraryItems | risk_library_items | Direct migration. | affectedModules | 6 | Versioning needed when risks update scoring templates. |
| decisions | project_decisions | Direct migration. | projectId | 1 | Decision status may need explicit enum. |
| risks | project_risks | Direct migration. | projectId | 1 | Link to lessons/risk library later. |
| issues | project_issues | Direct migration. | projectId | 1 | Issue source links optional. |
| operatingActions | activity_events or derived views | Prefer deriving from source records; do not persist as primary record. | projectId, href | 9 | May become notifications table later. |
