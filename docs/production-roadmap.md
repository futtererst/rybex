# Production Roadmap

Current update: Workflow transaction writes now have Auth/RBAC foundation
enforcement using demo auth by default, and RLS/Storage policy scaffolding
exists for review. The next production step is real Supabase auth/session
resolution plus careful table-by-table RLS enablement, not broader module
persistence.

Pilot readiness update: a production readiness gap review, pilot scorecard,
controlled pilot launch plan, pilot user test scripts, and pilot risk register
now exist. RybexOS is a controlled internal pilot candidate, not production-ready.
Any pilot should be limited to internal users, 1-2 projects, in-app notifications,
and carefully governed data handling.

Evidence update: shared evidence modeling and local demo verification are in
place. Production attachment upload and private storage security are still a
future phase.

Notification update: in-app escalation queues and local notification actions
are in place. Production delivery channels and notification persistence are
future work after auth/RLS and durable workflow/evidence persistence.

RybexOS should move from a seed-backed operating-system prototype into production through controlled phases. The goal is not to turn on a database everywhere at once. The goal is to prove durable workflow movement, then secure and scale it.

## Phase 0 - Current State

Objective:
Maintain the current seed-backed prototype as a reliable demo and architecture base.

Features:

- Full D5O lifecycle represented.
- Shared workflow grammar: Signal -> Decision -> Action -> Evidence -> Gate Movement.
- Visual capture and demo packaging.
- Persistence Phase 1 and Phase 2 schema scaffolding.
- RBAC, audit, implementation status, and repository contracts.

Dependencies:

- Existing seed data and data providers.
- Playwright visual capture.
- Route smoke checks.

Done Criteria:

- Verification passes.
- Demo docs and screenshots remain current.
- Seed mode stays default.

Risks:

- Prototype can be mistaken for production-ready.
- Seed data can drift from future schema.

Suggested Codex Implementation Sequence:

1. Keep demo and smoke checks passing.
2. Document production gaps honestly.
3. Avoid broad runtime rewrites.

## Phase 1 - Transactional MVP

Objective:
Prove that RybexOS can complete workflow actions before converting the whole app to database writes.

Features:

- Narrow workflow transaction engine.
- Seed-backed/local-state transaction flow for selected actions.
- Gate approval records as typed transaction results.
- Audit-event creation pattern.
- Status movement preview.
- Database runtime pilot only for reviewed D1/D2 reads if explicitly enabled.
- Seed fallback preserved.

Dependencies:

- Workflow operating layer.
- Repository contracts.
- Audit architecture.
- RBAC permission definitions.

Done Criteria:

- Users can approve/hold selected D1/D2/D3 decisions in demo/local state.
- Users can submit a daily report preview and create an RFI/change prompt from a field signal.
- Transactions define required input, evidence, permission, audit event, resulting movement, and failure states.
- Seed mode remains default.

Risks:

- Transaction model could drift from future persistence if not documented carefully.
- Too many transactions could be attempted at once.
- Local state may create false production confidence.

Suggested Codex Implementation Sequence:

1. Create transaction types and config.
2. Implement transaction preview/evaluator utilities.
3. Add transaction panels to highest-value workflows.
4. Add audit-event generation in memory only.
5. Document how each transaction maps to future tables.

## Phase 2 - Secure Internal MVP

Objective:
Make RybexOS safe for limited internal users and real project data in controlled workflows.

Features:

- Authentication provider.
- RBAC enforcement for routes and mutations.
- Project-level access.
- Basic RLS policies.
- User ownership on records.
- Comments/activity.
- Basic notifications for assigned workflow actions.

Dependencies:

- Persistence foundation.
- Human-approved schema/security review.
- Transaction definitions.
- Audit persistence.

Done Criteria:

- Users log in.
- Users can only view and mutate permitted data.
- Key transactions are audited.
- Project access works for PM/operations/finance/safety/quality roles.
- Seed fallback remains available for demos.

Risks:

- RLS policy mistakes.
- Permission model friction.
- Auth setup complexity.

Suggested Codex Implementation Sequence:

1. Choose auth provider.
2. Implement user/workspace membership tables in runtime.
3. Enforce permissions server-side for a narrow workflow set.
4. Add audit persistence for high-value actions.
5. Expand only after internal user testing.

## Phase 3 - Field And Commercial Operations MVP

Evidence upload note: a narrow private Supabase Storage pilot now exists for
workflow evidence requirements. Phase 3 must harden file access, signed URLs,
malware scanning, and retention before production use.

Objective:
Make field proof, commercial control, billing support, safety/quality closure, and closeout package creation operational.

Features:

- Daily report writes.
- RFI and change writes.
- Pay app support.
- File attachments and private storage.
- Safety corrective action closure.
- Quality deficiency closure.
- Closeout package writes.

Dependencies:

- Auth/RBAC.
- Audit persistence.
- Attachments/private storage.
- Workflow transactions.

Done Criteria:

- Field reports can be submitted and reviewed.
- RFI/change records can be created from field signals.
- Billing backup can link to daily reports, quantities, and approved changes.
- Safety and quality actions can be verified.
- Closeout packages can assemble linked evidence.

Risks:

- File storage and permissions are high-risk.
- Field-device usability must be validated.
- Commercial workflows need strong audit.

Suggested Codex Implementation Sequence:

1. Persist daily reports and linked evidence.
2. Persist RFIs/change events from field signals.
3. Add attachment upload/linking.
4. Persist billing backup and pay application state.
5. Persist safety/quality closure.
6. Persist closeout package assembly.

## Phase 4 - Enterprise Controls

Objective:
Add operating depth for leadership, finance, resource planning, procurement, and recurring review cadence.

Features:

- Master data.
- Approval matrix.
- Escalation engine.
- Financial controls.
- Schedule/resource controls.
- Document management.
- Operating report packs.

Dependencies:

- Secure internal MVP.
- Persistent workflow ownership.
- Stable master data schema.
- Transaction history.

Done Criteria:

- Owners receive actionable escalations.
- Approval paths are configurable.
- Leadership can review weekly operations, commercial exposure, cash, safety/quality, closeout aging, and performance.
- Master data prevents uncontrolled duplicate values.

Risks:

- Scope can balloon.
- Master data governance can slow users if overbuilt.
- Reporting performance may require views or materialized summaries.

Suggested Codex Implementation Sequence:

1. Add master data for companies, contacts, employees, cost codes.
2. Add approval matrix and delegation.
3. Add escalation engine.
4. Add financial/resource/procurement controls in limited slices.
5. Add exportable operating review packs.

## Phase 5 - Scale And Integrations

Objective:
Prepare RybexOS for enterprise scale, external collaboration, and production operations.

Features:

- Accounting integration.
- Procore/Autodesk strategy.
- Enterprise identity provider.
- Object storage hardening.
- Analytics/reporting optimization.
- Production monitoring.
- CI/CD, backups, incident response, support runbook.

Dependencies:

- Stable internal workflows.
- Production security review.
- External system decisions.
- Data retention policy.

Done Criteria:

- Production environments are separated.
- Monitoring and backups are active.
- External export/integration paths are controlled.
- Security review approves live production use.
- Support runbooks are available.

Risks:

- Integration complexity.
- Data ownership and duplication with GC systems.
- Reporting performance at scale.
- Security exposure from files and external users.

Suggested Codex Implementation Sequence:

1. Harden deployment and monitoring.
2. Harden file storage and backups.
3. Add identity provider.
4. Add PDF/email export before deep integrations.
5. Decide Procore/Autodesk/accounting integration boundaries.
