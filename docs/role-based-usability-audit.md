# Role-Based Usability Audit

Date: June 11, 2026

Purpose: validate whether each RybexOS role can quickly answer: what matters to me, what am I responsible for, what is blocked, what decision/action is needed, what evidence is required, and where do I go next?

## Findings

| Role | Primary goal | Primary routes | Needs to see first | Action to take | Evidence to provide/review | Clarity | Confusing areas | Recommended simplification | Role-specific view |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CEO / Executive | See risk, cash, blocked work, and decisions. | `/command-center`, `/billing`, `/closeout`, `/reports` | Leadership priorities, cash at risk, blocked field work, gate health. | Assign decision owners and drill only into exceptions. | Decision notes, commercial exposure, closeout acceptance status. | 8/10 | Lower-page details are still deep. | Keep executive demo in the first viewport and collapsed detail panels. | Later: executive home view. |
| Operations Leader | Keep work moving through D5O gates. | `/command-center`, `/projects`, `/mobilization`, `/field-execution` | D2/D3/D4 blockers and owner/due/action. | Approve, hold, or escalate gate movement. | Gate artifacts, readiness evidence, daily controls. | 8/10 | Cross-module queues can feel similar. | Use role context bands and decision queues as the standard entry pattern. | Later: operations queue. |
| Project Manager | Clear assigned blockers and protect margin. | `/projects`, `/changes`, `/billing`, `/closeout` | Gate blocker, required action, owner, due date, evidence. | Complete records, route decisions, recover changes, close packages. | Scope matrix, RFIs, change backup, billing backup, closeout evidence. | 8/10 | Dense registers remain detailed. | Keep registers below top decision/action areas. | Later: PM workspace. |
| Superintendent | Confirm readiness and field execution control. | `/mobilization`, `/field-execution`, `/safety`, `/quality` | Field start blockers, work package status, daily report needs. | Hold or release work, escalate field issues, verify readiness. | JHA, locates, access, crew/equipment/materials, reports. | 7/10 | Safety/quality and field records can overlap. | Keep field-facing language: today, blocker, evidence, signoff. | Later: superintendent queue. |
| Field Supervisor | Submit daily proof and escalate field signals. | `/field-execution`, `/field-execution/daily-report/new` | Today’s work, report submission, quantities/evidence required. | Submit daily report, flag RFI/change/safety/quality issues. | Quantities, photos, field notes, safety/quality observations. | 7/10 | Forms are still long by necessity. | Use role cue and outcome panel; future pass should add smaller task sections. | Later: field-only mobile flow. |
| Finance/Admin | Convert work into clean billing and cash recovery. | `/billing`, `/admin` | Cash at risk, backup missing, lien waiver/retainage issues. | Clear billing blockers and escalate aging payments. | Pay app support, SOV, lien waivers, approved changes. | 8/10 | Billing page is necessarily dense. | Keep billing decision queue at top and collapse lower support details over time. | Later: finance workspace. |
| Safety Manager | Control safety blockers, incidents, and corrective actions. | `/safety`, `/safety/record/new`, `/safety/jha/new` | Overdue corrective actions, incident follow-ups, missing JHAs. | Assign, verify, or escalate safety closure. | JHAs, toolbox talks, incident records, verification notes. | 8/10 | Closeout impact can be easy to miss. | Keep closeout-impact wording in decision/action cards. | Later: safety queue. |
| Quality Manager | Prove work was inspected, tested, corrected, and accepted. | `/quality`, `/closeout`, `/quality/inspection/new`, `/quality/deficiency/new` | Missing tests, open deficiencies, punch blockers. | Verify corrections, upload/confirm evidence, clear acceptance risk. | Inspection records, tests, photo proof, punch closure. | 8/10 | Quality and closeout evidence overlap. | Keep quality pages focused on evidence and verification, closeout on acceptance. | Later: quality workspace. |
| Estimator | Decide what to pursue and improve future estimates. | `/pipeline`, `/pipeline/new`, `/reports` | Go/no-go decision, risk signals, production-rate lessons. | Complete pursuit review or update estimating assumptions. | Score dimensions, pursuit risks, production-rate variance. | 8/10 | Optimize details can overwhelm early users. | Keep production/risk updates as exception queues. | Later: estimator workspace. |
| Admin | Understand system readiness and boundaries. | `/admin` | Data mode, route health, persistence/auth boundaries, demo readiness. | Run verification, explain limitations, guard secrets. | Readiness docs, route smoke status, data-source diagnostics. | 9/10 | Could become too technical if expanded. | Keep Admin as readiness cockpit, not a developer dump. | Current page is enough. |

## System-Level Root Causes

- The app is strongest when the first viewport shows stage, gate, blocker, owner, due date, and next action.
- Role clarity weakens when lower-page registers dominate before the user understands the decision.
- Guided workflows are acceptable for demo, but field/mobile roles will eventually need shorter task-first flows.
- Executive demos should avoid drilling into lower-page evidence tables unless asked.

## Changes Applied In This Pass

- Added role-context bands to major module workflow sections.
- Added role-context bands to guided create workflows.
- Made owner and due date more prominent in the shared decision queue.
- Added role/outcome language to guided workflow outcome panels.

## Remaining Caveats

- No true role-based workspace exists yet.
- No authenticated identity or permission enforcement exists yet.
- Forms remain long because persistence-backed task flows are not implemented yet.
