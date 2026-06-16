# End-User Simplification Pass

## Why This Was Needed

The prior simplification system improved structure, but the pages still felt like module dashboards. Users could see workflow, evidence, notifications, and records, but they still had to scan too much before knowing what to do.

This pass changes the first visible experience from "show the module" to "show the next action."

## New Page Contract

Every major page now starts with an action workspace:

- One-line page purpose.
- Current operating status: ready, blocked, at risk, or complete.
- Exactly one dominant primary action.
- No more than two secondary actions.
- No more than two critical blockers.
- No more than three missing or blocking evidence items.
- A clear Open details path.

## Default View = Action Workspace

The first visible layer answers:

- What needs my attention?
- What can I do now?
- What details can I open if needed?

The detailed operating model, registers, dashboards, tables, metrics, logs, and explanatory context remain available, but they are collapsed by default.

## Content Limits

- No visible card description should exceed one short sentence.
- No top-level panel should expose more than three cards.
- Uploaded or verified evidence stays in details unless it affects the current action.
- Metrics are details unless they directly support the required action.
- D5O theory and implementation explanations stay out of the default workspace.

## Page-by-Page Focus

- Command Center: my operating priorities.
- Pipeline: which pursuit needs a decision.
- Projects: which setup item blocks baseline readiness.
- Mobilization: what blocks field start.
- Field Execution: what must be reported or escalated today.
- RFIs/Submittals: which information item blocks work.
- Changes: which change risk needs protection now.
- Billing: what cash is blocked and what backup is needed.
- Safety: which safety action must close before work continues.
- Quality: which deficiency or test blocks acceptance.
- Closeout: what prevents acceptance or final billing.
- Reports/Optimize: what learning action should change operations.

## What Moved Into Details

The previous operating summaries, workflow context panels, metrics grids, dashboards, registers, tables, phase maps, scorecards, readiness matrices, and long guardrail explanations were moved into collapsed details on the major pages.

## What Remains Visible

The default workspace keeps only the minimum information required to act:

- Status.
- Status reason.
- Primary action.
- Owner.
- Due date.
- Two secondary actions at most.
- Two blockers at most.
- Three evidence needs at most.

## Future Role-Personalized Views

This pass does not add role-specific homepages. The next step would be personalized queues for executive, PM, field, finance, safety, quality, and admin users once production auth and project access are ready.

## Visual Acceptance + Subtraction Update

After screenshot review, the remaining visual competitor was the page header action row. Header utilities are now capped at two and visually quiet, so the primary action card remains the dominant action above the fold.

## Single Action Cockpit Refinement

The top-level page pattern has been tightened again. The separate status card,
primary action card, Also Do panel, Blocked By panel, Evidence Needed panel, and
details link are now merged into one ActionCockpit.

The default workspace now shows one dominant action with compact support rows:

- Do next.
- Owner.
- Due.
- Blocked by.
- Evidence needed.
- Also do.
- Open details.

Detailed records, full evidence lists, risk queues, and legacy dashboard content
remain available through collapsed details.

See:

- `docs/end-user-visual-acceptance-review.md`
- `docs/end-user-subtraction-backlog.md`

Run `npm run end-user-visual:verify` to confirm the visual acceptance package is complete.
Run `npm run single-action:verify` to confirm the cockpit refinement remains in place.
