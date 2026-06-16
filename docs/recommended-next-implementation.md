# Recommended Next Implementation

Recommendation: Build a narrow **Workflow Transactions MVP** in seed-backed/local state first, then persist it.

Do not continue broad persistence, auth, notifications, master data, or integrations before the interaction model for workflow movement is proven.

## Options Evaluated

| Option | Evaluation | Recommendation |
| --- | --- | --- |
| A. Continue persistence Phase 3 | Valuable, but risky before the app proves how users complete workflow actions. Adding more tables now could lock in a data model before transaction behavior is clear. | Not next. Keep persistence ready, but pause broad schema expansion. |
| B. Implement workflow transactions in seed mode first | Best fit for the current product claim. RybexOS now communicates Signal -> Decision -> Action -> Evidence -> Gate Movement. The next proof is letting users complete those movements safely in a reversible demo/local state. | Recommended. |
| C. Add auth/RBAC | Necessary for production, but premature before mutating workflows exist. Auth without real transactions mostly protects read-only demo pages. | Defer until transaction MVP is defined. |
| D. Add file/attachment management | Critical for production evidence, but should follow transaction design so files attach to the right events, records, and gates. | Defer. |
| E. Add notification/escalation engine | Notifications should be generated from durable workflow states. Current workflow queues are derived display logic. | Defer. |
| F. Build master data | Important for scale, but can distract from the core operating claim. | Defer. |
| G. Improve visual polish further | The visual layer is demo-credible. The product now needs interaction depth, not more surface polish. | Defer unless stakeholder review finds high-severity visual issues. |

## Why Workflow Transactions Next

The core product claim is not that RybexOS has pages. The claim is that it moves subcontracted infrastructure work through controlled decisions.

The app now shows this pattern:

Signal -> Decision -> Action -> Evidence -> Gate Movement.

The next step is proving the pattern can be completed by a user:

- approve go/no-go
- hold go/no-go
- approve or hold D2 gate
- approve or hold D3 field start
- submit daily report
- create RFI from field signal
- create change event from field signal
- resolve safety action
- resolve quality deficiency
- submit closeout package
- publish lessons learned

## MVP Boundary

Keep the first transaction implementation seed-backed/local-state only.

It should:

- not require database env vars
- not enable database runtime
- not add auth
- not create broad write persistence
- not remove seed mode
- not attempt every workflow at once

## Recommended First Slice

Build transaction infrastructure and wire it into 5 high-value workflow moments:

1. Go/no-go approval or hold.
2. D2 gate approval or hold.
3. D3 field-start approval or hold.
4. Daily report submission with RFI/change prompt.
5. Resolve a safety or quality action.

This slice proves leadership decisions, project setup control, field readiness, D4 evidence, and corrective action movement.

## Done Criteria

The next implementation is successful when:

- transaction types and config exist
- each transaction defines required inputs, evidence, permission, audit event, status movement, and failure states
- selected pages show a working transaction panel
- transaction results update local/demo UI state during the session
- seed mode remains default
- no database/auth/runtime behavior changes
- verification and route smoke checks pass

## What Comes After

After the Workflow Transactions MVP is proven:

1. Persist the same transaction model for D1/D2 only.
2. Add audit persistence and status history for those transactions.
3. Add auth/RBAC enforcement for transaction writes.
4. Expand to D3/D4 and commercial workflows.
5. Add attachments where evidence is required.
