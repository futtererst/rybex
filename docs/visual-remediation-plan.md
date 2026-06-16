# Visual Remediation Plan

Date: June 11, 2026

## Root Issue

The major visual issue after the first screenshot review was not a missing color, card style, or page-level layout. The deeper issue was that the workflow behind RybexOS was not consistently visible across every module.

Pages were credible, but some screens could still feel like rich module inventories instead of an operating system moving work forward.

## Remediation Strategy

The remediation is a shared workflow operating layer:

**Signal -> Decision -> Action -> Evidence -> Gate Movement**

This layer was introduced across:

- Command Center leadership workflows
- Module workflow context sections
- Workflow queues grouped by state
- Workflow phase map
- Workflow action cards
- Guided workflow outcome panels
- Demo and developer documentation

## Why This Approach

A page-by-page redesign would have improved individual screenshots but would not solve the product-level issue. RybexOS needs to feel like work is moving through controlled operating decisions across the full D5O lifecycle.

The shared workflow layer makes the product story consistent:

- Signals explain why attention is needed.
- Decisions clarify what leadership or managers must choose.
- Actions say what must happen next.
- Evidence explains what proof is needed.
- Gate movement shows how work advances.
- Consequences explain business risk if action is missed.

## Fixes Applied

- Added a universal workflow domain model.
- Added workflow configuration with subcontractor-specific language.
- Added workflow derivation from existing seed-backed operating data.
- Added reusable workflow components.
- Updated Command Center into a workflow cockpit.
- Added workflow context to major module pages.
- Added workflow outcome panels to guided workflows.
- Added workflow operating model documentation.

## Remaining Caveats

- The app remains seed-backed; workflow derivation is deterministic demo logic.
- Workflow queues are not yet backed by persisted ownership, audit, or status history.
- Future persistence should store workflow-generating source records rather than duplicating derived workflow rows prematurely.
- Role-specific workflow trimming should wait until real auth/RBAC enforcement exists.

## Demo Recommendation

Approved with caveats.

The demo should emphasize the operating pattern: signal, decision, action, evidence, and gate movement. Avoid scrolling every lower-page register unless a stakeholder asks for detail.

## Recommended Next Step

Regenerate screenshots and review:

- Command Center
- Pipeline
- Projects
- Mobilization
- Field Execution
- Changes
- Billing
- Closeout
- Optimize

If those screens now communicate workflow movement clearly, proceed to stakeholder demo materials.

## UX Simplification Follow-Up

A second system-level UX pass reduced visible density without adding business
scope. The new standard is:

Stage -> Gate -> Blockers -> Actions -> Evidence -> Next Movement.

Added:

- StageGateSummary
- DecisionQueue
- EvidenceChecklist
- NextBestAction
- ProgressiveDetails

Command Center now leads with gate/action/decision context and hides supporting
registers behind progressive disclosure. Major modules inherit the simpler
stage/gate/action pattern through `WorkflowModuleContext`.
