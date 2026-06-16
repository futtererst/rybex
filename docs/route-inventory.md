# Route Inventory

All current routes are seed-backed by default. Implementation status is
demo-ready unless noted otherwise.

| Route | Module | Purpose | Demo Proof Point | Runtime Data Source | Status |
| --- | --- | --- | --- | --- | --- |
| `/command-center` | Command Center | Executive operating cockpit | Shows risk, gates, cash, field, closeout, and action signals | Seed data | Implemented |
| `/pipeline` | Pipeline | D1 opportunity qualification | Shows go/no-go discipline before estimating | Seed data | Implemented |
| `/pipeline/new` | Pipeline | Guided opportunity intake | Captures scope, documents, risk, fit, and pursuit decision | Local preview / seed context | Implemented |
| `/projects` | Projects | D2 contract/project baseline | Shows contract, scope, budget, schedule, and D2 blockers | Seed data | Implemented |
| `/projects/new` | Projects | Guided project setup | Builds D2 readiness summary before mobilization planning | Local preview / seed context | Implemented |
| `/mobilization` | Mobilization | D3 field readiness | Shows crew, equipment, material, access, safety, quality, and work package readiness | Seed data | Implemented |
| `/mobilization/new` | Mobilization | Guided mobilization plan | Builds D3 field-start decision | Local preview / seed context | Implemented |
| `/field-execution` | Field Execution | D4 daily field control | Shows daily reports, production, blockers, change prompts, safety, and quality signals | Seed data | Implemented |
| `/field-execution/daily-report/new` | Field Execution | Guided daily report | Captures labor, equipment, quantities, photos/tests, delays, and signoff | Local preview / seed context | Implemented |
| `/rfis-submittals` | RFIs / Submittals | Information control | Shows overdue RFIs, submittal blockers, and linked records | Seed data | Implemented |
| `/rfis-submittals/rfi/new` | RFIs / Submittals | Guided RFI creation | Formalizes field questions and impact review | Local preview / seed context | Implemented |
| `/rfis-submittals/submittal/new` | RFIs / Submittals | Guided submittal creation | Captures package, dates, attachments, and field readiness impact | Local preview / seed context | Implemented |
| `/changes` | Change Control | Commercial recovery control | Shows notice deadlines, backup gaps, pricing status, and exposure | Seed data | Implemented |
| `/changes/new` | Change Control | Guided change event | Captures changed condition, notice, backup, pricing, and decision | Local preview / seed context | Implemented |
| `/billing` | Billing | Pay application support | Shows cash at risk, approved-not-billed changes, retainage, lien waivers, and backup gaps | Seed data | Implemented |
| `/billing/pay-application/new` | Billing | Guided pay application | Builds billing readiness and missing backup summary | Local preview / seed context | Implemented |
| `/safety` | Safety | Safety control | Shows JHAs, observations, incidents, corrective actions, and safety blockers | Seed data | Implemented |
| `/safety/record/new` | Safety | Guided safety record | Captures observation/incident/corrective action and escalation | Local preview / seed context | Implemented |
| `/safety/jha/new` | Safety | Guided JHA/toolbox | Captures hazards, controls, PPE, and crew acknowledgment | Local preview / seed context | Implemented |
| `/quality` | Quality | Quality control | Shows inspections, deficiencies, tests, punch, and evidence gaps | Seed data | Implemented |
| `/quality/inspection/new` | Quality | Guided inspection | Captures checklist, criteria, results, photos/tests, and deficiencies | Local preview / seed context | Implemented |
| `/quality/deficiency/new` | Quality | Guided deficiency/punch | Captures issue, impact, correction, verification, and closeout risk | Local preview / seed context | Implemented |
| `/closeout` | Closeout | D5 acceptance package | Shows closeout readiness, missing evidence, final billing, retainage, and acceptance risks | Seed data | Implemented |
| `/closeout/package/new` | Closeout | Guided closeout package | Builds D5 acceptance and archive readiness summary | Local preview / seed context | Implemented |
| `/reports` | Optimize | Lessons learned and intelligence | Shows scorecards, production rates, GC/vendor performance, actions, and risk updates | Seed data | Implemented |
| `/reports/lessons-learned/new` | Optimize | Guided lessons learned review | Captures performance variance, production updates, and improvement actions | Local preview / seed context | Implemented |
| `/admin` | Admin | System readiness | Shows module maturity, route coverage, persistence status, RBAC/audit posture, and demo docs | Seed data/config | Implemented |
