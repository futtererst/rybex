# RybexOS Persistence Architecture

This document defines the recommended path from typed seed data to durable records.
The current app should keep using `lib/d5o/data/*` provider functions until a database
adapter replaces the seed-backed implementation.

## Migration Sequence

1. Add workspace, user, role, audit, attachment, and comment/activity tables.
2. Persist Projects and Opportunities, then connect D1 and D2 gate records.
3. Persist D3/D4 operational records: mobilization plans, work packages, daily reports, RFIs, submittals, and changes.
4. Persist commercial recovery records: pay applications, SOV lines, backup, lien waivers, and exposure items.
5. Persist safety, quality, closeout, and optimize records.
6. Replace seed-backed data providers with repository adapters module by module.
7. Add status history and audit-event writes for approvals, submissions, rejections, and closeout acceptance.

## Core Tenancy And Users

| Entity | Purpose | Relationships | Owner Role | Audit | Attachments | Status History |
| --- | --- | --- | --- | --- | --- | --- |
| Workspace / Organization | Tenant boundary for Rybex operating data. | Owns users, projects, configuration, and records. | admin | High | No | No |
| User | Person acting in RybexOS. | Belongs to workspace, creates records, owns actions. | admin | High | No | Yes |
| UserRole | Permission grouping for module access and approvals. | Assigned to users. | admin | High | No | Yes |
| AuditEvent | Immutable trail of sensitive operating actions. | Links to any entity and optionally a project. | admin | High | No | No |
| Attachment | Evidence files, photos, documents, and backup. | Links to project records across modules. | record owner | Medium | File itself | Yes |
| Comment / ActivityEvent | Discussion and activity history. | Links to project records and users. | record owner | Medium | Optional | Yes |

## Operating Entities

| Entity | Purpose | Primary Relationships | Owner Role | Audit | Attachments | Status History |
| --- | --- | --- | --- | --- | --- | --- |
| Opportunity | D1 pursuit qualification and go/no-go control. | Converts to Project. | estimator | Medium | Yes | Yes |
| Project | Durable project system of record. | Owns all downstream records. | project_manager | High | Yes | Yes |
| D5OGate | Phase approval/control record. | Belongs to project and phase. | operations_leader | High | Yes | Yes |
| GateArtifact | Required evidence for a D5O gate. | Belongs to gate/project. | project_manager | Medium | Yes | Yes |
| MobilizationPlan | D3 field-start readiness. | Belongs to project, owns work packages. | superintendent | High | Yes | Yes |
| WorkPackage | Field-executable scope packet. | Belongs to project and mobilization plan. | superintendent | High | Yes | Yes |
| DailyReport | D4 daily proof of work, labor, quantities, safety, quality, and issues. | Belongs to project/work package. | field_supervisor | High | Yes | Yes |
| RFI | Formal clarification record. | Links project, work packages, daily reports, changes. | project_manager | High | Yes | Yes |
| Submittal | Approval package and review status. | Links project, work packages, materials, closeout requirements. | project_manager | High | Yes | Yes |
| ChangeEvent | Notice, backup, pricing, approval, billing, and dispute control. | Links project, RFIs, daily reports, billing. | project_manager | High | Yes | Yes |
| PayApplication | Pay app cycle and payment status. | Links project, SOV, changes, backup, lien waivers. | finance_admin | High | Yes | Yes |
| ScheduleOfValueLine | Billable line item and progress amount. | Belongs to project/pay app. | finance_admin | High | Yes | Yes |
| BillingBackupItem | Required support for billing entitlement. | Links pay app, daily reports, quantities, photos, changes. | finance_admin | Medium | Yes | Yes |
| LienWaiver | Required waiver for payment or retainage release. | Links pay app/project. | finance_admin | High | Yes | Yes |
| SafetyPlan | Project safety plan and mobilization prerequisite. | Belongs to project. | safety_manager | High | Yes | Yes |
| JhaRecord | Work-specific hazard analysis. | Links project/work package. | safety_manager | High | Yes | Yes |
| ToolboxTalk | Crew safety topic and acknowledgement. | Links project/work package. | field_supervisor | Medium | Yes | Yes |
| SafetyObservation | Field safety observation. | Links project/work package/corrective action. | safety_manager | High | Yes | Yes |
| SafetyIncident | Incident or near miss record. | Links project/corrective actions. | safety_manager | High | Yes | Yes |
| CorrectiveAction | Required correction and verification. | Links safety or quality source. | assigned owner | High | Yes | Yes |
| QualityInspection | Inspection checklist, result, and evidence. | Links project/work package/deficiencies. | quality_manager | High | Yes | Yes |
| QualityDeficiency | Quality issue requiring correction or verification. | Links inspection/work package/corrective action. | quality_manager | High | Yes | Yes |
| TestRecord | Test evidence required for acceptance/closeout. | Links work package, inspection, closeout requirement. | quality_manager | High | Yes | Yes |
| PunchItem | Acceptance or closeout issue. | Links work package/closeout. | project_manager | High | Yes | Yes |
| CloseoutPackage | D5 acceptance and archive package. | Links project, requirements, acceptance, billing, retainage. | project_manager | High | Yes | Yes |
| CloseoutRequirement | Required closeout artifact/evidence. | Links source module records and closeout package. | project_manager | High | Yes | Yes |
| AcceptanceRecord | GC/client review and response. | Links closeout package. | project_manager | High | Yes | Yes |
| ProjectPerformanceScorecard | O Optimize outcome summary. | Links completed project. | operations_leader | Medium | No | Yes |
| LessonLearned | Actionable lesson tied to module/process change. | Links project and improvement actions. | operations_leader | Medium | Optional | Yes |
| ProductionRateRecord | Estimated vs actual production intelligence. | Links sample projects. | estimator | Medium | No | Yes |
| GcPerformanceProfile | GC/client behavior and pursuit posture. | Links opportunities/projects. | executive | Medium | No | Yes |
| VendorPerformanceProfile | Vendor/subcontractor behavior and use posture. | Links projects/materials/submittals. | operations_leader | Medium | No | Yes |
| ImprovementAction | Assigned operating-system update. | Links lessons, risks, templates, modules. | operations_leader | Medium | Optional | Yes |
| RiskLibraryItem | Reusable risk condition and mitigation. | Links go/no-go, estimating, mobilization, work packages. | operations_leader | Medium | No | Yes |

## Repository Boundary

Pages should consume `lib/d5o/data/*` functions rather than importing seed arrays
directly. Future repository adapters can keep the same function names while reading
from a database, API, or cached aggregate layer.
