# UX Simplification System

RybexOS should feel like an operating platform, not a coded operating manual. The UX standard is:

Stage -> Gate -> Blockers -> Actions -> Evidence -> Next Movement

This sits on top of the existing workflow model:

Signal -> Decision -> Action -> Evidence -> Gate Movement

## Rules

## 1. Decision-First Layout

Major pages should start with:

1. PageHeader
2. StageGateSummary or workflow summary
3. NextBestAction
4. DecisionQueue
5. Key metrics
6. Primary queue/register
7. Progressive details

The user should know what to do before seeing the full record inventory.

## 2. Stage Gate Summary

Use `StageGateSummary` to show:

- current phase
- gate
- status
- readiness
- blocker
- decision
- action
- evidence
- next movement

Keep labels short: Current gate, Blocker, Decision, Action, Evidence, Next.

## 3. Decision Queue

Use `DecisionQueue` for top actions only. Group mentally by:

- Needs decision
- Blocked
- Overdue
- Ready for review

Rows should show title, owner, due date, decision/action, and CTA.

## 4. Evidence Checklist

Use `EvidenceChecklist` when proof is the issue. Do not explain evidence in paragraphs. Show item, status, owner, due date, and source.

## 5. Next Best Action

Use `NextBestAction` to answer:

- what should happen next
- why it matters
- what happens after

Keep it short enough to read in a few seconds.

## 6. Progressive Disclosure

Use `ProgressiveDetails` for supporting records, dense exception lists, and lower-page control inventory.

Default visible content should tell the user what matters. Details should appear only when requested.

## 7. Reduced Text Standard

Prefer:

- Gate blocked: scope matrix missing.
- Submit change notice.
- Evidence needed: daily report, photos, T&M ticket.
- Next: pricing required.

Avoid:

- long descriptions
- repeated operating-model explanation
- paragraphs inside cards
- equal-weight detail panels

## 8. Guided Workflow Standard

Guided workflows should keep:

- clear stepper
- short step title
- required fields obvious
- outcome panel at the end

Future targeted pass: collapse optional/supporting fields per step and make review panels more visual.

## 9. Brand Standard

Keep:

- deep navy shell
- clean white/gray surfaces
- orange primary action
- calm enterprise tones
- severity colors for blockers and urgency

Do not add decorative charts or generic SaaS visuals.
