# Pilot Readiness Scorecard

Scale:

- 0 = not started
- 1 = concept/scaffold
- 2 = demo only
- 3 = pilot candidate
- 4 = controlled pilot ready
- 5 = production ready

Current overall rating: controlled internal pilot candidate.

Production readiness status: not production-ready.

Pilot Mode status: `/pilot` is available as a guided operating slice for the three verified workflow completion proofs. It improves first-use focus but does not change production readiness.

| Area | Score | Rationale | Gap | Next Action |
| --- | ---: | --- | --- | --- |
| D5O workflow coverage | 4 | Full D5O lifecycle is represented and tied to workflow, gates, evidence, and Optimize learning. | Needs validation against real internal projects. | Pilot 1-2 projects and log model gaps. |
| UX clarity | 4 | Stage/gate/action/evidence simplification, universal page summaries, and visual QA are complete. | Lower-page density and edge cases may still need cleanup. | Use pilot scripts to observe first-use friction. |
| Role clarity | 4 | Role journeys, role context, and RBAC foundations exist. | No full role-specific workspaces or production login. | Validate each role's first 60 seconds in pilot. |
| Workflow transaction execution | 3 | Local transaction MVP works, database workflow write verifier passed previously, and the Billing Backup Blocker -> Cash Recovery proof flow completes in local demo state. | Only selected workflow actions are complete end-to-end. | Test the billing proof flow with users before expanding completion patterns. |
| Supabase persistence | 3 | Core, D1/D2, workflow transaction, evidence, and security scaffolds exist. | Broad module persistence is not enabled. | Do not expand persistence until pilot findings are reviewed. |
| Auth/RBAC | 3 | Demo auth and workflow transaction permission enforcement exist. | Production login, invitations, external users, and active RLS are missing. | Implement Supabase Auth/session resolution before live-data rollout. |
| Evidence handling | 3 | Evidence is modeled, displayed, derived, and locally actionable. | Production file governance is incomplete. | Track evidence in pilot, but avoid sensitive production documents. |
| Upload/storage | 2 | Private Supabase Storage pilot scaffold exists. | Signed URLs, storage policies, malware scanning, retention, and production document controls are missing. | Keep uploads isolated until security review approves them. |
| Notifications/escalations | 2 | In-app alerts and escalation queues are derived from workflows/evidence. | No external delivery, persistence, scheduler, or delivery logs. | Use in-app alerts only during pilot. |
| RLS/security | 1 | RLS and storage security scaffolds exist. | RLS is not enabled and production file access is not hardened. | Complete human security review before enabling policies. |
| Reporting/analytics | 2 | Command Center, modules, Optimize, and readiness data provide deterministic insight. | No live reporting views, scheduled packs, exports, or analytics optimization. | Define weekly operations report after workflow persistence matures. |
| Admin/system readiness | 4 | Admin shows platform mode, diagnostics, security, evidence, notification, and readiness posture. | Not a full production admin console. | Use Admin as pilot control point. |
| Integration readiness | 1 | Integration strategy is documented. | No accounting, GC platform, identity, email, document, or chat integration. | Defer integrations until internal workflow is proven. |
| Deployment readiness | 3 | Build, smoke, audit, verify, visual capture, package, and deployment docs exist. | No production environment separation, monitoring, backups, or incident response. | Use private/local demo deployment only. |
| Operational support readiness | 2 | Demo scripts, pilot scripts, verification, and support guidance exist. | No SLA, support runbook, training package, or incident process. | Assign pilot support owner before launch. |

## Summary

RybexOS is strong enough for a controlled internal pilot if the pilot is limited, supervised, and clear about demo/pilot boundaries. It is not ready for production operations, external users, sensitive document storage, or system-of-record use.

The pilot should validate the simplified page contract: stage / module header,
next required actions, gate / workflow readiness, evidence required, active
risks, and details available through progressive disclosure.

## Pilot Recommendation

Proceed only with a controlled internal pilot after human approval of:

- Pilot users and roles.
- Pilot projects.
- Data handling rules.
- Supabase mode and local fallback policy.
- Security limitations.
- Support and weekly review cadence.

## Do Not Approve Yet

- Production launch.
- External GC/client access.
- Broad production database writes.
- Production document storage.
- External notification delivery.
- RLS/security claims without a tested policy rollout.
## Workflow Completion Proofs

Current completion score remains controlled-pilot candidate only. Billing Backup and Field Issue escalation demonstrate that RybexOS can move focused tasks forward in local/demo state, but broader persistence, production auth/RLS, and real record creation remain gaps.

The completion proof layer is now registry-driven, which improves repeatability but does not change production readiness.
## Workflow Completion Proof Update

RybexOS now has three local/demo workflow completion proofs: Billing Backup Blocker -> Cash Recovery, Field Issue -> RFI / Change Escalation, and Closeout Requirement -> Acceptance / Final Billing Release. This improves workflow transaction usability confidence, but it does not change the production readiness score for persistence, RLS, production uploads, or external notifications.

## Pilot Slice Lockdown

Pilot readiness now depends on the locked three-workflow acceptance gate. `npm run pilot:acceptance` proves the critical production-build-safe path, and `npm run pilot:acceptance-visual` captures the visual companion review. Local/demo remains default, the DB bridge remains opt-in, and the local dev runtime caveat is documented separately from production build server acceptance.

Score posture is unchanged: Controlled internal pilot candidate — not production ready.
