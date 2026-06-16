# RBAC And RLS Review

Current `lib/d5o/rbac.ts` is a good UI permission map. Future database security
must enforce equivalent access in Postgres/Supabase RLS; TypeScript checks alone
are not sufficient.

## Required RLS Columns

- `organization_id` on every tenant-owned table.
- `workspace_id` only if workspaces become distinct from organizations.
- `project_id` on project-scoped records.
- `created_by` on user-created records.
- `owner_id` or `assigned_to_id` on owned/action records.
- `visibility` optional for finance/safety-sensitive records.

## Scope Recommendations

| Table Group | Scope | Notes |
| --- | --- | --- |
| organizations, users, profiles, memberships | Organization/user scoped | Admin manages memberships; users read own profile. |
| projects, opportunities | Organization scoped, project role filtered | Executives/ops see broad; field users limited. |
| D5O gates/artifacts | Project scoped | Approval permissions required for mutation. |
| mobilization/work packages/daily reports | Project scoped | Field supervisors can create daily reports only for assigned projects/packages. |
| RFIs/submittals/changes | Project scoped | PM/ops can mutate; field generally read/create prompts only. |
| billing/pay apps/commercial exposure | Project scoped plus finance visibility | Finance/admin/PM/executive; field users should not see sensitive amounts by default. |
| safety incidents | Project scoped with safety/admin restrictions | Field can report; sensitive incident details limited. |
| quality records | Project scoped | Quality/PM/ops can mutate; field can report/check where assigned. |
| closeout | Project scoped | PM/quality/finance share visibility. |
| optimize profiles/risk library | Organization scoped | Exec/ops/estimating visibility; admin controls global updates. |
| audit_events | Organization/project scoped, restricted | Admin plus authorized project leadership. |
| attachments | Inherit owner entity access | Storage path must include organization/project. |

## Role Notes

- executive: broad read, limited approval rights, finance visibility.
- operations_leader: broad operating control, gate/change/closeout approvals.
- project_manager: project ownership, most module editing, limited admin.
- estimator: pipeline and Optimize inputs, limited project commercial read.
- superintendent: mobilization/field execution ownership.
- field_supervisor: assigned work packages, daily reports, safety/quality reporting.
- safety_manager: safety records and safety-impacting project data.
- quality_manager: quality records and closeout evidence.
- finance_admin: billing, pay apps, commercial exposure, retainage.
- admin: membership/config/security controls.

## External Portal Future

If GC/client portal access is added, create separate external identity roles and
never reuse internal Rybex roles. External users should see only explicitly
shared RFIs, submittals, closeout submissions, and acceptance responses.

## Review Result

No blocker, but RLS implementation must come before live data. The schema must
add `organization_id`, `project_id`, `created_by`, and ownership columns from the
first migration, even if the UI still uses seed mode.
