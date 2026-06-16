# RybexOS D5O Foundation

This foundation establishes the reusable operating spine for RybexOS powered by D5O.
It is intentionally focused on operating model, navigation safety, typed demo data,
and reusable cockpit patterns rather than full workflow persistence.

## Where Things Live

- D5O phase configuration: `lib/d5o/config.ts`
- Core operating types: `lib/d5o/types.ts`
- Typed subcontractor demo data: `lib/d5o/seed-data.ts`
- Formatting and status presentation helpers: `lib/d5o/presentation.ts`
- Primary navigation and module placeholder metadata: `lib/d5o/modules.ts`
- Reusable D5O UI patterns: `components/d5o/`
- Primary navigation component: `components/layout/PrimaryNav.tsx`
- Command Center shell: `app/command-center/page.tsx`
- Pipeline page: `app/pipeline/page.tsx`
- Guided opportunity intake route: `app/pipeline/new/page.tsx`
- Projects page: `app/projects/page.tsx`
- Guided project setup route: `app/projects/new/page.tsx`
- Mobilization page: `app/mobilization/page.tsx`
- Guided mobilization route: `app/mobilization/new/page.tsx`
- Controlled future-module placeholder route: `app/[module]/page.tsx`
- Pilot Mode guided operating slice: `app/pilot/page.tsx`
- Pipeline status and label configuration: `lib/d5o/opportunity-config.ts`
- Go/no-go scoring logic: `lib/d5o/go-no-go.ts`
- Project setup and D2 launch labels: `lib/d5o/project-config.ts`
- D2 gate readiness logic: `lib/d5o/d2-gate.ts`
- Mobilization status and work package labels: `lib/d5o/mobilization-config.ts`
- D3 gate readiness logic: `lib/d5o/d3-gate.ts`

## What The Foundation Contains

- Central D5O phase definitions for D1 Discover, D2 Define, D3 Design / Prepare,
  D4 Deliver, D5 Document / Close, and O Optimize.
- Reusable typed entities for opportunities, projects, gates, artifacts, risks,
  issues, decisions, RFIs, submittals, changes, daily reports, safety, quality,
  closeout, users, roles, and project health.
- Realistic demo records for infrastructure subcontractor work such as fiber
  backbone construction, underground conduit, data center rack integration,
  structured cabling, telecom civil support, and broadband expansion.
- A Command Center that derives leadership metrics, D5O phase lanes, gate
  exceptions, operating action items, overdue RFI/submittal controls, missing
  daily reports, closeout aging, open change exposure, and upcoming decisions
  from typed seed data.
- Controlled placeholder pages for future navigation areas so users never land
  on broken dead ends while modules are still being designed.
- A real Pipeline / Opportunity Intake module for D1 Discover pursuit discipline.
- A real Projects / Project Setup module for D2 Define contract baseline and
  launch discipline.
- A real Mobilization / D3 Design-Prepare module for field-start readiness.
- A Pilot Mode route that packages the three verified workflow completion proofs into one guided internal operating path.

## Reusable Components

- `D5OPhaseGate` renders phase purpose, gate name, artifact readiness, missing
  items, owner/approver context, status, and next action.
- `ProjectHealthCard` summarizes project health, contract value, owner, next
  milestone, risks/issues, RFIs, changes, and missing artifacts.
- `OperatingActionItem` is for operational alerts with severity, category,
  project, owner, due date, business impact, required action, and CTA.
- `D5OPhaseSummary` groups active projects by phase and shows health at a glance.
- `ModulePlaceholder` gives future modules controlled purpose, phase alignment,
  planned capabilities, and a return path to Command Center.
- `OpportunityCard` summarizes bid due date, GC/client, service lines, risk,
  recommendation, score, owner, and next action.
- `OpportunityTable` gives a dense qualification control view for all pursuits.
- `GoNoGoScoreCard` renders total score, recommendation, risk level, dimension
  scores, strengths, concerns, mitigations, and approvals.
- `OpportunityRiskPanel` groups pursuit risks with severity, rationale,
  mitigation, and owner.
- `PipelineSummaryMetric` keeps Pipeline executive metrics consistent with
  Command Center cards.
- `OpportunityIntakeForm` provides the guided local-state D1 intake workflow.
- `ProjectListTable` gives a dense view of project baseline status, D2 readiness,
  contract posture, launch decision, and next action.
- `D2GateReadinessCard` evaluates whether a project is ready to move toward D3
  mobilization planning.
- `ContractSummaryCard`, `ProjectBaselineCard`, `ScopeMatrixPanel`,
  `FlowDownObligationPanel`, and `ProjectLaunchDecisionPanel` render reusable
  D2 contract, budget, schedule, scope, flow-down, and launch-control views.
- `ProjectSetupWizard` provides the guided local-state D2 setup workflow.
- `MobilizationTable`, `MobilizationReadinessCard`, and `D3GateReadinessCard`
  show field-start readiness, blockers, owner, decision, and next action.
- `CrewEquipmentReadinessPanel`, `MaterialReadinessPanel`,
  `PermitAccessReadinessPanel`, `SafetyReadinessPanel`, and
  `QualityWorkPackagePanel` render reusable D3 readiness controls.
- `WorkPackageCard` renders field-executable work package records.
- `MobilizationPlanWizard` provides the guided local-state D3 setup workflow.
- `FieldExecutionDashboard`, `DailyReportCard`, `WorkPackageExecutionCard`,
  `DailyReportCompliancePanel`, `ProductionProgressPanel`, `FieldIssuePanel`,
  `DelayChangePromptPanel`, `FieldSafetyQualityPanel`,
  `SupervisorSignoffQueue`, and `D4ControlScoreCard` render reusable D4 field
  execution controls.
- `DailyReportWizard` provides the guided local-state D4 daily report workflow.
- `RfiSubmittalDashboard`, `RfiTable`, `RfiCard`, `SubmittalRegister`,
  `SubmittalCard`, `RfiImpactPanel`, `SubmittalReviewPanel`,
  `InformationBlockerPanel`, `RfiWizard`, and `SubmittalWizard` render reusable
  RFI/submittal controls.
- `ChangeControlDashboard`, `ChangeEventTable`, `ChangeEventCard`,
  `NoticeDeadlineQueue`, `ChangeBackupPanel`, `CommercialExposurePanel`,
  `ChangeControlScoreCard`, and `ChangeEventWizard` render reusable change
  control views and workflow previews.
- `BillingDashboard`, `PayApplicationRegister`, `PayApplicationCard`,
  `PayApplicationWizard`, `ScheduleOfValuesTable`, `BillingReadinessCard`,
  `ApprovedNotBilledQueue`, `BillingBackupPanel`,
  `RetainageLienWaiverPanel`, `PaymentAgingPanel`, `CashAtRiskCard`, and the
  billing `CommercialExposurePanel` render reusable pay application and
  commercial recovery controls.

## Pipeline Module

The Pipeline module replaces the previous placeholder at `/pipeline`. It now includes:

- Executive pursuit summary for open opportunities, bid value, due-soon bids,
  go/no-go queue, high-risk pursuits, and approved pursuits.
- Opportunity board grouped by governed pursuit statuses such as new intake,
  under review, awaiting go/no-go, approved to bid, estimating, and submitted.
- Bid calendar and deadline pressure view.
- High-risk pursuit panel with mitigation-oriented risk factors.
- Go/no-go decision queue that reinforces the rule that estimating should not
  start until D1 approval is recorded.
- Guided `/pipeline/new` intake flow covering basics, scope/documents, fit and
  resources, risk review, and go/no-go summary.

Opportunity seed data still lives in `lib/d5o/seed-data.ts`. The scoring utility
derives recommendation, risk level, strengths, concerns, required mitigations,
and required approvals from each opportunity's score dimensions and risk factors.
Command Center imports the same opportunity records and pipeline status config
to show D1 signals without duplicating pipeline logic.

## Projects / D2 Define Module

The Projects module replaces the previous placeholder at `/projects`. It now includes:

- Executive summary for active projects, D2 projects, missing contract baselines,
  projects blocked from mobilization, contract value, and commercial risk count.
- Project control table showing contract status, D2 readiness, launch decision,
  and next action.
- Projects grouped by D5O phase.
- D2 gate exceptions for projects that should not move into D3 planning.
- Recently awarded or approved Pipeline opportunities that can start setup.
- Baseline detail panels for contract summary, payment/retainage/notice/change
  terms, budget, schedule, scope matrix, and flow-down obligations.
- Guided `/projects/new` setup workflow covering source opportunity, project
  basics, contract summary, scope matrix, budget/schedule baseline, required
  artifacts, D3 handoff, and D2 gate summary.

Project seed data still lives in `lib/d5o/seed-data.ts`. The `RybexProject` type
now carries D2 baseline fields such as contract status, contract baseline, budget
baseline, schedule baseline, payment terms, notice requirements, change-order
terms, scope matrix, flow-down obligations, setup artifacts, required submittals,
required closeout documents, launch decision, and missing artifacts.

`lib/d5o/d2-gate.ts` is the reusable evaluator for D2 readiness. It produces
readiness percent, ready/blocked state, missing artifacts, blockers, warnings,
recommended launch decision, required approvals, and next actions. Command Center
uses the same evaluator to surface D2 blocked projects.

## Mobilization / D3 Design-Prepare Module

The Mobilization module replaces the previous placeholder at `/mobilization`. It now includes:

- Executive summary for D2-ready projects awaiting planning, projects ready for
  field start, D4 blockers, missing safety packages, missing access/locates, and
  work packages not ready.
- Mobilization control table showing readiness status, D3 readiness percentage,
  recommended field-start decision, owner, and next action.
- Readiness board grouped by D3 status.
- Blocked mobilization queue that prevents D4 release.
- Upcoming field-start calendar.
- Readiness artifact panels for crew/equipment, materials, permits/access/locates,
  safety, quality, and work packages.
- Guided `/mobilization/new` setup workflow covering source project, field dates,
  crew/equipment/materials, access/permits/locates, safety, quality, work packages,
  and D3 gate summary.

Mobilization plans and work packages live in `lib/d5o/seed-data.ts` alongside the
existing opportunities and projects. `lib/d5o/d3-gate.ts` evaluates D3 readiness
and returns readiness percent, ready/blocked state, missing required items,
blockers, warnings, recommended field-start decision, required approvals, and
next actions. Command Center imports the same mobilization plans to surface D3
blockers and upcoming field starts.

## Field Execution / D4 Deliver Module

The Field Execution module replaces the previous placeholder at `/field-execution`. It now includes:

- Executive summary for active field projects, work packages in progress,
  missing/late daily reports, field issues, delay events, potential change
  events, safety signals, and quality deficiencies.
- D4 control queue that evaluates whether work should continue, escalate, create
  an RFI, create a change event, create safety/quality action, hold work, or move
  toward closeout review.
- Active work package execution cards tied back to D3-created work packages.
- Daily report compliance, production progress, field issue, delay/change prompt,
  safety/quality, and supervisor signoff panels.
- Recent daily report cards showing crew, labor, equipment, installed quantities,
  work performed, safety, quality, photos/tests, blockers, changed conditions,
  production status, and supervisor signoff.
- Guided `/field-execution/daily-report/new` workflow covering project/work
  package/date, crew/labor/equipment/materials, work performed and quantities,
  safety/site conditions, quality/photos/tests, delays/issues/RFI/change prompts,
  and supervisor signoff.

Daily reports live in `lib/d5o/seed-data.ts` with the rest of the typed demo
records. The D4 type model lives in `lib/d5o/types.ts` and includes daily report
status, crew/labor/equipment/material receipt records, installed quantities,
field safety observations, field quality checks, delays, blockers, changed
conditions, field photos, supervisor signoff, production status, and D4 control
readiness.

`lib/d5o/d4-gate.ts` is the reusable evaluator for D4 control. It produces a
control score, closeout-review readiness, missing required records, blockers,
warnings, recommended decision, required actions, production health,
documentation health, safety health, and quality health. Command Center imports
the same daily reports and D4 evaluator to surface D4 field signals and D5
closeout-readiness risk. Mobilization links field-started work toward Field
Execution, and Projects shows D4 exceptions where field records exist.

## RFI / Submittal + Change Control Modules

The `/rfis-submittals` module replaces the previous placeholder with a real
project-control workflow for formal clarification and approval packages. It now
includes:

- Executive summary for open RFIs, overdue RFIs, schedule-critical RFIs, open
  submittals, due-this-week submittals, rejected/revise-and-resubmit submittals,
  and RFIs linked to change events.
- RFI register and submittal register tables.
- Information blocker, RFI impact, and submittal review panels.
- Schedule-critical RFI cards and active submittal cards.
- Guided `/rfis-submittals/rfi/new` workflow for project/source, question and
  references, impact review, and submit/save-draft preview.
- Guided `/rfis-submittals/submittal/new` workflow for package setup, required
  dates/review, attachments/requirements, and submit/save-draft preview.

The `/changes` module replaces the previous placeholder with a real change
control workflow for notice, backup, pricing, approval, dispute, and billing
readiness. It now includes:

- Executive summary for open change events, notice risks, backup gaps, pending
  pricing, submitted changes, approved value, disputed/rejected value, and
  approved-but-unbilled value.
- Change event register table.
- Commercial control score card.
- Notice deadline, backup completeness, and commercial exposure panels.
- Change event cards for active commercial recovery focus.
- Guided `/changes/new` workflow for project/source, description and impact,
  notice and backup, pricing/commercial status, and review/decision preview.

The RFI, submittal, and change event type model lives in `lib/d5o/types.ts`.
Status presentation config lives in `lib/d5o/rfi-submittal-config.ts` and
`lib/d5o/change-control-config.ts`. Reusable control evaluators live in
`lib/d5o/rfi-submittal-control.ts` and `lib/d5o/change-control.ts`. Seed data
for RFIs, submittals, and change events lives in `lib/d5o/seed-data.ts`, linked
back to daily reports, work packages, and project records where practical.

Command Center now surfaces overdue/schedule-critical RFIs, submittals blocking
work, change notice and backup risk, approved changes not billed, and
rejected/disputed exposure. Field Execution links daily report RFI/change prompts
to the new create workflows. Projects shows open RFI, submittal, change, and
commercial exposure signals.

## Billing / Pay Application Support Module

The Billing module replaces the previous placeholder at `/billing`. It now includes:

- Executive summary for contract value, approved change value, pending exposure,
  unbilled approved changes, pay applications due, submitted/aging pay apps,
  retainage held, missing backup, and cash at risk.
- Pay application register showing status, billing period, requested amount,
  approved/paid amount, backup status, lien waiver status, and next action.
- Billing readiness and cash-at-risk score cards.
- Billing readiness by project using reusable pay application cards.
- Approved-not-billed change queue.
- Missing backup documentation panel.
- Retainage and lien waiver tracker.
- Payment aging and follow-up queue.
- Commercial exposure panel.
- Schedule of Values table tied to work packages, daily reports, quantities,
  stored materials, and backup status.
- Guided `/billing/pay-application/new` workflow covering project/billing period,
  SOV work completed, approved changes, backup documentation, retainage/lien
  waivers, and review/submit readiness.

Billing types live in `lib/d5o/types.ts`, including `PayApplication`,
`ScheduleOfValueLine`, `BillingBackupItem`, `LienWaiver`, and
`CommercialExposureItem`. Billing presentation config lives in
`lib/d5o/billing-config.ts`. Billing control logic lives in
`lib/d5o/billing-control.ts`, which evaluates readiness score, cash at risk,
unbilled approved changes, pending/disputed exposure, retainage held, missing
backup, lien waiver issues, aging pay applications, and required actions.

Billing seed data lives in `lib/d5o/seed-data.ts` alongside the rest of the
typed demo data. It includes pay applications, SOV lines, backup items, lien
waivers, and commercial exposure records connected to existing projects, daily
reports, work packages, and change events.

Command Center now surfaces pay application aging, billing backup gaps, lien
waiver issues, approved changes excluded from pay apps, retainage, and cash at
risk. Change Control links approved/disputed recovery records to Billing. Field
Execution shows daily report and quantity records that support billing. Projects
shows billing readiness, pay application counts, retainage held, and commercial
exposure signals.

## Safety + Quality Control Modules

The Safety module replaces the previous placeholder at `/safety`. It now includes:

- Executive summary for active safety plans, JHAs/toolbox talks due, open safety
  observations, corrective actions, incidents/near misses, overdue safety actions,
  projects blocked by safety, and safety records affecting closeout.
- Safety control score card that evaluates readiness, open observations,
  incident follow-up, competent-person gaps, and overdue corrective actions.
- Safety readiness by project.
- JHA/toolbox talk register.
- Safety observation cards.
- Incident/near-miss register.
- Corrective action tracker.
- Guided `/safety/record/new` workflow for observations, near misses, incidents,
  and corrective actions.
- Guided `/safety/jha/new` workflow for JHAs and toolbox talks.

The Quality module replaces the previous placeholder at `/quality`. It now includes:

- Executive summary for inspections due, completed inspections, open
  deficiencies, overdue actions, required tests missing, punch items, closeout
  evidence gaps, and projects blocked by quality.
- Quality control score card that evaluates inspections, deficiencies, tests,
  punch items, missing evidence, and closeout risks.
- Inspection register using reusable inspection cards.
- Deficiency tracker.
- Test evidence tracker.
- Punch item tracker.
- Closeout evidence risk panel.
- Guided `/quality/inspection/new` workflow for inspections, acceptance
  criteria, photos, tests, and results.
- Guided `/quality/deficiency/new` workflow for deficiencies and punch items.

Safety and quality types live in `lib/d5o/types.ts`, including `SafetyPlan`,
`JhaRecord`, `ToolboxTalk`, `SafetyObservation`, `SafetyIncident`,
`CorrectiveAction`, `QualityInspection`, `QualityDeficiency`, `TestRecord`, and
`PunchItem`. Presentation config lives in `lib/d5o/safety-config.ts` and
`lib/d5o/quality-config.ts`. Reusable control logic lives in
`lib/d5o/safety-control.ts` and `lib/d5o/quality-control.ts`.

Safety and quality seed data lives in `lib/d5o/seed-data.ts` alongside the
other operating records. It includes safety plans, JHA/toolbox records, safety
observations, incidents/near misses, corrective actions, inspections,
deficiencies, test records, and punch items linked to existing Rybex projects
and work packages.

Command Center now surfaces safety blockers, missing JHAs/toolbox talks,
incident follow-ups, quality deficiencies, failed inspections, missing tests,
punch closeout risks, and quality evidence gaps. Mobilization links D3 safety
and quality readiness gaps to the dedicated modules. Field Execution links daily
report safety/quality signals to `/safety` and `/quality`. Projects shows open
safety and quality control counts. Billing shows acceptance evidence that can
affect payment readiness.

## Closeout / D5 Document-Close Module

The Closeout module replaces the previous placeholder at `/closeout`. It now includes:

- Executive summary for projects in closeout, packages ready for review,
  blocked packages, open punch items, missing tests, missing as-builts/redlines,
  final billing blockers, retainage release blockers, and acceptance pending.
- Closeout package register showing status, readiness, acceptance, final billing,
  retainage release, target date, and next action.
- D5 readiness score card that evaluates package submission, final billing,
  retainage release, and archive readiness.
- Closeout readiness by project using reusable package cards.
- Missing document/evidence tracker.
- Acceptance queue.
- As-built/redline panel.
- Test evidence closeout panel.
- Punch and deficiency closeout risk panel.
- Commercial closeout panel for unbilled approved changes and final billing
  issues.
- Retainage and lien waiver readiness panel.
- Archive package panel for warranties and archive-index requirements.
- Guided `/closeout/package/new` workflow covering closeout scope, documents and
  evidence, punch/safety/quality closure, commercial closure, acceptance review,
  and D5 gate summary.

Closeout types live in `lib/d5o/types.ts`, including `CloseoutPackage`,
`CloseoutRequirement`, `AcceptanceRecord`, `AsBuiltRecord`, `WarrantyRecord`,
closeout statuses, acceptance statuses, retainage release statuses, requirement
categories, and D5 recommended decisions. Closeout presentation config lives in
`lib/d5o/closeout-config.ts`. D5 readiness logic lives in `lib/d5o/d5-gate.ts`,
which evaluates missing required documents, unresolved punch items, missing test
records, missing as-builts, unresolved RFIs/submittals, unresolved change
events, unbilled approved changes, final billing blockers, retainage blockers,
acceptance blockers, archive blockers, and next actions.

Closeout seed data lives in `lib/d5o/seed-data.ts`. It includes closeout
packages, closeout requirements, acceptance records, as-built/redline records,
and warranty/O&M/certification records linked to existing projects, daily
reports, safety/quality records, RFIs/submittals, changes, pay applications, and
lien waivers.

Command Center now surfaces D5 package blockers, missing as-builts/redlines,
missing test records, final billing blockers, retainage blockers, acceptance
pending, and archive readiness. Projects shows D5 blocked package counts.
Billing shows closeout packages affecting final recovery and retainage. Field
Execution links D5 handoff evidence to Closeout. Safety and Quality link
closeout-impact records to Closeout. RFIs/Submittals and Changes now include D5
handoff language for records that must be closed or documented before final
acceptance.

## Optimize / Lessons Learned + Performance Intelligence Module

The Optimize module replaces the previous placeholder at `/reports`. It now includes:

- Executive summary for completed projects reviewed, margin variance, production
  variance, change recovery, safety/quality performance, closeout cycle time,
  GC score, vendor score, and open improvement actions.
- Project performance scorecards covering margin, schedule, production, change
  recovery, billing cycle time, closeout cycle time, safety, quality,
  documentation, GC performance, and vendor performance.
- Lessons learned register with category, severity, owner, due date, target
  module, recommended change, and action required.
- Production rate library showing estimated versus actual rates, variance,
  confidence, conditions, and recommended estimating rates.
- GC/client performance profiles with pursuit posture.
- Vendor/subcontractor performance profiles with recommended use posture.
- Improvement action backlog tied to owners, modules, priority, due dates, and
  expected benefit.
- Risk library update panel that identifies which go/no-go scoring,
  estimating assumptions, mobilization checklists, or work package templates
  should change.
- Guided `/reports/lessons-learned/new` workflow covering project context,
  performance review, execution review, production rate updates, GC/vendor
  performance, improvement actions, risk library updates, and closeout of the
  review.

Optimize types live in `lib/d5o/types.ts`, including
`ProjectPerformanceScorecard`, `LessonLearned`, `ProductionRateRecord`,
`GcPerformanceProfile`, `VendorPerformanceProfile`, `ImprovementAction`, and
`RiskLibraryItem`. Presentation config lives in `lib/d5o/optimize-config.ts`.
Reusable control logic lives in `lib/d5o/optimize-control.ts`, which evaluates
operating improvement score, margin variance, production variance, change
recovery, safety/quality performance, GC/vendor risks, production rate updates,
risk library recommendations, and overdue improvement actions.

Optimize seed data lives in `lib/d5o/seed-data.ts` alongside the rest of the
D5O demo data. It includes project scorecards, lessons learned, production
rates, GC/client profiles, vendor/subcontractor profiles, improvement actions,
and risk library items connected to existing Rybex projects and completed
closeout outcomes.

Command Center now surfaces open Optimize actions, production rate update
recommendations, GC/vendor performance warnings, and risk library updates.
Pipeline shows GC posture and risk-library inputs that should affect future
go/no-go decisions. Projects shows open lessons learned review counts. Field
Execution links production records to the production rate library. Billing links
pay app aging and commercial recovery outcomes to Optimize. Closeout links
accepted or closeout-ready packages into lessons learned reviews.

## Enterprise Hardening Pass

The enterprise hardening pass adds the first durability architecture around the
seed-data prototype without introducing real persistence, authentication, or new
business modules.

### Data Provider Architecture

Pages can now consume module-level provider functions from `lib/d5o/data/`.
These functions currently read typed seed arrays from `lib/d5o/seed-data.ts`,
but they create the future swap point for repository/database adapters.

Provider functions include:

- `getCommandCenterData`
- `getPipelineData`
- `getProjectsData`
- `getMobilizationData`
- `getFieldExecutionData`
- `getRfiSubmittalData`
- `getChangeControlData`
- `getBillingData`
- `getSafetyData`
- `getQualityData`
- `getCloseoutData`
- `getOptimizeData`

The seed file remains centralized for now because many demo records reference
each other across modules. Splitting it into `lib/d5o/seeds/*` is still the
recommended next organization step once the repository layer is ready to own
cross-module relationships.

### Persistence Architecture

`docs/persistence-architecture.md` defines the recommended future entities,
relationships, owner roles, audit sensitivity, attachment needs, status-history
requirements, and migration sequence. The intended migration path is to replace
seed-backed provider functions with durable repository adapters module by module.

The persistence strategy pass adds the deeper database plan without switching
runtime data sources:

- Database schema plan: `docs/database-schema-plan.md`
- Persistence technology decision: `docs/persistence-technology-decision.md`
- Migration sequence: `docs/migration-sequence.md`
- Repository contract: `docs/data-repository-contract.md`
- Seed-to-database mapping: `docs/seed-to-database-mapping.md`
- Schema risk review: `docs/schema-risk-review.md`
- Persistence implementation checklist: `docs/persistence-implementation-checklist.md`
- Schema coverage review: `docs/schema-coverage-review.md`
- Relationship model review: `docs/relationship-model-review.md`
- Status history review: `docs/status-history-review.md`
- Audit requirements review: `docs/audit-requirements-review.md`
- RBAC/RLS review: `docs/rbac-rls-review.md`
- Attachment strategy review: `docs/attachment-strategy-review.md`
- Reporting/query review: `docs/reporting-query-review.md`

`lib/d5o/data/contracts.ts` defines the future repository interfaces for
Command Center, Pipeline, Projects, Mobilization, Field Execution,
RFIs/Submittals, Change Control, Billing, Safety, Quality, Closeout, Optimize,
and Admin. `lib/d5o/data/data-source.ts` adds a future data-source mode helper
with `RYBEXOS_DATA_SOURCE`, defaulting to `seed`.

The schema/security review found no blocking coverage gaps for the main D5O
lifecycle, but it identified decisions to settle before implementation:

- Store go/no-go score dimension detail as JSON or child rows.
- Decide whether opportunity risk factors become their own table.
- Choose the canonical RFI-to-change link direction.
- Add source linkage for promoted safety/quality records from daily reports.
- Confirm attachment metadata columns for version, checksum, privacy, scan
  status, and storage provider.
- Add `organization_id`, `project_id`, `created_by`, and ownership columns from
  the first migration so future RLS is not retrofitted later.

Important: do not move RybexOS to database persistence until the schema plan,
migration sequence, repository contract, RLS/security approach, and seed mapping
have been reviewed together. The current product remains intentionally
seed-backed.

### RBAC Architecture

`lib/d5o/rbac.ts` defines:

- D5O user roles
- module and workflow permissions
- role-to-permission mappings
- `hasPermission`
- `getPermissionsForRole`
- `canAccessModule`
- `getDefaultRouteForRole`

`lib/d5o/demo-user.ts` provides a non-persistent demo role context for the app
shell. This is not authentication; it is a demo and architecture placeholder for
future session-backed role enforcement.

### Audit Architecture

`lib/d5o/audit.ts` defines an `AuditEvent` shape, demo audit events, and helper
functions for creating and reading events by entity. Audit trails should be
applied to gate approvals, daily report signoff, change notice/pricing actions,
pay application submission/approval, safety incidents, quality deficiencies, and
closeout acceptance.

### Implementation Status Map

`lib/d5o/implementation-status.ts` tracks module maturity, implemented routes,
data source status, persistence status, RBAC status, known limitations, and
recommended next hardening steps. `/admin` now renders this as a read-only
System Readiness page.

The map also exposes `platformReadiness`, which summarizes lifecycle completion,
seed-backed data providers, schema-planned persistence, RBAC/auth gap, audit gap,
demo readiness, visual polish, and the next recommended build gate.

### Reusable States

Reusable enterprise states now live in `components/d5o/`:

- `EmptyState`
- `ErrorState`
- `LoadingState`
- `PermissionState`

### Visual QA And Demo Polish

Reusable visual primitives now also live in `components/d5o/`:

- `PageHeader`
- `MetricCard`
- `StatusChip`
- `OperatingActionCard`

These components standardize page hierarchy, executive metric cards, status
chips, and operating action presentation across the major D5O modules. Existing
module pages are being migrated to these primitives in staged, low-risk passes.

These are intended for future persistence and RBAC work where records may be
empty, unavailable, loading, or role-limited.

### Demo Readiness Documents

The demo package lives in:

- `docs/demo-readiness.md`
- `docs/demo-script.md`
- `docs/demo-click-path.md`
- `docs/demo-cheat-sheet.md`
- `docs/ceo-demo-path.md`
- `docs/visual-qa-checklist.md`

The 10-minute narrative starts at Command Center and ends with the message:
“This is the difference between managing projects with spreadsheets and running
work through a controlled operating model.”

### Route Safety

`app/not-found.tsx` provides a controlled route-safety fallback. `/admin` is now
a real readiness page rather than a placeholder. `scripts/smoke-routes.mjs`
contains the implemented route list and can be run against a local server with
`npm run smoke:routes`.

## Current Limitations

- Data is static and typed; there is no database or authentication layer yet.
- Data providers exist, but most pages still need staged migration away from
  direct seed imports.
- Repository contracts and data-source mode exist, but no database adapter has
  been implemented.
- Schema/security review docs exist, but human approval is still required before
  migrations or database adapters are added.
- RBAC is modeled and shown through the demo role context, but it is not enforced
  by middleware, sessions, or authentication.
- Audit architecture exists, but audit writes are not connected to workflow
  submissions yet.
- The guided New Opportunity workflow calculates a local score preview but does
  not persist records.
- The guided New Project Setup workflow calculates a local D2 readiness preview
  but does not persist records.
- The guided New Mobilization Plan workflow calculates a local D3 readiness
  preview but does not persist records.
- The guided New Daily Report workflow calculates a local D4 control preview but
  does not persist records or create formal RFIs/change events yet.
- The guided New RFI, New Submittal, and New Change Event workflows calculate
  local previews but do not persist records yet.
- The guided New Pay Application workflow calculates a local billing readiness
  preview but does not persist records or integrate with accounting.
- The guided New Safety Record, New JHA/Toolbox, New Quality Inspection, and New
  Deficiency/Punch workflows present controlled intake previews but do not
  persist records yet.
- The guided New Closeout Package workflow calculates a local D5 readiness
  preview but does not persist records or submit acceptance packages.
- The guided Lessons Learned Review workflow calculates a local Optimize summary
  but does not persist scorecards, lessons, or improvement actions yet.
- Placeholder pages describe future workflows but do not contain live workflow
  functionality, except Pipeline, Projects, Mobilization, Field Execution,
  RFIs/Submittals, Changes, Billing, Safety, Quality, Closeout, and Optimize,
  which are now implemented as real operating modules.
- Command Center metrics are derived from seed arrays and should later be backed
  by real project, opportunity, field, commercial, safety, quality, and closeout
  records.
- Visual QA was checked through code, responsive CSS, route response checks, and
  build output. The in-app browser connector was previously unreliable in this
  workspace, so browser-based screenshot QA may need a separate pass if the tool
  connection becomes available.

### Persistence Phase 1 Scaffold

Persistence Foundation Phase 1 has been scaffolded without enabling database
runtime behavior.

Added pieces:

- Core SQL schema: `supabase/migrations/0001_core_foundation.sql`
- Environment example: `.env.example`
- Safe database client placeholder: `lib/d5o/data/database-client.ts`
- Database repository skeleton: `lib/d5o/data/database-repository.ts`
- Repository selector and seed fallback: `lib/d5o/data/repository.ts`
- Local setup guidance: `docs/database-local-setup.md`

The app still defaults to `RYBEXOS_DATA_SOURCE=seed`. Database mode is scaffolded
only; repository methods intentionally throw controlled errors until Phase 2
implements a limited adapter.

Phase 1 includes core identity/workspace, opportunity/project shell, D5O gate,
gate artifact, attachment metadata, entity attachment links, audit events,
status history, comments, activity events, project risk/issue/decision, and
go/no-go score summary/detail tables. It does not include full mobilization,
field execution, billing, safety, quality, closeout, or optimize tables.

### Persistence Phase 2 D1/D2 Scaffold

Persistence Phase 2 adds D1/D2 schema scaffolding and a read-pilot boundary while
keeping seed mode as the default runtime.

Added pieces:

- D1/D2 migration: `supabase/migrations/0002_d1_d2_pipeline_projects.sql`
- Optional pilot seed: `supabase/seed/phase2_d1_d2_demo_seed.sql`
- Database readiness diagnostics: `lib/d5o/data/database-diagnostics.ts`
- Pipeline/Projects read-pilot scaffold in `lib/d5o/data/database-repository.ts`
- Phase 2 guide: `docs/persistence-phase-2-d1-d2.md`

The database read pilot is intentionally not a real Postgres adapter yet because
the project has no database client dependency installed. It validates database
mode and env state, then returns structured diagnostics. Pages remain seed-backed
unless a future pass explicitly converts a route after parity/security checks.

### Demo And Deployment Packaging Layer

The project now includes a lightweight demo/deployment packaging layer so the
seed-backed app can be verified, demonstrated, and shared without relying on
tribal knowledge.

Added scripts:

- `npm run demo:check` verifies required demo docs, route inventory, smoke route
  coverage, seed default, and safe env placeholders.
- `npm run verify` runs typecheck, lint, build, audit, demo readiness, and route
  smoke checks using a temporary local dev server.
- `npm run demo:package` creates `package-output/rybexos-demo-package` without
  `node_modules`, `.next`, `.env`, secrets, or local build artifacts.

Added docs:

- `README.md`
- `docs/route-inventory.md`
- `docs/deployment-readiness.md`
- `docs/stakeholder-demo-package.md`
- `docs/package-export-guide.md`

The Admin readiness page now includes a Demo & Deployment Readiness section for
seed mode, route smoke coverage, docs status, package guidance, verification,
and the browser visual QA connector limitation.

### Local Visual QA Workaround

The in-app browser connector remains unreliable in this Windows sandbox. A local
visual QA workaround now exists using Playwright as a dev-only dependency.

Added pieces:

- Capture script: `scripts/capture-visual-qa.mjs`
- Commands: `npm run visual:capture` and `npm run visual:qa`
- Output folders: `visual-qa-output/desktop/`, `visual-qa-output/tablet/`,
  `visual-qa-output/mobile/`, and `visual-qa-output/manual/`
- Runbook: `docs/local-visual-qa-runbook.md`
- Report template: `docs/visual-qa-report-template.md`

The capture script uses Playwright Chromium. Install browser binaries with
`npx playwright install chromium`. The script expects the app to already be
running at `http://127.0.0.1:3000` unless `BASE_URL` is provided.

### Screenshot Review And Targeted Polish

The captured Playwright screenshots were reviewed from the perspective of a
buyer, CEO, GC partner, project executive, and senior operator. The review is
documented in `docs/visual-qa-review-report.md`.

Findings:

- The first screen of the major modules is credible and communicates D5O control.
- Command Center, Billing, Closeout, Projects, Mobilization, and Field Execution
  are the strongest stakeholder-demo pages.
- The recurring caveat is lower-page density: full-page captures can feel like a
  complete operating inventory because many panels and registers carry similar
  visual weight.
- Mobile priority routes stacked safely, but the app shell/navigation consumed
  too much first-screen space before polish.

Fixes applied:

- Shared section headings now have stronger separation and scan hierarchy.
- Mobile navigation now becomes a compact horizontal rail below 820px.
- Admin readiness now points to the latest visual review and demo approval caveat.
- Demo readiness docs and CEO path now instruct presenters to focus on summaries,
  blockers, decision queues, and one proof point per module.

Demo status: approved with caveats. The remaining caveat is presentation density
below the fold, not route health or functional readiness.

## Recommended Next Build

Create a Stakeholder Demo Pack / Executive Review Materials package. If a
stakeholder review finds remaining high-friction visuals, do a narrow targeted
visual fix pass only. If persistence becomes the priority, verify local
Supabase/Postgres setup before any Phase 3 persistence work.

### Universal Workflow Operating Layer

The app now includes a shared workflow operating layer so RybexOS reads as an
operating system instead of a collection of module pages.

Added pieces:

- Workflow model: `lib/d5o/workflow/types.ts`
- Workflow configuration: `lib/d5o/workflow/config.ts`
- Workflow derivation from seed-backed operating data:
  `lib/d5o/workflow/derive-workflows.ts`
- Workflow component set: `components/d5o/workflow/*`
- Workflow operating model doc: `docs/workflow-operating-model.md`
- Visual remediation rationale: `docs/visual-remediation-plan.md`

The shared pattern is:

Signal -> Decision -> Action -> Evidence -> Gate Movement.

Command Center now derives leadership workflow actions across the lifecycle and
shows a summary band, grouped workflow queue, and D5O phase map. Major module
pages now include a workflow context section near the top. Guided workflows now
end with a workflow outcome panel that explains the signal addressed, decision,
action, evidence, next gate/status movement, and consequence if missed.

This layer is currently deterministic and seed-backed. Do not persist derived
workflow rows prematurely. Persistence should first store the source operating
records and then derive or materialize workflow actions intentionally.

Recommended next build: regenerate and review screenshots after the workflow
layer. If the workflow story is visually clear, prepare stakeholder demo
materials. If screenshots show remaining high-friction visuals, do a targeted
visual fix pass focused only on high/critical workflow clarity issues.

### Enterprise OS Roadmap Package

RybexOS now has a complete enterprise operating-system roadmap package. This is
documentation and implementation planning only; no runtime behavior, database
mode, auth, RLS, or product module surface was added.

Added docs:

- `docs/enterprise-os-backlog.md`
- `docs/capability-maturity-map.md`
- `docs/production-roadmap.md`
- `docs/enterprise-dependency-map.md`
- `docs/recommended-next-implementation.md`
- `docs/workflow-transaction-design.md`

Current maturity:

- Full D5O lifecycle prototype is implemented.
- Shared workflow layer is implemented.
- Seed-backed runtime remains default.
- Persistence scaffolding exists, but database runtime is not enabled.
- RBAC and audit architecture exist, but auth/enforcement/persistence are not production-grade.
- The app is demo-ready and architecture-ready, not production-ready.

Recommended next implementation:

Build a narrow Workflow Transactions MVP in seed-backed/local state first. The
goal is to prove workflow movement before broad database writes:

- approve or hold go/no-go
- approve or hold D2 gate
- approve or hold D3 field start
- submit a daily report
- create RFI/change from a field signal
- resolve safety or quality actions
- submit closeout package
- publish lessons learned

Do not continue broad persistence, auth, notifications, master data, or
integrations until the transaction model is proven and reviewed.

### Workflow Transactions MVP

A narrow local Workflow Transactions MVP has been implemented. It proves that
workflow signals can move through decision, action, evidence, and gate/status
movement without enabling production persistence.

Added pieces:

- Transaction definitions: `lib/d5o/workflow/transactions.ts`
- Transaction application logic: `lib/d5o/workflow/apply-transaction.ts`
- Local transaction store: `lib/d5o/workflow/local-transaction-store.ts`
- Transaction UI: `components/d5o/workflow/WorkflowTransactionPanel.tsx`,
  `WorkflowTransactionModal.tsx`, `WorkflowTransactionButton.tsx`,
  `WorkflowTransactionHistory.tsx`, and `WorkflowOutcomeBanner.tsx`
- Admin reset control: `WorkflowTransactionReset.tsx`
- Implementation guide: `docs/workflow-transactions-mvp.md`

Supported local transactions:

- approve/hold go-no-go
- approve/hold D2 gate
- approve/hold D3 field start
- submit daily report movement
- create RFI from signal
- create change event from signal
- resolve workflow action

Important limits:

- State is local/browser demo state.
- Seed data is not modified.
- Database runtime remains disabled.
- No auth, RLS, file upload, notification, or production audit persistence was added.

Recommended next build remains cautious: review the transaction interaction with
stakeholders, then persist the same transaction model narrowly for D1/D2 only.

### Persistence Phase 3 - Workflow Transactions

Workflow transaction persistence is now scaffolded, but not enabled at runtime.
This pass stores the persistence shape for the operating behavior first:

Signal -> Decision -> Action -> Evidence -> Gate Movement.

Added pieces:

- Migration: `supabase/migrations/0003_workflow_transactions.sql`
- Repository contract additions: `lib/d5o/data/contracts.ts`
- Database repository stubs: `lib/d5o/data/database-repository.ts`
- Local-to-database mapping adapter: `lib/d5o/workflow/persistence-adapter.ts`
- Store mode helper: `lib/d5o/workflow/transaction-store.ts`
- Phase 3 doc: `docs/persistence-phase-3-workflow-transactions.md`

The Phase 3 schema includes:

- `workflow_instances`
- `workflow_signals`
- `workflow_transactions`
- `workflow_evidence_requirements`
- `workflow_source_links`

Runtime behavior remains unchanged:

- `RYBEXOS_DATA_SOURCE` defaults to `seed`.
- `RYBEXOS_WORKFLOW_TRANSACTION_STORE` defaults to `local`.
- The local transaction MVP remains active.
- No database writes, auth, RLS, file upload, or production audit persistence
  was added.

Future production transaction writes should be atomic and create a workflow
transaction row, an audit event row, and a status history row whenever status or
resolution state changes.

Recommended next build: enable a DB-backed workflow transaction pilot only after
local database verification and human review. Do not convert the full app to
database runtime.

### Supabase Read-Only Pilot Env Handling

The database pilot now uses Supabase-specific environment handling.

Supported local/private variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Compatibility aliases remain supported:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Seed mode remains the default and requires no Supabase env vars. Database mode
is still a read-only pilot only. No writes, auth, RLS, uploads, notifications,
or production database runtime were added.

The read-only database repository can attempt pilot reads from:

- `workflow_instances`
- `workflow_signals`
- `workflow_evidence_requirements`
- `opportunities`
- `go_no_go_scores`
- `projects`
- `d5o_gates`

Admin reports Supabase env presence and pilot counts without exposing any key
values.

Security notes:

- Real Supabase values belong only in `.env.local`.
- `.env.local` is ignored and must never be packaged or committed.
- Development keys should be rotated before public deployment.
- `SUPABASE_SECRET_KEY` must remain server-side only.
- Stripe is not part of RybexOS. Do not add Stripe env vars, scripts, docs, or code.

### UX Simplification System

RybexOS now includes a reusable simplification layer so pages are less text-heavy
and more action-oriented.

Core interaction standard:

Stage -> Gate -> Blockers -> Actions -> Evidence -> Next Movement.

Added pieces:

- `components/d5o/stage-gates/StageGateSummary.tsx`
- `components/d5o/workflow/DecisionQueue.tsx`
- `components/d5o/workflow/EvidenceChecklist.tsx`
- `components/d5o/workflow/NextBestAction.tsx`
- `components/d5o/ProgressiveDetails.tsx`
- `docs/ux-simplification-audit.md`
- `docs/ux-simplification-system.md`

The shared `WorkflowModuleContext` now presents stage/gate summary, next best
action, and compact decision queue across major module pages. Command Center was
simplified so leadership sees the next gate, top action, and decision queue
first, with detailed registers hidden behind progressive disclosure.

Remaining caveat: guided workflows still contain broad demo field coverage.
Future UX work should collapse optional/supporting fields step-by-step without
changing business scope.

### Role-Based Usability Validation

RybexOS now includes a role validation package so the simplified UX can be
reviewed by actual operating personas instead of only by module.

Added:

- `docs/role-based-usability-audit.md`
- `docs/role-journey-map.md`
- `docs/user-knows-what-to-do-checklist.md`
- `components/d5o/workflow/RoleContextBand.tsx`

The shared `WorkflowModuleContext` now shows a compact role context band on
major module pages. Guided workflow entry pages also show the relevant role
context. The shared `DecisionQueue` now makes owner and due date more prominent,
and `WorkflowOutcomePanel` states who the workflow is for and what it produces.

Role-based caveats:

- No real role-based routing or authenticated workspaces exist yet.
- Field and finance workflows remain dense because they carry evidence-heavy
  operating records.
- Future production UX should add role-specific home queues after auth, RBAC,
  and persisted workflow ownership are implemented.

Recommended next build: stakeholder demo pack / executive review materials, or
a targeted field/mobile guided workflow simplification if field usability is the
priority.

### Persistence Phase 4 - Workflow Transaction Write Pilot

RybexOS now has a narrow database-backed write pilot for workflow transactions
only. The default remains seed/local.

Enable the pilot locally only with both:

```text
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_TRANSACTION_STORE=database
```

Added:

- `app/actions/workflow-transactions.ts`
- `lib/d5o/data/workflow-transaction-writes.ts`
- `scripts/verify-workflow-transaction-db.mjs`
- `docs/persistence-phase-4-workflow-transaction-writes.md`

The pilot can:

- insert `workflow_transactions`
- update `workflow_instances`
- insert `audit_events`
- insert `status_history` when state changes
- mark matching `workflow_evidence_requirements` verified

It does not:

- persist source module records
- add authentication
- enable RLS
- upload files
- send notifications
- implement a production approval matrix

Admin now reports workflow transaction, audit, status-history, and last
transaction counts when database mode can read them. The UI shows local/default
transaction messaging, database pilot success, and database write errors without
pretending success.

Verification command:

```powershell
npm run db:verify-workflow-transactions
```

Next recommended build: review Phase 4 pilot rows, then add authenticated
server-side permission enforcement and RLS before broadening persistence.

### Workflow Action Completion Fix

The workflow card action path has been hardened so Command Center can complete
an action instead of only displaying workflow context.

Changed:

- `/command-center` now renders an actionable `WorkflowActionCard` for the top
  leadership workflow.
- `WorkflowTransactionPanel` explains unavailable actions instead of hiding the
  transaction path silently.
- `WorkflowTransactionModal` keeps evidence visible but allows evidence to stay
  pending in the MVP.
- `WorkflowTransactionRuntime` is mounted globally as a safe fallback so
  workflow cards can still open the modal and complete actions when the React
  click handler is not attached in the local browser/runtime.
- `/api/workflow-transactions` provides the client-to-server commit path without
  exposing server-side Supabase secrets.
- `applyWorkflowTransaction` requires transaction notes but no longer requires a
  checked evidence item.
- Missing Supabase secret errors now tell the user to switch to local
  transaction mode or configure `SUPABASE_SECRET_KEY`.
- `scripts/verify-workflow-actions.mjs` and `npm run workflow:verify-actions`
  validate the action mapping and local transaction wiring.

Debug note: `docs/workflow-action-completion-debug.md`.

### Auth + RBAC Foundation

RybexOS now resolves a current user/role before workflow transaction writes and
checks whether that role is allowed to complete the selected transaction.

Added:

- `lib/d5o/auth/auth-mode.ts`
- `lib/d5o/auth/current-user.ts`
- `lib/d5o/auth/workflow-transaction-permissions.ts`
- `lib/d5o/auth/permission-guard.ts`
- `docs/auth-rbac-foundation.md`
- `scripts/verify-rbac.mjs`

Defaults remain safe:

- `RYBEXOS_AUTH_MODE=demo`
- `RYBEXOS_DATA_SOURCE=seed`
- `RYBEXOS_WORKFLOW_TRANSACTION_STORE=local`

Workflow transaction writes now enforce role permissions before local result
acceptance or Supabase pilot writes. Allowed writes stamp actor name, role, and a
database-safe actor UUID when one is available. Demo user ids are not written as
Supabase UUIDs.

Still pending:

- production login UI
- Supabase session resolution
- active RLS policies
- route-level middleware
- external users and invitations
- MFA
- production approval matrix

Next recommended build: Supabase auth/session resolution plus RLS policy
implementation, only after this RBAC foundation is reviewed.

### Evidence / Attachment Foundation

RybexOS now has a shared evidence layer for gate, recovery, billing, safety,
quality, closeout, and audit proof.

Added:

- `lib/d5o/evidence/types.ts`
- `lib/d5o/evidence/config.ts`
- `lib/d5o/evidence/derive-evidence.ts`
- `lib/d5o/evidence/local-evidence-store.ts`
- `components/d5o/evidence/*`
- `docs/evidence-attachment-foundation.md`
- `scripts/verify-evidence-model.mjs`

The foundation derives evidence requirements from workflows, billing backup,
closeout requirements, safety/JHA records, quality inspections, deficiencies,
tests, and punch items. Demo users can mark evidence attached, verified, or
waived in browser-local state only.

Production file uploads are not enabled. Supabase Storage, file access RLS,
malware scanning, signed URLs, versioning, and persistent attachment writes
remain future work.

Verification:

```powershell
npm run evidence:verify
```

#### Supabase Storage Evidence Upload Pilot

The narrow upload pilot adds a controlled path for attaching one file to a
`workflow_evidence_requirements` row when database mode is explicitly enabled.

Added:

- `lib/d5o/evidence/evidence-store.ts`
- `app/actions/evidence-uploads.ts`
- `supabase/storage/rybexos-evidence-bucket.sql`
- `docs/supabase-storage-evidence-pilot.md`
- `scripts/verify-evidence-upload-pilot.mjs`

The pilot uploads to the private `rybexos-evidence` bucket, writes
`attachments`, links `entity_attachments`, updates the evidence requirement to
`uploaded`, and writes audit/status-history rows. Local/demo evidence actions
remain the default through `RYBEXOS_EVIDENCE_STORE=local`.

This is still not production document management. RLS, signed URL downloads,
malware scanning, retention automation, file version review, and external
sharing are not enabled.

Optional verification:

```powershell
npm run evidence:verify-upload
```

The upload verifier performs a dry run unless
`RYBEXOS_ALLOW_EVIDENCE_UPLOAD_TEST=1` is set.

### RLS + Storage Security Foundation

RybexOS now has a staged security foundation for future database and evidence
file enforcement.

Added:

- `docs/rls-storage-security-foundation.md`
- `supabase/migrations/0004_rls_security_scaffold.sql`
- `lib/d5o/security/rls-readiness.ts`
- `scripts/verify-security-foundation.mjs`
- `scripts/inspect-supabase-security.mjs`

The migration creates helper functions such as `auth_user_profile_id`,
`is_workspace_member`, `has_workspace_permission`, `can_access_project`,
`can_access_workflow_instance`, and `can_access_evidence_requirement`. It also
adds a read-only `security_scaffold_status` diagnostic RPC.

Important: broad RLS is not enabled by this pass. Storage policies are
scaffolded as comments only, the evidence bucket remains private, and production
security is still not claimed. `SUPABASE_SECRET_KEY` and service-role aliases
remain server-only.

Verification:

```powershell
npm run security:verify
npm run db:inspect-security
```

`db:inspect-security` requires local Supabase env vars and does not mutate data.

### Notification + Escalation Foundation

RybexOS now derives in-app notifications and escalation queues from workflow
signals and evidence requirements.

Added:

- `lib/d5o/notifications/types.ts`
- `lib/d5o/notifications/config.ts`
- `lib/d5o/notifications/derive-notifications.ts`
- `lib/d5o/notifications/local-notification-store.ts`
- `components/d5o/notifications/*`
- `docs/notification-escalation-foundation.md`
- `scripts/verify-notifications.mjs`

Notifications are action-first: title, required action, owner, due date,
business impact, consequence, and target route. Local demo users can
acknowledge, mark in progress, resolve, dismiss, and reset notification state.

External delivery is not implemented. Email, SMS, push, Teams, Slack,
notification persistence, retry handling, preferences, and RLS-backed
notification access remain future work.

Verification:

```powershell
npm run notifications:verify
```
## Production Readiness Gap Review

Latest update: RybexOS now has an executive-grade production readiness gap
review and controlled pilot launch package.

New readiness assets:

- `docs/production-readiness-gap-review.md`
- `docs/pilot-readiness-scorecard.md`
- `docs/controlled-pilot-launch-plan.md`
- `docs/pilot-user-test-scripts.md`
- `docs/pilot-risk-register.md`
- `lib/d5o/readiness/pilot-readiness.ts`
- `scripts/verify-pilot-readiness.mjs`

The Admin page now surfaces a compact Pilot Readiness section with current
rating, top blockers, controlled pilot recommendation, production readiness
status, and readiness document references.

Current maturity: controlled internal pilot candidate.

Production readiness status: not production-ready. The app still needs
production auth/session resolution, tested RLS, hardened storage access, broader
record persistence, operational monitoring, backups, and support procedures
before it can be used as a live system of record.

Verification:

- `npm run pilot:verify` checks that readiness docs, scorecard data, limitations,
  and Admin references exist.
- `npm run verify` includes `pilot:verify`.

Recommended next step: human review of the controlled pilot launch plan and
risk register. Do not expand persistence, auth, storage, or notification scope
until pilot boundaries are approved.
## Universal Page Simplification System

Latest update: major RybexOS module pages now use a shared page simplification
layer so users see what to do before they see dense records.

New assets:

- `components/d5o/simplified/ModuleStageHeader.tsx`
- `components/d5o/simplified/NextActionPanel.tsx`
- `components/d5o/simplified/GateReadinessPanel.tsx`
- `components/d5o/simplified/EvidenceRequiredPanel.tsx`
- `components/d5o/simplified/ActiveRisksPanel.tsx`
- `components/d5o/simplified/ProgressiveDetailsSection.tsx`
- `components/d5o/simplified/PageOperatingLayout.tsx`
- `lib/d5o/simplification/page-summary.ts`
- `lib/d5o/simplification/derive-next-actions.ts`
- `lib/d5o/simplification/derive-page-readiness.ts`
- `docs/page-simplification-system.md`
- `scripts/verify-page-simplification.mjs`

Page contract:

- Stage / module header
- Next required actions
- Gate / workflow readiness
- Evidence required
- Active risks / escalations
- Details / records below or behind progressive disclosure

The system does not remove workflow, evidence, notification, Admin, readiness,
or pilot logic. It reorders the first viewport so users can see status, owner,
next action, evidence, and blocker before drilling into detailed records.

Verification:

- `npm run simplify:verify` checks shared components, support utilities, major
  page usage, details/progressive-disclosure support, and documentation.
- `npm run verify` includes `simplify:verify`.

Page comprehension QA:

- `docs/page-comprehension-qa-review.md` scores each major page against the
  five-second enterprise usability test.
- `docs/page-remediation-backlog.md` separates fixes into Must Fix Before Pilot,
  Should Fix Before Executive Demo, and Later.
- `npm run page-comprehension:verify` confirms every major page is covered with
  a clarity score, pass/fail statement, and prioritized backlog.

Current remediation theme: the top summaries work, but dense legacy sections
still appear too quickly after the summary. Billing, Closeout, and Optimize need
overflow/detail containment before pilot.

## End-User Simplification Pass

Major pages now use `ActionWorkspaceLayout` from `components/d5o/end-user`.
The first visible layer is limited to one primary action, two secondary actions,
critical blockers, evidence needed now, and a details link. Previous operating
panels and dense records remain available through `CollapsedDetails`.

Verification:

- `npm run end-user:verify` checks the end-user components, page focus config,
  major page usage, collapsed details, and documentation updates.

## End-User Visual Acceptance + Subtraction

Screenshot review confirmed the action workspace works as the default page
experience. The remaining visual competitor was the page header action row, so
header actions are capped at two and styled as quiet utilities. The subtraction
review and backlog live in:

- `docs/end-user-visual-acceptance-review.md`
- `docs/end-user-subtraction-backlog.md`

Verification:

- `npm run end-user-visual:verify`

## Expanded Details Visual QA

Added a separate QA capture mode for full-page desktop screenshots with details
sections expanded. This is for inspecting dense record layouts only and does
not represent the default end-user view.

Commands:

- `npm run visual:capture-expanded`
- `npm run visual:verify-expanded`

Output:

- `visual-qa-output/expanded-details`

Docs:

- `docs/expanded-details-visual-qa.md`

## Single Action Cockpit Refinement

The major user-facing pages now render one `ActionCockpit` through
`ActionWorkspaceLayout`. The cockpit merges the prior status card, primary
action, secondary actions, blockers, evidence, and details link into one focused
surface. This is a UX subtraction pass only; workflow, evidence, notification,
auth, and persistence behavior are unchanged.

Verification:

- `npm run single-action:verify`

## User Workflow QA

Added automated safe-click user workflow QA for the 13 primary scenarios across
Command Center, Pipeline, Projects, Mobilization, Field Execution,
RFIs/Submittals, Changes, Billing, Safety, Quality, Closeout, Reports, and
Admin.

Implemented safe CTA remediation:

- Same-page ActionCockpit CTAs now open/focus `#details-records` instead of
  behaving like route-to-self links.
- Module workflow detail CTAs now focus the relevant workflow section instead
  of linking back to the same module page.
- The QA script treats navigation, modal/dialog opening, detail expansion,
  hash/focus movement, scroll, and visible feedback as valid outcomes.

New assets:

- `scripts/qa-user-workflows.mjs`
- `scripts/verify-user-workflow-qa.mjs`
- `docs/user-workflow-qa-report.md`
- `docs/user-workflow-remediation-backlog.md`

Verification:

- `npm run user-flow:qa`
- `npm run user-flow:verify`

## CTA Outcome Clarity QA

Added outcome clarity QA to check whether important CTAs are understandable
after click, not merely non-dead. The check records route changes, detail
expansion, scroll/focus, highlighted targets, modal/dialog opening, and visible
feedback.

Safe UI remediation:

- Same-page detail CTAs now add a visible focus highlight.
- Header hash CTAs expand collapsed details before focusing their target.
- Workflow-section anchors are highlighted when focused.

New assets:

- `scripts/qa-cta-outcomes.mjs`
- `scripts/verify-cta-outcomes.mjs`
- `docs/cta-outcome-clarity-qa-report.md`
- `docs/cta-outcome-remediation-backlog.md`

Verification:

- `npm run cta-outcome:qa`
- `npm run cta-outcome:verify`

## Task Outcome Contract

Manual founder review found that a working CTA can still be weak if it routes
to a generic module page or highlights only a generic detail bar. The primary
ActionCockpit CTA now uses a task outcome contract:

- concrete task labels replace vague labels such as `Open priority` and
  `Open action details`
- focused routes include `focus=...#focused-task`
- `FocusedTaskPanel` shows `You are here to`, owner, due date, blocker,
  evidence, and the next step
- same-page cockpit CTAs focus the exact task panel before details

New assets:

- `lib/d5o/end-user/task-outcome-contract.ts`
- `components/d5o/end-user/FocusedTaskPanel.tsx`
- `scripts/verify-task-outcome-contracts.mjs`

Verification:

- `npm run task-outcome:verify`

## Workflow Completion Engine Proof

The first complete local/demo workflow now connects Command Center to Billing.
`Add missing billing backup` opens the exact Billing focused task, shows the
linked backup evidence, lets the user mark backup attached or waive evidence,
sends the item to review, resolves the billing blocker, and records local demo
history.

New assets:

- `lib/d5o/workflow-completion/*`
- `components/d5o/workflow-completion/*`
- `docs/workflow-completion-engine.md`
- `docs/billing-backup-workflow-trace.md`
- `scripts/qa-workflow-completion.mjs`
- `scripts/verify-workflow-completion.mjs`

Verification:

- `npm run workflow-completion:qa`
- `npm run workflow-completion:verify`

Boundary:

- Local/demo state only.
- No broad persistence, RLS, production upload, external notification, or
  production cash recovery claim was added.

Hydration fix:

- Browser QA showed the proof panel rendered but did not reliably update
  completion state from React handlers in Playwright.
- `WorkflowCompletionPanel` now includes scoped `data-qa` selectors and a
  narrow panel runtime for the Billing Backup proof path.
- The runtime updates only local demo state and visible status/history for the
  proof panel.
- `workflow-completion:diagnose` filters known local dev-server HMR websocket
  noise and fails real app/browser errors.
## Workflow Completion Expansion

- Added the second Workflow Completion Engine proof flow: Field Issue -> RFI / Change Escalation.
- The proof reuses `FocusedTaskPanel`, `WorkflowCompletionPanel`, `completion-service`, and `local-completion-store`.
- Field Execution now routes `Escalate field issue` to `/field-execution?focus=field-issue-escalation#focused-task`.
- Local/demo actions can create a demo RFI draft, mark the issue controlled, and resolve the issue with visible history.
- This proof is not database-backed yet and does not create production RFI/change records.

## Workflow Completion Standardization

- Added a shared workflow completion registry and definition model.
- Billing Backup and Field Issue completion proofs are registered workflows, not one-off component branches.

## Closeout Completion Proof

- Added the third Workflow Completion Engine proof flow: Closeout Requirement -> Acceptance / Final Billing Release.
- The proof reuses the shared completion registry, FocusedTaskPanel, WorkflowCompletionPanel, local completion store, result banner, linked outputs, and QA contract pattern.
- The local/demo path marks closeout evidence attached, sends the item to review, resolves the blocker, and shows closeout/final billing linked outputs.
- This proof is not database-backed yet and does not claim production document management, storage security, RLS, or production closeout readiness.

## Workflow Completion Persistence Bridge

- Added an opt-in workflow completion store mode: `RYBEXOS_WORKFLOW_COMPLETION_STORE=local|database`.
- Local remains the default and all browser-local proof flows continue to run without Supabase.
- Database completion mode uses a server action and database adapter to write completion events to `workflow_transactions`, update `workflow_instances`, update evidence where possible, and write `audit_events` plus `status_history`.
- The database bridge is a Supabase pilot only. It does not enable RLS, production auth, production linked records, external notifications, or production file security.
- `WorkflowCompletionPanel` now renders from definitions, QA selectors, action labels, transitions, and linked output definitions.
- Added `workflow-completion:qa-all` and `completion-registry:verify`.

## Pilot Mode Billing Usability Fix

- Manual review found that `/pilot` could route to the Billing focused task while still leaving the user without an obvious executable path.
- Added `GuidedCompletionFlow` above Billing completion details so the first pilot task shows three visible steps: mark backup attached, send to review, and resolve billing blocker.
- The guided flow uses the existing completion registry/service/store and the local runtime fallback; it does not create a second completion system.
- Pilot Mode progress now has a local-demo runtime fallback that reads the same completion storage and updates visible workflow cards after returning from Billing.
- Added `pilot-billing-task:verify` and strengthened `pilot-mode:qa` so this manual failure regresses if the guided controls or Pilot progress disappear.

## Pilot Mode Field / Closeout Human Execution

- Extended `GuidedCompletionFlow` for Field Issue and Closeout so both workflows are executable by visible human controls from `/pilot`.
- Field Issue now saves an `Escalation note`, then lets the user create an RFI/change path, mark the issue controlled, and resolve it.
- Closeout now saves a `Closeout evidence note`, then lets the user attach evidence, send to review, and resolve the blocker.
- Saved notes are written to local demo completion state/history and cleared by Pilot Mode reset.
- Added `pilot-field-closeout:qa` and `pilot-field-closeout:verify`.
## Workflow Editable Field Contract

Added `lib/d5o/workflow-completion/editable-field-contracts.ts` and `workflow-execution:qa` / `workflow-execution:verify`. The guided completion UI now renders required human inputs for Billing, Field Issue, and Closeout, saves values to local/demo completion state, writes history, and gates downstream actions until required saved fields exist.

## Runtime Stability Fix

Manual browser review exposed hydration mismatch warnings, React-rendered script warnings, duplicate key warnings, and unstable completion/Pilot progress ownership. The completion bridge has been retired. Server renders definitions/static shell, the client provider owns live completion state, local/demo persistence is adapter-driven, and Pilot progress derives from provider state. Known duplicate change/closeout list keys use stable composite keys. Run `npm run workflow-state:qa`, `npm run runtime:qa`, and their verifiers before continuing workflow expansion.

Manual runtime failure: Pilot progress hydration mismatch. `/pilot` must render `0 of 3 workflows complete` deterministically on the server and first client render, then load browser-local completion progress after hydration. Run `npm run pilot-progress:qa` and `npm run pilot-progress:verify` with the runtime checks before demo review.
## Pilot Slice Lockdown

The three-workflow Pilot Mode slice is locked for regression protection: Billing Backup Blocker -> Cash Recovery, Field Issue -> RFI / Change Escalation, and Closeout Requirement -> Acceptance / Final Billing Release. `npm run pilot:acceptance` is the gate before demo or pilot review, and `npm run pilot:acceptance-visual` is the visual companion.

Local/demo remains the default. The database completion bridge is opt-in. The local dev runtime caveat remains documented because this environment showed unreliable client handler binding during headless inspection; the acceptance runner uses the production build server. Status remains: Controlled internal pilot candidate — not production ready.

## Workflow Business Outcome Layer

Terminal Pilot workflow actions now generate a business outcome record through the shared completion state. `WorkflowOutcomeRecordPanel` and `WorkflowHistoricalRecordPanel` show the process completed, object moved, saved inputs, evidence/document references, linked outputs, remaining blockers, next business step, and historical record label. `npm run workflow-outcomes:qa` is included in the Pilot acceptance gate.

## Billing v2 Blueprint

`docs/billing-v2-gold-standard-workflow-blueprint.md` defines the Billing v2 blueprint for Billing Backup Blocker -> Pay Application Review Readiness. It is a documentation and product-design artifact only: no Billing v2 implementation has occurred yet, and no UI, workflow logic, route, persistence, auth, RLS, Pilot Mode, or QA behavior was changed by the blueprint.

Verification: `npm run billing-v2:verify-blueprint`.

## D5O True Workflow Management Development Package

`docs/d5o-true-workflow-management-development-package.md` now defines the master D5O true workflow management standard. It resets workflow development around business process, business object, required inputs, evidence/documents, review/handoff, outcome record, historical record, and next business step.

`docs/billing-v2-enterprise-workflow-implementation-spec.md` now defines the Billing v2 Enterprise Workflow Implementation Specification for the future Billing Backup Package -> Commercial Review -> Billing Blocker Cleared workflow.

This is specification only. No implementation occurred in this package: no UI changes, runtime behavior changes, routes, persistence, auth, RLS, Pilot Mode changes, Field/Closeout refactors, or production readiness claims are created by these documents. The next step is manual review of the implementation spec before code is written.

Verification: `npm run d5o-workflow-package:verify`.

## Billing v2 Implementation Readiness Review

Billing v2 implementation readiness review completed. The review package includes:

- `docs/billing-v2-implementation-readiness-review.md`
- `docs/billing-v2-implementation-build-plan.md`
- `docs/billing-v2-data-model-mapping.md`
- `docs/billing-v2-qa-acceptance-plan.md`

The recommendation is Ready with conditions. No implementation occurred: no UI/runtime/persistence/auth/RLS/Pilot Mode behavior changed, no new workflow was added, and Billing v2 is not claimed as implemented. The next step is to resolve the listed conditions and approve the build plan before code is written.

Verification: `npm run billing-v2:verify-readiness`.

## Billing v2 Engineering Readiness Guardrails

Billing v2 engineering readiness guardrails created. The package includes:

- `docs/adr/0001-billing-v2-local-demo-reference-first.md`
- `docs/adr/0002-billing-v2-domain-state-machine.md`
- `docs/adr/0003-billing-v2-commercial-review-simulation.md`
- `docs/adr/0004-billing-v2-evidence-reference-model.md`
- `docs/adr/0005-billing-v2-pilot-integration-boundary.md`
- `docs/billing-v2-state-transition-matrix.md`
- `docs/billing-v2-domain-command-contract.md`
- `docs/billing-v2-ui-wireframe-spec.md`
- `docs/billing-v2-domain-test-plan.md`
- `docs/billing-v2-phase-1a-domain-implementation-prompt.md`

The next implementation pass must be Billing v2 Phase 1A domain-only: state machine, command contract, guards, events, local/demo state, and domain tests before UI work. No implementation occurred in this guardrail pass. No UI/runtime/persistence/auth/RLS/Pilot Mode behavior changed, no Field/Closeout refactor occurred, and Billing v2 remains future work until Phase 1A is explicitly run.

Verification: `npm run billing-v2:verify-engineering-readiness`.
