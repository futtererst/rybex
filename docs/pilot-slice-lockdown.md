# Pilot Slice Lockdown

## Purpose

The Pilot Mode slice is locked to protect the three proven workflows from regression before demo or controlled internal pilot review.

## Included Workflows

- `billing-backup-cash-recovery`
- `field-issue-escalation`
- `closeout-requirement-final-billing-release`

## Excluded Workflows

- Any workflow not registered in Pilot Mode.
- External notifications.
- Production file upload/security.
- Full RLS.
- Production auth/login.
- External GC access.

## Current Architecture State

- Workflow completion state is owned by `WorkflowCompletionProvider`.
- Server renders definitions/static shell.
- Client provider owns live completion state.
- Local/demo persistence is adapter-driven.
- Pilot progress derives from the same provider state as `WorkflowCompletionPanel`.
- The DOM/script runtime bridge is removed.

## State Ownership Model

Server renders stable workflow definitions and static shells. The client provider owns live workflow execution state, saved editable fields, evidence state, linked outputs, result banners, history, reset behavior, and Pilot progress.

## Local/Demo Behavior

Local/demo mode remains default. Saved field values and workflow state persist through browser local/demo storage and are reset only through Pilot Demo reset.

## Database Bridge Status

The Supabase workflow completion persistence bridge remains opt-in. It is not the default and is not production persistence.

## Runtime Caveat

Local Next dev runtime in this environment has shown unreliable client handler binding during headless inspection. The locked acceptance gate uses a production build server because that runtime is stable and clean.

## What `pilot:acceptance` Proves

- All three Pilot workflows are human-executable.
- Editable fields save visibly.
- Required fields gate downstream actions.
- Pilot progress updates and rehydrates.
- Runtime QA catches hydration, script-tag, duplicate key, `getSnapshot`, and maximum update-depth warnings.
- User flow and CTA outcome QA still pass.
- Full static verification still passes.

## What It Does Not Prove

- Production readiness.
- Production auth/login.
- Full RLS.
- Production file security.
- External notifications.
- External user access.
- Broad database persistence.

## Future Change Rules

- Do not add a fourth workflow to Pilot Mode without updating the acceptance gate.
- Do not bypass `WorkflowCompletionProvider`.
- Do not reintroduce a DOM/script bridge.
- Do not remove editable field gating.
- Do not route Pilot workflow CTAs to generic module pages.
- Do not mark this slice production-ready.

## Regression Risks Guarded

- Hydration mismatch.
- Script-tag runtime warning.
- Duplicate React keys.
- `useSyncExternalStore` snapshot warning.
- Lost editable fields.
- Ungated completion actions.
- Pilot progress drift.
- Generic or vague CTAs.
- Missing focus metadata.
- Workflow completion state split across multiple owners.

## Business Outcome Record Guard

The locked slice now requires each completed workflow to produce a business outcome record. The record must show the process completed, business object moved, saved inputs, evidence/document references, linked outputs, business impact, remaining blockers, next business step, and historical reference label.

`npm run workflow-outcomes:qa` and `npm run workflow-outcomes:verify` guard this layer, and `npm run pilot:acceptance` includes the outcome QA.
