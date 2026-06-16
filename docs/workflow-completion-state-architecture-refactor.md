# Workflow Completion State Architecture Refactor

## Current Failure Symptoms

Manual and browser QA exposed recurring state-boundary failures in the Workflow Completion and Pilot Mode layer:

- React script-tag warning from the workflow completion bridge.
- Hydration mismatch in workflow completion and Pilot progress UI.
- Local/demo overlays replacing registered demo items.
- A runtime bridge was needed to keep workflow controls bound.
- `useSyncExternalStore` warned that `getSnapshot` should be cached.
- QA passed while manual use still exposed unclear or unstable behavior.

## Root Architectural Problem

Workflow state was split across server-rendered page data, client-only localStorage overlays, a DOM bridge, Pilot progress derivation, workflow panels, and QA-only runtime behavior. No single owner controlled live workflow execution state.

## State Ownership Model

State ownership model: server renders definitions/static shell, client provider owns live completion state.

Server renders definitions/static shell. Client provider owns live completion state.

The new owner is `WorkflowCompletionProvider`. It owns:

- completion item state for registered workflows
- saved editable field values
- linked output records
- history entries
- result banners
- Pilot Mode progress derivation
- reset behavior
- adapter hydration after React mounts

## Server / Client Boundary Rules

- Server render uses registry definitions and deterministic default states only.
- The first client render matches the server render.
- Browser state is loaded only after hydration.
- No component reads localStorage or `window` during render.
- No DOM script bridge binds workflow controls.
- No `Date.now()`, `Math.random()`, or generated IDs are used for SSR-visible state.

## Provider / Store Design

`WorkflowCompletionProvider` uses a reducer and exposes `useWorkflowCompletion()`:

- `getCompletionItem(workflowId)`
- `getSavedFields(workflowId)`
- `getAvailableActions(workflowId)`
- `getPilotProgress()`
- `getPilotWorkflowStatus(workflowId)`
- `saveField(workflowId, fieldId, value)`
- `applyAction(workflowId, actionType, payload?)`
- `resetWorkflow(workflowId)`
- `resetPilotWorkflows()`
- `hydrateFromAdapter()`
- `isHydrated`
- `mode`

UI components call provider actions directly. Buttons are React-controlled, not bridge-controlled.

## Local / Demo Adapter Behavior

Local/demo persistence is adapter-driven. The adapter loads saved state from localStorage only inside client lifecycle, merges overlays onto registry definitions, saves reducer snapshots after hydration, and clears only pilot workflows during Pilot reset.

## Database Adapter Behavior

The Supabase completion persistence bridge remains opt-in and is not expanded in this pass. Database mode remains an adapter path and is not the default.

## Pilot Mode Progress

Pilot progress derives from provider state. It no longer has its own localStorage reader, local store subscription, or DOM refresh path.

## Hydration Safety Rules

- Registry defaults are the initial state.
- Saved local/demo state is applied after hydration.
- First render text stays stable.
- History timestamps for local/demo actions are deterministic.
- Runtime QA fails on hydration mismatch, script warning, duplicate key warning, `getSnapshot` warning, and maximum update depth errors.

## Migration Plan

1. Add provider, reducer, state model, and local/demo adapter.
2. Move completion panels and Pilot progress to `useWorkflowCompletion()`.
3. Retire the DOM runtime bridge.
4. Keep legacy local store helpers only for compatibility reads.
5. Add workflow-state QA and verification.

## QA Strategy

`workflow-state:qa` completes all three Pilot workflows through visible UI controls, verifies Pilot progress after each completion, reloads `/pilot` to verify safe rehydration, and resets Pilot demo state.

## Out of Scope

- New workflows.
- New modules.
- Broad persistence changes.
- RLS.
- Auth changes.
- Production readiness claims.

## Pilot Slice Lockdown

The provider/reducer architecture is now guarded by the Pilot acceptance gate. `npm run pilot:acceptance` runs the production-build-safe regression suite for the three locked workflows, and `npm run pilot:acceptance-visual` captures the visual companion output.

The local dev runtime caveat remains documented because this environment showed unreliable handler binding under headless local dev inspection. The acceptance path uses the production build server. Status remains Controlled internal pilot candidate — not production ready.
