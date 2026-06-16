# Visual QA Review Report

Date: June 11, 2026

Build reviewed: Seed-backed RybexOS D5O demo after Playwright visual capture.

Screenshot source: `visual-qa-output/manifest.json`

Screenshots inspected: desktop module pages, priority workflow pages, and tablet/mobile priority routes.

Post-fix capture: 37 screenshots regenerated successfully; latest manifest is at `visual-qa-output/manifest.json`; capture command reported no failures.

## Executive Summary

RybexOS is visually credible as an infrastructure subcontractor operating system. The first screen on the major modules communicates control, urgency, and D5O discipline. The strongest pages are Command Center, Billing, Closeout, Projects, Mobilization, and Field Execution because they make risk and next action visible quickly.

The main caveat is density. Full-page screenshots can read like a complete operating inventory below the fold because many panels carry similar visual weight. That is acceptable for an enterprise operations cockpit, but stakeholder demos should stay on the top sections, key blockers, and the strongest proof panels unless a viewer asks to go deeper.

Demo approval recommendation: approved with caveats.

Applied fixes:
- Tightened shared section-heading hierarchy so panels scan as decisions and registers instead of one long data wall.
- Improved mobile/tablet shell behavior by turning the nav into a compact horizontal rail below 820px.
- Added Admin readiness references to this review and approval caveat.
- Added a universal workflow operating layer so pages communicate signal, decision, action, evidence, gate movement, ownership, consequence, and resolution path.
- Capped Command Center leadership workflow/action lists so the first page reads as an executive cockpit instead of a full operating backlog.

## Workflow Layer Follow-Up

After the initial screenshot review, the root product issue was identified as workflow visibility rather than visual styling alone. The app looked credible, but several modules still risked reading as rich data inventories.

The remediation was not another page-by-page redesign. RybexOS now has a shared workflow layer documented in `docs/workflow-operating-model.md` and implemented through reusable workflow components. Command Center now presents leadership workflows first, and major modules show their workflow context near the top.

Before the next stakeholder demo, regenerate screenshots with `npm run visual:capture` and confirm the top sections make this operating pattern obvious:

Signal -> Decision -> Action -> Evidence -> Gate Movement.

Latest spot check:

- Desktop Command Center now shows a concise leadership workflow queue and capped required-action list; lower D5O detail remains long but is secondary.
- Desktop Pipeline clearly presents Pursuit Control workflow context and action queues before the detailed opportunity board.
- Desktop Daily Report workflow ends with a visible workflow outcome panel that ties field evidence to RFI/change control and D4 movement.
- Mobile Command Center stacks safely with no obvious horizontal overflow, though it remains a long enterprise cockpit below the fold.

## Route Review

| Route | Viewport | Rating | What works | Issues found | Severity | Recommended fix | Fix applied | Notes |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| `/command-center` | desktop | 8.5 | Strong executive cockpit, clear D5O model, operating actions feel real. | Long lower page has many equal-weight sections. | medium | Strengthen section separation and keep demo focused on top risks. | yes | Best opening page for stakeholders. |
| `/pipeline` | desktop | 8 | Go/no-go discipline is clear; metrics and opportunity cards feel operational. | Lower board/register density can feel spreadsheet-like in full-page capture. | medium | Improve shared hierarchy; demo the decision controls first. | yes | Credible pursuit-control page. |
| `/projects` | desktop | 8 | Contract baseline, D2 gates, and launch controls read as subcontractor-specific. | Long baseline detail section is dense. | medium | Use stronger section headings and leave detail as drilldown during demo. | yes | Good proof of D2 discipline. |
| `/mobilization` | desktop | 8 | D3 readiness story is obvious; blockers and work packages are visible. | Many readiness cards compete below the fold. | medium | Use shared section hierarchy and demo the gate table/blocked items first. | yes | Strong operations page. |
| `/field-execution` | desktop | 8 | Daily control, production, change prompts, safety/quality signals are credible. | Dense field signals can feel like multiple dashboards stacked together. | medium | Keep top action areas prominent; preserve full detail for operator review. | yes | Strong for senior operator demo. |
| `/rfis-submittals` | desktop | 7.8 | Information control story is clear and tied to field/change records. | Register density is high. | low | Keep summary/overdue items first in demo. | yes | Solid secondary proof point. |
| `/changes` | desktop | 8 | Commercial recovery and notice risk are easy to understand. | Some lower commercial exposure sections are visually heavy. | low | Demo notice deadline and backup queue first. | yes | Good commercial-control story. |
| `/billing` | desktop | 8.5 | Cash-at-risk, approved-not-billed, retainage, backup risk are excellent proof points. | Very long lower evidence and SOV sections. | medium | Keep executive summary and approved-not-billed queue prominent. | yes | One of the strongest buyer pages. |
| `/safety` | desktop | 7.8 | Safety blockers, JHAs, observations, and corrective actions are visible. | Similar card weights make triage slower than ideal. | low | Use top metrics and overdue actions as demo anchor. | yes | Credible without overbuilding safety module. |
| `/quality` | desktop | 7.8 | Inspection, deficiency, test, and punch evidence are tied to closeout. | Long evidence lists can feel dense. | low | Use section headings and closeout-risk framing. | yes | Works as D4/D5 evidence layer. |
| `/closeout` | desktop | 8.3 | Acceptance, punch, tests, final billing, retainage, and archive readiness are obvious. | Full-page view is very long; lower columns are dense. | medium | Demo package register and blocker list first. | yes | Strong final-recovery proof point. |
| `/reports` | desktop | 7.8 | Optimize story is clear; production intelligence and lessons learned complete the loop. | Could feel like reports inventory if shown too quickly. | medium | Anchor demo on production variance and improvement actions. | yes | Good close to executive narrative. |
| `/admin` | desktop | 8 | System readiness, persistence status, docs, and route health are credible. | It is necessarily technical and long. | low | Add compact visual QA review signal and keep demo to top readiness sections. | yes | Useful for investor/developer confidence. |
| `/command-center` | mobile | 7.5 | Content stacks safely and metrics remain readable. | Nav consumed too much first-screen space before fix. | medium | Convert mobile nav to compact horizontal rail. | yes | Re-capture required after fix. |
| `/field-execution` | tablet/mobile | 7.5 | Field execution remains readable on smaller widths. | Dense lower panels require scrolling. | low | Preserve stacking and reduce shell overhead. | yes | Acceptable for field device review. |
| `/field-execution/daily-report/new` | mobile | 8 | Guided daily report is usable and step sequence is clear. | Long workflow, but appropriate for daily report depth. | low | Keep controls full-width and readable. | yes | Strong workflow proof. |
| `/billing` | tablet/mobile | 7.5 | Cash and backup risk remain visible. | Commercial sections are long on mobile. | low | Demo mobile only if asked; desktop is stronger. | yes | No overflow observed in capture. |
| `/closeout` | tablet/mobile | 7.5 | Closeout blockers and package status remain readable. | Very long page on mobile. | low | Keep mobile review to top summary and package register. | yes | Acceptable. |
| `/reports` | tablet/mobile | 7.3 | Optimize loop remains legible. | Most susceptible to feeling like a data inventory. | medium | Demo production rates and improvement actions only. | yes | Needs future stakeholder polish if this becomes a headline page. |

## Good / Better / Best Assessment

Good:
- The app already feels like a real subcontractor operating platform, not a generic task board.
- The D5O lifecycle is clear from pursuit through closeout and optimization.
- Command Center, Billing, Closeout, Projects, and Mobilization are credible enough for an executive demo.
- Seed data names, commercial terms, readiness gates, and operating actions feel specific to infrastructure work.
- Status chips, metric cards, and page headers mostly hold together as one product family.

Better:
- Keep demos focused on executive summaries, blockers, decision queues, and one proof panel per module.
- Reduce the feeling of equal-weight lower-page content by making section boundaries stronger.
- Improve mobile first-screen efficiency so navigation does not dominate the page.
- Use Admin to show product maturity without overexplaining implementation details.

Best:
- Add role-specific executive/operator views after persistence and RBAC are real.
- Add selective drill-down pages so full module pages do not carry every register at once.
- Add a stakeholder-grade demo deck with curated screenshots and talk track.
- Add persisted activity history and document previews so operational records feel live.
- Add a measured chart layer only where it supports decisions: cash at risk, gate blockers, cycle time, production variance.

Competitor expectation:
Users familiar with Procore, Autodesk Build, ServiceNow, WorkBoard, Smartsheet, Monday.com, Asana, or Jira will expect clean navigation, consistent status language, fast scanability, and confidence that risks become actions. RybexOS meets the operating-model and specificity bar better than generic work-management tools. It still needs future drill-downs and role-specific trimming to feel as refined as top-tier enterprise platforms.

## Root Causes

- Page header consistency: strong overall; no material defect found.
- Metric row density: credible on desktop, stacked safely on mobile, but many modules use dense executive rows.
- Card spacing: acceptable, improved through shared section heading separation.
- Weak visual hierarchy: lower panels on long pages sometimes compete with primary risks.
- Too many equal-weight panels: main recurring issue in full-page screenshots.
- Tables too dense: acceptable for enterprise dashboards, but should be avoided as the first demo focus.
- Status chip inconsistency: no critical defect found; chips are readable enough for demo.
- Mobile overflow: no obvious horizontal overflow found in priority captures; mobile shell was too tall before fix.
- Workflow step layout weakness: daily report workflow is long but clear; no blocking issue.
- CTA clutter: primary/secondary CTAs are generally clear.
- Text too long: some cards are detail-heavy, but operationally credible.
- Section headings not strong enough: fixed with shared border and spacing.
- Brand polish gaps: no major color or typography break found.
- Executive story unclear: strongest on Command Center, Billing, Closeout; weaker on Optimize if shown without narration.

## Before / After Notes

Before:
- Mobile screenshots showed the sidebar/nav as a tall block before content.
- Long module pages had many adjacent panels with similar weight.
- Admin had visual QA tooling status but did not mention the review report or approval recommendation.

After:
- Mobile shell uses a compact horizontal navigation rail below 820px.
- Shared section headings now create clearer separation between operating areas.
- Admin includes the latest visual review report and the demo approval caveat.

## Remaining Known Issues

- Full-page screenshots remain long because the seed-backed demo intentionally shows the full operating lifecycle.
- Lower-page content can still feel dense if a stakeholder scrolls through every module without narration.
- The Optimize page is strategically important, but should be demoed as the learning loop rather than as a report archive.
- Browser connector QA remains unrelated to app health; local Playwright capture is the working visual QA path.

## Demo Recommendation

Status: approved with caveats.

Use the demo path from Command Center through Pipeline, Projects, Mobilization, Field Execution, Changes/Billing, Closeout, and Optimize. Keep each page anchored to the top summary and one operating proof point. Avoid scrolling every long register unless the audience asks for depth.

Recommended next build: Stakeholder Demo Pack / Executive Review Materials.

## UX Simplification Pass

Status: approved with minor caveats.

What improved:

- Command Center now starts with stage/gate status, next best action, and a compact leadership decision queue.
- Heavy supporting registers are hidden behind progressive disclosure.
- Major module pages inherit a simpler stage/gate/action/evidence pattern from `WorkflowModuleContext`.
- The visible workflow language is shorter and more action-oriented.
- Users can answer “what is blocked, who owns it, and what moves next?” faster.

Remaining complexity:

- Guided workflows still carry broad demo fields and should receive a future step-level disclosure pass.
- Some module registers remain dense below the fold, but they are less dominant in the first view.
- Admin remains intentionally technical because it proves architecture readiness.

Demo readiness:

- Approved with minor caveats for stakeholder demo.
- Keep the demo anchored on next best action, decision queue, and one proof point per module.

## Role-Based Validation Pass

Status: approved with minor caveats.

What improved:

- Major modules now show a compact role context band: built for, see first, next move.
- Guided workflow entry points now show the intended audience and operating outcome.
- Decision queues make owner and due date more visible.
- Workflow outcome panels now clarify who the workflow serves and what it produces.

Remaining caveats by role:

- Executive: lower-page records remain dense; keep the demo in the first viewport unless asked.
- Field supervisor: daily report remains long; a future mobile-first task flow would be stronger.
- Finance: Billing is still detail-heavy because cash control needs backup, waivers, aging, and exposure in one place.
- Admin: readiness content is intentionally technical; keep it to status, boundary, and verification proof.

Demo recommendation remains approved with minor caveats.
