# ADR 0002: Billing v2 Domain State Machine

## Status

Accepted for Billing v2 Phase 1 planning.

## Context

The prior workflow proof showed strong mechanics, but a future Billing v2 implementation could regress into button-driven UI behavior if business rules are owned by components. Billing v2 must prove that a real business object moves through enforceable states before screen work starts.

The key invariant is commercial: the billing blocker cannot be cleared until the backup package is ready, commercial review has approved it, and the user has entered a resolution note.

## Decision

Billing v2 must be implemented as a domain state machine with commands, guards, events, state transitions, and tests before UI work begins.

- UI cannot own business rules.
- Commands must enforce state and data guards.
- Clear blocker cannot be allowed unless commercial review is approved.
- Package readiness must be computed by domain logic, not by button visibility alone.
- Domain events must record meaningful business actions.
- Domain tests must prove invariants before any Billing v2 UI implementation begins.

## Consequences

- Phase 1A becomes a domain-only implementation pass.
- UI work in Phase 1B can render domain state instead of re-creating business rules.
- QA can test the workflow without relying on browser-only behavior.
- The domain model can support Pay App 003 demo data while remaining reusable for other pay applications.

## Risks

- The domain layer may feel abstract if it is not tied to the existing WorkflowCompletionProvider boundary.
- Overbuilding a separate engine would fragment the accepted workflow architecture.
- Too much schema thinking in Phase 1A could distract from local/demo domain proof.

## Acceptance Impact

Billing v2 implementation cannot begin with UI components. Phase 1A must first produce a tested domain state machine that proves readiness gating, review gating, evidence waiver rules, blocker clearance rules, outcome generation, and historical record generation.
