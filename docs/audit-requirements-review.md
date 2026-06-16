# Audit Requirements Review

Audit is for sensitive operating actions. Lower-risk user-visible events can go
to `activity_events`; status transitions go to `status_history`.

| Module | Entity | Action | Actor Role | Required Audit Fields | Before/After | Attachment Snapshot |
| --- | --- | --- | --- | --- | --- | --- |
| Pipeline | Opportunity / go_no_go_scores | Go/no-go approval, hold, decline, no-bid | executive, operations_leader, estimator | actor, role, timestamp, recommendation, score, reason | Yes | Reference bid docs if decision depends on them. |
| Projects | d5o_gates | D2 gate approval/hold/block | operations_leader, project_manager | phase, readiness, approver, missing artifacts | Yes | Reference baseline artifacts. |
| Mobilization | d5o_gates / mobilization_plans | D3 field-start approval/hold | operations_leader, superintendent | readiness, decision, blockers, approver | Yes | Reference safety/access/work package evidence. |
| Field Execution | daily_reports | Submission/rejection/approval | field_supervisor, superintendent, project_manager | report date, project, work package, status | Yes | Reference photos/tests, do not duplicate files. |
| Field Execution | supervisor_signoffs | Supervisor signoff | superintendent, field_supervisor | signer, signed_at, report id | Yes | No, references report attachments. |
| RFIs | rfis | Submit, answer, close, void | project_manager | rfi number, due date, impact flags, status | Yes | Reference RFI attachments. |
| Submittals | submittals | Submit, approve, reject, revise | project_manager, reviewer | package, revision, result, status | Yes | Reference submittal package. |
| Changes | change_events | Notice submitted, pricing submitted, approved, rejected, disputed | project_manager, finance_admin, operations_leader | amount, notice deadline, status, billing status | Yes | Reference backup and directives. |
| Billing | pay_applications | Submit, approve, reject, mark paid/disputed | finance_admin, project_manager, executive | requested/approved/paid amounts, period, status | Yes | Reference pay app package/waivers. |
| Safety | safety_incidents | Create, update severity, close | safety_manager, field_supervisor | severity, incident type, location, report required | Yes | Reference incident attachments/photos. |
| Safety/Quality | corrective_actions | Assign, verify, close, reopen | safety_manager, quality_manager, assigned owner | due date, verification, verifier, status | Yes | Reference verification photos/docs. |
| Quality | quality_deficiencies | Create, correct, verify, close | quality_manager, project_manager | severity, location, reinspection, closeout impact | Yes | Reference deficiency photos/tests. |
| Closeout | closeout_packages | Submit, reject, accept, archive | project_manager, quality_manager, finance_admin | package, readiness, acceptance, retainage/final billing status | Yes | Reference package requirements. |
| Optimize | lessons_learned | Publish, assign action, verify, close | operations_leader | category, target module, owner, status | Yes | Optional evidence. |
| Admin/RBAC | workspace_memberships/roles | Role add/remove/change | admin | user, old role, new role, changed_by | Yes | No. |
| Attachments | attachments | Upload/delete/replace sensitive evidence | record owner, admin | owner entity, file name, storage path, action | Before/after for replace/delete | File reference required. |

## Audit Event Fields

Minimum persistent fields:

- `id`
- `organization_id`
- `project_id`
- `entity_type`
- `entity_id`
- `action`
- `actor_id`
- `actor_role`
- `timestamp`
- `summary`
- `before_state`
- `after_state`
- `severity`
- `attachment_ids`

## Review Result

The current `AuditEvent` type is sufficient for demo architecture. Persistent
implementation should add `organization_id`, `actor_id`, and attachment reference
support.
