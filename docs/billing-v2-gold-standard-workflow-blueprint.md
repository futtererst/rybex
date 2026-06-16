# Billing v2 Gold Standard Workflow Blueprint

## 1. Executive Summary

The Billing Backup workflow should guide a Billing or Commercial user from a blocked pay application item to a review-ready backup package. The workflow is not just about changing a status to resolved. It is about helping the user understand why Pay App 003 is blocked, document the missing backup, reference the evidence, send the package to a commercial reviewer, clear the specific billing blocker, and leave behind a historical record that explains what changed.

Workflow name: Billing Backup Blocker -> Pay Application Review Readiness.

Business process: Billing backup completion and pay application readiness.

Business object: Pay App 003 / billing backup package.

Starting business problem: Pay App 003 is blocked because required backup documentation is missing or incomplete.

Business impact: The $84K cash recovery path is blocked until the backup package is documented, referenced, and ready for commercial review.

Primary user: Billing / Commercial user.

Supporting user: Project Manager.

Reviewer / handoff owner: Commercial reviewer / Operations leader, depending on the future role model.

This blueprint is documentation only. It defines the future Billing v2 product behavior before any UI, workflow logic, route, persistence, auth, RLS, QA script, or Pilot Mode changes are made.

## 2. Business Context

Rybex is a subcontractor that protects cash recovery by proving that billed work is supported by the right backup. A pay application can be rejected or delayed when stored materials, change events, approvals, T&M support, photos, daily reports, or other commercial evidence are not documented clearly.

For Billing Backup, the workflow matters because it:

- Protects cash recovery by identifying the blocked amount and the backup needed to unblock it.
- Prevents pay app rejection by requiring a documented backup note and evidence reference before the item is treated as ready.
- Creates a backup record that explains what support exists, where it can be found, and who prepared it.
- Supports commercial review by packaging the business context, evidence reference, and resolution note for the reviewer.
- Preserves documentation for future dispute, audit, collection, or internal review.

## 3. Current-State Problem

The current product can let a user fill fields and click workflow buttons. It can save local/demo field values, move local/demo workflow state, and show history. That is necessary, but it is not enough for a user who is trying to run a real billing process.

The current gap is that the workflow does not yet fully explain the business process. A user can complete actions without the product making the Pay App readiness outcome obvious enough. The outcome needs to be about Pay App 003 being ready for commercial review, not only a generic resolved state.

Billing v2 should turn the workflow into a guided business path: understand the blocker, document the backup, reference evidence, confirm readiness, send to review, clear the blocker, and inspect the historical record.

## 4. Future-State Workflow Promise

The future Billing v2 experience should make the user feel:

"I know what is blocked, why it matters, what backup I need to document, who reviews it next, what changed after I completed the workflow, and where the record lives."

That promise should be visible in the first screen, the required fields, the disabled action messages, the handoff state, the final outcome, and the historical record.

## 5. Business Object Definition

Billing v2 should make the business object explicit and stable.

| Attribute | Definition | Example value |
| --- | --- | --- |
| Pay App number | The pay application affected by the backup blocker. | Pay App 003 |
| Backup package | The set of notes and references that support the billed item. | Billing backup package for Pay App 003 |
| Blocked amount | The cash value affected by the missing or incomplete backup. | $84K |
| Blocker | The reason the pay application item cannot move cleanly to review. | Missing product approval / billing backup |
| Related change/event reference | The linked change event, stored material item, or billing support item. | CE-004 or stored material billing support |
| Related evidence references | The documents or locations that prove the backup exists. | Daily report, photo log, T&M ticket, product approval, file/package location |
| Owner | The user or role accountable for preparing the package. | Billing / PM |
| Due date | The deterministic target date for the backup package. | 2026-07-15 |
| Status | The business status of the backup package. | Blocked, Backup documented, Evidence referenced, Ready for review, Sent to commercial review, Blocker cleared |

## 6. Workflow Stages

### A. Understand The Billing Blocker

Purpose: Make the user understand the blocked business object, cash impact, and reason work is needed.

User sees: Pay App 003, blocked amount of $84K, blocker description, owner, due date, related item, current status, and plain-language business impact.

User enters: Nothing required at this stage.

Validation: The workflow cannot proceed to review or resolution until required backup and evidence fields are saved.

System response: Shows the blocker summary and explains that missing backup prevents Pay App review readiness.

State change: None.

Business meaning: The user knows this is a cash recovery blocker, not a generic task.

Next step: Document the backup support.

### B. Document Backup Support

Purpose: Capture the human explanation of what backup exists or what has been prepared.

User sees: A required Backup note field with helper text that connects the note to Pay App 003 and the $84K blocker.

User enters: Backup note.

Validation: Backup note is required before evidence can be marked ready or the package can be sent to review.

System response: Saves the note, displays the saved value, and adds it to the pending outcome record.

State change: Blocked -> Backup documented.

Business meaning: Rybex has a written explanation of the backup prepared for the blocked pay application item.

Next step: Reference evidence/documents.

### C. Reference Evidence/Documents

Purpose: Capture where the reviewer can inspect the supporting documentation.

User sees: A required Evidence reference field with examples such as daily report, photo log, T&M ticket, approval backup, or file/package location.

User enters: Evidence reference.

Validation: Evidence reference is required before the package can be confirmed ready. A production file upload is not required in this phase.

System response: Saves the evidence reference, displays it near the business object and outcome preview, and adds it to local/demo history.

State change: Backup documented -> Evidence referenced.

Business meaning: The backup is not only described; it is traceable to supporting proof.

Next step: Confirm backup readiness.

### D. Confirm Backup Readiness

Purpose: Require the user to confirm that the backup package is complete enough for commercial review.

User sees: A readiness checklist summarizing Pay App 003, $84K blocked amount, backup note, evidence reference, related item, owner, and due date.

User enters: Optional review note if more context is needed.

Validation: Backup note and evidence reference must be saved. If a waiver path is used, waiver reason is required and must include risk language.

System response: Enables the action to send the package to commercial review and shows what will be included in the handoff.

State change: Evidence referenced -> Ready for review.

Business meaning: The package has enough documented support to move out of preparation and into commercial review.

Next step: Send to commercial review.

### E. Send To Commercial Review

Purpose: Move the package from the preparer to the reviewer with clear handoff context.

User sees: Reviewer or review role, handoff summary, what will be reviewed, and the local/demo caveat.

User enters: Optional review note.

Validation: Package must be Ready for review. Backup note and evidence reference must be saved. Waiver reason is required if evidence was waived.

System response: Records the handoff state, shows a sent-to-review message, and adds a history entry.

State change: Ready for review -> Sent to commercial review.

Business meaning: Billing / PM preparation is complete enough for Commercial or Operations to review the backup package.

Next step: Clear billing blocker after review readiness is acknowledged in the workflow.

### F. Clear Billing Blocker

Purpose: Resolve the specific backup blocker for this pay application item.

User sees: Resolution note field, summary of saved backup note, evidence reference, handoff status, and final business outcome preview.

User enters: Resolution note.

Validation: Resolution note is required. The item must have been sent to commercial review or explicitly routed through an approved waiver path.

System response: Saves the resolution note, marks the blocker cleared, and generates the business outcome record.

State change: Sent to commercial review -> Blocker cleared.

Business meaning: Missing backup is no longer the reason this item blocks the $84K cash recovery path.

Next step: Review outcome and historical record.

### G. Review Outcome And Historical Record

Purpose: Let the user and reviewer inspect what happened, what was captured, and what happens next.

User sees: Outcome record, historical record, saved inputs, evidence reference, state changes, user/role, local/demo caveat, remaining blockers, and next business step.

User enters: Nothing required after completion.

Validation: Record must show the required saved fields and final outcome before the workflow is considered complete.

System response: Displays the final outcome and historical record label.

State change: Blocker cleared -> Historical record available.

Business meaning: Rybex can explain how the billing backup blocker was handled, where the evidence lives, and why Pay App 003 is now ready for commercial review.

Next step: Open pay application review.

## 7. Required Editable Fields

| Field | Label | Helper text | Placeholder | Required/optional | When required | What it unlocks | Where saved value appears | History entry created |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Backup note | Backup note | Explain what backup supports Pay App 003 and the $84K blocked amount. | Signed T&M ticket and product approval backup are available for CE-004. | Required | Before confirming backup readiness or sending to review. | Evidence-ready and review actions. | Guided process, readiness checklist, outcome record, historical record. | Backup support documented. |
| Evidence reference | Evidence reference | Point to the daily report, photo log, T&M ticket, approval backup, or file/package location the reviewer should inspect. | Daily Report 2026-06-24, Photo Log PL-18, and approval package in Billing/Pay App 003/CE-004. | Required | Before confirming readiness or sending to review. | Ready for review and review handoff. | Evidence section, outcome record, historical record. | Evidence reference saved. |
| Resolution note | Resolution note | State why the billing backup blocker can be cleared for this item. | Backup package documented and sent to commercial review for Pay App 003. | Required | Before clearing the billing blocker. | Final outcome and historical record creation. | Outcome record, historical record, final banner. | Billing blocker cleared. |
| Waiver reason | Waiver reason | Explain why backup is waived and what commercial risk remains. | Reviewer approved temporary waiver; risk remains if GC requests product approval backup before payment. | Required only if waiver path exists and is selected. | Before review handoff or blocker clearance through waiver. | Waiver-based review path. | Handoff summary, outcome record, historical record, remaining risk section. | Evidence waiver reason recorded. |
| Optional review note | Review note | Add context for the commercial reviewer. | Please verify stored material billing support before including in the review package. | Optional | Never required unless future policy changes. | Adds context to handoff. | Handoff/review status and historical record. | Review note added, if provided. |
| Optional blocked amount | Blocked amount | Confirm or adjust the cash value affected by this backup blocker. | $84K | Optional in this phase, defaulted from business object. | Required only if future workflow allows user override. | Cash impact display and outcome copy. | Business problem card, outcome record, historical record. | Blocked amount confirmed or updated, if edited. |
| Optional related change/event reference | Related change/event reference | Link the backup package to the change event, stored material item, or support record. | CE-004 / stored material billing support. | Optional in this phase, defaulted from business object when available. | Required only if future policy makes link mandatory. | Context for reviewer and historical trace. | Business object summary, evidence section, outcome record. | Related item referenced, if saved. |

## 8. Evidence And Document Handling

Evidence reference is required for Billing v2. The workflow should not imply that a production file upload exists unless that capability is actually implemented later.

In this phase, the user must be able to point to a daily report, photo log, T&M ticket, approval backup, or file/package location. The evidence reference should be structured enough for a reviewer to find the supporting material without guessing.

Evidence references must appear in:

- The Evidence / Document Reference section.
- The readiness checklist.
- The handoff summary.
- The final outcome record.
- The historical record.

If a waiver path exists, the waiver reason must be required. The waiver language must clearly state that evidence is missing or incomplete, who accepted the risk, and what risk remains. A waiver should not silently create the same confidence as a normal evidence reference.

Production document upload, document storage, signed access, malware scanning, retention, and external submission remain future/pilot concerns and are not claimed by this blueprint.

## 9. Handoff Model

"Send to commercial review" means the backup package is ready for a Commercial reviewer or Operations leader to inspect before the pay application item is treated as commercially ready.

Who receives it: Commercial reviewer / Operations leader, depending on the future role model.

What they review:

- Pay App 003 business object.
- $84K blocked amount.
- Blocker description.
- Backup note.
- Evidence reference.
- Related change/event reference.
- Waiver reason and risk language, if applicable.
- Resolution context and remaining blockers.

State entered: Sent to commercial review.

Future production system behavior might create an assigned review task, send an in-app notification, write a durable audit event, attach document permissions, and connect the record to the pay application package.

Local/demo mode should simulate the handoff by changing the visible state, displaying the reviewer role, showing the handoff summary, and writing a local/demo history entry. It should not claim external notification delivery, production assignment, or durable database-backed review.

## 10. Business Outcome Model

Required final outcome copy:

"Billing backup blocker resolved. Pay App 003 is ready for commercial review. The $84K cash recovery path is no longer blocked by missing backup for this item."

Business object moved: Pay App 003 / billing backup package moved from blocked backup preparation to commercial review readiness.

Cash impact changed: The $84K cash recovery path is no longer blocked by missing backup for this item. Cash recovery still depends on the later pay application review, approval, and payment process.

Remaining blockers: Any separate GC review comments, payment timing, contract compliance, lien waiver, retainage, or unrelated pay app issues remain outside this workflow unless explicitly captured as future blockers.

Next business step: Open pay application review.

Historical record label: Pay App 003 billing backup readiness record.

## 11. Historical Record Model

The workflow should produce a historical record that can be referenced after completion.

The record must include:

- Workflow name: Billing Backup Blocker -> Pay Application Review Readiness.
- Business object: Pay App 003 / billing backup package.
- Saved backup note.
- Saved evidence reference.
- Saved resolution note.
- Waiver reason and risk language, if used.
- Optional review note, if provided.
- Blocked amount and related change/event reference.
- State changes with timestamps or deterministic local/demo markers.
- User / role that saved each required input.
- Handoff owner or reviewer role.
- Final outcome.
- Remaining blockers.
- Next business step.
- Local/demo caveat.
- Future database-backed path.

Local/demo caveat: In local/demo mode, the record is a simulated or browser-local workflow record. It supports product review and operating design, but it is not production persistence or a legal system of record.

Future database-backed path: A production version should write the historical record to durable workflow, evidence, pay application, audit, and status-history storage after auth, RLS, retention, file access, and operational support are approved.

## 12. Required UI Structure

This section documents future UI structure only. Do not implement these components as part of this blueprint task.

Business Process Header: Shows workflow title, Pay App 003, owner, due date, status, and reviewer/handoff role.

Business Problem Card: Explains the missing backup blocker, $84K cash impact, related item, and why review readiness is blocked.

Guided Process Steps: Shows the seven business stages with visible completion state and disabled reasons.

Evidence / Document Reference: Captures and displays the required evidence reference and any waiver reason.

Handoff / Review Status: Shows review readiness, reviewer role, handoff summary, and local/demo simulation caveat.

Outcome Record: Shows final outcome copy, moved business object, cash impact change, remaining blockers, and next step.

Historical Record: Shows saved notes, evidence reference, state changes, user/role, outcome, and storage caveat.

Remaining Blockers: Separates resolved missing-backup blocker from other possible commercial blockers.

Next Business Step: Directs the user to open pay application review after the blocker is cleared.

## 13. Exact User-Facing Copy

Workflow title: Billing Backup Blocker -> Pay Application Review Readiness

Business problem statement: Pay App 003 is blocked because required backup documentation is missing or incomplete. The $84K cash recovery path cannot move to commercial review until the backup package is documented and referenced.

Field label: Backup note

Helper text: Explain what backup supports Pay App 003 and the $84K blocked amount.

Placeholder: Signed T&M ticket and product approval backup are available for CE-004.

Field label: Evidence reference

Helper text: Point to the daily report, photo log, T&M ticket, approval backup, or file/package location the reviewer should inspect.

Placeholder: Daily Report 2026-06-24, Photo Log PL-18, and approval package in Billing/Pay App 003/CE-004.

Field label: Resolution note

Helper text: State why the billing backup blocker can be cleared for this item.

Placeholder: Backup package documented and sent to commercial review for Pay App 003.

Field label: Waiver reason

Helper text: Explain why backup is waived and what commercial risk remains.

Placeholder: Reviewer approved temporary waiver; risk remains if GC requests product approval backup before payment.

Disabled button message: Save a backup note and evidence reference before sending this item to commercial review.

Disabled button message: Send the backup package to commercial review before clearing this billing blocker.

Disabled button message: Save a resolution note before clearing the billing blocker.

Success message after backup note: Backup note saved for Pay App 003.

Success message after evidence reference: Evidence reference saved for Pay App 003.

Handoff message: Pay App 003 backup package is ready for Commercial review. The reviewer should inspect the backup note, evidence reference, related item, and any waiver risk before approving the item for pay application review.

Final outcome message: Billing backup blocker resolved. Pay App 003 is ready for commercial review. The $84K cash recovery path is no longer blocked by missing backup for this item.

Next business CTA: Open pay application review.

Local/demo caveat: This record is local/demo workflow history only. It does not submit Pay App 003, upload production documents, notify external reviewers, or create production persistence.

## 14. Acceptance Criteria

- User understands Pay App 003 is the business object.
- User understands the $84K cash impact.
- User understands why backup is required before the item can be review-ready.
- User can enter and save required fields: Backup note, Evidence reference, and Resolution note.
- Downstream actions are gated by required inputs.
- Disabled actions explain what is missing in business language.
- Send to commercial review explains who receives the package and what they review.
- Resolve blocker explains the business result, not only a state change.
- Outcome record is visible after completion.
- Historical record is referenceable after completion.
- Evidence reference appears in the outcome and historical record.
- Waiver path, if present, requires a reason and risk language.
- Remaining blockers are separated from the resolved missing-backup blocker.
- Next business step is clear: Open pay application review.
- Local/demo caveat is visible anywhere the record could be mistaken for production persistence.
- Billing v2 does not expand the workflow scope beyond Billing Backup.

## 15. Non-Goals

- No production pay app submission.
- No external GC submission.
- No production document storage claim.
- No RLS/auth expansion.
- No broad billing module rewrite.
- No new workflow beyond Billing Backup.
- No accounting integration.
- No external notification delivery.
- No Pilot Mode behavior change from this blueprint alone.
- No claim of demo or pilot readiness from this blueprint alone.

## 16. Build Sequence Recommendation

Recommended next implementation sequence:

1. Implement Billing v2 UI/process using this blueprint.
2. Manually validate Billing v2 with a Billing / Commercial user.
3. Apply the pattern to Field.
4. Apply the pattern to Closeout.
5. Update Pilot Mode only after the Billing, Field, and Closeout patterns are intentionally aligned.
6. Revisit demo readiness after manual validation and verification pass.

This sequence is a recommendation only. No Billing v2 implementation has occurred in this blueprint step.
