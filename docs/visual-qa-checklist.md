# Visual QA Checklist

Browser screenshot QA remains blocked in this Windows sandbox when the connector
reports `windows sandbox failed: spawn setup refresh`. Use the local capture
workflow in `docs/local-visual-qa-runbook.md` with this checklist.

Automated capture command:

```powershell
npx playwright install chromium
npm run visual:capture
```

Output path:

- `visual-qa-output/desktop/`
- `visual-qa-output/tablet/`
- `visual-qa-output/mobile/`
- `visual-qa-output/manifest.json`

If automated capture is unavailable, capture screenshots manually into
`visual-qa-output/manual/` and complete `docs/visual-qa-report-template.md`.

## App Shell And Navigation

- Brand, demo role, and primary navigation are visible.
- Implemented modules are linked through central navigation.
- Limited role states are understandable and do not block demo navigation.
- Mobile navigation wraps without horizontal overflow.

## Page Headers

- Every major module has eyebrow, title, one-sentence purpose, context, and clear actions.
- Primary CTA is visually dominant.
- Secondary CTAs do not compete with the primary action.
- D5O phase or operating context is visible.

## Metrics

- Summary metrics use consistent card styling.
- Critical, warning, success, info, blocked, and neutral tones are consistent.
- Metric labels are short and operational.
- Helper text explains why the number matters.

## Cards, Panels, And Tables

- Cards and panels use the shared border radius, surface, line, and shadow tokens.
- Tables and dense registers remain readable at desktop width.
- High-risk rows/cards are visually distinct.
- No card reads like lorem ipsum or placeholder copy.

## Status Chips

- Success means complete/approved/positive.
- Warning means attention needed.
- Critical means urgent or high-risk.
- Blocked is distinct from critical.
- Closed/complete states are clear but subdued.

## Operating Actions

- Each action states business impact and required action.
- Owner and due date are visible.
- CTA takes the user to the relevant module.
- Actions are not generic activity messages.

## Workflow Layer

- Command Center shows leadership workflows before lower-detail module summaries.
- Major modules show the relevant workflow context and primary operating question.
- Workflow cards clearly communicate signal, decision, action, evidence, and gate/status movement.
- Workflow queues group work by decision/action state rather than by raw record type only.
- Consequence language is specific: field blocked, notice deadline risk, cash at risk, acceptance blocker, or operating-model update.
- Workflow transaction buttons are visible but not visually dominant.
- Transaction modals are readable on desktop and mobile.
- Outcome banners explain what moved after a demo transaction.
- Demo/local-state limitation is visible without overwhelming the page.

## Guided Workflows

- Workflow title and purpose are clear.
- Step sequence is visible or the form sections are clearly ordered.
- Review/summary section explains the decision outcome.
- Final review includes the workflow outcome: signal addressed, decision, action, evidence, and next gate/status movement.
- Back path to the source module is available.
- Helper text explains why major fields matter.

## Empty, Error, Loading, Permission States

- States use the shared enterprise components.
- Copy is operational and tells the user what to do next.
- Permission limitations are framed as role/context controls, not broken pages.

## Responsive Review

- Desktop: summary rows and main panels scan cleanly.
- Tablet: grids collapse to two columns where appropriate.
- Mobile: metrics stack, CTAs become full-width, cards remain readable.
- No horizontal overflow in app shell, tables, cards, or workflow forms.

## Executive Demo Readiness

- Command Center is the strongest first impression.
- Admin readiness page is credible but not overly technical.
- Demo script matches actual route names and page labels.
- Known limitations are stated honestly.
- `docs/visual-qa-review-report.md` is complete and the demo approval status is understood before stakeholder demo.
- Current screenshot review status: approved with caveats. Keep demos focused on top summaries, blockers, decision queues, and one proof panel per module.

## Brand Consistency

- Deep navy shell, white/soft-gray panels, orange CTA, slate text.
- No decorative charts or visual noise.
- Tone is disciplined infrastructure operations, not consumer SaaS.
