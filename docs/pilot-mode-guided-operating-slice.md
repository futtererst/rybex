# Pilot Mode Guided Operating Slice

## Purpose

Pilot Mode gives a controlled internal user one guided path through the three proven RybexOS workflow completion proofs.

It is designed for focused pilot review. A user should not need to understand the full app before completing real operating work.

## Included Workflows

1. Add missing billing backup
   - Workflow: Billing Backup Blocker -> Cash Recovery
   - Route: `/billing?focus=billing-billing-backup-cash-recovery&pilot=1#focused-task`
   - Business value: unblocks pay application and cash recovery.

2. Escalate field issue
   - Workflow: Field Issue -> RFI / Change Escalation
   - Route: `/field-execution?focus=field-issue-escalation&pilot=1#focused-task`
   - Business value: moves a field issue into RFI/change control.

3. Complete closeout requirement
   - Workflow: Closeout Requirement -> Acceptance / Final Billing Release
   - Route: `/closeout?focus=closeout-requirement-final-billing-release&pilot=1#focused-task`
   - Business value: supports acceptance, final billing, and retainage release.

## Why These Three

These workflows prove the operating model across cash, field control, and closeout. They already have registered completion definitions, local/demo state transitions, result banners, history updates, and browser QA coverage.

## Difference From Full Navigation

The full app remains available. Pilot Mode is a guided entry path that shows only the three verified completion workflows, their current progress, and a direct CTA into the exact focused task.

## Local/Demo Behavior

Local/demo mode remains the default. Progress reads from browser-local workflow completion state. The `Reset Pilot Demo State` control resets only the three Pilot Mode workflow items.

## Database Completion Pilot Behavior

When `RYBEXOS_WORKFLOW_COMPLETION_STORE=database` is intentionally enabled with reviewed Supabase environment variables, Pilot Mode can show database pilot mode. The database bridge is opt-in and not production-ready.

## Not Production Ready

Pilot Mode does not enable production auth, RLS, external notifications, production file storage, signed URLs, malware scanning, or broad persistence. It is a controlled internal pilot candidate only.

## Pilot User Instructions

1. Open `/pilot` from Command Center.
2. Start with `Add missing billing backup`.
3. On Billing, complete the guided steps: mark backup attached, send to review, and resolve billing blocker.
4. Return to Pilot Mode.
5. Complete `Escalate field issue`.
6. Return to Pilot Mode.
7. Complete `Complete closeout requirement`.
8. Review the progress summary.

## Manual Pilot Failure: Billing Task Was Not Visibly Executable

Manual review found that routing from Pilot Mode to Billing was not enough. The user landed on the correct focused task but did not see an obvious executable workflow.

Fix: Billing now shows a guided completion flow above detailed records with visible steps, sequential buttons, disabled-step reasons, completion banner, and return-to-pilot path.

QA now checks this exact regression in `npm run pilot-mode:qa`.

## Pilot Mode Human-Execution Standard

Field Issue and Closeout now follow the same standard as Billing:

- Field Issue starts from `/pilot`, opens the Field Execution focused task, saves an `Escalation note`, creates an RFI/change control path, marks the issue controlled, resolves the issue, and returns to Pilot Mode as complete/resolved.
- Closeout starts from `/pilot`, opens the Closeout focused task, saves a `Closeout evidence note`, marks evidence attached, sends the item to review, resolves the blocker, and returns to Pilot Mode as complete/resolved.
- Saved notes remain visible and are recorded in local/demo completion history.
- `npm run pilot-field-closeout:qa` proves both paths from Pilot Mode.

## QA Proof Criteria

- `/pilot` renders exactly three workflow cards.
- Each card routes to the exact focused task with `pilot=1`.
- Each focused task renders its completion panel.
- Billing focused task renders `Complete billing backup task`.
- Billing can be completed through all three visible guided steps.
- Field Issue and Closeout render visible guided steps with editable notes.
- Field Issue and Closeout can be completed from Pilot Mode and update Pilot progress.
- Each focused task shows `Return to Pilot Mode`.
- Guardrails say not production ready.
- Reset is local/demo only.
## Editable Field Contract

Pilot Mode now requires real user-entered inputs before the three guided workflows can be completed. Billing, Field Issue, and Closeout each show required fields in the guided flow, keep saved values visible, write local history, and block the next action until required fields are saved.

## Runtime Stability

Pilot Mode and the three focused task routes are covered by `npm run runtime:qa`. The QA preloads demo completion state and fails on hydration mismatches, duplicate key warnings, React-rendered script warnings, and uncaught browser errors. This keeps Pilot Mode executable for a human user instead of merely passing scripted completion checks.

The former workflow completion script bridge is gone. Pilot progress and focused task controls now use `WorkflowCompletionProvider`; server renders definitions/static shell, the client provider owns live completion state, and local/demo persistence is adapter-driven.

## Manual Runtime Failure: Pilot Progress Hydration Mismatch

Manual review found the Pilot progress title could hydrate inconsistently: server markup showed `0 of 3 workflows complete`, while the first client render surfaced only `0`. Pilot progress now renders a deterministic baseline first, then loads local/demo completion progress after hydration. `npm run pilot-progress:qa` proves `/pilot` hydrates cleanly and updates to `1 of 3 workflows complete` after completing Billing from Pilot Mode.

## State Ownership Model

Server renders definitions/static shell. The client provider owns live completion state.

Pilot progress derives from provider state, and workflow completion controls call React handlers from the same provider. No DOM bridge is used.

## Pilot Slice Lockdown

Pilot Mode is locked to exactly three workflows for regression protection:

- Billing Backup Blocker -> Cash Recovery.
- Field Issue -> RFI / Change Escalation.
- Closeout Requirement -> Acceptance / Final Billing Release.

`npm run pilot:acceptance` is the required gate before demo or pilot review. `npm run pilot:acceptance-visual` is the visual companion. Local/demo remains default, database completion remains opt-in, and the local dev runtime caveat is addressed by the production build server acceptance runner.

Status: Controlled internal pilot candidate — not production ready.

## Business Outcome Summaries

After a Pilot workflow completes, the Pilot card shows the business outcome summary, next business step, historical record label, and whether the record is local/demo or database-backed. This makes the slice a guided operating path rather than a set of completed buttons.
