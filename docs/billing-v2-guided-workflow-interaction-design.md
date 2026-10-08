# Billing v2 Guided Workflow Interaction Design

## Principle

Billing v2 must behave like a guided business workflow, not a form dashboard.

The UI must help the user understand the billing blocker, build the backup package, satisfy evidence requirements, hand the package to commercial review, record the review decision, clear the blocker, and find the resulting outcome record.

No replacement UI implementation occurred in this pass. The failed Phase 1B UI should not be committed as accepted UI.

## Screen Questions

The screen should answer these questions without requiring the user to understand the system architecture:

1. What business blocker exists?
2. What business object am I moving?
3. What step am I on?
4. What do I need to do right now?
5. Why does this step matter?
6. What will unlock after I complete this step?
7. What evidence is still missing?
8. Who receives the handoff?
9. What outcome am I working toward?

## Layout Model

Billing v2 should use three major zones.

### A. Process Rail

The process rail may be a left-side rail on desktop or a top stepper on smaller viewports.

Steps:

1. Understand blocker
2. Build backup package
3. Add required proof
4. Submit for commercial review
5. Record review decision
6. Clear billing blocker
7. View outcome record

Each step shows one of these statuses:

- not started
- active
- complete
- blocked

The process rail is not decorative. It is the user's map of the business process.

### B. Active Step Workspace

The center of the screen shows only the current step.

Each active step includes:

- step title
- plain-English purpose
- required fields/actions for this step only
- what happens after save/continue
- primary CTA
- secondary CTA if needed
- validation messages

The active workspace must not show all workflow fields at once.

### C. Readiness / Context Panel

The readiness/context panel may be right-side on desktop and sticky/stacked on smaller viewports.

It shows:

- Pay App 003
- $84,000 blocked
- current state
- readiness checklist
- evidence progress
- review status
- blocker clearance status
- next business step

The context panel should orient the user, not compete with the active step.

## Evidence Package UX

Evidence should feel like a package, not a list of text inputs.

Each evidence item shows:

- evidence name
- required/optional
- status
- why it is required
- reference field
- save reference
- waive with reason
- saved reference
- effect on readiness

The package summarizes progress:

- 0/5 complete
- 3/5 complete
- 5/5 complete
- ready / not ready

## Commercial Review UX

Commercial review must feel like a handoff.

The UI must show:

- review task created
- assigned to Commercial Review
- status pending / approved / changes requested / rejected
- decision note
- review decision
- what decision means for blocker clearance

## Outcome UX

The outcome must not be only a banner.

The outcome step shows:

- business outcome
- business object moved
- business impact
- evidence captured
- review decision
- remaining blockers
- next business step
- historical record
