# User Workflow Remediation Backlog

CTA outcome clarity follow-up: `docs/cta-outcome-remediation-backlog.md` tracks whether working CTAs also produce clear visible outcomes.

## Manual Founder Review Failures

| Observed behavior | Why it failed | Fix implemented | Verification | Status |
| --- | --- | --- | --- | --- |
| Command Center `Open priority` routed to `/projects` without a focused task | User landed on Projects and still had to infer the task | Replaced vague primary CTA generation with task outcome contract and focused task panel | QA now fails cross-page cockpit CTAs without focus metadata and `You are here to` instruction | Completed |
| Pipeline `Open action details` highlighted only the generic details bar | User saw a section highlight, not the exact action or next step | Same-page cockpit CTAs now open/focus the focused task panel before details | QA now fails cockpit CTAs that target only `#details-records` | Completed |

## Must Fix Before Usability Review

| Page | CTA label | Current behavior | Expected behavior | User impact | Recommended fix | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| All major pages | No same-page no-change failures detected by automated safe-click QA | CTAs produced navigation, details expansion, scroll/focus, modal, or feedback | Keep primary paths meaningful | Users can keep moving | Continue monitoring during manual QA | P0 | Completed |

## Should Fix Before Executive Demo

| Page | CTA label | Current behavior | Expected behavior | User impact | Recommended fix | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /admin | No automated dead CTA detected | Readiness CTAs responded safely | Admin remains scannable | Low risk | Keep status references clear | P1 | Completed |

## Later

| Page | CTA label | Current behavior | Expected behavior | User impact | Recommended fix | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| All pages | Record-level CTAs inside dense details | Many are inspect/review links in demo content | Mature into record drawers after persistence | Drill-down remains broad | Add record-specific drawers when production persistence expands | P2 | Deferred |
