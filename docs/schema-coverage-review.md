# Schema Coverage Review

This review compares the TypeScript domain model in `lib/d5o/types.ts` with the
proposed schema in `docs/database-schema-plan.md`. Result: the major operating
model is covered. The main implementation caveats are source-link constraints,
derived score snapshots, and attachment/status/audit consistency.

| TypeScript Type | Proposed Table Or Tables | Coverage | Notes | Required Change Before Implementation |
| --- | --- | --- | --- | --- |
| D5OPhase | d5o_gates, config/reference seed | partially covered | Phase definitions are currently static config. | Decide whether phases remain code config or become read-only reference rows. |
| D5OGate | d5o_gates | covered | Project phase gate state is explicit. | Add `organization_id`, `approved_by`, `approved_at`, `readiness_snapshot`. |
| GateArtifact | gate_artifacts | covered | Required gate evidence maps cleanly. | Attachments should link through `attachments`. |
| Opportunity | opportunities, opportunity_documents, go_no_go_scores, opportunity_reviews | covered | D1 model is covered by parent plus child tables. | Preserve opportunity-to-project conversion fields. |
| RequiredOpportunityReview | opportunity_reviews | covered | Reviewer role/status maps well. | Add reviewer user FK when auth exists. |
| GoNoGoDimensionInput | go_no_go_scores | partially covered | Current schema stores score summary, not dimension breakdown. | Add JSON or child table for dimension scores/rationales. |
| OpportunityRiskFactor | project_risks or opportunity_risk_factors | partially covered | Opportunity risks are not explicitly named in schema. | Add `opportunity_risk_factors` or store in `go_no_go_scores.score_detail`. |
| RybexProject | projects plus D2 child tables | covered | Project record splits into normalized baseline tables. | Keep project summary columns for dashboard performance. |
| ContractBaseline | contract_baselines | covered | D2 contract summary maps directly. | Decide versioning for contract baseline changes. |
| ScopeMatrixItem | scope_matrix_items | covered | Direct table exists. | Add category enum/check. |
| BudgetBaseline | budget_baselines | covered | Direct table exists. | Add budget line detail later if estimating becomes real. |
| ScheduleBaseline | schedule_baselines | covered | Direct table exists. | Add milestone child table if needed. |
| FlowDownObligation | flow_down_obligations | covered | Direct table exists. | Add notice/change/pay flag columns for reporting. |
| NoticeRequirement | notice_requirements | covered | Direct table exists. | Include trigger event and notice window fields. |
| ProjectSetupArtifact | project_setup_artifacts | covered | Direct D2 artifact table exists. | Link to gate artifacts where appropriate. |
| ProjectRisk | project_risks | covered | Direct table exists. | Link repeated risk patterns to risk_library_items later. |
| ProjectIssue | project_issues | covered | Direct table exists. | Add source link if created from field/RFI/change records. |
| ProjectDecision | project_decisions | covered | Direct table exists. | Add decision outcome and decided_at. |
| MobilizationPlan | mobilization_plans plus readiness child tables | covered | D3 plan is covered. | Store current readiness plus derived source details. |
| CrewPlan | crew_plans | covered | Direct table exists. | Add crew member table later if assignments become detailed. |
| EquipmentReadinessItem | equipment_readiness_items | covered | Direct table exists. | Add equipment asset FK later if fleet module appears. |
| MaterialReadinessItem | material_readiness_items | covered | Direct table exists. | Add vendor/purchase order linkage later. |
| PermitAccessItem | permit_access_items | covered | Direct table exists. | Add authority/issuer fields. |
| UtilityLocateRecord | utility_locate_records | covered | Direct table exists. | Add expiration and ticket number indexes. |
| TrafficControlRequirement | permit_access_items or traffic_control_requirements | partially covered | Schema folds traffic control into permit/access. | Add `traffic_control_requirements` if this becomes high-volume. |
| SafetyReadinessItem | safety_plans, jha_records, safety readiness child records | partially covered | Readiness summary is spread across Safety/D3. | Keep D3 readiness snapshots or child table for plan-specific safety items. |
| QualityReadinessItem | quality_inspections, test_records, work_packages | partially covered | Quality readiness is distributed. | Keep readiness snapshot on mobilization plan. |
| WorkPackage | work_packages | covered | Critical D3/D4 bridge is covered. | Add plan_id nullable for manual packages. |
| KickoffRecord | mobilization_plans or kickoff_records | partially covered | No separate kickoff table currently planned. | Add `kickoff_records` if kickoff signoff needs audit. |
| DailyReport | daily_reports plus child tables | covered | D4 report fully decomposes. | Add uniqueness on project/report_date/work_package when needed. |
| FieldCrewMember | daily_report_crew_members | covered | Direct table exists. | None. |
| LaborHourEntry | labor_hour_entries | covered | Direct table exists. | Consider cost-code linkage. |
| EquipmentUsageEntry | equipment_usage_entries | covered | Direct table exists. | Consider equipment asset FK later. |
| MaterialReceipt | material_receipts | covered | Direct table exists. | Link material readiness item where applicable. |
| InstalledQuantity | installed_quantities | covered | Direct table exists. | Link SOV/quantity backup for billing. |
| FieldSafetyObservation | field_safety_observations | covered | Daily safety signal table exists. | Add promotion link to safety_observations. |
| FieldQualityCheck | field_quality_checks | covered | Daily quality signal table exists. | Add promotion link to quality_inspections/deficiencies. |
| FieldDelay | field_delays | covered | Direct table exists. | Link to RFIs/change events through link tables. |
| FieldBlocker | field_blockers | covered | Direct table exists. | Add source/resolution fields. |
| ChangedCondition | changed_conditions | covered | Direct prompt table exists. | Link to RFI/change event when created. |
| FieldPhotoRecord | field_photo_records, attachments | covered | Photo metadata plus attachment model. | Use attachments as file source of truth. |
| SupervisorSignoff | supervisor_signoffs | covered | Direct table exists. | Audit signoff. |
| RFI | rfis, rfi_links, attachments | covered | RFI model maps cleanly. | Enforce project-scoped RFI numbering. |
| Submittal | submittals, submittal_links, attachments | covered | Submittal model maps cleanly. | Add supplier/vendor table later if needed. |
| ChangeEvent | change_events, change_event_links, change_event_backups, change_pricing_records | covered | Commercial recovery is covered. | Add notice submission timestamp and backup completeness history. |
| ScheduleOfValueLine | schedule_of_value_lines | covered | Direct table exists. | Decide SOV versioning. |
| PayApplication | pay_applications, schedule_of_value_lines, billing_backup_items, lien_waivers | covered | Billing model is covered. | Add pay app line item rejection child table if needed. |
| BillingBackupItem | billing_backup_items, attachments | covered | Direct table exists. | Source link type must be constrained. |
| LienWaiver | lien_waivers | covered | Direct table exists. | Attachment required for submitted/accepted states. |
| CommercialExposureItem | commercial_exposure_items | covered | Direct table exists. | Link to change/billing source records. |
| SafetyPlan | safety_plans | covered | Direct table exists. | Link training requirements if expanded. |
| JhaRecord | jha_records | covered | Direct table exists. | Crew acknowledgement details may need child table. |
| ToolboxTalk | toolbox_talks | covered | Direct table exists. | Do not derive from JHA records in DB. |
| SafetyObservation | safety_observations | covered | Direct table exists. | Link to daily field observations where promoted. |
| SafetyIncident | safety_incidents | covered | Direct table exists. | Strong audit and restricted visibility required. |
| CorrectiveAction | corrective_actions | covered | Generic safety/quality corrective action table. | Validate source_type/source_id at repository layer. |
| QualityInspection | quality_inspections | covered | Direct table exists. | Checklist items may become child table later. |
| QualityDeficiency | quality_deficiencies | covered | Direct table exists. | Link corrective action and reinspection. |
| TestRecord | test_records, attachments | covered | Direct table exists. | Attachment required for closeout-required tests. |
| PunchItem | punch_items | covered | Direct table exists. | Link to closeout package/requirement when applicable. |
| CloseoutPackage | closeout_packages | covered | Direct table exists. | Readiness score should be derived or snapshot-labeled. |
| CloseoutRequirement | closeout_requirements, attachments | covered | Direct table exists. | Source module/entity links need validation. |
| AcceptanceRecord | acceptance_records | covered | Direct table exists. | Audit submissions/responses. |
| AsBuiltRecord | as_built_records, attachments | covered | Direct table exists. | Add file versioning expectations. |
| WarrantyRecord | warranty_records, attachments | covered | Direct table exists. | Vendor normalization optional later. |
| CloseoutItem | closeout_requirements or punch_items | partially covered | Older closeout item type maps to D5 requirements/punch. | Treat as legacy seed view, not primary table. |
| ProjectPerformanceScorecard | project_performance_scorecards | covered | Direct table exists. | Mark derived metrics source/snapshot date. |
| LessonLearned | lessons_learned | covered | Direct table exists. | Publication/verification status history required. |
| ProductionRateRecord | production_rate_records | covered | Direct table exists. | Convert sampleProjectIds to join table later. |
| GcPerformanceProfile | gc_performance_profiles | covered | Direct table exists. | GC master table optional. |
| VendorPerformanceProfile | vendor_performance_profiles | covered | Direct table exists. | Vendor master table optional. |
| ImprovementAction | improvement_actions | covered | Direct table exists. | Link completion evidence attachments. |
| RiskLibraryItem | risk_library_items | covered | Direct table exists. | Add versioning if used to update scoring templates. |
| OperatingActionItem | derived from source tables or activity_events | intentionally seed-only | Should not be primary persisted business object initially. | Derive from source records; later add notifications if needed. |
| AuditEvent | audit_events | covered | Direct table exists and code architecture exists. | Add persistent writer and immutable DB policy later. |

## Review Result

No blocking schema gaps were found for the main lifecycle entities. Required
pre-implementation refinements:

- Add dimension-detail storage for go/no-go scoring.
- Decide whether opportunity risk factors get a table or live inside score details.
- Add explicit kickoff strategy if D3 kickoff signoff becomes auditable.
- Treat operating actions as derived, not as source-of-truth records.
- Ensure source/link tables have repository-level validation until DB constraints mature.
