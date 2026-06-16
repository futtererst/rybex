# Universal Page Simplification System

## Why This Was Needed

RybexOS had the right operating modules and workflow logic, but too much module knowledge was visible at once. Users had to read dense cards, metrics, tables, and explanations before they could answer the basic operating question:

What do I do next?

The simplification system moves each major page from "show everything this module knows" to "show what the user needs to do next."

## Page Contract

Each major page should show this sequence near the top:

1. Stage / Module Header
2. Next Required Actions
3. Gate / Workflow Readiness
4. Evidence Required
5. Active Risks / Escalations
6. Details / Records

The first five sections are short and action-oriented. Detailed records stay available below the top summary or behind progressive disclosure.

## Content Hierarchy

Top-level content should answer:

- Current stage
- Current D5O phase
- Ready, blocked, at risk, or complete
- Required next action
- Owner
- Due date
- Evidence needed
- Active blocker or escalation
- Where to resolve

Lower-level content should hold:

- Full registers
- Tables
- Audit and status history
- Detailed record descriptions
- Implementation/readiness explanations
- Supporting operating data

## Shared Components

Core components live in `components/d5o/simplified/`:

- `ModuleStageHeader`
- `NextActionPanel`
- `GateReadinessPanel`
- `EvidenceRequiredPanel`
- `ActiveRisksPanel`
- `ProgressiveDetailsSection`
- `PageOperatingLayout`

Support utilities live in `lib/d5o/simplification/`:

- `page-summary.ts`
- `derive-next-actions.ts`
- `derive-page-readiness.ts`

## Progressive Disclosure

Dense records should not disappear. They should move down the page or into a details layer. This keeps operational information available without making the first viewport feel like a coded operating manual.

Use progressive disclosure for:

- Register tables
- Long explanations
- Audit history
- Implementation status
- Supporting records
- Secondary metrics

## Before / After Principle

Before:

"Here are all the records, metrics, panels, summaries, logs, and module status details."

After:

"This stage is blocked. The next action is assigned to this owner. This evidence is required. These details are available if needed."

## Single Action Cockpit

The latest refinement collapses the visible top layer into one ActionCockpit
instead of separate action, blocker, evidence, status, and details panels. The
page should read as one cockpit:

- Do next.
- Blocked by.
- Evidence needed.
- Also do.
- Open details.

This keeps the default view focused on action while preserving detailed records
inside progressive disclosure.

## What Remains Intentionally Detailed

RybexOS is an operating platform for subcontracted infrastructure work. Some detail is necessary and should remain available:

- Contract and scope baseline
- Mobilization readiness
- Daily field proof
- RFIs/submittals
- Change backup
- Billing support
- Safety and quality verification
- Closeout acceptance package
- Optimize performance intelligence
- Admin readiness and pilot boundaries

The change is not deleting detail. The change is sequencing detail behind action.

## Future Role-Personalized Views

The current simplification system is page-based and role-aware through language. Future work can add role-personalized views once auth, RBAC, project ownership, and workflow persistence are production-ready.

Possible future views:

- Executive: decisions, cash, blocked work, gate health
- PM: assigned actions, gate blockers, evidence to collect
- Field supervisor: today report, quantities, photos, field issue prompts
- Finance: billing blockers, retainage, backup, cash risk
- Safety/quality: overdue actions, missing proof, verification
- Admin: readiness, security, verification, support

## Comprehension QA Review

The latest screenshot-based review is documented in:

- `docs/page-comprehension-qa-review.md`
- `docs/page-remediation-backlog.md`

Current finding: the top-of-page operating summary works. The Must Fix Before
Pilot remediation pass moved Billing, Closeout, and Optimize dense records into
progressive details and added overflow containment. Remaining Should/Later items
focus on reducing density across the rest of the app.

Use `npm run page-comprehension:verify` to confirm the review package covers
every major page and includes prioritized remediation categories.

## End-User Action Workspace Update

The default page view is now stricter than the original simplified summary.
Major pages start with `ActionWorkspaceLayout`, which shows one primary action,
two secondary actions at most, critical blockers, missing evidence, and an
Open details path.

The previous simplified panels, readiness detail, metrics, dashboards,
registers, and operating context remain available through collapsed details.
The page should feel like an action workspace before it feels like a module
dashboard.

Visual acceptance update: header action buttons were demoted to quiet utility
links and capped at two so they do not compete with the primary action card.
