# Field Issue Escalation Workflow Trace

## Registry Status

Registered workflow id: `field-issue-escalation`. This trace is executed through the shared Workflow Completion Engine definition model.

## Workflow

Field Issue -> RFI / Change Escalation.

## Primary User

Field Supervisor / Project Manager.

## Starting Points

- `/command-center`
- `/field-execution`

## Expected Business Story

A field issue has been captured from field execution or daily reporting. The issue may require clarification, owner direction, schedule impact tracking, changed condition notice, or change event protection.

The user must escalate the issue to the correct control path and see the original issue change state.

## Proof Issue

- Issue: Unclear conduit routing discovered in Zone B.
- Source: D4 daily report DR-0142.
- Location: Zone B conduit run.
- Owner: Field Supervisor / PM.
- Business impact: Crew productivity and schedule may be affected without owner direction.
- Recommended path: RFI if clarification is needed. Change event if scope, cost, or schedule impact exists.

## Required States

- `open`
- `in_progress`
- `rfi_required`
- `change_required`
- `rfi_created`
- `change_event_created`
- `controlled`
- `resolved`
- `cannot_complete`

## Required Actions

- `create_rfi_from_field_issue`
- `create_change_event_from_field_issue`
- `mark_field_issue_controlled`
- `resolve_field_issue`
- `reopen_field_issue`

## Required Result Messages

- `RFI draft created from field issue.`
- `Change event draft created from field issue.`
- `Field issue marked controlled.`
- `Field issue resolved.`
- `This issue cannot be completed yet because [reason].`

## Local/Demo Proof Path

1. Visit `/field-execution?focus=field-issue-escalation#focused-task`.
2. Confirm the focused task says: `You are here to: Escalate field issue`.
3. Enter and save an `Escalation note`.
4. Confirm the saved note remains visible.
5. Create an RFI draft or change event from the field issue.
6. Confirm a linked output record appears.
7. Mark the field issue controlled.
8. Resolve the field issue.
9. Confirm the result banner and history update.

## Pilot Mode Human-Execution Proof

`npm run pilot-field-closeout:qa` starts from `/pilot`, opens `Escalate field issue`, saves the escalation note, creates an RFI draft, controls and resolves the issue, returns to Pilot Mode, and confirms the Field card is complete/resolved.

## Current Scope

This proof is local/demo by default and not database-backed as a production field issue workflow. The opt-in completion persistence bridge can record completion events and linked-output metadata in Supabase pilot tables, but it does not create production RFI or change records.

## Editable Field Proof

Field Issue completion now requires visible saved inputs before control actions unlock:

- `Escalation note`
- `Recommended control path`
- RFI title/question or change title/impact note for the selected path
- `Control reason`
- `Resolution note`

The saved values remain visible and appear in local/demo history.
