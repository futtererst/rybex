# Controlled Pilot Launch Plan

## Pilot Objective

Validate whether RybexOS helps internal Rybex users move subcontracted infrastructure work through controlled workflows:

Signal -> Decision -> Action -> Evidence -> Gate Movement.

The pilot should prove operating behavior, not production scale.

Pilot Mode is available at `/pilot` as the recommended guided entry path for the first controlled internal review. It includes the three verified workflow completion proofs and keeps full app navigation available.

## Pilot Boundaries

Recommended scope:

- 1-2 internal Rybex projects.
- Limited internal users only.
- No external GC/client access.
- No sensitive production documents unless storage/security is fully configured and approved.
- Workflow actions and evidence tracking are the primary test.
- Notifications are in-app only.
- Seed/local fallback remains available.

## What Users Can Do

- Review Command Center leadership priorities.
- Review workflow stage/gate status.
- Complete selected workflow transactions.
- Track evidence requirements.
- Mark local/demo evidence attached, verified, or waived.
- Review in-app notifications and escalation queues.
- Use Admin to see readiness, data mode, security limits, and diagnostics.
- Use Pilot Mode to complete billing backup, field issue escalation, and closeout requirement workflows without navigating the full app.
- Complete the first Pilot Mode task through a visible guided billing backup flow: mark backup attached, send to review, resolve blocker, and return to Pilot Mode.
- Complete the Field Issue and Closeout Pilot Mode tasks through visible guided flows with saved notes, sequential actions, result banners, history, and return-to-pilot progress updates.

## What Users Cannot Do

- Treat RybexOS as the system of record.
- Invite external GC/client users.
- Use production login/RLS.
- Rely on external notifications.
- Upload sensitive production documents unless storage security is approved.
- Expect all module records to persist.
- Expect integrations with accounting, Procore, Autodesk, email, Teams, Slack, DocuSign, or file management systems.

## Recommended Pilot Users/Roles

- Executive sponsor: CEO or operations leader.
- Pilot owner: operations leader or senior PM.
- Project manager: owns D2, change, billing, and closeout actions.
- Superintendent or field supervisor: validates daily field workflow and evidence needs.
- Billing/commercial user: validates cash-at-risk and backup workflows.
- Safety/quality leader: validates corrective action and evidence language.
- Admin/developer support: monitors mode, diagnostics, issues, and verification.

## Recommended Pilot Project Type

Choose projects that are representative but low risk:

- Internal project with clear scope and known stakeholders.
- Not highly confidential.
- Has active field, change, billing, safety/quality, and closeout concerns.
- Small enough for weekly review.
- Complex enough to test cross-module workflow movement.

## Pilot Success Criteria

- Users understand what matters to them within 60 seconds.
- Users can read the stage / module header and understand whether work is ready, blocked, at risk, or complete.
- Users can identify the next required actions, owner, due date, evidence required, and active risks without reading dense records first.
- Owners, due dates, blockers, evidence, and CTAs are clear.
- At least five workflow actions are completed during the pilot.
- Evidence requirements are reviewed and acted on.
- In-app notifications identify meaningful risks without creating noise.
- Admin readiness status is understood by sponsor and pilot owner.
- Pilot users can explain what is demo/local, what is database-backed, and what is not production-ready.
- The Billing Backup pilot task is visibly executable without expanding details or hunting through records.
- Field Issue and Closeout pilot tasks are visibly executable from `/pilot`, including editable note save, visible state movement, and complete/resolved Pilot Mode cards.

Detailed registers, implementation notes, and supporting records should remain
available below the operating summary or through progressive disclosure.

Pre-pilot remediation gate:

- Review `docs/page-comprehension-qa-review.md`.
- Complete all "Must Fix Before Pilot" items in `docs/page-remediation-backlog.md`. Current pilot blockers for Billing, Closeout, and Optimize are marked complete.
- Confirm the end-user action workspace is the first visible layer on major pages.
- Run `npm run page-comprehension:verify`.
- Run `npm run page-remediation:verify`.
- Run `npm run end-user:verify`.
- Run `npm run end-user-visual:verify`.

## Pilot Exit Criteria

Exit to next build only when:

- Pilot users confirm workflow language matches real work.
- Top workflow actions are understood and useful.
- Data mode and local/database boundaries are not confusing.
- Security/data handling concerns are documented.
- Next persistence/auth/storage priorities are ranked.
- No critical usability blocker remains.

Do not exit to production until:

- Auth/session resolution is complete.
- RLS is enabled and tested.
- File storage security is approved.
- Broad write persistence is reviewed.
- Backups, monitoring, support, and incident response exist.

## Pilot Data Handling Rules

- Use non-sensitive project data where possible.
- Do not paste secrets, credentials, or private keys into records.
- Do not commit `.env.local`.
- Do not include secrets in screenshots or demo packages.
- Avoid sensitive production documents until storage/RLS are approved.
- Label any manually entered records as pilot/test where appropriate.

## Support Process

- Assign one pilot owner.
- Assign one technical support owner.
- Review issues weekly.
- Capture blocker, route, role, expected behavior, actual behavior, screenshot if available, and severity.
- Separate product issues from data/security/operational questions.

## Issue Reporting Process

Use this format:

- Role:
- Route:
- Workflow:
- Action attempted:
- Expected result:
- Actual result:
- Severity:
- Screenshot or notes:
- Data mode:
- Recommended fix:

## Weekly Review Agenda

1. Review top workflow actions completed.
2. Review blocked work and unresolved notifications.
3. Review evidence gaps.
4. Review user confusion by role.
5. Review security/data concerns.
6. Review defects and fixes.
7. Decide whether to continue, narrow, expand, or stop pilot.

## Go/No-Go Decision Points

Pilot launch go:

- Sponsor approved.
- Pilot roles assigned.
- Data handling rules accepted.
- Support owner assigned.
- Verification passes.

Verification gate:

```powershell
npm run demo:check
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
npm run smoke:routes
npm run verify
npm run workflow:verify-actions
npm run rbac:verify
npm run evidence:verify
npm run notifications:verify
npm run security:verify
npm run pilot:verify
npm run user-flow:qa
npm run user-flow:verify
npm run cta-outcome:qa
npm run cta-outcome:verify
npm run task-outcome:verify
```

User workflow QA is required before a usability review. The latest automated
safe-click pass covers 13 scenarios and confirms no same-page no-change CTA
failures in the primary user path. Review `docs/user-workflow-qa-report.md` and
`docs/user-workflow-remediation-backlog.md` before claiming pilot confidence.

CTA outcome clarity QA is also required. It confirms primary and important
secondary CTAs produce understandable outcomes through route changes, expanded
details, highlighted focus targets, modals, or visible feedback. Review
`docs/cta-outcome-clarity-qa-report.md` and
`docs/cta-outcome-remediation-backlog.md`.

Task outcome contract verification is required before founder review. It checks
that primary cockpit CTAs use concrete labels, include focus metadata when they
route, and land on a focused task panel with `You are here to` and a next-step
instruction.

Workflow completion proof verification is required before presenting the app as
able to move work forward. `npm run workflow-completion:qa` validates the
Billing Backup Blocker -> Cash Recovery path from Command Center through local
completion history. This remains a local/demo proof, not production cash
recovery persistence.

If database env vars are configured for a private pilot, also run:

```powershell
npm run db:verify-workflow-transactions
npm run db:inspect-security
```

If the evidence upload pilot is configured, also run:

```powershell
npm run evidence:verify-upload
```

Pilot continue:

- No critical security or data handling issue.
- Users are completing actions.
- Weekly review produces actionable findings.

Pilot pause:

- Data mode confusion affects trust.
- Users cannot complete workflow actions.
- Security boundaries are unclear.
- Evidence/upload scope is misunderstood.

Pilot stop:

- Sensitive data is at risk.
- Workflow actions fail repeatedly.
- Product is being treated as production system of record.
- Human sponsor withdraws approval.
## Workflow Completion Proof Boundary

Two local/demo completion proofs are available for review:

- Billing Backup Blocker -> Cash Recovery.
- Field Issue -> RFI / Change Escalation.

These prove task outcome and completion behavior. They are not a production RFI/change or billing persistence system.

The completion proof layer is now standardized through the registry model, which makes future local/demo workflows repeatable before production persistence is added.
## Workflow Completion Proof Scope

The controlled pilot planning package now recognizes three local/demo completion proofs: Billing Backup Blocker -> Cash Recovery, Field Issue -> RFI / Change Escalation, and Closeout Requirement -> Acceptance / Final Billing Release. These prove action completion behavior, result banners, history, and linked demo outputs, but they are not production persistence, production storage, RLS, or external-notification readiness.

The Workflow Completion Persistence Bridge can be tested as an opt-in Supabase pilot. It should remain internal-only until auth, RLS, support process, and data handling rules are approved.
## Editable Field Gate

Pilot users must complete the three guided workflows through visible saved fields, not button-only actions. The pilot scope includes saved notes/references in local/demo history for Billing, Field Issue, and Closeout. Production persistence, RLS, and production document controls remain outside this pass.

## State Ownership Model

Server renders definitions/static shell. The client provider owns live completion state.

This keeps the guided pilot slice stable while local/demo persistence remains adapter-driven and database persistence remains opt-in.

## Pilot Slice Lockdown

The controlled pilot launch plan now treats the three-workflow Pilot Mode slice as locked for regression protection. The included workflows are Billing Backup Blocker -> Cash Recovery, Field Issue -> RFI / Change Escalation, and Closeout Requirement -> Acceptance / Final Billing Release. No fourth workflow should be added before human review of this slice.

`npm run pilot:acceptance` is the required acceptance gate before pilot review. `npm run pilot:acceptance-visual` is the visual companion. The local dev runtime caveat remains documented; the acceptance gate uses the production build server because it has been stable in this environment.

Status: Controlled internal pilot candidate — not production ready.

## Outcome Record Review

Pilot review must inspect the business outcome record for each completed workflow. The record should show captured details, evidence/document references, linked outputs, state movement, business impact, remaining blockers, next business step, and historical reference label. These records remain local/demo unless the database pilot bridge is explicitly configured.

## Billing v2 Blueprint Boundary

The Billing v2 blueprint now exists at `docs/billing-v2-gold-standard-workflow-blueprint.md`. It is a product-design specification for the future Billing Backup Blocker -> Pay Application Review Readiness workflow only. No Billing v2 implementation has occurred yet, and the controlled pilot scope is not expanded by this document.

## D5O True Workflow Management Package Boundary

`docs/d5o-true-workflow-management-development-package.md` defines the D5O true workflow management standard for future workflow development across D5O. `docs/billing-v2-enterprise-workflow-implementation-spec.md` defines the future Billing v2 enterprise workflow implementation spec.

This is specification only. No implementation occurred, no controlled pilot scope changed, and no Pilot Mode behavior changed. The next step is manual review of the Billing v2 implementation spec before code is written.

Verification: `npm run d5o-workflow-package:verify`.

## Billing v2 Readiness Review Boundary

Billing v2 implementation readiness review completed in `docs/billing-v2-implementation-readiness-review.md`. The build plan, data model mapping, and QA acceptance plan are documented in `docs/billing-v2-implementation-build-plan.md`, `docs/billing-v2-data-model-mapping.md`, and `docs/billing-v2-qa-acceptance-plan.md`.

No implementation occurred. Controlled pilot scope, Pilot Mode behavior, workflow runtime, persistence, auth, and RLS remain unchanged. The next step is to resolve the review conditions and approve the build plan before code is written.

Verification: `npm run billing-v2:verify-readiness`.

## Billing v2 Engineering Readiness Boundary

Billing v2 engineering readiness guardrails now exist: ADRs, state transition matrix, command contract, UI wireframe spec, domain test plan, and a saved Phase 1A implementation prompt.

No implementation occurred. Controlled pilot scope, Pilot Mode behavior, workflow runtime, persistence, auth, and RLS remain unchanged. The next approved Billing v2 implementation pass must be Phase 1A domain-only and must not refactor Field or Closeout.

Verification: `npm run billing-v2:verify-engineering-readiness`.

## Billing v2 Phase 1A Domain Boundary

Billing v2 Phase 1A domain layer now exists as internal domain code only. Controlled pilot scope, Pilot Mode behavior, workflow runtime behavior, persistence, auth, RLS, Field, and Closeout remain unchanged.

The controlled pilot launch plan should not treat Billing v2 as a new pilot workflow yet. A later Phase 1B UI/integration pass must be separately reviewed before any pilot-facing behavior changes.

Verification:

```powershell
npm run billing-v2:qa-domain
npm run billing-v2:verify-domain
```
