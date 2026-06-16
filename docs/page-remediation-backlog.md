# Page Remediation Backlog

## Must Fix Before Pilot

Status: Completed for the current pilot remediation pass. Keep these items for regression checks.

End-user simplification follow-up: completed. Major pages now use an action workspace first and move older simplified panels, dashboards, tables, registers, metrics, and long guardrail copy into collapsed details.

Visual subtraction follow-up: completed. Header actions were capped at two and styled as quiet utilities so the primary action card remains dominant above the fold. See `docs/end-user-subtraction-backlog.md`.

| Page | Issue | User Impact | Recommended Fix | Priority | Expected Outcome |
| --- | --- | --- | --- | --- | --- |
| /billing | Completed: right-edge clipping/overflow appeared in desktop and mobile screenshots. | Finance users may not trust cash-risk and billing details. | Billing records now use progressive disclosure and overflow-safe detail containers. | P0 | Billing page is readable without horizontal clipping. |
| /closeout | Completed: right-edge clipping/overflow appeared in desktop and mobile screenshots. | Closeout users may miss acceptance, retainage, or evidence details. | Closeout records now use progressive disclosure and overflow-safe detail containers. | P0 | Closeout can be reviewed safely on desktop and mobile. |
| /reports | Completed: right-edge clipping/overflow and high density appeared in desktop/tablet screenshots. | Executives may perceive Optimize as a raw report archive. | Optimize records now use progressive disclosure and overflow-safe detail containers. | P0 | Optimize reads as learning actions first, intelligence library second. |
| /billing, /closeout, /reports | Completed: dense legacy sections appeared immediately after the simplified summary. | Users still hit a wall of content after the first viewport. | Guardrails, large metrics, dashboards, and record tables moved into collapsed detail sections. | P0 | The first two viewports stay action-oriented. |
| Cross-page | Partially deferred: metrics grids on other pages can still exceed the decision-support limit. | Users cannot tell which metrics matter most. | Limit visible metrics to 4-6 and move the rest into details in a later cross-page pass. | P1 | Metrics support decisions instead of competing with actions. |

## Should Fix Before Executive Demo

| Page | Issue | User Impact | Recommended Fix | Priority | Expected Outcome |
| --- | --- | --- | --- | --- | --- |
| /command-center | Too many leadership widgets compete after the summary. | Executives may lose the single priority. | Keep one leadership priority block and collapse duplicate notification/workflow panels. | P1 | Command Center feels like a cockpit, not a stacked dashboard. |
| /projects | Contract metrics and phase lanes compete with D2 action clarity. | PMs may read instead of acting. | Collapse phase lanes and detailed contract cards below "Project records." | P1 | D2 gate blockers remain the first PM focus. |
| /mobilization | Guardrail, workflow context, metrics, calendar, and readiness panels repeat readiness. | Operations users may scan too much before finding the blocker. | Show one blocked mobilization and top readiness issues before details. | P1 | Field-start decision is immediate. |
| /field-execution | Evidence panel can say no blocking evidence while field proof is dense below. | Field users may underestimate evidence capture needs. | Improve field evidence mapping from daily reports/photos/quantities/signoff. | P1 | Field proof needs are accurate in the top summary. |
| /rfis-submittals | Full registers appear quickly after summary. | PMs may miss the top overdue response. | Collapse full registers; keep only top overdue RFI/submittal actions visible. | P2 | Information blockers are action-first. |
| /changes | Commercial recovery sections repeat notice/backup/pricing concepts. | Users may not know whether notice, backup, pricing, or billing is the next move. | Group details by notice, backup, pricing, billing handoff. | P2 | Change recovery path is clearer. |
| /safety | Safety planning and corrective logs are long. | Safety users may have to scroll too far to verify the key action. | Collapse safety plan tables and logs after top corrective actions. | P2 | Corrective action closure stays primary. |
| /quality | Inspection, deficiency, test, and punch cards create a long list. | Quality users may lose the top acceptance blocker. | Collapse details into inspections, tests, punch/deficiencies. | P2 | Quality evidence is easier to navigate. |
| /admin | Readiness page is extremely long. | Sponsors may see it as a developer dump. | Keep pilot/security/data/verification visible; collapse the rest. | P2 | Admin becomes a credible readiness dashboard. |

## Later

| Page | Issue | User Impact | Recommended Fix | Priority | Expected Outcome |
| --- | --- | --- | --- | --- | --- |
| Cross-page | Role-aware language exists, but pages are not personalized by role. | Users still see some actions outside their immediate responsibility. | Add role-personalized views after production auth and workflow ownership mature. | P3 | Each role lands on a focused work queue. |
| Cross-page | Details are page-level, not object-level. | Users drill through long sections rather than opening one record drawer. | Add record drawers/tabs after persistence is durable. | P3 | Drill-down becomes faster without hiding data. |
| /reports | Optimize intelligence is rich but not packaged as review output. | Executives may want operating review packs. | Create exportable weekly operating review packs after reporting persistence. | P3 | Optimize supports recurring leadership cadence. |
| /command-center | Leadership view still pulls from many same-weight signals. | Executives may need a more opinionated top-five ranking. | Add configurable executive priority rules after live pilot feedback. | P3 | Leadership attention is more precise. |
