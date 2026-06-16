# Workflow Action Completion Debug

Date: 2026-06-11

## Route Tested

Primary route: `/command-center`

Supporting routes to verify after the fix:
- `/pipeline`
- `/projects`
- `/mobilization`
- `/field-execution`
- `/changes`
- `/billing`
- `/closeout`
- `/admin`

## Workflow Card Tested

Command Center top leadership workflow from `deriveOperatingWorkflows()`:
- Render source: `workflowSummary.topLeadershipWorkflows[0]`
- Card component: `WorkflowActionCard`
- Transaction component: `WorkflowTransactionPanel`

## Failure Category

Primary category: `no action rendered`

The Command Center top experience showed:
- `StageGateSummary`
- `NextBestAction`
- `DecisionQueue`

Those elements explained the workflow and linked to modules, but they did not expose the transaction-enabled workflow card in the main leadership path. The user could see the signal but could not complete the workflow action directly from Command Center.

Secondary category: `validation too strict`

`applyWorkflowTransaction()` required at least one evidence item to be confirmed. That is too strict for the MVP because evidence upload is intentionally not implemented. A user could be blocked from completing a valid demo transaction simply because evidence remained pending.

## Diagnostic Matrix

| Check | Result Before Fix | Result After Fix |
| --- | --- | --- |
| Action buttons visible | Not visible in Command Center primary workflow path | Visible on the new top workflow action card |
| Buttons enabled | Not applicable | Enabled when demo role has permission |
| Modal opens | Not reachable from Command Center top path | Opens from workflow action buttons |
| Modal submit works | Could be blocked by evidence validation | Notes are required; evidence can remain pending |
| Local state updates | Existing local overlay existed | Existing overlay is used after successful transaction |
| Database write attempted | Only when DB transaction store is enabled | Same behavior preserved |
| Server action error shown | Existing error path existed | Missing secret message is now explicit |
| UI success/error shown | Existing message path existed | Mode label, success, and error messages are clearer |
| Admin diagnostics changed | DB mode only | DB counts update only when DB writes are enabled and configured |

## Fix Applied

- Added an actionable `WorkflowActionCard` to `/command-center` directly under the leadership priority queue.
- Kept the existing seed/local transaction overlay behavior.
- Relaxed local transaction validation so missing evidence confirmation does not block the MVP.
- Added a visible transaction mode label:
  - `Local demo transaction`
  - `Supabase transaction pilot`
- Added a clear unavailable-action explanation when no action can be completed.
- Added `WorkflowTransactionRuntime`, a document-level action fallback mounted in the app layout. It opens the modal, calls `/api/workflow-transactions`, updates local transaction storage, and renders the outcome when React synthetic click binding is unavailable.
- Added `/api/workflow-transactions` so client UI can call the server-side transaction commit path without importing the server action into the client component.
- Updated the database missing-secret error:
  - “Database transaction store is enabled, but server-side Supabase secret is missing. Switch to local transaction store or configure SUPABASE_SECRET_KEY.”
- Added `npm run workflow:verify-actions` to verify mappings and local action wiring.

## Verified Result

Playwright interaction check completed:

```text
Local workflow transaction applied. Database transaction store is not enabled. D2 approved for D3 mobilization planning. Move into D3 mobilization planning with baseline artifacts attached.
```

This confirms:

- an enabled workflow action is visible on Command Center
- clicking opens the transaction modal
- confirming applies the transaction
- success feedback renders on the card
- local transaction state is written to browser storage

## How to Complete a Workflow Action

1. Open `/command-center`.
2. Find `Act on the top workflow`.
3. Click an action button such as `Resolve`, `Approve`, `Hold`, `Create RFI`, or `Create Change`.
4. Review the modal.
5. Add or keep transaction notes.
6. Leave evidence checked if reviewed, or uncheck items and record pending evidence in notes.
7. Confirm the action.
8. Confirm the success banner and updated workflow state.
9. Open transaction history for the card when available.

## Local Mode Behavior

Local mode updates only browser-local workflow transaction state.

Expected:
- Card updates visually.
- Outcome banner appears.
- Transaction history appears.
- Seed data remains unchanged.
- Reset demo transaction state clears the local overlay.

## Database Mode Behavior

Database workflow transaction writes happen only when:

```text
RYBEXOS_DATA_SOURCE=database
RYBEXOS_WORKFLOW_TRANSACTION_STORE=database
SUPABASE_SECRET_KEY is configured server-side
```

Expected write path:
- `workflow_transactions` insert
- `workflow_instances` status/resolution update
- `audit_events` insert
- `status_history` insert when state changes
- optional `workflow_evidence_requirements` update

If the secret is missing, the UI must show a clear error and must not fake success.

## Verification

Run:

```powershell
npm run workflow:verify-actions
```

This checks:
- Workflow action mappings exist.
- Workflow cards render transaction panels.
- The modal submits MVP transaction fields.
- Local overlay update paths exist.
- Evidence upload/checkoff is not required to complete the MVP transaction.

For full app confidence, also run the standard verification and visual capture commands.
