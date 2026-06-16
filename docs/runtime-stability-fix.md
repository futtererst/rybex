# Runtime Stability Fix

## Observed Issue

Manual browser review exposed React hydration mismatch warnings on Command Center, Pilot Mode, and focused workflow completion pages. The visible mismatch came from completion panels that rendered deterministic markup on the server, then changed `data-ready`, runtime binding attributes, and history text through client-side script fallback code.

The same review also exposed React warnings for script tags rendered inside React components and duplicate key warnings in change-control and closeout lists.

## Root Causes

- Workflow completion panels rendered executable script tags and mutated DOM after hydration.
- Pilot progress rendered a second script fallback even though React state already handled progress updates.
- Focused task state read browser URL state during initial client render.
- Local completion state read `localStorage` during the first client render.
- Several lists used IDs that are not unique after records were merged across collections.

## Fix Applied

- Removed React-rendered script tags from completion and pilot progress UI.
- Disconnected the obsolete workflow transaction runtime script from the app shell.
- Replaced the temporary runtime bridge with `WorkflowCompletionProvider`, a React client provider that owns live completion state without rendering scripts or binding DOM controls.
- Updated `npm run dev` to use the webpack-backed Next dev runner. The Turbopack dev path in this environment was leaving client controls inconsistently bound during manual browser review.
- Deleted the public workflow completion script bridge and added verifier checks to prevent `next/script`, `<Script>`, or `workflow-completion-dom-bridge.js` from returning to the layout.
- Moved Pilot Mode progress derivation into the same provider state used by the workflow completion panel.
- Made focused task routing and local completion state load after hydration.
- Standardized workflow completion history count rendering as `0 event(s)`.
- Added stable composite keys in known duplicate change-control and closeout render paths.
- Replaced time-based bridge history IDs with deterministic per-item sequence IDs.
- Added `runtime:qa` to fail on hydration, duplicate key, script-rendering, and uncaught runtime warnings.
- Added `runtime:verify` for static guardrails.

## Routes Tested

- `/command-center`
- `/pilot`
- `/billing?focus=billing-billing-backup-cash-recovery&pilot=1#focused-task`
- `/field-execution?focus=field-issue-escalation&pilot=1#focused-task`
- `/closeout?focus=closeout-requirement-final-billing-release&pilot=1#focused-task`
- `/changes`
- `/closeout`

## Manual Runtime Failure: Pilot Progress Hydration Mismatch

Manual browser review found `/pilot` still hydrating with mismatched progress text. The server rendered `0 of 3 workflows complete`, while the client hydration path reported only `0` for the progress title around `PilotProgressSummary`.

Root cause: Pilot progress used browser-local completion state and a fallback progress updater close to the hydration boundary. The title was also rendered from split JSX text nodes instead of one shared formatted string.

Fix: `PilotProgressSummary` now renders a deterministic baseline on the server and first client render, using `formatPilotProgressTitle(progress)` for the full title string. Browser-local completion state is loaded by the completion provider after hydration, and Pilot progress derives from that provider state.

Regression: `npm run pilot-progress:qa` opens `/pilot`, fails on hydration mismatch warnings, completes the Billing pilot workflow, returns to Pilot Mode, and verifies the progress title updates to `1 of 3 workflows complete`.

## State Ownership Model

Server renders definitions/static shell. The client provider owns live completion state.

Local/demo persistence is adapter-driven. Pilot progress derives from provider state. Workflow completion controls call React handlers from `useWorkflowCompletion()`. No DOM script bridge is used for workflow completion behavior.

## Remaining Limitations

This is a runtime stability fix only. It does not add production persistence, RLS, production auth, external notifications, or new workflow scope.
