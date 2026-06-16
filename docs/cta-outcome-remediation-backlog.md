# CTA Outcome Remediation Backlog

## Manual Founder Review Failures

| Observed behavior | Why it failed | Fix implemented | Verification | Status |
| --- | --- | --- | --- | --- |
| Command Center `Open priority` routed generically to `/projects` | User did not know which Projects task needed attention | Concrete task labels and focus metadata now route to a focused task panel | Primary cockpit QA requires focus metadata and `You are here to` | Completed |
| Pipeline `Open action details` only highlighted the Pipeline Details bar | The user saw a generic section, not an action outcome | Same-page cockpit CTAs now focus the exact task panel | QA fails primary CTAs that only target `#details-records` | Completed |

## Must Fix Before Founder Review

| Page | CTA | Current outcome | Why it is unclear | Recommended fix | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| All priority routes | No unresolved primary/header CTA clarity failures detected | Outcomes route, focus, expand, highlight, or show feedback | No founder-review blocker found | Keep outcome QA in the demo gate | P0 | Completed |

## Should Fix Before Executive Demo

| Page | CTA | Current outcome | Why it is unclear | Recommended fix | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Details sections | No unresolved secondary clarity failures detected by automated QA | Secondary CTAs produced visible outcomes | Low risk | Continue manual review for deep record actions | P1 | Completed |

## Later

| Page | CTA | Current outcome | Why it is unclear | Recommended fix | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| All pages | Deep record actions | Many detailed records remain demo/read-only | Full record drawers need persistence/auth maturity | Add record-level drawers after production data contracts mature | P2 | Deferred |
