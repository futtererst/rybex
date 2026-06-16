# Data Repository Contract

The UI should depend on repository functions, not table queries. Current provider
functions are seed-backed; future database adapters must honor this contract.

## Cross-Cutting Rules

- Every mutating function receives actor metadata and required role permission.
- Repository metadata should include organization/workspace scope, actor ID/name,
  actor role, related project ID, required permission, and whether audit is
  required.
- Sensitive mutations write `audit_events` and `status_history`.
- Read functions must scope data by organization/workspace once auth exists.
- Create flows can continue to return preview objects until persistence is enabled.

| Area | Function | Inputs | Output | Mode | Permission | Audit | Future Tables |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Command Center | getCommandCenterData | workspace/project filters | aggregate command data | Read | view_command_center | No | most module tables, reporting views |
| Pipeline | getPipelineData | filters | opportunities, statuses, scores | Read | view_pipeline | No | opportunities, go_no_go_scores |
| Pipeline | getOpportunityById | id | Opportunity | Read | view_pipeline | No | opportunities |
| Pipeline | createOpportunity | opportunity input | Opportunity | Mutate | edit_pipeline | Yes | opportunities, opportunity_documents, audit_events |
| Pipeline | updateOpportunity | id, input | Opportunity | Mutate | edit_pipeline | Yes | opportunities, status_history |
| Pipeline | evaluateGoNoGo | Opportunity/input | score result | Read/compute | view_pipeline | No | go_no_go_scores |
| Projects | getProjectsData | filters | projects and baseline data | Read | view_projects | No | projects, contract_baselines |
| Projects | getProjectById | id | RybexProject | Read | view_projects | No | projects |
| Projects | createProjectSetup | setup input | RybexProject | Mutate | edit_project_setup | Yes | projects, contract_baselines, d5o_gates |
| Projects | evaluateD2Gate | projectId | D2 readiness | Read/compute | view_projects | No | contract_baselines, gate_artifacts |
| Mobilization | getMobilizationData | filters | plans/work packages | Read | view_mobilization | No | mobilization_plans, work_packages |
| Mobilization | getMobilizationPlanById | id | MobilizationPlan | Read | view_mobilization | No | mobilization_plans |
| Mobilization | createMobilizationPlan | input | MobilizationPlan | Mutate | edit_mobilization | Yes | mobilization_plans, readiness items |
| Mobilization | evaluateD3Gate | planId | D3 readiness | Read/compute | view_mobilization | No | D3 tables |
| Field Execution | getFieldExecutionData | filters | daily reports/work packages | Read | view_field_execution | No | daily_reports, work_packages |
| Field Execution | getDailyReportById | id | DailyReport | Read | view_field_execution | No | daily_reports |
| Field Execution | createDailyReport | input | DailyReport | Mutate | submit_daily_report | Yes | daily_reports and child tables |
| Field Execution | evaluateD4Control | projectId | D4 control | Read/compute | view_field_execution | No | daily_reports, work_packages |
| RFIs/Submittals | getRfiSubmittalData | filters | RFI/submittal registers | Read | view_rfis_submittals | No | rfis, submittals |
| RFIs/Submittals | createRfi | input | RFI | Mutate | edit_rfis_submittals | Yes | rfis, rfi_links |
| RFIs/Submittals | createSubmittal | input | Submittal | Mutate | edit_rfis_submittals | Yes | submittals, submittal_links |
| RFIs/Submittals | linkRfiToChangeEvent | rfiId, changeEventId | void | Mutate | edit_rfis_submittals | Yes | rfi_links, change_event_links |
| Changes | getChangeControlData | filters | change register | Read | view_changes | No | change_events |
| Changes | createChangeEvent | input | ChangeEvent | Mutate | edit_changes | Yes | change_events, backups, pricing |
| Changes | updateChangeEventStatus | id, status | ChangeEvent | Mutate | edit_changes | Yes | change_events, status_history |
| Changes | evaluateCommercialControl | projectId | control summary | Read/compute | view_changes | No | change_events, billing |
| Billing | getBillingData | filters | pay apps/exposure | Read | view_billing | No | pay_applications, SOV, waivers |
| Billing | createPayApplication | input | PayApplication | Mutate | edit_billing | Yes | pay_applications, SOV |
| Billing | evaluateBillingReadiness | projectId | readiness summary | Read/compute | view_billing | No | billing tables, change_events |
| Safety | getSafetyData | filters | safety records | Read | view_safety | No | safety tables |
| Safety | createSafetyRecord | input | SafetyObservation/Incident | Mutate | edit_safety | Yes | safety_observations, incidents, corrective_actions |
| Safety | createJhaRecord | input | JhaRecord | Mutate | edit_safety | Yes | jha_records |
| Safety | evaluateSafetyControl | projectId | safety summary | Read/compute | view_safety | No | safety tables |
| Quality | getQualityData | filters | quality records | Read | view_quality | No | quality tables |
| Quality | createInspection | input | QualityInspection | Mutate | edit_quality | Yes | quality_inspections |
| Quality | createDeficiency | input | QualityDeficiency | Mutate | edit_quality | Yes | quality_deficiencies, corrective_actions |
| Quality | evaluateQualityControl | projectId | quality summary | Read/compute | view_quality | No | quality tables |
| Closeout | getCloseoutData | filters | closeout packages | Read | view_closeout | No | closeout tables |
| Closeout | createCloseoutPackage | input | CloseoutPackage | Mutate | edit_closeout | Yes | closeout_packages, requirements |
| Closeout | evaluateD5Gate | projectId | D5 readiness | Read/compute | view_closeout | No | closeout, billing, quality, safety |
| Optimize | getOptimizeData | filters | scorecards/lessons/rates | Read | view_optimize | No | optimize tables |
| Optimize | createLessonsLearnedReview | input | scorecard/review | Mutate | edit_lessons_learned | Yes | scorecards, lessons, actions |
| Optimize | updateProductionRate | input | ProductionRateRecord | Mutate | edit_lessons_learned | Yes | production_rate_records |
| Optimize | evaluateOptimizeControl | filters | operating improvement summary | Read/compute | view_optimize | No | optimize tables |
| Admin | getImplementationStatus | none | module status | Read | manage_admin | No | implementation config |
| Admin | getSystemReadiness | none | readiness summary | Read | manage_admin | No | audit, status, route metadata |
| Workflow Transactions | getWorkflowInstances | filters/scope | workflow instance records | Read | view_command_center | No | workflow_instances |
| Workflow Transactions | getWorkflowInstanceById | id | workflow instance | Read | view_command_center | No | workflow_instances |
| Workflow Transactions | getWorkflowTransactions | workflowInstanceId | transaction history | Read | view_command_center | No | workflow_transactions |
| Workflow Transactions | createWorkflowTransaction | transaction input + actor meta | workflow transaction | Mutate | workflow-specific permission | Yes | workflow_transactions, audit_events, status_history |
| Workflow Transactions | updateWorkflowResolutionState | workflowInstanceId + state input | workflow instance | Mutate | workflow-specific permission | Yes | workflow_instances, status_history |
| Workflow Transactions | getWorkflowEvidenceRequirements | workflowInstanceId | evidence requirements | Read | view_command_center | No | workflow_evidence_requirements |
| Workflow Transactions | createWorkflowEvidenceRequirement | evidence input + actor meta | evidence requirement | Mutate | workflow-specific permission | Yes | workflow_evidence_requirements |
| Workflow Transactions | linkWorkflowSource | source link input + actor meta | source link | Mutate | workflow-specific permission | Yes | workflow_source_links |

TypeScript interfaces live in `lib/d5o/data/contracts.ts`.

## Phase 2 Read Pilot Boundary

Persistence Phase 2 scaffolds database-mode read methods for:

- `pipeline.getPipelineData()`
- `projects.getProjectsData()`

Because the app intentionally has no SQL/Supabase client dependency yet, these
database methods return structured read-pilot diagnostics when database mode is
explicitly enabled and Supabase URL/read-key values are configured. They are not
used by the seed-backed default runtime.

The seed repository remains the default provider. Future work should replace the
structured database read-pilot responses with real read adapters before any
route is converted.

## Phase 3/4 Workflow Transaction Boundary

Persistence Phase 3 adds repository contracts for workflow transaction
persistence:

- `workflowTransactions.getWorkflowInstances()`
- `workflowTransactions.getWorkflowInstanceById(id)`
- `workflowTransactions.getWorkflowTransactions(workflowInstanceId)`
- `workflowTransactions.createWorkflowTransaction(input)`
- `workflowTransactions.updateWorkflowResolutionState(workflowInstanceId, input)`
- `workflowTransactions.getWorkflowEvidenceRequirements(workflowInstanceId)`
- `workflowTransactions.createWorkflowEvidenceRequirement(input)`
- `workflowTransactions.linkWorkflowSource(input)`

The database repository now includes the narrow Phase 4 write pilot for
`workflowTransactions.createWorkflowTransaction(input)`. The seed repository
still returns empty read collections and rejects writes because local workflow
transaction state remains the default demo runtime.

Phase 4 write behavior:

- insert `workflow_transactions`
- update `workflow_instances`
- create `audit_events`
- create `status_history` when status or resolution state changes
- mark matching `workflow_evidence_requirements` verified

It must not write source module records. Broad module persistence, auth, RLS,
uploads, notifications, and production approval routing remain out of scope.
