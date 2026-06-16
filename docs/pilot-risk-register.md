# Pilot Risk Register

| Risk | Impact | Likelihood | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| Database mode misconfiguration | Users may see empty data, unexpected pilot data, or failed writes. | Medium | Keep seed mode default; document `.env.local`; use Admin diagnostics before pilot sessions. | Technical support owner | Open |
| Service key exposure | Private Supabase keys could leak through docs, screenshots, logs, or demo packages. | Medium | Keep keys only in `.env.local`; exclude env files from packages; never display secrets in Admin. | Technical support owner | Open |
| RLS not enabled | Database rows are not protected by production-grade row policies. | High | Limit pilot to internal users; do not use external access; complete RLS review before live production use. | Security owner | Open |
| Storage access not hardened | Evidence files could be mishandled if upload pilot is treated as production storage. | High | Avoid sensitive documents; keep bucket private; do not claim production document management. | Security owner | Open |
| Upload pilot not verified | Evidence upload may fail or create trust issues during pilot. | Medium | Use local/demo evidence actions unless upload pilot is explicitly configured and tested. | Technical support owner | Open |
| Local/demo state confusion | Users may think local browser actions are durable production records. | High | Label local/demo behavior; use Admin to show current modes; train pilot users. | Pilot owner | Open |
| Incomplete production auth | Users cannot rely on real identity, login, or access control. | High | Use limited internal users only; avoid sensitive data; implement auth before expanded pilot. | Product owner | Open |
| No external notifications | Owners may miss due/overdue actions if they do not open the app. | Medium | Review in-app notifications during weekly pilot cadence; do not rely on email/SMS. | Pilot owner | Open |
| Visual complexity regression | Pages could become too dense again as pilot issues are added. | Medium | Apply user-knows-what-to-do checklist; keep details behind disclosure where possible. | UX owner | Open |
| User misunderstanding of demo vs pilot status | Stakeholders may overestimate readiness. | High | Use readiness docs and Admin status; repeat "controlled pilot candidate, not production-ready." | Sponsor | Open |
| Incomplete reporting | Leaders may expect exportable reports or live analytics that do not exist. | Medium | Define manual weekly review outputs; defer reporting packs until live data is durable. | Operations owner | Open |
| Insufficient role training | Users may not know where to start or what to do next. | Medium | Use role-based pilot scripts and short role walkthroughs. | Pilot owner | Open |
