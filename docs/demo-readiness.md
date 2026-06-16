# RybexOS Demo Readiness

Update: Evidence is now visible as a shared operating control. For the demo,
show that gates, billing, safety, quality, and closeout depend on required
proof. Evidence actions are local/demo only; production file storage is not
enabled.

Notification update: Command Center and the app shell now surface in-app alerts
and escalations. Keep the demo language clear: no email, SMS, Teams, Slack, or
push delivery is enabled.

RybexOS is ready for an executive walkthrough of the complete D5O operating
model. The demo should feel like a controlled subcontractor operating system,
not a catalog of software screens.

## Positioning

Opening statement:

“RybexOS is the operating system for running subcontracted infrastructure work
with discipline from pursuit through closeout. It does not just track projects;
it encodes how the work should be run.”

Closing statement:

“This is the difference between managing projects with spreadsheets and running
work through a controlled operating model.”

## Demo Conditions

- Start at `/command-center`.
- Use `/pilot` when the audience needs a guided operating slice instead of the full app tour.
- Use the visible demo role context in the left navigation.
- Treat all records as typed seed/demo data.
- Do not claim live database persistence, real authentication, accounting sync, or external integrations.
- If browser screenshot QA is unavailable, use the local visual QA workaround in `docs/local-visual-qa-runbook.md`.

Pilot Mode note: `/pilot` packages the three verified workflow completion proofs into one guided path. It is a controlled internal pilot candidate, not production ready.

Manual pilot usability note: the Billing Backup task now shows a visible guided completion flow, so users can complete the first pilot task without hunting through details.

## What The Demo Must Prove

- RybexOS moves work through Signal -> Decision -> Action -> Evidence -> Gate Movement.
- Local workflow transactions can complete selected actions and show outcome/gate movement without production persistence.
- D5O phase control is visible from pursuit through Optimize.
- Go/no-go discipline protects estimating resources and pursuit quality.
- Contract baseline must be controlled before mobilization.
- Field readiness prevents unsafe, unplanned, or commercially exposed starts.
- Daily field control captures proof, quantities, delays, safety, quality, and issue prompts.
- Change, billing, and cash-at-risk visibility protect margin recovery.
- Closeout and Optimize turn evidence into acceptance, payment, retainage release, and better future work.

## Recommended Flow

1. Command Center - show stage/gate health, next best action, and top leadership priorities.
2. Pipeline - show pursuit gate, go/no-go decision, and required evidence.
3. Projects - show D2 gate blocker, owner, and next movement.
4. Mobilization - show D3 field-start approve/hold logic.
5. Field Execution - show daily evidence and RFI/change prompts.
6. RFIs/Submittals and Changes - show information blockers and recovery actions.
7. Billing - show approved-not-billed changes, backup gaps, and cash at risk.
8. Safety and Quality - show corrective actions, inspections, tests, and punch evidence.
9. Closeout - show acceptance blockers, final billing, and retainage movement.
10. Optimize - show production variance and operating-model updates.
11. Admin / System Readiness - show seed mode, verification, and readiness posture.

## Workflow Story To Repeat

On every major page, narrate the same pattern:

- Signal: what triggered attention.
- Decision: what must be decided.
- Action: what the owner must do.
- Evidence: what proves the work is controlled.
- Gate movement: what status or D5O gate advances next.

This keeps the demo from becoming a screen tour.

## Simplified Demo Rule

Open with the top action. Do not scroll through every register.

Use:

- Stage
- Gate
- Blocker
- Action
- Evidence
- Next movement

Details are available below the fold or behind disclosure if the audience asks.

## Universal Page Simplification

Major pages now follow the same first-view contract:

- Stage / module header
- Next required actions
- Gate / workflow readiness
- Evidence required
- Active risks / escalations
- Details / records below the operating summary

For the demo, read the top summary first. It tells the audience where they are,
whether the work is ready, blocked, at risk, or complete, who owns the next
action, what evidence is needed, and where to resolve the issue. Use dense
tables and detailed panels only when the audience asks to drill down.

Latest comprehension QA:

- `docs/page-comprehension-qa-review.md`
- `docs/page-remediation-backlog.md`

Demo caveat: the simplified summaries are clear enough for review, and Billing,
Closeout, and Optimize now keep dense records behind progressive disclosure.
Avoid opening dense lower-page details unless the audience asks.

## End-User Action Workspace

Major pages now open as action workspaces instead of module dashboards. For the
demo, show only the default workspace first: one primary action, owner, due
date, critical blocker, evidence needed now, and Open details.

Use the details section only when the audience asks for registers, tables,
metrics, or supporting proof.

Visual acceptance update: the current demo should treat header links as utility
navigation. The orange primary action inside the action workspace is the action
to narrate.

## Known Limits To State Honestly

- Create workflows are guided previews and do not persist records yet.
- Workflow transactions update local browser state only; seed data and database records are not modified.
- RBAC is modeled and visible as a demo role context, but real login/session enforcement is not implemented.
- Data providers currently read seed data and are ready to be swapped for database repositories.
- Browser screenshot QA remains blocked in this Windows sandbox while the connector reports `windows sandbox failed: spawn setup refresh`.

## Local Visual QA Workaround

Before a stakeholder demo, run:

```powershell
npm run verify
npx playwright install chromium
npm run dev
npm run visual:capture
```

If automated capture fails because local browser tooling is unavailable, capture
screenshots manually into `visual-qa-output/manual/` and complete
`docs/visual-qa-report-template.md`.

Visual QA is considered approved only after the reviewer checks desktop, tablet,
and mobile layouts or explicitly accepts the manual fallback.

Latest screenshot review: `docs/visual-qa-review-report.md`.

Current demo recommendation: approved with minor caveats. The app is credible
for a stakeholder demo. Anchor each page on the stage/gate summary, next best
action, decision queue, or one operating proof point.

## Controlled Pilot Readiness

RybexOS is demo ready and a controlled internal pilot candidate. It is not
production-ready.

Use these docs before any pilot conversation:

- `docs/production-readiness-gap-review.md`
- `docs/pilot-readiness-scorecard.md`
- `docs/controlled-pilot-launch-plan.md`
- `docs/pilot-user-test-scripts.md`
- `docs/pilot-risk-register.md`

Pilot demo guidance:

- Say clearly that the first pilot should be internal only.
- Keep the scope to 1-2 projects and limited users.
- Do not include external GC/client access.
- Do not use sensitive production documents unless storage/RLS security is approved.
- Treat in-app notifications as pilot guidance only, not external delivery.
- Use Admin to show demo ready, controlled pilot candidate, and not production-ready status.

## Role-Based Validation

Role-based usability validation is complete. The supporting docs are:

- `docs/role-based-usability-audit.md`
- `docs/role-journey-map.md`
- `docs/user-knows-what-to-do-checklist.md`

Demo guidance by audience:

- Executive: stay on Command Center, Billing, Field Execution, Closeout, and Optimize. Show decisions, cash at risk, blocked work, and next movement.
- PM/operations: show Projects, Mobilization, Field Execution, Changes, Billing, and Closeout. Show assigned action, owner, due date, evidence, and gate movement.
- Field: show Field Execution and Daily Report. Show today’s work, quantity/evidence capture, and RFI/change prompts.
- Finance/admin: show Billing and Admin. Show billing blockers, lien waiver/retainage risk, route health, and seed/database-read boundaries.
- Safety/quality: show Safety, Quality, and Closeout. Show corrective actions, deficiencies, tests, punch, and acceptance evidence.

Avoid drilling into dense lower-page details unless the stakeholder asks. The role context bands and decision queues are the preferred demo anchors.

## Workflow Action Demo

The Command Center now includes `Act on the top workflow`, a transaction-enabled card for the highest leadership workflow.

Demo path:

1. Open `/command-center`.
2. Show the signal, owner, due date, and consequence.
3. Click the available workflow action.
4. Confirm the modal.
5. Show the success banner and updated card state.
6. Explain that local mode updates demo transaction state, while the Supabase write pilot is only used when explicitly enabled.

If the audience asks about evidence, say: evidence is modeled and locally actionable now. A narrow private Supabase Storage upload pilot exists for workflow evidence requirements, but production file management, signed URLs, RLS, malware scanning, and retention controls come later.

## User Workflow QA

User workflow QA now checks the major page CTAs against the no-dead-end standard:
each CTA must navigate, open/focus details, open a modal, start a transaction,
create a draft flow, or show clear feedback.

Latest result:

- `npm run user-flow:qa` covered 13 scenarios and 73 safe CTA checks.
- `docs/user-workflow-qa-report.md` records the scenario results.
- `docs/user-workflow-remediation-backlog.md` records remediation status.
- Current automated finding: no same-page no-change CTA failures in the primary user path.

CTA outcome clarity:

- `npm run cta-outcome:qa` checks whether important CTAs have understandable outcomes.
- Same-page details and workflow-section CTAs now expand/focus and highlight the target.
- Latest automated finding: no unresolved CTA outcome clarity issues across priority routes.

Task outcome contract:

- Founder-review failures are covered: Command Center no longer routes to a
  generic Projects page, and Pipeline no longer uses a generic `Open action
  details` outcome.
- Primary cockpit CTAs now use concrete task labels and land on a focused task
  panel with `You are here to`, owner, due date, blocker, evidence, and next
  step.
- Run `npm run task-outcome:verify` with the CTA QA checks before founder or
  executive review.

Workflow completion proof:

- Use `Add missing billing backup` from Command Center to show a complete
  action path.
- The flow lands on Billing, opens `You are here to: Add missing billing
  backup`, marks backup attached or waived, sends it to review, resolves the
  blocker, and shows local demo history.
- Run `npm run workflow-completion:qa` and
  `npm run workflow-completion:verify` before using this as the proof workflow.
- Explain plainly that completion state is local/demo; production persistence
  and file governance remain future hardening.
## Workflow Completion Demo Proofs

- Billing Backup Blocker -> Cash Recovery remains the first verified completion proof.
- Field Issue -> RFI / Change Escalation is the second completion proof and runs in local/demo state.
- The Field Execution proof shows an issue moving into RFI/change control with visible linked output, result banner, and history.
- Production persistence for the field issue proof is not enabled.
- Both proofs now run through the shared completion registry and definition-driven `WorkflowCompletionPanel`.
## Workflow Completion Proofs

- Billing Backup Blocker -> Cash Recovery remains the primary cash proof.
- Field Issue -> RFI / Change Escalation remains the field control proof.
- Closeout Requirement -> Acceptance / Final Billing Release is the third local/demo proof.
- The closeout proof shows evidence attached, review, blocker resolution, result banner, history, and local linked outputs.
- These flows are not production-backed and do not claim database persistence, production upload security, RLS, or final pilot readiness.
- Workflow completion persistence has an opt-in Supabase bridge for local pilot verification, but local/demo completion remains the default demo behavior.

Pilot Mode human-execution proof:

- Billing, Field Issue, and Closeout can now be completed from `/pilot` through visible guided controls.
- Field Issue requires and preserves an `Escalation note` before RFI/change control.
- Closeout requires and preserves a `Closeout evidence note` before evidence attachment.
- `npm run pilot-field-closeout:qa` proves Field and Closeout note save, state movement, history, result banners, return to Pilot Mode, and progress update.
## Workflow Editable Fields

Demo readiness now includes the Pilot Workflow Editable Field Contract. The three Pilot Mode workflows require visible saved inputs before completion actions unlock, and `npm run workflow-execution:qa` verifies the full human path from `/pilot`.

## Runtime Stability

Before demo or pilot review, run `npm run runtime:qa`. It checks the core Command Center, Pilot Mode, focused completion pages, Changes, and Closeout routes for hydration mismatch warnings, duplicate React keys, script-rendering warnings, and uncaught browser errors. Runtime stability fixes are documented in `docs/runtime-stability-fix.md`.

Manual runtime failure: Pilot progress hydration mismatch. Pilot Mode now renders deterministic baseline progress first, then applies local/demo completion progress after hydration. Run `npm run pilot-progress:qa` to prove `/pilot` has no progress-title hydration mismatch and still updates after the Billing workflow is completed.

## State Ownership Model

Server renders definitions/static shell. The client provider owns live completion state.

Pilot progress derives from provider state, local/demo persistence is adapter-driven, and no workflow completion DOM bridge is used. Run `npm run workflow-state:qa` before demo review.

## Pilot Slice Lockdown

The guided `/pilot` slice is locked to the three proven workflows only: Billing Backup Blocker -> Cash Recovery, Field Issue -> RFI / Change Escalation, and Closeout Requirement -> Acceptance / Final Billing Release.

Before demo or pilot review, run `npm run pilot:acceptance`. Use `npm run pilot:acceptance-visual` as the visual companion when screenshots are required. Local/demo remains the default, the DB bridge is opt-in, and the local dev runtime caveat is handled by running acceptance against the production build server.

Demo language: Controlled internal pilot candidate — not production ready.

## Workflow Business Outcomes

For Pilot Mode, do not stop the story at `resolved`. Show the business outcome record after completion: what process completed, what object moved, what inputs and references were captured, what remains unresolved, and what the next business step is. This is still local/demo unless database pilot mode is explicitly enabled.

## Billing v2 Blueprint Boundary

The Billing v2 blueprint now exists at `docs/billing-v2-gold-standard-workflow-blueprint.md`. It defines the future Billing Backup Blocker -> Pay Application Review Readiness process, but no Billing v2 implementation has occurred yet. Do not present Billing v2 as demo ready, pilot ready, production ready, or implemented functionality.

## D5O True Workflow Management Package Boundary

`docs/d5o-true-workflow-management-development-package.md` now defines the D5O True Workflow Management Development Package. `docs/billing-v2-enterprise-workflow-implementation-spec.md` now defines the Billing v2 Enterprise Workflow Implementation Specification.

This is specification only. No implementation occurred, and demo readiness is not expanded by these documents. Do not present Billing v2 as implemented, demo ready, pilot ready, production ready, or externally ready. The next step is manual review of the Billing v2 implementation spec before code is written.

Verification: `npm run d5o-workflow-package:verify`.

## Billing v2 Readiness Review Boundary

Billing v2 implementation readiness review completed in `docs/billing-v2-implementation-readiness-review.md`. The supporting implementation roadmap, data mapping, and QA plan are documented in `docs/billing-v2-implementation-build-plan.md`, `docs/billing-v2-data-model-mapping.md`, and `docs/billing-v2-qa-acceptance-plan.md`.

This is documentation-only. No implementation occurred, demo readiness is not expanded, and Billing v2 should not be presented as implemented, demo ready, pilot ready, production ready, or externally ready. The next step is to review the conditions and approve the build plan before code is written.

Verification: `npm run billing-v2:verify-readiness`.

## Billing v2 Engineering Readiness Boundary

Billing v2 engineering readiness guardrails now exist: ADRs, state transition matrix, command contract, UI wireframe spec, domain test plan, and a saved Phase 1A implementation prompt.

This is documentation-only. No implementation occurred, demo readiness is not expanded, and Billing v2 should not be presented as implemented, demo ready, pilot ready, production ready, or externally ready. The next step is manual review of the guardrails and then a domain-only Phase 1A implementation pass before any UI work.

Verification: `npm run billing-v2:verify-engineering-readiness`.

## Billing v2 Phase 1A Domain Boundary

Billing v2 Phase 1A domain layer now exists for future implementation work. It is not demo-facing functionality. No Billing v2 UI, route, Pilot Mode behavior, persistence, auth, RLS, Field workflow, or Closeout workflow changed.

Demo readiness is not expanded by Phase 1A. Continue to present Billing v2 as future user-facing work until a later accepted UI pass connects the domain layer to a visible workflow.

Verification:

```powershell
npm run billing-v2:qa-domain
npm run billing-v2:verify-domain
```

## Billing v2 Phase 1A Hardening Boundary

Billing v2 Phase 1A domain hardening is complete and documented in `docs/billing-v2-phase-1a-domain-review.md` and `docs/billing-v2-phase-1a-domain-implementation-report.md`.

The domain review is Accepted for Phase 1B UI, but Billing v2 is still not demo-facing functionality. UI is not implemented, routes are unchanged, and Pilot Mode is unchanged. Demo readiness is not expanded until a later accepted UI pass connects the domain layer to a visible workflow.
