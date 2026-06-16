# UX Simplification Audit

RybexOS is functionally broad and workflow-aware, but the interface was starting to feel like an operating manual. This audit identifies the system-level fixes needed to make the product easier to understand.

## Findings

| Route | Issue | Severity | Root Cause | Recommended System-Level Fix | Fix Level |
| --- | --- | --- | --- | --- | --- |
| `/command-center` | Too many workflow bands, phase maps, metrics, action cards, and exception lists were visible at once. | high | Leadership page showed too much source detail before the next decision was clear. | Lead with StageGateSummary, NextBestAction, and DecisionQueue. Move support registers into ProgressiveDetails. | component + page |
| `/command-center` | “What should I do next?” was buried below explanatory workflow text. | high | Workflow pattern was described more than acted on. | Put next action and consequence in the top viewport. | component |
| `/pipeline` | Go/no-go workflow was visible but competed with metrics and detailed records. | medium | Equal-weight sections. | Shared WorkflowModuleContext now renders stage/gate summary and compact decisions first. | component |
| `/projects` | D2 gate blockers were not visually dominant enough. | medium | Baseline artifacts and project cards carried similar weight. | StageGateSummary surfaces gate, blocker, action, evidence, and next movement. | component |
| `/mobilization` | Field-start readiness needed a clearer approve/hold mental model. | medium | Readiness details were spread across panels. | StageGateSummary and NextBestAction clarify field-start gate movement. | component |
| `/field-execution` | D4 field signals competed with daily report detail. | medium | Field evidence and escalation prompts were displayed with similar priority. | DecisionQueue shows only blocked/overdue/review actions first. | component |
| `/rfis-submittals` | Information control risk could read like a register. | medium | RFI/submittal tables were detailed before the blocker/action. | Stage/gate/action pattern clarifies what approval or clarification blocks work. | component |
| `/changes` | Change recovery needed stronger notice/backup/action hierarchy. | medium | Commercial registers had many statuses. | NextBestAction highlights notice, backup, or pricing movement. | component |
| `/billing` | Cash risk and billing backup could be hidden among many pay app fields. | high | Finance data was dense and register-heavy. | DecisionQueue surfaces cash, backup, pay app aging, and waiver issues first. | component |
| `/safety` | Safety actions were complete but too prose-heavy. | medium | Corrective action context repeated. | EvidenceChecklist and concise labels should replace paragraphs in future targeted pass. | component |
| `/quality` | Evidence gaps and punch risks needed faster scanning. | medium | Test, deficiency, punch, and inspection panels carried equal weight. | Stage/gate summary makes closeout/billing impact visible before detail. | component |
| `/closeout` | Acceptance blockers were competing with requirement inventory. | high | D5 documentation detail appeared before gate movement. | StageGateSummary and DecisionQueue surface acceptance/final billing blockers first. | component |
| `/reports` | Optimize read as many intelligence categories rather than a learning action queue. | medium | Scorecards, rates, profiles, actions, and risks were equally weighted. | DecisionQueue and NextBestAction emphasize what changes before the next job. | component |
| Guided workflows | Some flows still feel like long forms. | medium | Many fields are visible up front. | Preserve stepper/outcome panel; future pass should add per-step progressive details. | page |
| Tables/registers | Large tables can dominate first view. | medium | Data display precedes decision in some modules. | Move supporting registers below actions or behind ProgressiveDetails. | component |
| Role context | Role exists but does not always simplify the message. | low | Demo role is visible mostly in shell/Admin. | Future pass should tune labels for executive, PM, field, finance, safety, and quality contexts. | component |

## Root Causes

- Page hierarchy drifted toward data inventory.
- Too many equal-weight sections were visible at once.
- Workflow language sometimes explained the model instead of showing the next move.
- Detailed registers appeared before gate movement and decision queues.
- Guided workflows have good structure but still show too much detail per step.

## System-Level Fix Applied

The app now adds a UX simplification layer:

Stage -> Gate -> Blockers -> Actions -> Evidence -> Next Movement

Implemented pieces:

- `StageGateSummary`
- `DecisionQueue`
- `EvidenceChecklist`
- `NextBestAction`
- `ProgressiveDetails`

These components reduce visible density and make action/gate movement clearer across major modules without adding new business scope.
