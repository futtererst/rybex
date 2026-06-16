# Enterprise Dependency Map

This dependency map shows what must come before what as RybexOS moves toward production.

## Primary Dependency Chain

```text
Workflow operating layer
  -> Workflow transaction design
  -> Narrow transaction MVP
  -> Persistence of selected transactions
  -> Auth and RBAC enforcement
  -> Attachments and evidence storage
  -> Notifications and escalation
  -> Role-based workspaces
  -> Enterprise reports and integrations
```

## Core Dependencies

| Dependency | Must Come Before | Why |
| --- | --- | --- |
| Persistence foundation | Real workflow transactions | Status movement and audit events must be durable before production use. |
| Workflow transaction design | Database writes | Writes need a clear source, input, evidence, permission, audit, and resulting movement. |
| Auth | RBAC enforcement | Permissions require a real user/session identity. |
| RBAC enforcement | Finance, safety, quality, and admin production use | Sensitive module access cannot rely on UI-only restrictions. |
| RLS policies | Production database use | Project and workspace scope must be enforced below the app layer. |
| Audit persistence | Production-grade approvals | Gate, change, billing, safety, quality, and closeout decisions need traceability. |
| Status history | Gate movement and approval history | Current status alone is not enough for disputes or governance. |
| Attachments/private storage | Production closeout, safety, quality, billing backup | Evidence must be secure, linked, and durable. |
| Master data | Procurement, resource controls, clean reporting | Crews, vendors, companies, cost codes, and contacts need canonical records. |
| Workflow transactions | Notifications and escalation | Notifications should be generated from real workflow states, not display-only derivations. |
| File storage | Field evidence and PDF packages | Daily photos, tests, backup, waivers, and closeout packages need files. |
| Financial actuals | Margin forecasting | Forecasting is not credible without actual and committed cost. |
| Role ownership | Role-based workspaces | Workspaces should show owned/assigned work, not generic module inventories. |

## Module Dependency Map

| Capability | Upstream Dependencies | Downstream Enables |
| --- | --- | --- |
| D1 Pipeline writes | Opportunity tables, go/no-go score tables, audit events | Real pursuit approvals, estimating queue, pipeline reports. |
| D2 Project setup writes | Project tables, contract baseline tables, status history | D2 gate approvals, D3 planning, contract-risk reports. |
| D3 Mobilization writes | Projects, work packages, safety plans, quality requirements | D3 field-start approvals, resource planning, field execution readiness. |
| D4 Daily reports | Work packages, users, attachments, audit | Quantities, safety/quality evidence, RFI/change prompts, billing backup. |
| RFIs/Submittals | Projects, work packages, attachments, status history | Information blockers, change links, closeout evidence. |
| Change events | Daily reports, RFIs, attachments, audit, billing status | Commercial recovery, pay app inclusion, exposure reports. |
| Billing | SOV, daily quantities, approved changes, lien waivers, backup | Cash control, retainage forecast, commercial recovery. |
| Safety | Users, projects, work packages, attachments | Corrective actions, incident control, D3/D4/D5 risk management. |
| Quality | Work packages, inspections, tests, attachments | Punch, closeout evidence, acceptance readiness. |
| Closeout | Attachments, billing, safety, quality, RFIs, changes | Acceptance, final billing, retainage release, archive. |
| Optimize | Closed projects, performance records, production rates, GC/vendor profiles | Better go/no-go scoring, estimates, checklists, risk library. |

## Critical Ordering Rules

1. Persistence before production workflow transactions.
2. Workflow transaction design before broad database writes.
3. Auth before RBAC enforcement.
4. Audit before approvals are production-grade.
5. Attachments before production closeout, safety evidence, quality evidence, and billing backup.
6. Master data before clean procurement, resource controls, and financial controls.
7. Workflow transactions before notifications and escalations.
8. Daily report writes before reliable production-rate intelligence.
9. Change event writes before commercial recovery reporting is production-grade.
10. Billing writes before cash-at-risk reporting is production-grade.
11. Closeout writes before Optimize can rely on completed-project outcomes.
12. Production monitoring/backups before live operational rollout.

## Recommended Constraint

Do not enable broad database runtime until a narrow transaction path proves:

- required input validation
- permission check
- audit event
- status history movement
- evidence link handling
- user feedback
- rollback/fallback path

That proof should happen on a small set of high-value workflows first.
