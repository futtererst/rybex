# Workflow Transaction Design

RybexOS workflow transactions should turn displayed workflow actions into controlled operating movement.

The transaction pattern is:

Signal -> Decision -> Action -> Evidence -> Gate Movement

This document defines the design for a seed-backed/local-state Workflow Transactions MVP. It should not enable database runtime, auth, or production persistence yet.

Implementation note: the MVP is now implemented with local browser state. See `docs/workflow-transactions-mvp.md` for the implemented scope, limitations, and reset behavior.

## Transaction Contract

Each transaction should define:

- transaction type
- source workflow
- source record type
- source record id
- required inputs
- required evidence
- permission required
- status changes
- audit event
- resulting gate/status movement
- user feedback
- failure states

## Shared Transaction Fields

| Field | Purpose |
| --- | --- |
| id | Unique transaction id. |
| transactionType | Canonical transaction type. |
| workflowType | Source workflow category. |
| sourceModule | Module where the transaction originates. |
| sourceRecordType | Record type being acted on. |
| sourceRecordId | Record id being acted on. |
| projectId | Optional project scope. |
| actorRole | Current role performing the transaction. |
| actorName | Current user display name. |
| decision | Decision being recorded. |
| requiredInputs | Inputs required before submit. |
| evidence | Evidence linked or required. |
| fromStatus | Starting status. |
| toStatus | Resulting status. |
| gateMovement | D5O gate or operating status movement. |
| auditSummary | Human-readable audit summary. |
| failureReason | Reason transaction cannot complete. |
| createdAt | Transaction creation timestamp. |

## Initial Transaction Candidates

| Transaction | Source Workflow | Required Inputs | Status Changes | Evidence Required | Audit Event | Permission Required | Resulting Movement | User Feedback | Failure States |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| approve_go_no_go | pursuit_control | opportunity id, decision note, approver | awaiting_go_no_go -> approved_to_bid | score summary, dimension scores, reviewer notes | go_no_go_approved | approve_go_no_go | D1 approved to bid; ready for D2 if awarded | "Pursuit approved with recorded D1 decision." | missing score, missing approver, high risk without mitigation |
| hold_go_no_go | pursuit_control | opportunity id, hold reason, owner, due date | awaiting_go_no_go -> hold_for_clarification | clarification list, owner note | go_no_go_held | approve_go_no_go | D1 held until clarification is resolved | "Pursuit held with required clarification." | missing hold reason, missing owner |
| approve_d2_gate | contract_baseline | project id, approver, approval note | define/under_review -> ready_for_mobilization_planning | contract baseline, scope matrix, budget, schedule, notice terms | d2_gate_approved | approve_d2_gate | D2 approved for D3 planning | "D2 baseline approved for mobilization planning." | missing baseline artifact, unresolved contract blocker |
| hold_d2_gate | contract_baseline | project id, hold reason, blocker owner, due date | define -> blocked or watch | blocker list, baseline gap evidence | d2_gate_held | approve_d2_gate | D2 held until baseline blocker is resolved | "D2 gate held with assigned blocker." | missing blocker owner, missing reason |
| approve_d3_field_start | mobilization_readiness | mobilization plan id, approver, field-start date | ready_for_review -> approved_for_field_start | JHA, locates, access, permits, crew/equipment/material readiness, work packages | d3_field_start_approved | approve_d3_gate | D3 approved for D4 delivery | "Field start approved with readiness evidence." | missing safety package, missing locates, missing work package |
| hold_d3_field_start | mobilization_readiness | mobilization plan id, hold category, owner, due date | ready_for_review/planning -> blocked or awaiting_inputs | readiness blocker evidence | d3_field_start_held | approve_d3_gate | D3 held for safety/access/material/crew/work package/quality | "Field start held with required action." | missing category, missing owner |
| submit_daily_report | field_execution | work package id, date, supervisor, report content | draft -> submitted or supervisor_review | labor, equipment, quantities, photos/tests status, safety/quality notes, signoff | daily_report_submitted | submit_daily_report | D4 evidence captured; prompts RFI/change/safety/quality where applicable | "Daily report submitted and prompts generated." | missing supervisor, missing quantities, missing signoff when required |
| create_rfi_from_signal | information_control | source signal id, project id, question, due date, assignee | draft -> submitted | field source, drawing/spec reference, photos/attachments | rfi_created_from_signal | edit_rfis_submittals | Field uncertainty moves into RFI control | "RFI created from field signal." | missing question, missing assignee, missing due date |
| create_change_event_from_signal | change_recovery | source signal id, project id, title, notice status, owner | potential -> notice_required or pricing_required | daily report, photos, RFI/GC direction, labor/equipment backup | change_event_created_from_signal | edit_changes | Changed condition moves into recovery control | "Change event created before notice risk is missed." | missing owner, missing source evidence, notice deadline already missed |
| resolve_safety_action | safety_control | corrective action id, verification note, verifier | open/in_progress/overdue -> verified or closed | corrected photo, supervisor verification, corrective action note | safety_action_verified | edit_safety | Safety exposure closed or verified | "Safety corrective action verified." | missing verification evidence, not authorized verifier |
| resolve_quality_deficiency | quality_control | deficiency id, correction note, reinspection result, verifier | open/in_progress/failed -> corrected or verified | reinspection, photos, test result, correction evidence | quality_deficiency_verified | edit_quality | Quality blocker closed for billing/closeout readiness | "Quality deficiency corrected and verified." | missing reinspection, missing evidence |
| submit_closeout_package | closeout_acceptance | package id, reviewer, submission note | ready_for_review -> submitted | requirements complete, punch closed, tests/as-builts/warranties, billing/waiver status | closeout_package_submitted | edit_closeout | D5 package submitted for acceptance | "Closeout package submitted for GC/client review." | missing required doc, open punch, final billing blocker |
| publish_lesson_learned | optimize_learning | review id, owner, actions, target modules | draft/open -> published or assigned | scorecard, lessons, rate recommendations, improvement actions | lesson_learned_published | edit_lessons_learned | Optimize updates operating model backlog | "Lessons published and actions assigned." | missing owner, missing action, no target module |

## Permission Model

The MVP can call existing RBAC helper functions and show blocked states based on current demo role. It should not imply production security until real auth exists.

Future production writes must enforce permissions server-side, not only in UI components.

## Audit Model

Every transaction should create a demo audit event with:

- entity type
- entity id
- action
- actor role
- actor name
- timestamp
- summary
- before state
- after state
- related project id
- severity

In seed/local-state MVP, audit events can be in-memory or preview-only. In production, they must persist.

## Evidence Model

Evidence should be represented as structured requirements:

- required evidence label
- source module
- source record id
- status: missing, partial, complete, verified
- attachment required: yes/no

In the MVP, evidence can be selected/listed without real uploads. Production evidence requires attachment metadata, private file storage, and entity attachment links.

## Status Movement Model

Transactions should not set arbitrary status strings. Each transaction type should define allowed `fromStatus` and `toStatus` values.

If a transaction is blocked, the UI should show:

- what is missing
- who owns it
- what evidence is required
- what status/gate remains blocked

## User Feedback

Successful transaction feedback should say what moved:

- "D1 pursuit approved to bid."
- "D2 gate held for contract baseline."
- "D3 field start held for missing JHA."
- "Daily report submitted and change prompt created."

Failed feedback should say what must be fixed:

- "Cannot approve D3. Utility locates are not confirmed."
- "Cannot submit closeout package. OTDR test record is missing."

## MVP Boundaries

Do:

- keep runtime seed-backed
- support local/demo state only
- implement transaction config and preview logic
- show clear success/failure feedback
- generate demo audit events

In default demo mode, do not:

- enable database writes
- add auth
- remove seed mode
- add broad module scope
- claim production readiness

## Future Persistence Mapping

Each transaction should later map to:

- source table update
- workflow_instances row
- workflow_signals row when the signal is first materialized
- workflow_transactions row
- workflow_evidence_requirements rows
- workflow_source_links rows
- status_history row
- audit_events row
- optional gate_artifacts row
- optional entity_attachments rows
- optional comments/activity_events rows

This is why the transaction model should be proven before broad database writes.

## Phase 3 Schema Scaffold

`supabase/migrations/0003_workflow_transactions.sql` now defines the workflow
transaction persistence scaffold.

Production transaction execution should eventually be atomic:

1. Validate permission and workflow state.
2. Resolve actor and enforce RBAC permission for the transaction/workflow pair.
3. Insert `workflow_transactions`.
4. Insert `audit_events`.
5. Insert `status_history` if status or resolution state changed.
6. Update `workflow_instances`.
7. Update source module records only through the appropriate module repository.

The local transaction store remains the default transaction runtime.

## Phase 4 Write Pilot

A narrow database write pilot now persists workflow transaction movement only
when both settings are explicit:

```text
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_TRANSACTION_STORE=database
```

The pilot writes:

- `workflow_transactions`
- `workflow_instances` status/resolution updates
- `audit_events`
- `status_history`
- `workflow_evidence_requirements` status updates when confirmed evidence matches

It does not persist source module records, enable production login, enable RLS,
upload files, or create notifications. The Auth/RBAC foundation now enforces
workflow transaction permissions in the server action path, but production
Supabase auth/session resolution, RLS, and approval matrix review are still
required before production use.
