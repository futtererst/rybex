# ADR 0003: Billing v2 Commercial Review Simulation

## Status

Accepted for Billing v2 Phase 1 planning.

## Context

Billing v2 includes a handoff from the Billing / Commercial user to a commercial reviewer or Finance/Admin reviewer. Production auth, role enforcement, RLS, notification delivery, and durable review assignment are not part of Phase 1A. However, the business process still requires review before a blocker can be cleared.

If "send to review" only changes a status flag, the workflow will feel artificial and will not satisfy the enterprise workflow standard.

## Decision

Commercial review must be represented as a real local/demo review task object with approve, request changes, and reject decisions, even though production auth/RLS is not expanded.

- "Send to review" cannot simply change status.
- Sending to review must create a `BillingReviewTask`.
- The review task must identify assigned role, status, review package, decision note requirements, and next state.
- A review decision must be required before blocker clearance.
- Approval, request changes, and rejection must produce distinct events and historical entries.

## Consequences

- The workflow has a visible handoff and review object without expanding production authorization.
- Blocker clearance depends on business review, not only on user completion.
- Request changes and rejection become real states the workflow must handle.
- Future production review services can map to the same conceptual object.

## Risks

- Local/demo review simulation may be mistaken for role-secured production approval unless labeled.
- Review UI can become too large if all review metadata is shown at once.
- Implementation can overbuild assignment and notification mechanics before the pilot requires them.

## Acceptance Impact

Billing v2 is not accepted if the review step is only a status change. The workflow must create a visible review task and require an approved review decision before the billing blocker can clear.
