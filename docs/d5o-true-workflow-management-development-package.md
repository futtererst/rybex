# D5O True Workflow Management Development Package

## 1. Executive Summary

This package resets RybexOS development around true workflow management across D5O. The product already has strong mechanics: lifecycle structure, Pilot Mode, workflow completion, editable fields, state movement, outcome records, QA, visual capture, and acceptance gates. Those mechanics are necessary, but they are not sufficient.

RybexOS must evolve from workflow mechanics into business-process execution. A workflow should not feel like a user is filling a form and pressing buttons. It should feel like the user is moving a real subcontractor business object through a controlled process that protects margin, cash, schedule, safety, quality, recovery, acceptance, and institutional memory.

Every workflow must satisfy this chain:

**Business trigger → Business process → Business object → Required inputs → Evidence/documents → Review/handoff → State movement → Business outcome → Historical record → Next step**

This document is a development package and standards artifact only. It does not implement UI, runtime behavior, persistence, auth, RLS, routes, Pilot Mode behavior, or workflow refactors.

## 2. What D5O Means For RybexOS

D5O is the operating lifecycle RybexOS uses to connect business development, project setup, preparation, delivery, closeout, and learning.

### D1 — Discover

- Identify and qualify work.
- Decide whether Rybex should pursue the opportunity.
- Protect estimating discipline, pursuit capacity, commercial judgment, and early risk visibility.

### D2 — Define

- Establish contract, scope, schedule, commercial, and project baseline.
- Prevent undefined work from entering execution.
- Protect handoff clarity from pursuit into project setup.

### D3 — Design / Prepare

- Convert the baseline into field-ready mobilization and work packages.
- Prevent premature mobilization.
- Protect procurement, labor readiness, permits/access, safety planning, quality planning, and constructability.

### D4 — Deliver

- Execute field work with daily proof, RFI/change escalation, safety, quality, billing, and commercial control.
- Prevent field problems from becoming unrecoverable risk.
- Protect productivity, schedule, recovery rights, billing support, and field-to-office accountability.

### D5 — Document / Close

- Assemble closeout, acceptance, final billing, retainage, and archive evidence.
- Prove completion and release final payment.
- Protect final acceptance, retainage recovery, warranty record, and future dispute defense.

### O — Optimize

- Convert project outcomes into improved estimating, production rates, templates, risk rules, and lessons learned.
- Improve the next project.
- Protect institutional learning and repeatable operating performance.

## 3. RybexOS Business Purpose

RybexOS exists to help Rybex users execute business processes that protect:

- margin
- cash
- schedule
- field execution
- safety
- quality
- change recovery
- billing readiness
- closeout acceptance
- retainage release
- institutional learning

The system should help a user know what process they are in, what object is moving, what proof is required, who owns the next decision, what changed after action, and where the record can be found later.

## 4. Definition Of True Workflow Management

True workflow management is business-process execution, not task tracking.

A workflow is not accepted if it only provides:

- cards
- buttons
- notes
- resolved states
- generic routing
- highlighted sections
- simulated completion

A workflow is accepted only when:

- the user knows the business problem
- the user knows the business object
- required inputs are captured
- evidence/documents are captured or referenced
- handoff/review is created
- state changes have business meaning
- outcome is clear
- historical record is referenceable
- next business step is clear

The accepted workflow sentence is:

**RybexOS guides the user through a business process, captures required inputs and evidence, creates a historical record, and moves a real business object toward a measurable outcome.**

## 5. Enterprise Workflow Architecture

True workflow management requires an architecture that separates definitions, business objects, instances, steps, evidence, reviews, outcomes, and historical records.

### A. Workflow Definition Layer

Every workflow definition must include:

- workflowId
- D5O phase
- business process
- business object type
- starting problem
- business impact
- primary user
- supporting users
- handoff owner
- stages
- editable fields
- evidence requirements
- document requirements
- review rules
- approval rules
- state transitions
- business outcome
- historical record
- next step
- QA contract

The definition layer should describe the business process before UI or persistence decisions are made.

### B. Business Object Layer

Business objects include:

- opportunity
- pursuit decision
- project baseline
- contract baseline
- scope matrix
- mobilization plan
- work package
- daily report
- field issue
- RFI
- submittal
- change event
- pay application
- billing backup package
- safety corrective action
- quality deficiency
- closeout requirement
- closeout package
- lesson learned
- production rate update

Workflow state should attach to these objects, not float as generic task completion.

### C. Workflow Instance Layer

A workflow instance is the live execution of a workflow definition against one real business object. It should identify the object, current state, owner, role, due date, blockers, saved inputs, evidence status, review status, linked outputs, and history.

Instances should make clear whether they are local/demo, database pilot, or future production-backed records.

### D. Task And Step Layer

Each workflow step must show:

- why the step exists
- what the user enters
- what evidence is required
- what changes after save
- what comes next

Steps should not be hidden QA paths. They must be visible, understandable, and executable by the target user.

### E. Evidence And Document Layer

Evidence must be:

- uploaded
- referenced
- linked
- verified
- waived with reason
- tied to workflow and business object

Evidence cannot be treated as an optional attachment when the workflow outcome depends on it.

### F. Review And Handoff Layer

Every review/handoff must include:

- recipient role
- assigned owner
- review status
- decision
- decision note
- timestamp
- next state

The user must know who receives the handoff and what the recipient is expected to decide.

### G. Outcome Record Layer

Every completed workflow must generate an outcome record that states:

- workflow name
- business process
- business object moved
- required inputs captured
- evidence/documents captured or referenced
- review/handoff result
- state movement
- measurable business outcome
- remaining blockers
- next business step
- local/demo, database pilot, or future production status

### H. Historical Record Layer

Every completed workflow must be referenceable later. The historical record must allow a future user to answer: what happened, who acted, what was captured, what decision was made, what changed, what remained open, and what the next business step was.

## 6. D5O Workflow Catalogue

The target workflow catalogue below defines the intended workflow management scope. It is not an implementation claim.

### D1 — Discover: Opportunity Intake → Go/No-Go Decision

- Business process: Opportunity qualification and pursuit decision.
- Business object: Opportunity / pursuit decision.
- Trigger: New opportunity identified.
- Primary user: Business development / estimator.
- Reviewer/handoff: Leadership / estimating reviewer.
- Required inputs: opportunity summary, scope, customer, location, schedule, size, strategic fit, risk notes.
- Required evidence/documents: invitation, plans/specs reference, bid documents, client notes.
- Workflow stages: intake, qualification, risk review, estimate readiness, go/no-go decision.
- Business outcome: Opportunity is approved for pursuit or declined with a referenceable reason.

### D2 — Define: Award / Approved Pursuit → Project Baseline Ready

- Business process: Contract and project baseline setup.
- Business object: Project baseline / contract baseline / scope matrix.
- Trigger: Award or approved pursuit moves toward project setup.
- Primary user: Project manager / operations.
- Reviewer/handoff: Operations leader / finance/admin.
- Required inputs: contract value, scope inclusions/exclusions, schedule, billing terms, key risks, handoff notes.
- Required evidence/documents: contract, proposal, estimate, scope matrix, baseline schedule.
- Workflow stages: baseline creation, scope review, commercial review, launch readiness, handoff.
- Business outcome: Project baseline is ready for mobilization planning.

### D3 — Design / Prepare: Project Baseline → Field Start Release

- Business process: Mobilization and work package readiness.
- Business object: Mobilization plan / work package.
- Trigger: Project baseline approved for preparation.
- Primary user: Project manager / superintendent.
- Reviewer/handoff: Operations / field leadership.
- Required inputs: crew plan, equipment plan, procurement needs, permits/access, safety plan, quality plan.
- Required evidence/documents: permits, JHA/toolbox plan, procurement confirmations, drawings, work package details.
- Workflow stages: readiness planning, constraint review, evidence collection, field release review, start authorization.
- Business outcome: Field start is released or blocked with clear constraints.

### D4 — Deliver: Work Package → Daily Report And Field Evidence

- Business process: Field execution proof and daily reporting.
- Business object: Work package / daily report.
- Trigger: Field work is performed.
- Primary user: Field supervisor.
- Reviewer/handoff: Project manager / operations.
- Required inputs: installed quantities, crew, equipment, weather, delays, issues, safety/quality observations.
- Required evidence/documents: photos, tickets, daily reports, production records.
- Workflow stages: daily capture, issue review, evidence attachment/reference, PM review, billing/closeout support.
- Business outcome: Work performed is documented and available for schedule, billing, quality, and closeout use.

### D4 — Deliver: Field Issue → RFI / Change Escalation

- Business process: Field issue control and escalation.
- Business object: Field issue / RFI / change event.
- Trigger: Field condition, conflict, missing information, or scope impact is identified.
- Primary user: Field supervisor / PM.
- Reviewer/handoff: PM / commercial reviewer / owner-response queue.
- Required inputs: issue description, location, impact, recommended control path, RFI/change details, resolution note.
- Required evidence/documents: daily report, photos, sketches, crew impact notes.
- Workflow stages: identify issue, choose control path, create RFI/change output, mark controlled, resolve original issue.
- Business outcome: Field issue is controlled through linked RFI or change process.

### D4 / Commercial: Changed Condition → Protected Change Event

- Business process: Change control and recovery protection.
- Business object: Change event.
- Trigger: Changed condition, directive, delay, scope gap, or entitlement event.
- Primary user: PM / commercial user.
- Reviewer/handoff: Commercial reviewer / operations.
- Required inputs: event description, notice deadline, impact, pricing path, recovery status.
- Required evidence/documents: directive, photos, daily report, tickets, correspondence, estimate backup.
- Workflow stages: event creation, notice review, backup collection, pricing review, billing handoff.
- Business outcome: Change event is commercially protected and moved toward recovery.

### D4 / Commercial: Billing Backup Package → Pay Application Review Readiness

- Business process: Billing backup completion and pay application readiness.
- Business object: Pay application / billing backup package.
- Trigger: Pay application item is blocked by missing or incomplete backup.
- Primary user: Billing / commercial user.
- Reviewer/handoff: Commercial reviewer / finance/admin.
- Required inputs: backup summary, evidence reference, affected amount, source record, review note, resolution note.
- Required evidence/documents: T&M ticket, daily report, photo log, supervisor confirmation, product approval backup, related change event.
- Workflow stages: identify blocker, build package, satisfy evidence, confirm readiness, commercial review, clear blocker.
- Business outcome: Pay application backup package is ready for review and the specific backup blocker is cleared.

### Safety: Safety Observation / Incident → Corrective Action Closure

- Business process: Safety corrective action management.
- Business object: Safety observation, incident, or corrective action.
- Trigger: Safety observation, incident, or hazard is recorded.
- Primary user: Safety lead / field supervisor.
- Reviewer/handoff: Safety manager / operations.
- Required inputs: observation/incident details, corrective action, owner, due date, closure note.
- Required evidence/documents: photos, toolbox record, incident report, corrective proof.
- Workflow stages: record issue, assign action, collect evidence, verify correction, close action.
- Business outcome: Safety action is closed with proof or remains open with visible accountability.

### Quality: Deficiency / Missing Test → Acceptance Control

- Business process: Quality deficiency and acceptance control.
- Business object: Quality deficiency / test evidence requirement.
- Trigger: Deficiency, failed inspection, missing test, or acceptance risk is identified.
- Primary user: Quality manager / PM.
- Reviewer/handoff: Quality reviewer / operations.
- Required inputs: deficiency description, correction plan, verification note, acceptance impact.
- Required evidence/documents: inspection, test result, photo, correction evidence.
- Workflow stages: identify deficiency, assign correction, collect proof, verify, release acceptance blocker.
- Business outcome: Quality issue is controlled and no longer blocks acceptance, billing, or closeout for the item.

### D5 — Document / Close: Closeout Requirement → Acceptance / Final Billing Release

- Business process: Closeout requirement completion and final recovery readiness.
- Business object: Closeout requirement / closeout package.
- Trigger: Closeout requirement is missing, incomplete, or blocking final billing/retainage.
- Primary user: PM / closeout owner.
- Reviewer/handoff: Closeout reviewer / finance/admin.
- Required inputs: evidence note, evidence reference, acceptance note, remaining blockers.
- Required evidence/documents: as-builts, test results, warranties, punch closure, acceptance support.
- Workflow stages: identify requirement, collect evidence, send to review, resolve blocker, release final billing path.
- Business outcome: Closeout requirement is satisfied or risk is accepted, and acceptance/final billing can proceed for the item.

### O — Optimize: Project Outcome → Operating Model Update

- Business process: Lessons learned and operating model improvement.
- Business object: Lesson learned / production rate update / risk rule update.
- Trigger: Project performance outcome, variance, claim, safety/quality trend, or closeout review.
- Primary user: Operations / executive / estimator.
- Reviewer/handoff: Leadership / estimating owner.
- Required inputs: outcome summary, variance reason, recommendation, affected template/rate/rule.
- Required evidence/documents: project scorecard, production data, change history, closeout notes.
- Workflow stages: identify learning, validate evidence, approve update, publish operating model change.
- Business outcome: Future estimating, production planning, or risk controls are improved.

## 7. System Capabilities Required

The target platform capabilities are:

- workflow definition registry
- business object service
- evidence/document service
- review/approval service
- handoff service
- outcome record service
- historical record service
- role-based work queues

These services should be introduced deliberately. Current local/demo and pilot mechanics should be mapped before adding production-grade platform services.

## 8. Required Data Model Package

Target data model families include:

- workflow_definitions
- workflow_instances
- workflow_steps
- workflow_tasks
- workflow_state_transitions
- workflow_handoffs
- workflow_reviews
- workflow_outcome_records
- workflow_historical_records
- workflow_business_object_links
- workflow_linked_outputs
- evidence_requirements
- evidence_references
- attachments
- entity_attachments
- evidence_waivers
- evidence_verifications
- review_tasks
- review_decisions
- approval_events
- approval_conditions
- audit_events
- status_history
- activity_events
- comments
- notifications
- notification_events
- escalation_rules
- escalation_events

Current schema should be mapped before adding new tables. Do not add new tables until the existing schema, seed data, workflow completion model, evidence model, audit/status history plans, and Supabase pilot boundaries are reviewed together.

## 9. UX Requirements For True Workflow Management

The standard workflow screen structure is:

- Business Process Header
- Business Problem Card
- Business Object Card
- Guided Process Steps
- Evidence / Document Package
- Review and Handoff
- Outcome Record
- Historical Record
- Remaining Blockers
- Next Business Step

Each screen must tell the user what business process they are executing, what object they are changing, why it matters, what they must provide, what changes when they act, who receives the handoff, what outcome was achieved, and where the record can be found later.

## 10. Development Roadmap

### Phase 0 — Product Reset And Standards

Freeze the true workflow management standard, review this package, and confirm that future workflow work starts from business process design before implementation.

### Phase 1 — Billing v2 Gold Standard

Use Billing Backup Package -> Pay Application Review Readiness as the gold-standard workflow. Review the implementation specification manually before writing code.

### Phase 2 — Apply Pattern To Field Issue

After Billing v2 passes manual acceptance, refactor Field Issue -> RFI / Change Escalation using the accepted pattern.

### Phase 3 — Apply Pattern To Closeout

After Billing and Field pass manual acceptance, refactor Closeout Requirement -> Acceptance / Final Billing Release.

### Phase 4 — Extend D1 / D2 / D3

Add true workflows for opportunity intake, pursuit decision, baseline setup, and field start release.

### Phase 5 — Full D4 Controls

Extend true workflow management across daily reports, work packages, safety, quality, commercial recovery, RFIs/submittals, billing, and production control.

### Phase 6 — Optimize Workflows

Connect outcomes to lessons learned, estimating feedback, production rates, templates, risk rules, and operating model updates.

### Phase 7 — Enterprise Hardening

Add production persistence, auth/RBAC enforcement, RLS, secure document storage, audit durability, monitoring, backup/recovery, support process, and production data governance.

## 11. Non-Negotiable Rule

Do not build any new workflow unless it satisfies:

**Business process + business object + required inputs + evidence/documents + review/handoff + outcome record + historical record + next business step.**

This package is specification only. No workflow implementation, UI change, runtime behavior change, route, persistence, auth, RLS, Pilot Mode behavior, or production readiness claim is created by this document.
