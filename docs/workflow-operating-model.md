# RybexOS Workflow Operating Model

Update: Evidence is now a shared operating layer. Workflows can surface missing,
pending, uploaded, verified, waived, or rejected evidence, and local demo users
can mark evidence attached/verified/waived without enabling production file
storage.

Notification update: workflow and evidence risks now derive in-app alerts and
escalation queues. These alerts are local/demo only; external delivery is not
enabled.

RybexOS is organized around operating workflows, not around pages that display records.

The shared pattern is:

**Signal -> Decision -> Action -> Evidence -> Gate Movement**

Every major module should answer:

- What workflow is this part of?
- What signal triggered attention?
- What decision is required?
- What action is required?
- Who owns it?
- What evidence is needed?
- What gate or status movement happens next?
- What happens if it is missed?
- Where does the user go to resolve it?

## Universal Workflow Pattern

Signal:
The exception, blocker, due date, risk, or opportunity that requires attention.

Decision:
The operating choice that must be made before work moves forward.

Action:
The specific step the owner must take.

Evidence:
The record, document, photo, approval, field note, score, test, or artifact that proves the action was controlled.

Gate movement:
The D5O gate or operating status that changes once the action and evidence are complete.

## Transaction MVP

RybexOS now includes a narrow local workflow transaction MVP. Workflow action cards can perform demo transactions such as approving/holding go-no-go, approving/holding D2 and D3 gates, submitting daily report movement, creating RFI/change prompts from signals, and resolving workflow actions.

These transactions update local browser state only. They prove the interaction model but do not persist records, enforce production auth, upload files, or modify seed data.

## D5O Workflow Map

D1 Discover:
Pursuit Control asks whether Rybex should pursue the work. Signals include bid deadlines, high-risk pursuits, and missing reviews. Evidence includes go/no-go score detail and reviewer notes. Gate movement is D1 approval, hold, or no-bid.

D2 Define:
Contract Baseline asks whether scope, contract, budget, schedule, and notice terms are controlled before mobilization planning. Evidence includes baseline artifacts, scope matrix, and notice requirements. Gate movement is D2 ready for D3 or held.

D3 Design / Prepare:
Mobilization Readiness asks whether the crew can safely and productively mobilize. Evidence includes JHAs, locates, access, permits, crew/equipment/material readiness, and work packages. Gate movement is D3 approved for D4 or held.

D4 Deliver:
Field Execution asks what happened in the field and what must be escalated. Evidence includes daily reports, quantities, photos, safety observations, quality checks, delays, blockers, RFIs, and change prompts. Status movement sends issues into formal control.

Information Control:
RFIs and submittals ask what clarification or approval is blocking work. Evidence includes questions, references, reviewers, due dates, field links, attachments, and response status.

Change Recovery:
Change Control asks what work, delay, direction, or condition needs commercial recovery. Evidence includes notice, backup, pricing, approvals, daily reports, RFIs, and photos.

Billing / Cash Control:
Billing asks what can be billed, what is blocked, and what cash is at risk. Evidence includes SOV lines, quantities, daily reports, approved changes, backup, lien waivers, retainage, and payment status.

Safety Control:
Safety asks whether safety requirements are complete and corrective actions are controlled. Evidence includes plans, JHAs, toolbox talks, observations, incidents, photos, and verification.

Quality Control:
Quality asks whether work has been inspected, tested, corrected, and proven. Evidence includes inspections, deficiencies, tests, punch items, photos, reinspection, and verification.

D5 Document / Close:
Closeout Acceptance asks whether Rybex can prove completion, secure acceptance, recover final payment, and release retainage. Evidence includes tests, as-builts, warranties, punch closure, RFIs/submittals, changes, final billing, waivers, and acceptance records.

O Optimize:
Optimize Learning asks what Rybex should change before the next project. Evidence includes scorecards, production variances, lessons learned, GC/vendor performance, risk library updates, and improvement actions.

## Command Center Usage

Command Center is the leadership workflow cockpit. It should show the highest-consequence workflows first: critical safety signals, blocked field work, notice deadlines, cash at risk, closeout/payment blockers, and decisions blocking D5O gate movement.

Leaders use Command Center to decide what needs action now.

## Module Usage

Module pages show the workflow context for that operating area:

- Pipeline: pursuit decisions and bid-risk signals.
- Projects: D2 baseline blockers.
- Mobilization: field-start readiness.
- Field Execution: daily proof and escalation prompts.
- RFIs/Submittals: information blockers.
- Changes: notice, backup, pricing, and recovery actions.
- Billing: cash, backup, lien waiver, and pay application movement.
- Safety: corrective action and readiness control.
- Quality: inspection, test, deficiency, and punch control.
- Closeout: acceptance, final billing, retainage, and archive readiness.
- Optimize: lessons, production rates, partner performance, and process updates.

## Field Evidence

Field users create much of the evidence that protects the business:

- Daily reports prove work performed.
- Photos prove installed condition and closeout evidence.
- Quantities support production and billing.
- Safety observations create corrective action control.
- Quality checks prevent late closeout surprises.
- Changed conditions trigger RFI/change recovery before notice windows are missed.

## Optimize Loop

Optimize closes the lifecycle. Completed work updates future pursuit decisions, estimating assumptions, mobilization checklists, work package templates, GC/vendor posture, and the risk library.

The goal is not to collect lessons. The goal is to change the operating system.
