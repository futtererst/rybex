# ADR 0001: Billing v2 Local/Demo And Reference-First

## Status

Accepted for Billing v2 Phase 1 planning.

## Context

Billing v2 is intended to turn the existing Billing Backup Blocker proof into a true business workflow for a billing backup package. The current RybexOS maturity is controlled internal pilot candidate, not production ready. Production document storage, production pay application submission, external GC submission, and durable production controls are outside the approved Phase 1 scope.

If Billing v2 tries to look production-ready before the domain workflow is proven, the implementation can create false confidence around document custody, cash recovery, and formal billing submission.

## Decision

Billing v2 Phase 1 will be local/demo and reference-first.

- Evidence references must be structured records, not free-text only.
- Local/demo behavior must be clearly labeled wherever the workflow asks the user to capture or reference evidence.
- The workflow may reference documents, source records, daily reports, photo logs, supervisor confirmations, and product approvals in local/demo mode.
- The workflow must not claim production document upload, production document storage, production pay application submission, or external GC submission.
- Production persistence, secured document storage, RLS, signed URLs, file retention, and production pay app submission remain future work.

## Consequences

- Phase 1 can prove the business process before production storage is introduced.
- Users can still understand what evidence is required and where it is referenced.
- Local/demo output can generate outcome and historical records without pretending to be a production system of record.
- Future production work will need to map the reference-first model to durable storage and security controls.

## Risks

- Users may still interpret references as stored documents unless copy is explicit.
- A too-light evidence model could weaken the business process if references are not structured and visible.
- Later production storage work may require schema or service changes after the local/demo model is validated.

## Acceptance Impact

Billing v2 is accepted for Phase 1 only if users can see evidence requirements, enter structured references or waivers, understand local/demo limitations, and find those references in the outcome and historical record. It is not accepted if evidence is reduced to a general note or if the UI implies production document handling.
