# Enterprise Operating-System Backlog

Status note: Auth/RBAC foundation now exists for workflow transaction writes in
demo/local and database pilot modes. Production login, active RLS, external user
models, route middleware, and full approval matrix enforcement remain backlog
items.

Current maturity: credible seed-backed operating-system prototype.

Target maturity: enterprise-grade operational platform for subcontracted infrastructure work.

Priority scale:

- P0: Required before production use.
- P1: Required for an internal operational MVP.
- P2: Required for scale, control depth, or broader rollout.
- P3: Valuable after the operating foundation is stable.

## A. Persistence And Data Platform

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Database runtime | Enable a real Postgres/Supabase-backed runtime behind the existing data-source flag. | Real records must survive sessions and support reporting. | P0 | Phase 1/2 schema scaffolds | Phase 1 | Converts demo workflows into durable operations. | High: broad data-shape parity risk. |
| Repository implementation | Implement typed repositories for seed and database sources. | Keeps pages independent of storage details. | P0 | Database runtime | Phase 1 | Supports safe route-by-route migration. | Medium: contract drift. |
| Migration execution | Apply reviewed SQL migrations in a controlled local/dev database. | Validates schema before production. | P0 | Schema approval | Phase 1 | Reduces data debt before writes begin. | Medium: rollback discipline needed. |
| Seed/database fallback | Preserve seed mode and allow database mode only when explicitly enabled. | Protects demos and rollback. | P0 | Data-source selector | Phase 1 | Safe adoption path. | Low. |
| Status history | Persist status movements for high-value records. | Gates, approvals, changes, pay apps, and closeout need traceable movement. | P0 | Database runtime | Phase 1 | Auditability and workflow integrity. | Medium: volume and consistency. |
| Audit persistence | Persist audit events for sensitive transactions. | Approval and commercial records require evidence of who did what. | P0 | Database runtime | Phase 1 | Production trust and dispute support. | Medium. |
| Data validation | Add server-side validation for create/update operations. | Prevents bad records entering operating workflows. | P1 | Repository writes | Phase 1 | Safer transactions. | Medium. |
| Backup/restore | Define backup, restore, and point-in-time recovery expectations. | Production operating data is business-critical. | P1 | Database provider | Phase 4 | Resilience. | Medium. |

## B. Authentication, RBAC, And Security

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login/auth provider | Add real identity provider and session handling. | Users must be known before enforcing ownership. | P0 | Persistence foundation | Phase 2 | Enables secure internal use. | High: auth/session edge cases. |
| Role enforcement | Apply existing RBAC permissions to routes and mutations. | Demo role context must become real protection. | P0 | Auth provider | Phase 2 | Prevents unauthorized actions. | High if scattered. |
| Project-level access | Restrict project records by membership and role. | PMs and field users should see relevant work only. | P0 | Workspace memberships | Phase 2 | Data separation. | Medium. |
| Finance-sensitive access | Restrict margin, pay app, cash, retainage, and cost data. | Commercial data is sensitive. | P0 | Role enforcement | Phase 2 | Executive and finance control. | Medium. |
| External user model | Model GC/client/vendor portal users separately from employees. | Future collaboration cannot expose internal data. | P2 | Auth/RBAC | Phase 5 | Partner collaboration. | High. |
| RLS policies | Add Postgres/Supabase row-level security. | Enforces security below the application layer. | P0 | Auth and scoping columns | Phase 2 | Defense in depth. | High: policy bugs can leak or block data. |
| Audit security events | Audit role changes, login-sensitive actions, and permission changes. | Security actions need traceability. | P1 | Audit persistence | Phase 2 | Compliance and incident response. | Medium. |

## C. Workflow Transactions

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Go/no-go approval | Complete D1 approve/hold/no-bid transaction. | Protects pursuit discipline. | P0 | Workflow transaction engine | Phase 1 | Converts scoring into controlled decision. | Medium. |
| D2 gate approval | Approve or hold contract baseline movement. | Prevents unbaselined work from entering D3. | P0 | Projects repository | Phase 1 | Enforces operating discipline. | Medium. |
| D3 field-start approval | Approve or hold mobilization for field start. | Blocks unsafe or unready starts. | P0 | Mobilization data | Phase 3 | Field risk reduction. | Medium. |
| Daily report submission | Submit report with quantities, issues, evidence, and signoff. | D4 proof is the backbone of change, billing, and closeout. | P0 | Daily report writes | Phase 3 | Field control and recovery. | High. |
| RFI creation/closure | Create, submit, answer, close, and link RFIs. | Controls information blockers. | P1 | RFI repository | Phase 3 | Reduced field ambiguity. | Medium. |
| Change event lifecycle | Capture notice, backup, pricing, approval, billing movement. | Protects margin recovery. | P0 | Change repository | Phase 3 | Commercial protection. | High. |
| Pay application submission | Submit pay apps with backup, lien waiver, and change inclusion. | Converts work into cash. | P1 | Billing repository | Phase 3 | Cash control. | High. |
| Safety corrective action verification | Resolve safety actions with verification. | Prevents open safety exposure. | P0 | Safety writes | Phase 3 | Safety accountability. | Medium. |
| Quality deficiency closure | Correct and verify deficiencies/punch. | Protects acceptance and closeout. | P1 | Quality writes | Phase 3 | Reduced rework and closeout delay. | Medium. |
| Closeout submission/acceptance | Submit package and record GC/client response. | Enables final billing and retainage. | P1 | Attachments and closeout writes | Phase 3 | Completion proof. | High. |
| Lessons learned publication | Publish lessons and assign improvement actions. | Closes the Optimize loop. | P2 | Optimize writes | Phase 4 | Continuous improvement. | Medium. |

## D. Approvals And Decision Rights

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Approval matrix | Define which roles approve each gate and transaction. | Prevents unclear decision rights. | P0 | RBAC architecture | Phase 2 | Governance. | Medium. |
| Delegation | Allow temporary delegated approvals. | Operations cannot stall when approvers are unavailable. | P2 | Approval matrix | Phase 4 | Continuity. | Medium. |
| Conditional approvals | Approve with required follow-up conditions. | Matches real subcontractor operations. | P1 | Workflow transactions | Phase 2 | Controlled flexibility. | Medium. |
| Overrides | Allow admin/executive override with reason. | Handles urgent field realities. | P1 | Audit persistence | Phase 2 | Business continuity. | High: misuse risk. |
| Audit comments | Require comments on approvals/holds/overrides. | Decisions need context. | P0 | Audit persistence | Phase 1 | Defensible decisions. | Low. |
| Approval history | Show decision timeline per record. | Users need to understand why status changed. | P1 | Status history | Phase 2 | Transparency. | Medium. |

## E. Document And Attachment Management

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Upload | Upload files to private storage. | Field evidence and project controls need documents. | P0 | Object storage decision | Phase 3 | Real evidence capture. | High. |
| Private storage | Store files outside public web access. | Protects project, safety, and commercial records. | P0 | Auth/RLS | Phase 3 | Security. | High. |
| Metadata | Persist attachment title, type, owner, version, source. | Search and package assembly need structure. | P0 | Attachment schema | Phase 3 | Document control. | Medium. |
| Versioning | Track revisions for drawings, submittals, closeout docs. | Avoids field use of stale documents. | P1 | Metadata | Phase 4 | Quality and dispute control. | Medium. |
| Record linking | Link attachments through entity attachment rows. | Evidence must be reusable across records. | P0 | Attachment metadata | Phase 3 | Cross-module proof. | Medium. |
| Preview/download | Allow safe viewing and download. | Users must inspect evidence. | P1 | Private storage | Phase 4 | Usability. | Medium. |
| Closeout package assembly | Bundle accepted records into a package. | D5 requires delivery-ready evidence. | P1 | Attachments and closeout writes | Phase 4 | Acceptance speed. | High. |
| Retention rules | Define archival and deletion policy. | Project records may have legal retention requirements. | P2 | Production policy | Phase 5 | Compliance. | Medium. |

## F. Notifications And Escalation Engine

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Due soon | Notify owners before due dates. | Prevents avoidable misses. | P1 | Workflow transactions | Phase 2 | Timely action. | Medium. |
| Overdue | Escalate past-due workflows. | Keeps blocked work visible. | P1 | Ownership and due dates | Phase 2 | Accountability. | Medium. |
| Blocked | Alert leaders when work is blocked. | Field, billing, and closeout blockers need visibility. | P1 | Workflow derivation | Phase 2 | Fast intervention. | Medium. |
| Awaiting approval | Notify approvers when decision is needed. | Gates should not stall silently. | P1 | Approval matrix | Phase 2 | Faster decisions. | Medium. |
| Missed notice window | Escalate change notice risk. | Notice misses create margin leakage. | P0 | Change events | Phase 3 | Commercial protection. | High. |
| Missing daily report | Escalate absent D4 proof. | Daily proof drives billing/change/closeout. | P0 | Daily report writes | Phase 3 | Field discipline. | Medium. |
| Pay app aging | Alert finance/PM when payment ages. | Cash needs active follow-up. | P1 | Billing writes | Phase 3 | Cash control. | Medium. |
| Safety/quality escalation | Escalate critical safety or quality exposure. | High-consequence issues need urgent action. | P0 | Safety/quality writes | Phase 3 | Risk control. | High. |
| Closeout blocker escalation | Escalate missing D5 evidence and retainage blockers. | Acceptance and final payment depend on closure. | P1 | Closeout writes | Phase 3 | Faster final recovery. | Medium. |

## G. Master Data Management

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Companies | Central GC/client/vendor/company records. | Prevents duplicate partner names. | P1 | Persistence | Phase 4 | Cleaner reporting. | Medium. |
| Contacts | Shared contacts by company/project. | Supports notices, RFIs, pay apps, and approvals. | P1 | Companies | Phase 4 | Communication control. | Medium. |
| Employees | Internal people records. | Ownership and permissions need reliable users. | P0 | Auth | Phase 2 | Accountability. | Medium. |
| Crews | Crew roster and crew type records. | Field planning and productivity need crew context. | P1 | Employees | Phase 4 | Resource planning. | Medium. |
| Vendors | Vendor profiles and performance. | Procurement and Optimize need structured vendor data. | P2 | Companies | Phase 4 | Vendor control. | Medium. |
| Equipment | Equipment inventory and readiness. | Mobilization and field execution depend on equipment. | P2 | Master data foundation | Phase 4 | Resource discipline. | Medium. |
| Materials | Material catalog and lead-time context. | Procurement, submittals, and billing need consistent materials. | P2 | Procurement foundation | Phase 4 | Procurement control. | Medium. |
| Cost codes | Shared cost code library. | Billing, production, estimates, and forecasting need alignment. | P0 | Financial controls | Phase 4 | Financial reporting. | High. |
| Service lines | Canonical service line definitions. | Pipeline, projects, optimize need consistency. | P1 | Existing config | Phase 4 | Portfolio clarity. | Low. |
| Project types | Canonical project type library. | Estimating and performance comparison need consistency. | P1 | Existing config | Phase 4 | Better intelligence. | Low. |
| Regions | Region/market library. | Risk and production rates vary by region. | P2 | Master data | Phase 4 | Better go/no-go and estimating. | Low. |
| Templates | Reusable forms/checklists/work packages. | Standardizes execution. | P1 | Workflow transactions | Phase 4 | Repeatability. | Medium. |
| Checklists | Controlled checklist templates for gates and evidence. | Keeps D5O discipline repeatable. | P1 | Templates | Phase 4 | Operating consistency. | Medium. |

## H. Financial Controls

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Actual cost | Capture/import labor, material, equipment, vendor actuals. | Margin cannot be real without cost. | P1 | Accounting integration or manual cost input | Phase 4 | Margin truth. | High. |
| Committed cost | Track POs, subcontracts, and vendor commitments. | PMs need committed exposure. | P1 | Procurement controls | Phase 4 | Forecast control. | High. |
| Cost-to-complete | Forecast remaining work cost. | Prevents late margin surprises. | P1 | Actual + committed cost | Phase 4 | Margin protection. | High. |
| Forecast margin | Compare estimate, current forecast, and final expected margin. | Leadership needs margin trend. | P1 | Cost-to-complete | Phase 4 | Executive control. | High. |
| Margin fade | Identify where margin erodes. | Supports corrective action and Optimize. | P1 | Forecast margin | Phase 4 | Profit protection. | Medium. |
| WIP | Work in progress reporting. | Finance needs revenue/cost position. | P2 | Billing and cost | Phase 4 | Finance discipline. | High. |
| Revenue forecast | Forecast billings and cash timing. | Supports cash planning. | P2 | Billing writes | Phase 4 | Cash visibility. | Medium. |
| Purchase orders | Create/track POs or integrate with accounting. | Procurement and commitments need control. | P2 | Vendor/material master data | Phase 4 | Spend control. | High. |
| Vendor commitments | Track subcontract/vendor commitments. | Prevents uncontrolled external spend. | P2 | Purchase orders | Phase 4 | Financial discipline. | Medium. |
| Unbilled work | Identify complete or approved work not billed. | Protects cash. | P1 | Billing and field quantities | Phase 3 | Recovery. | Medium. |
| Retainage forecast | Forecast retainage held and release timing. | Retainage is trapped cash. | P1 | Billing/closeout | Phase 3 | Cash planning. | Medium. |

## I. Schedule And Resource Controls

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lookahead schedule | Short-horizon work plan by project/crew. | Drives field readiness and constraints. | P1 | Projects and work packages | Phase 4 | Execution control. | Medium. |
| Crew assignments | Assign crews to work packages and dates. | Resource conflicts need visibility. | P1 | Crew master data | Phase 4 | Labor planning. | Medium. |
| Access windows | Track work windows, outages, site access, escorts. | Missed access creates standby and delay. | P1 | Mobilization/work packages | Phase 4 | Schedule reliability. | Medium. |
| Milestones | Track project milestones against baseline. | Leadership needs schedule movement. | P1 | Schedule baselines | Phase 4 | Schedule control. | Medium. |
| Constraints | Track blockers before they hit field work. | Supports lookahead discipline. | P1 | Workflow transactions | Phase 4 | Delay prevention. | Medium. |
| Schedule variance | Compare planned vs actual progress. | Identifies recovery needs. | P1 | Daily report quantities | Phase 4 | Delivery control. | Medium. |
| Recovery plans | Assign actions to recover schedule slippage. | Behind work needs a managed response. | P2 | Schedule variance | Phase 4 | Schedule recovery. | Medium. |

## J. Procurement And Material Control

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Requisitions | Request materials from project/work package need. | Starts procurement control early. | P2 | Material master data | Phase 4 | Procurement discipline. | Medium. |
| Vendor quotes | Capture and compare quotes. | Supports buyout and change pricing. | P2 | Vendors | Phase 4 | Cost control. | Medium. |
| Purchase orders | Issue or track POs. | Creates commitment visibility. | P2 | Financial controls | Phase 4 | Spend governance. | High. |
| Long-lead tracking | Track materials that threaten mobilization. | Long-lead failures block field work. | P1 | Mobilization/material records | Phase 4 | Field readiness. | Medium. |
| Delivery commitments | Track vendor promised delivery dates. | Prevents surprise shortages. | P1 | Purchase orders or material plan | Phase 4 | Schedule protection. | Medium. |
| Material shortages | Escalate shortages to field and PM. | Shortages create downtime. | P1 | Delivery commitments | Phase 4 | Productivity. | Medium. |
| Stored materials | Track billable stored materials and backup. | Supports pay apps and cash. | P1 | Billing | Phase 3 | Cash acceleration. | Medium. |
| Substitutions | Control approved equivalent/substitution path. | Prevents quality, submittal, and billing gaps. | P2 | Submittals/change control | Phase 4 | Commercial and quality control. | Medium. |

## K. Role-Based Workspaces

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CEO workspace | Executive risk, cash, gates, and performance. | Leadership needs a concise cockpit. | P1 | RBAC and workflow ownership | Phase 4 | Executive adoption. | Medium. |
| Operations leader workspace | Field readiness, production, blockers, crews. | Operations needs cross-project control. | P1 | Schedule/resource controls | Phase 4 | Delivery discipline. | Medium. |
| PM workspace | Project-specific workflow actions and documents. | PMs need a daily command surface. | P1 | Workflow transactions | Phase 4 | User adoption. | Medium. |
| Superintendent workspace | Work packages, daily reports, blockers. | Field leadership needs focused execution. | P1 | D4 writes | Phase 4 | Field usability. | Medium. |
| Field supervisor workspace | Mobile daily report and evidence capture. | Field adoption depends on speed. | P1 | Attachments and daily reports | Phase 4 | Data quality. | High. |
| Estimator workspace | Pipeline, go/no-go, risk library, production rates. | Pursuit quality improves with feedback. | P2 | Optimize data | Phase 4 | Estimate accuracy. | Medium. |
| Finance workspace | Billing, cash, retainage, lien waivers, exposure. | Finance needs payment control. | P1 | Billing writes and permissions | Phase 4 | Cash protection. | Medium. |
| Safety workspace | JHAs, observations, incidents, corrective actions. | Safety needs focused action queues. | P1 | Safety writes | Phase 4 | Risk reduction. | Medium. |
| Quality workspace | Inspections, tests, deficiencies, punch. | Quality needs evidence control. | P1 | Quality writes | Phase 4 | Acceptance readiness. | Medium. |
| Admin workspace | System readiness, users, roles, master data. | Admin controls should be limited and transparent. | P1 | Auth/RBAC | Phase 4 | Governance. | Medium. |

## L. Reporting And Operating Review Packs

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Weekly operations report | Cross-project gates, blockers, field starts, issues. | Leadership cadence needs a standard report. | P1 | Persistent workflow data | Phase 4 | Operating rhythm. | Medium. |
| Commercial exposure report | Change, RFI, billing, unbilled, disputed exposure. | Margin leakage needs executive visibility. | P1 | Change/billing writes | Phase 4 | Profit protection. | Medium. |
| Billing/cash report | Pay app due/aging, retainage, backup gaps. | Finance needs cash action list. | P1 | Billing writes | Phase 4 | Cash discipline. | Medium. |
| Safety/quality report | Open actions, incidents, deficiencies, tests, punch. | Risk and acceptance need joint visibility. | P1 | Safety/quality writes | Phase 4 | Risk control. | Medium. |
| Closeout aging report | Packages by age, missing docs, retainage blockers. | Final payment and reputation depend on closeout. | P1 | Closeout writes | Phase 4 | Faster close. | Medium. |
| Pipeline report | Pursuit volume, bid due, go/no-go, risk posture. | Estimating capacity needs governance. | P2 | Pipeline persistence | Phase 4 | Better pursuit decisions. | Low. |
| Performance report | Margins, production rates, GC/vendor performance. | Optimize needs repeatable evidence. | P2 | Optimize persistence | Phase 5 | Strategic improvement. | Medium. |

## M. External Collaboration And Integrations

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Procore/Autodesk strategy | Decide whether to integrate, export, or coexist. | GC workflows may live outside RybexOS. | P2 | Stable internal workflows | Phase 5 | Partner fit. | High. |
| Email export | Send controlled RFIs, notices, packages, reports. | Some partners operate by email. | P2 | Document/record templates | Phase 5 | Practical adoption. | Medium. |
| PDF package export | Export pay app, closeout, RFI/change backup packages. | Stakeholders need shareable evidence. | P1 | Attachments and package assembly | Phase 5 | External credibility. | High. |
| Microsoft/Google identity | Use enterprise identity provider. | Reduces password/admin burden. | P1 | Auth provider selection | Phase 5 | Security and adoption. | Medium. |
| Accounting integration | Connect billing, cost, commitments, payments. | Full financial control needs actuals. | P2 | Financial controls | Phase 5 | Margin truth. | High. |
| File storage | Harden object storage integration. | Evidence must be secure and durable. | P0 | Attachments | Phase 3 | Production readiness. | High. |
| DocuSign | Manage signed waivers, approvals, contract docs. | Some workflows require signature proof. | P3 | Document management | Phase 5 | Formal approvals. | Medium. |
| Teams/Slack notifications | Send action/escalation notifications. | Workflows should reach owners. | P2 | Notification engine | Phase 5 | Timely action. | Medium. |

## N. Production Operations

| Item | Description | Why It Matters | Priority | Dependency | Recommended Phase | Enterprise Value | Implementation Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CI/CD | Automated test/build/deploy pipeline. | Production changes need discipline. | P0 | Hosting decision | Phase 5 | Release safety. | Medium. |
| Environment separation | Dev, staging, production with separate data/secrets. | Prevents demo/test data from touching production. | P0 | CI/CD | Phase 5 | Operational safety. | Medium. |
| Monitoring/logging | Track app errors, route failures, performance. | Production issues need visibility. | P0 | Deployment | Phase 5 | Reliability. | Medium. |
| Error tracking | Capture frontend/server exceptions. | Faster triage. | P1 | Monitoring | Phase 5 | Supportability. | Medium. |
| Backups | Scheduled database and file backups. | Protects operating records. | P0 | Database/file storage | Phase 5 | Resilience. | High. |
| Incident response | Define support and outage process. | Production systems need response discipline. | P1 | Monitoring | Phase 5 | Business continuity. | Medium. |
| Support runbook | Document common failures and operator actions. | Reduces tribal knowledge. | P1 | Production pilot | Phase 5 | Maintainability. | Low. |
| Onboarding | User training, role setup, demo-to-real transition. | Adoption requires guided rollout. | P1 | Secure MVP | Phase 5 | User adoption. | Medium. |
| Production security review | Human review before live data. | Prevents security/data leaks. | P0 | Auth/RLS/files | Phase 5 | Risk reduction. | High. |
