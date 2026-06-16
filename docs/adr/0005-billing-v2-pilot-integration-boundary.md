# ADR 0005: Billing v2 Pilot Integration Boundary

## Status

Accepted for Billing v2 Phase 1 planning.

## Context

Pilot Mode already includes three locked workflows: Billing Backup Blocker to Cash Recovery, Field Issue to RFI / Change Escalation, and Closeout Requirement to Acceptance / Final Billing Release. The product direction is to improve Billing first and use that pattern later, not to redesign all Pilot Mode behavior at once.

Billing v2 must fit the accepted state architecture: server renders definitions/static shell, client provider owns live workflow state, persistence is adapter-driven, and Pilot progress derives from shared client state.

## Decision

Billing v2 may replace the existing Billing focused task experience at the current pilot route, but Pilot Mode structure must not be broadly refactored in Phase 1A.

- Existing Field and Closeout workflows are not refactored.
- Billing v2 must integrate without creating a parallel workflow engine.
- Existing `WorkflowCompletionProvider` remains the shared architecture boundary.
- Pilot card can show Billing v2 outcome after implementation, but broader Pilot redesign is out of scope.
- Phase 1A is domain-only and must not change Pilot Mode behavior.

## Consequences

- Billing v2 can become the gold-standard workflow without destabilizing the locked Pilot slice.
- The domain model can be prepared before UI and Pilot integration decisions.
- Field and Closeout remain untouched until Billing passes manual acceptance.
- Future Pilot updates can consume Billing v2 outcomes after the domain and UI are accepted.

## Risks

- Billing v2 may need careful adapter work later to avoid duplicating completion state.
- Pilot expectations may need a follow-up update once Billing v2 replaces the old focused task.
- A broad Pilot redesign could creep into Billing implementation unless Phase 1A boundaries are enforced.

## Acceptance Impact

Billing v2 Phase 1A is accepted only if it stays domain-only and does not alter Pilot Mode. Later Billing UI integration must reuse the shared workflow architecture and must not create a parallel workflow engine.
