# Billing v2 Data Model Mapping

## Purpose

This document maps Billing v2 conceptual objects to current and future data structures. It is a planning artifact only and does not add schema, persistence, auth, RLS, routes, runtime behavior, or UI.

## Mapping Summary

| Conceptual Object | Current Existing Table/Type If Available | Future Table/Type If Needed | Local/Demo Representation | Supabase Pilot Representation | Production Representation | Implementation Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| BillingBackupPackage | Current seed/domain concepts: `payApplications`, `billingBackupItems`, `WorkflowCompletionItem`; schema plan includes `pay_applications` and `billing_backup_items`. | `billing_backup_packages` or package metadata on `workflow_instances` linked to `billing_backup_items`. | Object inside workflow completion state with package fields, readiness status, review status, and resolution status. | `workflow_instances` with `source_record_type=billing_backup_item`, metadata for package fields, linked `workflow_evidence_requirements`. | Durable package table linked to pay application, backup item, evidence, review, audit, and status history. | Start local/demo. Use current billing backup item and pay app seed data. Do not add durable package table until schema mapping is approved. |
| BillingEvidenceRequirement | Current evidence model and `workflow_evidence_requirements`; schema plan includes evidence requirements and attachments. | Billing-specific evidence requirement policy or generic `evidence_requirements`. | Array of requirement objects attached to package state. | `workflow_evidence_requirements` rows linked to workflow instance and source billing item. | Durable evidence requirement table with policy, status, verifier, and attachment/reference links. | Reuse current evidence requirement shape first; keep upload optional/future. |
| BillingEvidenceReference | Current saved field/evidence reference in local workflow outcome; future data model package includes `evidence_references`. | `evidence_references`, `attachments`, `entity_attachments`. | Saved reference text keyed by requirement/package and included in outcome/historical records. | Metadata on completion transaction or future `evidence_references` rows if available. | Durable evidence reference rows linked to package, requirement, attachment/source record, actor, and timestamp. | Implement reference-first. Avoid production upload/storage claim. |
| BillingReviewTask | Current completion registry has send-to-review state but no full review task object. Future package lists `workflow_tasks`, `review_tasks`, `workflow_reviews`. | `review_tasks` or `workflow_tasks` linked to workflow instance/package. | Local package review task object with assigned role, owner, status, due date, and package summary. | `workflow_instances` or `workflow_tasks` metadata if schema exists; otherwise local/demo only. | Durable review task table with role assignment, status, decision linkage, audit, and notifications. | Simulate locally in first build. Do not create full review service unless separately scoped. |
| BillingReviewDecision | Current completion action can move review state, but no explicit decision object. Future package lists `review_decisions`, `approval_events`. | `review_decisions` and/or `approval_events`. | Local decision object: approve, request_changes, reject, note, actor, timestamp. | Completion transaction metadata or `review_decisions` if available. | Durable decision table linked to review task, actor, role, decision note, state transition, audit event. | Required for Billing v2 local/demo because blocker clearance depends on approval. |
| BillingBlockerResolution | Current completion terminal transition and outcome generation. Future package lists `workflow_state_transitions`, `workflow_transactions`, `status_history`. | `workflow_state_transitions` or specialized resolution record if needed. | Local resolution object with resolution note, clearedBy, clearedAt, from/to state, remaining blockers. | `workflow_transactions`, `audit_events`, `status_history`, and outcome metadata. | Durable resolution/status transition linked to package, review approval, evidence status, audit, and pay app readiness. | Implement as package state transition plus outcome record; do not mutate production pay app status in first build. |
| BillingOutcomeRecord | Current `WorkflowOutcomeRecord` and outcome panels exist. | `workflow_outcome_records`. | Generated outcome record in provider/local adapter state. | Outcome metadata on completion event or future outcome table. | Durable outcome record table linked to package, workflow instance, pay app, evidence, review decision, and audit. | Reuse existing outcome model and extend for review decision. |
| BillingHistoricalRecord | Current historical record panel and local history exist; future package lists `workflow_historical_records`, `audit_events`, `status_history`, `activity_events`. | `workflow_historical_records` or aggregate view over audit/status/activity/outcome records. | Local history plus historical record panel containing inputs, evidence references, review task, decision, transitions, outcome, mode. | `audit_events`, `status_history`, `workflow_transactions`, and outcome metadata. | Durable referenceable record with retention, audit, role access, and document links. | Generate visible local/demo historical record first; production durability is future hardening. |

## Current Schema Notes

- `docs/database-schema-plan.md` already identifies `pay_applications`, `billing_backup_items`, `workflow_instances`, `workflow_transactions`, `workflow_evidence_requirements`, `audit_events`, and `status_history`.
- `docs/seed-to-database-mapping.md` maps `payApplications` to `pay_applications` and `billingBackupItems` to `billing_backup_items`.
- `docs/data-repository-contract.md` describes workflow transaction reads/writes and evidence requirement reads/writes.
- Current local/demo completion state already supports saved fields, history, result, and outcome records.

## Recommendation

Implement Billing v2 first as a local/demo package object layered on the existing workflow completion provider/adapter. Map the package to current billing backup item and pay application seed data. Do not add new tables in the first implementation unless a separate schema review approves them.

No Billing v2 implementation occurred in this data model mapping.

## Engineering Guardrail Update

Billing v2 Phase 1A must use this mapping as a domain-model boundary, not as permission to add tables. The first implementation pass is local/demo domain only: state machine, commands, guards, events, structured evidence references, review task object, outcome record, and historical record.

Do not add durable schema, persistence adapters, auth/RLS, production document storage, or Pilot Mode integration in Phase 1A. Do not create a parallel workflow engine. Existing `WorkflowCompletionProvider` remains the shared architecture boundary for later integration. Demo data may use Pay App 003, but domain logic must support any package.
