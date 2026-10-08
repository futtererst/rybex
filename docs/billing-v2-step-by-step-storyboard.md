# Billing v2 Step-By-Step Storyboard

## Purpose

This storyboard defines the replacement Billing v2 interaction. It converts the accepted domain layer into a guided business workflow. It is specification only. No replacement UI implementation occurred in this pass, and the failed UI should not be committed as accepted UI.

## Step 1 — Understand Blocker

User sees:

- Pay App 003 is blocked.
- $84,000 is affected.
- Blocker reason: required backup documentation is missing or incomplete.
- The user is building a Billing Backup Package.

Primary CTA:

- Start backup package

What unlocks next:

- Package details can be entered.

## Step 2 — Build Backup Package

User enters:

- Backup summary
- Related source record
- Amount affected

Primary CTA:

- Save package details and continue

What unlocks next:

- Required proof package becomes active.

## Step 3 — Add Required Proof

User sees evidence checklist:

- Signed T&M ticket
- Daily report reference
- Photo log reference
- Supervisor confirmation
- Product approval backup

User adds structured references or waives with reason.

Primary CTA:

- Validate package readiness

What unlocks next:

- Submit for commercial review when all required evidence is referenced, verified, attached, or waived with reason.

## Step 4 — Submit For Commercial Review

User sees:

- Readiness summary
- Evidence progress
- Missing items if not ready
- Handoff recipient: Commercial Review / Finance/Admin

If ready, primary CTA:

- Send package to commercial review

System creates:

- Commercial Review Task

What unlocks next:

- Review decision can be recorded.

## Step 5 — Record Review Decision

User sees review task:

- Assigned role
- Package summary
- Decision note field
- Approve / request changes / reject

Primary CTA:

- Approve package

Alternative actions:

- Request changes
- Reject package

What unlocks next:

- Blocker clearance becomes possible only after approval.

## Step 6 — Clear Billing Blocker

User sees:

- Approved review
- Resolution note field
- Blocker clearance impact

Primary CTA:

- Clear billing blocker

What unlocks next:

- Outcome record and historical record are generated.

## Step 7 — View Outcome Record

User sees:

- Pay App 003 ready for commercial review
- $84,000 no longer blocked by missing backup
- Evidence references
- Review decision
- Historical record
- Next business step

Primary CTA:

- Return to Pilot Mode

Secondary CTA:

- Open billing records

## Field Placement

Fields are not all visible at once.

Step 2 fields:

- Backup summary
- Related source record
- Amount affected

Step 3 fields:

- Evidence reference per evidence item
- Waiver reason when waiving

Step 5 fields:

- Review decision note

Step 6 fields:

- Resolution note

Outcome step:

- Read-only summary only
