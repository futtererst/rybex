# Workflow Completion Standard

## Why Standardization Was Needed

The first two completion proofs proved that RybexOS can move work forward:

- Billing Backup Blocker -> Cash Recovery.
- Field Issue -> RFI / Change Escalation.

Both flows worked, but the implementation needed a shared definition model so future workflows can be added by configuration instead of one-off component logic.

## Completion Definition Model

Each completion workflow is registered in `lib/d5o/workflow-completion/workflow-completion-registry.ts`.

Each definition includes:

- workflow id;
- source module and source record;
- start state and terminal states;
- allowed states;
- action definitions;
- required evidence;
- linked output types;
- permission requirements;
- notification and audit behavior;
- route target and focus key;
- QA selectors and QA contract;
- deterministic demo seed data.

## State / Action / Transition Contract

Each action defines:

- `fromStates`;
- `toState`;
- required permissions;
- whether reason/evidence is required;
- optional linked output creation;
- evidence/notification updates;
- result and blocked messages;
- QA selector.

The completion service loads the definition, validates the current state, applies the transition, creates linked output records when configured, writes local history, and returns the result banner message.

## Local/Demo Store Behavior

The local store remains the default. It stores:

- updated completion item snapshots;
- history by completion item id;
- registered demo items from the registry;
- scoped or full reset support.

It does not persist production records.

## Database Pilot Store Behavior

`RYBEXOS_WORKFLOW_COMPLETION_STORE=database` enables an opt-in Supabase pilot only when `RYBEXOS_DATA_SOURCE=database` is also set.

The pilot writes completion events through server-side code to existing workflow tables:

- `workflow_transactions`;
- `workflow_instances`;
- `workflow_evidence_requirements`;
- `audit_events`;
- `status_history`.

Completion-specific data is labeled with `rybexos_completion_pilot=true`. RLS is not enabled, linked outputs are pilot metadata, and local/demo mode remains the default.

## Pilot Mode Guided Slice

`/pilot` packages the three registered proof workflows into a guided operating slice. It uses the same completion registry, QA contracts, and local/demo store, then routes each workflow card to its exact focused task with `pilot=1` so users can return to Pilot Mode.

## UI Rendering Contract

`WorkflowCompletionPanel` renders from the workflow definition:

- current state;
- facts from the current item;
- available and configured actions;
- evidence requirements;
- linked outputs;
- history;
- result banner.

Components should not fork into bespoke workflow-specific panels unless the workflow has truly unique interaction needs.

## Manual Pilot Usability Guardrail

The Billing Backup pilot task now renders `GuidedCompletionFlow` above dense details. A user landing from `/pilot` sees `Complete billing backup task`, then follows three visible steps: `Mark backup attached`, `Send to review`, and `Resolve billing blocker`.

This guardrail exists because a prior technically passing QA flow still failed manual review: the user landed on Billing but did not see an executable path. Browser QA now verifies the visible guided flow, step status changes, result banner, return to Pilot Mode, and updated Pilot progress.

Field Issue and Closeout now use the same human-execution standard. Their guided flows include visible note fields, saved-note confirmation, sequential action buttons, disabled-step reasons, result banners, local history, and Pilot Mode progress checks.

Future completion workflows should not be considered pilot-ready until a normal user can complete the task from `/pilot` without knowing hidden selectors, registry structure, or implementation details.

## QA Contract

`lib/d5o/workflow-completion/qa-contracts.ts` exposes:

- `getCompletionQaContract(workflowId)`;
- `getAllCompletionQaContracts()`.

The browser QA scripts still perform full interaction proof. `workflow-completion:qa-all` runs the registered proof scripts together.

## How To Add a Future Workflow

1. Add a registry entry.
2. Define states and terminal states.
3. Define actions and transitions.
4. Define route target and focus key.
5. Add QA selectors and a QA contract.
6. Add minimal task outcome wiring.
7. Add browser QA for the workflow.

## What Not To Do

- Do not create a second completion system.
- Do not hardcode transitions in UI components.
- Do not claim production persistence unless database writes exist.
- Do not skip browser QA.
- Do not add new workflows without a registry entry.

## Current Registered Workflows

- `billing-backup-cash-recovery`
- `field-issue-escalation`
- `closeout-requirement-final-billing-release`

## Known Limitations

- Completion state is local/demo by default.
- Field issue RFI/change outputs are demo linked records, not production records.
- Billing completion does not write pay application state to the database.
- Closeout completion updates local/demo evidence, closeout package output, and final billing release notes only.
- Database completion persistence is a narrow opt-in pilot and not production readiness.
- Production permission enforcement, RLS, audit persistence hardening, and notifications remain future work.

## Future Database Persistence Path

The registry gives the future database write path a stable contract:

- workflow id;
- source record;
- transition action;
- resulting state;
- linked output;
- evidence update;
- history/audit event.

The next persistence phase should write this definition-driven completion event model before expanding broad module CRUD.
## Editable Field Contract

The three Pilot Mode workflows now use a shared editable-field contract. Billing requires backup, evidence reference, and resolution notes. Field Issue requires escalation, control path, RFI/change details, control reason, and resolution notes. Closeout requires evidence, reference, and acceptance notes. Required fields stay visible, save into local/demo state, appear in history or summary, and block downstream actions until saved.

## State Ownership Model

Server renders definitions/static shell. The client provider owns live completion state.

Workflow completion panels, editable fields, history, result banners, and Pilot progress now consume `useWorkflowCompletion()`. Local/demo persistence is adapter-driven, and the database bridge remains an opt-in adapter path.
## Business Outcome Record Layer

Workflow completion now generates a business outcome record when a Pilot workflow reaches a terminal state. The record explains the business process completed, business object moved, saved inputs, evidence/document references, linked outputs, state change, business impact, remaining blockers, next business step, and historical record label.

The outcome layer is local/demo by default and database pilot metadata only when the opt-in completion bridge is configured. It does not claim production persistence or production readiness.
