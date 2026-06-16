# Page Comprehension QA Review

Review source: latest Playwright screenshots in `visual-qa-output`, captured at desktop, tablet, and mobile where available.

QA question: Can a user answer the five-second enterprise usability test?

1. What stage/module am I in?
2. Is the work ready, blocked, at risk, or complete?
3. What action is required next?
4. Who owns it and when is it due?
5. What evidence is required?
6. Where do I go for details?

Scale: 1 = unclear, 5 = immediately clear.

## Summary

The Universal Page Simplification System materially improves comprehension. The top operating summary now makes stage, status, action, owner, due date, evidence, and risks visible across the major pages.

The remaining problem is not missing information. The problem is still too much competing information immediately after the summary. Several pages expose guardrails, workflow context panels, metrics, and dense registers before the user has a calm drill-down path. Billing, Closeout, Reports, and some mobile captures also show visual overflow or clipped right-side content that reduces trust.

Overall recommendation: approved for continued internal review. Must-fix pilot blockers for Billing, Closeout, and Optimize have been remediated by moving dense records into progressive details and adding overflow containment. Should/Later items remain open.

End-user simplification update: major pages now use an action workspace as the first visible layer. Re-review should judge whether the user can identify one primary action, owner, due date, blocker, evidence needed now, and the details path without reading the underlying module dashboard.

Visual acceptance update: screenshot review found the action workspace successful, with header action buttons as the primary remaining competitor. Those actions were capped and visually demoted; current status is pass for controlled pilot visual acceptance with minor Admin caveats.

## /command-center

Five-second clarity score: 3/5.

Pass/fail statement: Pass with caveats.

What is clear:
- Executive cockpit stage is clear.
- Status, owner, next actions, evidence, and risks are visible at the top.
- The page clearly points users toward workflow resolution.

What is confusing:
- Too many leadership panels compete immediately after the simplified summary.
- Notification summary, escalation queue, role context, stage gate, next best action, decision queue, and action card all appear before the page calms down.

Primary action obvious:
Yes, but it competes with multiple other action areas.

Too many panels compete:
Yes.

Owner/due/evidence visible:
Yes.

Move below fold/details:
- Role context band.
- Duplicate notification panels.
- Leadership workflow table after the first three actions.
- Secondary readiness and operating metric sections.

Recommended remediation:
Keep the top summary and one leadership action strip. Collapse duplicate workflow and notification sections into "Leadership details."

## /pipeline

Five-second clarity score: 4/5.

Pass/fail statement: Pass.

What is clear:
- D1 pursuit control is clear.
- Go/no-go actions, owner, due date, and pursuit evidence are visible.
- Opportunity details are reachable below.

What is confusing:
- Two guardrail panels appear immediately after the summary and repeat the same operating idea.
- Opportunity board still dominates the page after the first viewport.

Primary action obvious:
Yes.

Too many panels compete:
Moderate.

Owner/due/evidence visible:
Yes.

Move below fold/details:
- Optimize intelligence guardrail.
- D1 intelligence inputs.
- Full opportunity board.

Recommended remediation:
Collapse guardrails and intelligence inputs into "Pursuit details." Keep only the summary and top three pursuits visible.

## /projects

Five-second clarity score: 3/5.

Pass/fail statement: Pass with caveats.

What is clear:
- D2 contract baseline stage is clear.
- Blocked status is visible.
- Required next actions and contract evidence are visible.

What is confusing:
- Metrics are numerous and compete with the simplified summary.
- Project control table and phase lanes arrive before users can choose a single workstream.

Primary action obvious:
Yes.

Too many panels compete:
Yes.

Owner/due/evidence visible:
Yes.

Move below fold/details:
- Large metrics grid.
- Project phase lanes.
- Contract/baseline control cards.

Recommended remediation:
Limit visible metrics to four and collapse phase lanes plus detailed contract cards into "Project records."

## /mobilization

Five-second clarity score: 3/5.

Pass/fail statement: Pass with caveats.

What is clear:
- Field-start readiness is clear.
- D3 owner, blockers, due actions, and evidence are visible.
- The next movement into D4 is clear.

What is confusing:
- D3 guardrail, workflow context, and metrics repeat the same field-start story.
- Readiness calendars and work package details make the page long before the user chooses a plan.

Primary action obvious:
Yes.

Too many panels compete:
Yes.

Owner/due/evidence visible:
Yes.

Move below fold/details:
- D3 guardrail.
- Full mobilization table.
- Calendar and detailed readiness panels.

Recommended remediation:
Show only the top blocked mobilization and top three readiness issues before details.

## /field-execution

Five-second clarity score: 4/5.

Pass/fail statement: Pass.

What is clear:
- Daily field control stage is clear.
- Next actions and field issue escalation are obvious.
- Owner, due date, and RFI/change paths are visible.

What is confusing:
- Evidence panel sometimes says no blocking evidence while the lower page contains many field evidence items.
- Field dashboards remain very dense.

Primary action obvious:
Yes.

Too many panels compete:
Moderate.

Owner/due/evidence visible:
Mostly.

Move below fold/details:
- Active work package grid.
- Full field issue lists.
- Signoff and production details.

Recommended remediation:
Improve evidence derivation for field execution and collapse lower dashboards into "Field records."

## /rfis-submittals

Five-second clarity score: 4/5.

Pass/fail statement: Pass.

What is clear:
- Information control stage is clear.
- Overdue RFI/submittal actions are visible.
- Owner, due date, evidence, and active risks are easy to scan.

What is confusing:
- Full RFI and submittal registers are still long and appear quickly.

Primary action obvious:
Yes.

Too many panels compete:
Moderate.

Owner/due/evidence visible:
Yes.

Move below fold/details:
- Full registers.
- Linked commercial records.
- D5 handoff note.

Recommended remediation:
Keep the top three overdue information actions visible and move register tables into collapsed details.

## /changes

Five-second clarity score: 4/5.

Pass/fail statement: Pass.

What is clear:
- Change recovery stage is clear.
- Notice, backup, pricing, and billing recovery actions are visible.
- Evidence and active risks are direct.

What is confusing:
- Commercial recovery details become dense quickly.
- Change register and recovery focus panels repeat similar commercial risk language.

Primary action obvious:
Yes.

Too many panels compete:
Moderate.

Owner/due/evidence visible:
Yes.

Move below fold/details:
- Change register.
- Income/recovery focus cards.
- Billing handoff list.

Recommended remediation:
Collapse all but notice deadline and backup risk into "Commercial recovery details."

## /billing

Five-second clarity score: 4/5.

Pass/fail statement: Pass after pilot remediation.

What is clear:
- Billing and cash control stage is clear.
- Cash-risk actions, owner, due date, and billing backup evidence are visible.

What is confusing:
- Detailed billing records are now behind progressive disclosure, so users must open records to see all pay app and SOV detail.

Primary action obvious:
Yes.

Too many panels compete:
No above the operating summary; detailed records are collapsed.

Owner/due/evidence visible:
Yes.

Move below fold/details:
- Completed. Billing metrics, pay app table, SOV details, evidence risks, and final recovery details are in collapsed Billing records.

Recommended remediation:
Completed. Keep monitoring mobile screenshots for detail drawer overflow.

## /safety

Five-second clarity score: 4/5.

Pass/fail statement: Pass.

What is clear:
- Safety control stage is clear.
- Corrective action, JHA, and incident signals are visible.
- Owner/due/action are visible.

What is confusing:
- Safety metrics and planning tables remain dense.
- Details are long but generally organized.

Primary action obvious:
Yes.

Too many panels compete:
Moderate.

Owner/due/evidence visible:
Yes.

Move below fold/details:
- Safety readiness by project.
- Full auto/toolbox control tables.
- Incident/corrective action logs.

Recommended remediation:
Collapse long safety operating details after the top action and readiness summary.

## /quality

Five-second clarity score: 4/5.

Pass/fail statement: Pass.

What is clear:
- Quality control stage is clear.
- Tests, deficiencies, inspections, and evidence blockers are visible.
- Required proof is clear.

What is confusing:
- Lower page becomes a long list of cards.
- Some inspection/test details are visible before the user chooses a specific issue.

Primary action obvious:
Yes.

Too many panels compete:
Moderate.

Owner/due/evidence visible:
Yes.

Move below fold/details:
- Full inspection register.
- Deficiency, test, and punch trackers.

Recommended remediation:
Group quality details into three collapsed buckets: inspections, tests, punch/deficiencies.

## /closeout

Five-second clarity score: 4/5.

Pass/fail statement: Pass after pilot remediation.

What is clear:
- Closeout and acceptance stage is clear.
- Acceptance blockers, final billing blockers, evidence, owner, and due date are visible.

What is confusing:
- Detailed closeout records are collapsed, so users must open records to review the full acceptance package.

Primary action obvious:
Yes.

Too many panels compete:
No above the operating summary; detailed records are collapsed.

Owner/due/evidence visible:
Yes.

Move below fold/details:
- Completed. Package table, evidence cards, acceptance, final billing, retainage, and archive details are in collapsed Closeout records.

Recommended remediation:
Completed. Keep acceptance package records available only through the details layer.

## /reports

Five-second clarity score: 4/5.

Pass/fail statement: Pass after pilot remediation.

What is clear:
- Optimize learning stage is clear.
- Improvement actions and production-rate evidence are visible.

What is confusing:
- Full performance intelligence is now intentionally behind progressive disclosure.

Primary action obvious:
Yes.

Too many panels compete:
No above the operating summary; detailed records are collapsed.

Owner/due/evidence visible:
Yes.

Move below fold/details:
- Completed. Scorecards, lessons, production rates, GC/vendor profiles, risk library, and improvement backlog are in collapsed Optimize records.

Recommended remediation:
Completed. Continue to treat Optimize as learning actions first and intelligence library second.

## /admin

Five-second clarity score: 3/5.

Pass/fail statement: Pass with caveats.

What is clear:
- Admin/System Readiness page purpose is clear.
- Pilot readiness, production status, and major blockers are visible.
- Current readiness posture is honest.

What is confusing:
- Admin remains extremely long.
- Many readiness sections compete and can feel like a developer inventory.

Primary action obvious:
Mostly. It is a readiness review page, not an action page.

Too many panels compete:
Yes.

Owner/due/evidence visible:
Not applicable for most Admin sections; pilot blockers are visible.

Move below fold/details:
- Detailed route list.
- Full implementation status map.
- Long readiness docs list.
- Persistence/security sections that are not part of current decision.

Recommended remediation:
Keep Pilot Readiness, Security/RLS, Data Source, and Verification Status visible. Collapse everything else into readiness detail groups.

## Cross-Page Findings

Must address before pilot:

- Completed: Billing, Closeout, and Reports dense records are moved into progressive details with overflow containment.
- Completed for the pilot blockers: old dense sections no longer appear immediately after the operating summary on Billing, Closeout, and Reports.
- Open cross-page: metrics grids on other pages can still exceed the "4-6 useful metrics max" target.

Should address before executive demo:

- Collapse duplicate guardrails and workflow context sections.
- Reduce repeated workflow language after the new summary.
- Add a consistent "View all actions/details" pattern below the top three actions.
- Improve field evidence derivation so evidence panels do not understate field proof needs.

Later:

- Add role-personalized views after production auth and workflow ownership are durable.
- Add route-specific detail tabs once records are persistent.
- Create executive report packs from the simplified page summaries.
