# Status History Review

RybexOS should use one centralized `status_history` table. A per-entity status
history table would create repeated logic and make cross-module audit/reporting
harder.

## Required Fields

- `id`
- `organization_id`
- `project_id` nullable for non-project records
- `entity_type`
- `entity_id`
- `from_status`
- `to_status`
- `changed_by`
- `changed_at`
- `reason`
- `related_audit_event_id`

## Entity Recommendations

| Entity | Strategy | Reason |
| --- | --- | --- |
| opportunities | Full status history | Pursuit/no-bid/approval decisions affect estimating and risk. |
| projects | Full status history | Phase and health changes are executive/audit relevant. |
| d5o_gates | Full status history | Gate approvals are core operating controls. |
| gate_artifacts | Full status history | Missing/complete/waived artifacts affect gate readiness. |
| mobilization_plans | Full status history | Field-start approval and blockers must be traceable. |
| work_packages | Full status history | Field readiness and execution state affect schedule and billing. |
| daily_reports | Full status history | Draft/submitted/review/approved/late states affect proof and billing. |
| supervisor_signoffs | Full status history | Signoff is an auditable field-control action. |
| rfis | Full status history | Submitted/answered/overdue/closed affects schedule and change recovery. |
| submittals | Full status history | Approval/rejection affects procurement and field readiness. |
| change_events | Full status history | Notice/pricing/approval/billing/dispute states affect money. |
| change_pricing_records | Full status history | Pricing submission/approval is commercially sensitive. |
| pay_applications | Full status history | Submission/approval/payment/rejection must be traceable. |
| lien_waivers | Full status history | Waiver status affects payment and retainage release. |
| safety_incidents | Full status history | Incidents are high-audit records. |
| safety_observations | Current plus history when corrective action required | Positive/low observations may not need heavy history. |
| corrective_actions | Full status history | Verification and closure must be traceable. |
| quality_inspections | Full status history | Pass/fail/reinspection impacts acceptance. |
| quality_deficiencies | Full status history | Correction/verification affects closeout and billing. |
| test_records | Full status history | Failed/missing/passed tests affect closeout. |
| punch_items | Full status history | Punch closure affects acceptance. |
| closeout_packages | Full status history | Submission/rejection/acceptance/archive are major events. |
| closeout_requirements | Full status history | Requirement completeness affects final billing/retainage. |
| lessons_learned | Full status history | Publication/implementation/verification matters for Optimize. |
| improvement_actions | Full status history | Assignment/implementation/verification must be visible. |
| project_performance_scorecards | Current status only plus audit on publish | Mostly snapshot records. |
| production_rate_records | Current status/version plus audit on change | Rates should version when used for estimating updates. |
| gc/vendor performance profiles | Current plus periodic snapshot | Profile scores can be recalculated. |

## Implementation Notes

- Repository mutating functions should create status history entries.
- Status changes that affect approvals, money, safety, quality, or acceptance should also write audit events.
- Derived statuses should not be written unless they are explicit snapshots.
