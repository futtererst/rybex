# ADR 0004: Billing v2 Evidence Reference Model

## Status

Accepted for Billing v2 Phase 1 planning.

## Context

The Billing v2 workflow depends on evidence: signed T&M ticket, daily report reference, photo log reference, supervisor confirmation, product approval backup, and related change event where applicable. Evidence is not optional decoration; it is the business reason the pay application can move toward review readiness.

If evidence is represented as a general note, the app cannot show what is missing, what was waived, why it was waived, or what appears in the historical record.

## Decision

Billing v2 Phase 1 must use structured evidence references.

- Evidence requirements are first-class items.
- Each evidence item must have status, reference text, required flag, and waiver behavior.
- Required evidence must be satisfied by referenced, attached, verified, or waived-with-reason status.
- Waiver reason is required before a required evidence item can be waived.
- Evidence cannot be represented only by a general note.
- Outcome and historical records must include the evidence requirement status and saved reference or waiver reason.

## Consequences

- Package readiness can be computed consistently.
- Users can see exactly which evidence item blocks review.
- The historical record can explain why a billing blocker was cleared.
- Future production upload/storage can attach to evidence items rather than replacing a generic note.

## Risks

- Too many evidence controls can make the screen dense.
- The model must distinguish local/demo references from production attachments.
- Optional evidence must not weaken required evidence gates.

## Acceptance Impact

Billing v2 is accepted only if evidence requirements are visible, structured, saved, validated, and carried into outcome and historical records. Missing required evidence must block commercial review unless waived with a reason.
