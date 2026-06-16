import { EmptyState } from "@/components/d5o/EmptyState";
import { EvidenceBlockingList, EvidenceReset, EvidenceSummaryCard } from "@/components/d5o/evidence";
import { NotificationReset, NotificationSummaryStrip } from "@/components/d5o/notifications";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PermissionState } from "@/components/d5o/PermissionState";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { WorkflowTransactionReset } from "@/components/d5o/workflow/WorkflowTransactionReset";
import { getAuthMode } from "@/lib/d5o/auth/auth-mode";
import { getCurrentRybexUser, getCurrentUserPermissions } from "@/lib/d5o/auth/current-user";
import { demoAuditEvents } from "@/lib/d5o/audit";
import { getDataSourceMode, getDatabasePilotCounts, getDatabaseReadinessStatus } from "@/lib/d5o/data";
import { demoUser, getDemoAccessibleModules, getDemoRolePermissions } from "@/lib/d5o/demo-user";
import { deriveEvidenceRequirements } from "@/lib/d5o/evidence";
import { getEvidenceStoreMode } from "@/lib/d5o/evidence/evidence-store";
import { deriveOperatingNotifications } from "@/lib/d5o/notifications";
import { getPilotModeStatus, getPilotWorkflows } from "@/lib/d5o/pilot/pilot-slice";
import {
  getPilotBlockers,
  getPilotReadinessScorecard,
  getPilotReadinessSummary,
  getPilotRecommendations
} from "@/lib/d5o/readiness/pilot-readiness";
import { implementedRouteList, moduleImplementationStatuses, platformReadiness } from "@/lib/d5o/implementation-status";
import { canAccessModule } from "@/lib/d5o/rbac";
import { getRlsReadiness, getStorageSecurityReadiness } from "@/lib/d5o/security/rls-readiness";
import { getWorkflowTransactionStoreMode } from "@/lib/d5o/workflow/transaction-store";
import { getWorkflowCompletionStoreMode } from "@/lib/d5o/workflow-completion/completion-store-mode";
import { getRegisteredCompletionWorkflowDefinitions } from "@/lib/d5o/workflow-completion/workflow-completion-registry";

export const metadata = {
  title: "Admin / System Readiness | RybexOS"
};

const adminAccess = canAccessModule(demoUser.role, "admin");
const accessibleModules = getDemoAccessibleModules().filter((item) => item.canAccess);
const permissions = getDemoRolePermissions();
const dataSourceMode = getDataSourceMode();
const authMode = getAuthMode();
const databaseReadiness = getDatabaseReadinessStatus();
const workflowTransactionStoreMode = getWorkflowTransactionStoreMode();
const workflowCompletionStoreMode = getWorkflowCompletionStoreMode();
const evidenceStoreMode = getEvidenceStoreMode();
const rlsReadiness = getRlsReadiness();
const storageSecurityReadiness = getStorageSecurityReadiness();
const pilotReadinessSummary = getPilotReadinessSummary();
const pilotReadinessScorecard = getPilotReadinessScorecard();
const pilotBlockers = getPilotBlockers();
const pilotRecommendations = getPilotRecommendations();
const pilotModeStatus = getPilotModeStatus();
const pilotModeWorkflows = getPilotWorkflows();
const registeredCompletionWorkflowCount = getRegisteredCompletionWorkflowDefinitions().length;
const persistenceReviewGate = [
  {
    label: "Schema coverage review",
    status: "complete",
    detail: "TypeScript domain types are mapped to proposed tables with implementation notes."
  },
  {
    label: "Relationship model review",
    status: "complete",
    detail: "Canonical RFI/change links will use explicit join tables; safety/quality links use direct keys plus controlled source links."
  },
  {
    label: "Status history review",
    status: "complete",
    detail: "Centralized status_history strategy defined for high-value records."
  },
  {
    label: "Audit requirements review",
    status: "complete",
    detail: "High-audit actions are identified across gates, field, commercial, safety, quality, closeout, and RBAC."
  },
  {
    label: "RBAC / RLS review",
    status: "complete",
    detail: "Organization, project, ownership, module, finance, safety, quality, attachment, and audit scopes are defined."
  },
  {
    label: "Attachment strategy review",
    status: "complete",
    detail: "Attachment metadata belongs in Postgres, files in private object storage, and entity links in join rows."
  },
  {
    label: "Reporting / query review",
    status: "complete",
    detail: "Initial indexes and aggregation strategy are defined without premature materialization."
  },
  {
    label: "Repository contract reconciliation",
    status: "complete",
    detail: "Repository metadata now includes organization/workspace and actor role fields for future RLS/audit alignment."
  }
];

export default async function AdminPage() {
  const databasePilotCounts = await getDatabasePilotCounts();
  const currentUser = await getCurrentRybexUser();
  const currentUserPermissions = await getCurrentUserPermissions();
  const evidenceSummary = deriveEvidenceRequirements();
  const notificationSummary = deriveOperatingNotifications(currentUser.role ?? demoUser.role);

  return (
    <div className="command-grid">
      <PageHeader
        context="Read-only readiness view. Full admin controls are intentionally not implemented yet."
        eyebrow="Enterprise Hardening"
        secondaryActions={[
          { href: "/command-center", label: "Command Center" },
          { href: "/reports", label: "Optimize" }
        ]}
        subtitle="Review module maturity, route coverage, seed-data mode, persistence readiness, RBAC architecture, audit foundations, and demo support documents."
        tags={[`${dataSourceMode} data mode`, "RBAC architecture ready", "Demo package ready"]}
        title="Admin / System Readiness"
      />

      {!adminAccess ? (
        <PermissionState
          moduleLabel="Admin"
          role={demoUser.role}
          message="The current demo role can view this readiness page for demonstration, but future write controls should require the admin role."
        />
      ) : null}

      <WorkflowModuleContext
        queueTitle="System-readiness workflow actions"
        workflowType="system_readiness"
      />

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pilot Readiness</p>
            <h2>Controlled pilot candidate, not production-ready</h2>
          </div>
          <span className="muted">Launch only after human approval of security, data, and support boundaries.</span>
        </div>
        <div className="metrics-grid">
          <div className="metric-card metric-warning">
            <span className="metric-label">Readiness Rating</span>
            <strong>{pilotReadinessSummary.averageScore}/5</strong>
            <span>{pilotReadinessSummary.currentMaturity}</span>
          </div>
          <div className="metric-card metric-critical">
            <span className="metric-label">Production Status</span>
            <strong>{pilotReadinessSummary.productionReadinessStatus}</strong>
            <span>RLS, production auth, storage security, and operations remain pending</span>
          </div>
          <div className="metric-card metric-info">
            <span className="metric-label">Scorecard Areas</span>
            <strong>{pilotReadinessScorecard.length}</strong>
            <span>Product, workflow, data, security, evidence, notifications, UX, and operations</span>
          </div>
          <div className="metric-card metric-success">
            <span className="metric-label">Pilot Recommendation</span>
            <strong>Limited internal</strong>
            <span>1-2 projects, limited users, in-app notifications only</span>
          </div>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Top blockers</h3>
            <ul className="compact-list">
              {pilotBlockers.slice(0, 4).map((blocker) => (
                <li key={blocker}>
                  <span className="artifact-state artifact-missing" />
                  <span>{blocker}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="control-list">
            <h3>Controlled pilot guidance</h3>
            <p>{pilotReadinessSummary.controlledPilotRecommendation}</p>
            <p>{pilotReadinessSummary.recommendedPilotScope}</p>
          </div>
          <div className="control-list">
            <h3>Next recommendations</h3>
            <ul className="compact-list">
              {pilotRecommendations.slice(0, 4).map((recommendation) => (
                <li key={recommendation}>
                  <span className="artifact-state artifact-complete" />
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="control-list">
            <h3>Readiness documents</h3>
            <p>`docs/production-readiness-gap-review.md`, `docs/pilot-readiness-scorecard.md`, `docs/controlled-pilot-launch-plan.md`, `docs/pilot-user-test-scripts.md`, and `docs/pilot-risk-register.md`.</p>
          </div>
        </div>
      </section>

      <section className="metrics-grid" aria-label="System readiness summary">
        <div className="metric-card metric-success">
          <span className="metric-label">Modules Represented</span>
          <strong>{moduleImplementationStatuses.length}</strong>
          <span>Full D5O lifecycle plus Admin readiness</span>
        </div>
        <div className="metric-card metric-info">
          <span className="metric-label">Routes Covered</span>
          <strong>{implementedRouteList.length}</strong>
          <span>Included in smoke-check list</span>
        </div>
        <div className="metric-card metric-warning">
          <span className="metric-label">Data Source</span>
          <strong>{dataSourceMode}</strong>
          <span>Typed demo records behind provider functions</span>
        </div>
        <div className="metric-card metric-info">
          <span className="metric-label">RBAC</span>
          <strong>Ready</strong>
          <span>{currentUserPermissions.length || permissions.length} permissions for {currentUser.role ?? demoUser.title}</span>
        </div>
        <div className="metric-card metric-info">
          <span className="metric-label">Audit Events</span>
          <strong>{demoAuditEvents.length}</strong>
          <span>Architecture seeded for sensitive actions</span>
        </div>
        <div className="metric-card metric-warning">
          <span className="metric-label">Persistence</span>
          <strong>Phase 2</strong>
          <span>D1/D2 scaffolded; database runtime disabled</span>
        </div>
      </section>

      <section className="panel" data-qa="admin-pilot-mode-readiness">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pilot Mode Readiness</p>
            <h2>Guided operating slice available</h2>
          </div>
          <span className="muted">Pilot Mode packages three verified workflows without claiming production readiness.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Pilot Mode route</h3>
            <p>/pilot is available from Command Center.</p>
          </div>
          <div className="control-list">
            <h3>Workflows included</h3>
            <p>{pilotModeWorkflows.length} verified workflow completion proof flows.</p>
          </div>
          <div className="control-list">
            <h3>Local/demo progress</h3>
            <p>Enabled through browser-local completion state and scoped pilot reset.</p>
          </div>
          <div className="control-list">
            <h3>Database completion pilot</h3>
            <p>{pilotModeStatus.databasePilotAvailable ? "Configured as opt-in database pilot mode." : "Not active; local/demo remains the default."}</p>
          </div>
          <div className="control-list">
            <h3>Production readiness</h3>
            <p>Not ready. Pilot Mode is a controlled internal candidate only.</p>
          </div>
          <div className="control-list">
            <h3>RLS / notifications</h3>
            <p>RLS and external notifications are not enabled.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Auth / RBAC Foundation</p>
            <h2>Workflow actions are permission checked</h2>
          </div>
          <span className="muted">Foundation only. Production login and RLS are not enabled.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Auth mode</h3>
            <p>{authMode}</p>
          </div>
          <div className="control-list">
            <h3>Current user source</h3>
            <p>{currentUser.source}: {currentUser.name}</p>
          </div>
          <div className="control-list">
            <h3>Current role</h3>
            <p>{currentUser.role ?? "Unresolved"}</p>
          </div>
          <div className="control-list">
            <h3>Permissions</h3>
            <p>{currentUserPermissions.length} permissions resolved for the current role.</p>
          </div>
          <div className="control-list">
            <h3>Supabase auth configured</h3>
            <p>{authMode === "supabase" && databaseReadiness.databaseReadPilotReady ? "Environment present; login/session resolver pending." : "Not active in current mode."}</p>
          </div>
          <div className="control-list">
            <h3>Workflow transaction RBAC</h3>
            <p>Enabled in server transaction path before local result or Supabase write is accepted.</p>
          </div>
          <div className="control-list">
            <h3>RLS</h3>
            <p>Not enabled. Policies remain planned until production auth is approved.</p>
          </div>
          <div className="control-list">
            <h3>Production auth status</h3>
            <p>Not production-ready. No login UI, invitations, MFA, external users, or active RLS yet.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Security / RLS Foundation</p>
            <h2>Security model scaffolded, not production-enforced</h2>
          </div>
          <span className="muted">No secrets shown. Broad RLS is intentionally not enabled yet.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Auth mode</h3>
            <p>{rlsReadiness.authMode}</p>
          </div>
          <div className="control-list">
            <h3>RBAC enforcement</h3>
            <p>App-level RBAC is enabled for workflow transaction writes and evidence upload pilot actions.</p>
          </div>
          <div className="control-list">
            <h3>RLS scaffold</h3>
            <p>{rlsReadiness.rlsScaffoldStatus}: helper functions and policy families are defined in migration 0004.</p>
          </div>
          <div className="control-list">
            <h3>RLS enabled</h3>
            <p>{rlsReadiness.databaseRls}. Broad RLS must be enabled table-by-table after human review.</p>
          </div>
          <div className="control-list">
            <h3>Storage bucket</h3>
            <p>{storageSecurityReadiness.expectedBucket}: private bucket scaffold available.</p>
          </div>
          <div className="control-list">
            <h3>Storage policies</h3>
            <p>{storageSecurityReadiness.storagePolicies}. No public-read policy is included.</p>
          </div>
          <div className="control-list">
            <h3>Service key boundary</h3>
            <p>Server-only. Client components must never receive service-role or secret keys.</p>
          </div>
          <div className="control-list">
            <h3>Production security</h3>
            <p>{rlsReadiness.productionSecurityStatus}. Supabase Auth, RLS enforcement, signed URLs, and file scanning remain pending.</p>
          </div>
        </div>
      </section>

      <EvidenceSummaryCard summary={evidenceSummary} />

      <NotificationSummaryStrip summary={notificationSummary} />

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Notification / Escalation Foundation</p>
            <h2>In-app alerts derived from workflow and evidence risk</h2>
          </div>
          <span className="muted">No email, SMS, Teams, Slack, or push delivery is enabled.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Notification engine</h3>
            <p>Implemented with shared domain types, escalation rules, and derivation from workflows and evidence.</p>
          </div>
          <div className="control-list">
            <h3>In-app notifications</h3>
            <p>Local/demo only. Users can acknowledge, mark in progress, resolve, or dismiss in browser state.</p>
          </div>
          <div className="control-list">
            <h3>External delivery</h3>
            <p>Not enabled. Email, SMS, Teams, Slack, and push are future delivery modes only.</p>
          </div>
          <div className="control-list">
            <h3>Escalation rules</h3>
            <p>Configured for RFIs, notice deadlines, field start blockers, daily reports, billing, safety, quality, closeout, retainage, and Optimize.</p>
          </div>
          <div className="control-list">
            <h3>Notification persistence</h3>
            <p>Not enabled. Notification state is local demo state only.</p>
          </div>
          <div className="control-list">
            <h3>Unresolved / critical</h3>
            <p>{notificationSummary.allNotifications.length} unresolved modelled alerts / {notificationSummary.criticalNotifications.length} critical.</p>
          </div>
          <div className="control-list">
            <h3>Escalation queue</h3>
            <p>{notificationSummary.escalationQueue.length} alert(s) currently meet escalation rules.</p>
          </div>
          <div className="control-list">
            <h3>Current role alerts</h3>
            <p>{notificationSummary.currentUserNotifications.length} alert(s) for {currentUser.role ?? demoUser.role}.</p>
          </div>
        </div>
        <NotificationReset />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Evidence / Attachment Foundation</p>
            <h2>Evidence modeled, upload remains demo-only</h2>
          </div>
          <span className="muted">Production Supabase Storage, file access controls, and RLS are not enabled.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Evidence model</h3>
            <p>Implemented in `lib/d5o/evidence/types.ts` with shared categories, statuses, verification, and source links.</p>
          </div>
          <div className="control-list">
            <h3>Evidence UI</h3>
            <p>Requirement cards, checklists, blockers, status chips, and demo evidence actions are available.</p>
          </div>
          <div className="control-list">
            <h3>Local demo actions</h3>
            <p>Users can mark evidence attached, verified, or waived in browser-local demo state only.</p>
          </div>
          <div className="control-list">
            <h3>Supabase evidence read</h3>
            <p>Workflow evidence requirements can be read through the existing database repository pilot when database mode is enabled.</p>
          </div>
          <div className="control-list">
            <h3>Production upload</h3>
            <p>Not enabled. Supabase Storage and file upload security remain future work.</p>
          </div>
          <div className="control-list">
            <h3>Evidence upload pilot</h3>
            <p>{evidenceStoreMode === "database" && dataSourceMode === "database" ? "Opt-in database/storage pilot mode requested." : "Not enabled; local demo evidence actions remain active."}</p>
          </div>
          <div className="control-list">
            <h3>Expected bucket</h3>
            <p>rybexos-evidence private bucket. Public-read policy is not configured.</p>
          </div>
          <div className="control-list">
            <h3>Attachment metadata</h3>
            <p>Scaffolded through attachments and entity_attachments for workflow evidence requirements.</p>
          </div>
          <div className="control-list">
            <h3>Storage security</h3>
            <p>RLS, signed URLs, malware scanning, retention automation, and production file governance are not enabled.</p>
          </div>
          <div className="control-list">
            <h3>Evidence blockers</h3>
            <p>{evidenceSummary.missingEvidence.length} missing, {evidenceSummary.evidenceBlockingGate.length} gate, {evidenceSummary.evidenceBlockingBilling.length} billing, {evidenceSummary.evidenceBlockingCloseout.length} closeout.</p>
          </div>
        </div>
        <EvidenceReset />
      </section>

      <EvidenceBlockingList
        requirements={[
          ...evidenceSummary.evidenceBlockingGate,
          ...evidenceSummary.evidenceBlockingBilling,
          ...evidenceSummary.evidenceBlockingCloseout
        ]}
        title="Evidence blocking gate, billing, or closeout movement"
      />

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workflow Transactions MVP</p>
            <h2>Local workflow movement enabled</h2>
          </div>
          <span className="muted">Seed-backed demo state only. No database persistence is enabled.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Transaction MVP</h3>
            <p>Implemented for the primary Signal - Decision - Action - Evidence - Gate Movement actions.</p>
          </div>
          <div className="control-list">
            <h3>Runtime</h3>
            <p>Local browser state layered over seed-backed workflows. Seed data remains unchanged.</p>
          </div>
          <div className="control-list">
            <h3>Persistence</h3>
            <p>Not enabled. Transactions are demo-local and can be reset from this page.</p>
          </div>
          <div className="control-list">
            <h3>Supported demo actions</h3>
            <p>Approve/hold go-no-go, approve/hold D2, approve/hold D3, submit daily report, create RFI/change, and resolve workflow action.</p>
          </div>
        </div>
        <WorkflowTransactionReset />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workflow Transaction Persistence</p>
            <h2>Phase 3 schema scaffolded, runtime still local</h2>
          </div>
          <span className="muted">Persistence supports the workflow model later; it is not active by default.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Local transaction MVP</h3>
            <p>{platformReadiness.workflowTransactionMvpStatus}</p>
          </div>
          <div className="control-list">
            <h3>Workflow transaction schema</h3>
            <p>{platformReadiness.workflowTransactionPersistenceStatus}</p>
          </div>
          <div className="control-list">
            <h3>Database transaction store</h3>
            <p>{workflowTransactionStoreMode === "database" && dataSourceMode === "database" ? "Write pilot enabled for workflow transactions only." : platformReadiness.workflowTransactionDatabaseRuntimeStatus}</p>
          </div>
          <div className="control-list">
            <h3>Default transaction store</h3>
            <p>{workflowTransactionStoreMode}</p>
          </div>
          <div className="control-list">
            <h3>Audit / status persistence</h3>
            <p>{workflowTransactionStoreMode === "database" && dataSourceMode === "database" ? "Workflow transactions create audit and status-history rows in the pilot path." : platformReadiness.workflowTransactionAuditStatus}</p>
          </div>
          <div className="control-list">
            <h3>Workflow transaction rows</h3>
            <p>{databasePilotCounts.workflowTransactionCount ?? "Not read"} ({databasePilotCounts.status})</p>
          </div>
          <div className="control-list">
            <h3>Audit / status rows</h3>
            <p>{databasePilotCounts.auditEventCount ?? "Not read"} audit / {databasePilotCounts.statusHistoryCount ?? "Not read"} status</p>
          </div>
          <div className="control-list">
            <h3>Last workflow transaction</h3>
            <p>{databasePilotCounts.lastWorkflowTransactionCreatedAt ?? "Not read"}</p>
          </div>
          <div className="control-list">
            <h3>Pilot warning</h3>
            <p>Auth, RLS, approvals, notifications, file evidence, and production write hardening are not enabled.</p>
          </div>
          <div className="control-list">
            <h3>Next phase</h3>
            <p>Review pilot writes, then add auth/RBAC/RLS before production workflow persistence.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workflow Completion Persistence</p>
            <h2>Completion bridge scaffolded for Supabase pilot</h2>
          </div>
          <span className="muted">Opt-in only. Local completion remains the default.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Completion store mode</h3>
            <p>{workflowCompletionStoreMode}</p>
          </div>
          <div className="control-list">
            <h3>Local completion engine</h3>
            <p>Enabled for registered demo proof flows.</p>
          </div>
          <div className="control-list">
            <h3>Database completion pilot</h3>
            <p>{workflowCompletionStoreMode === "database" && dataSourceMode === "database" ? "Configured to attempt server-side Supabase writes." : "Not enabled. Set database data source and completion store mode to test."}</p>
          </div>
          <div className="control-list">
            <h3>Registered workflows</h3>
            <p>{registeredCompletionWorkflowCount} completion workflow(s) registered.</p>
          </div>
          <div className="control-list">
            <h3>DB verifier</h3>
            <p>Run `npm run workflow-completion:verify-db` only with local Supabase env configured.</p>
          </div>
          <div className="control-list">
            <h3>RLS</h3>
            <p>Not enabled. Completion writes are pilot-only and server-side.</p>
          </div>
          <div className="control-list">
            <h3>Production status</h3>
            <p>Not production-ready. Auth, RLS, approval controls, notifications, and document security remain pending.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Enterprise OS Roadmap</p>
            <h2>Prototype maturity, production path defined</h2>
          </div>
          <span className="muted">Current maturity: operating-system prototype, not production-ready.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Enterprise backlog</h3>
            <p>`docs/enterprise-os-backlog.md` defines the capability backlog from persistence through production operations.</p>
          </div>
          <div className="control-list">
            <h3>Capability maturity map</h3>
            <p>`docs/capability-maturity-map.md` rates each enterprise capability and its gap to production readiness.</p>
          </div>
          <div className="control-list">
            <h3>Production roadmap</h3>
            <p>`docs/production-roadmap.md` sequences the path from seed-backed prototype to secure internal MVP and enterprise controls.</p>
          </div>
          <div className="control-list">
            <h3>Dependency map</h3>
            <p>`docs/enterprise-dependency-map.md` shows what must come before persistence, auth, attachments, notifications, reports, and integrations.</p>
          </div>
          <div className="control-list">
            <h3>Recommended next implementation</h3>
            <p>`docs/recommended-next-implementation.md` recommends a narrow Workflow Transactions MVP before broad database writes.</p>
          </div>
          <div className="control-list">
            <h3>Workflow transaction design</h3>
            <p>`docs/workflow-transaction-design.md` defines transaction types, evidence, permissions, audit events, and gate movement.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Demo & Deployment Readiness</p>
            <h2>Packaged for stakeholder handoff</h2>
          </div>
          <span className="muted">Seed-backed demo mode remains the safe default.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Seed mode default</h3>
            <p>`RYBEXOS_DATA_SOURCE=seed` is the expected demo/runtime mode.</p>
          </div>
          <div className="control-list">
            <h3>Route smoke status</h3>
            <p>`npm run smoke:routes` covers all {implementedRouteList.length} implemented routes when a local server is running.</p>
          </div>
          <div className="control-list">
            <h3>Demo docs</h3>
            <p>Demo readiness, script, click path, cheat sheet, CEO path, and stakeholder package docs are maintained.</p>
          </div>
          <div className="control-list">
            <h3>Persistence docs</h3>
            <p>Schema, security review, local database setup, and Phase 2 D1/D2 docs are present; DB runtime remains off.</p>
          </div>
          <div className="control-list">
            <h3>Package guide</h3>
            <p>`docs/package-export-guide.md` and `npm run demo:package` prepare a shareable folder without secrets.</p>
          </div>
          <div className="control-list">
            <h3>Verify command</h3>
            <p>`npm run verify` runs the full local confidence suite including temporary route smoke checks.</p>
          </div>
          <div className="control-list">
            <h3>Visual QA limitation</h3>
            <p>The in-app browser connector is blocked in this sandbox; use local capture or manual screenshots instead.</p>
          </div>
          <div className="control-list">
            <h3>Local visual capture</h3>
            <p>Playwright visual capture is available. Run `npm run dev`, then `npm run visual:capture`.</p>
          </div>
          <div className="control-list">
            <h3>Screenshot output</h3>
            <p>`visual-qa-output/desktop`, `tablet`, `mobile`, and `manifest.json` hold local captures.</p>
          </div>
          <div className="control-list">
            <h3>Visual QA checklist</h3>
            <p>`docs/visual-qa-checklist.md` and `docs/local-visual-qa-runbook.md` define the fallback review process.</p>
          </div>
          <div className="control-list">
            <h3>Workflow operating model</h3>
            <p>`docs/workflow-operating-model.md` defines Signal - Decision - Action - Evidence - Gate Movement across D5O.</p>
          </div>
          <div className="control-list">
            <h3>Workflow remediation</h3>
            <p>`docs/visual-remediation-plan.md` explains why the workflow layer solved the product-coherence issue.</p>
          </div>
          <div className="control-list">
            <h3>Report template</h3>
            <p>`docs/visual-qa-report-template.md` captures desktop, tablet, mobile, and demo approval findings.</p>
          </div>
          <div className="control-list">
            <h3>Latest review</h3>
            <p>`docs/visual-qa-review-report.md` documents the screenshot review, targeted fixes, and demo approval recommendation.</p>
          </div>
          <div className="control-list">
            <h3>Demo approval</h3>
            <p>Approved with caveats after screenshot review; remaining caveats are lower-page density and future stakeholder polish.</p>
          </div>
          <div className="control-list">
            <h3>Deployment readiness</h3>
            <p>`docs/deployment-readiness.md` defines pre-demo, pre-deploy, rollback, and seed-mode expectations.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Persistence Foundation</p>
            <h2>Seed fallback remains active</h2>
          </div>
          <span className="muted">Phase 1-3 scaffolds only. No route depends on database env vars.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Data source mode</h3>
            <p>{platformReadiness.seedModeStatus}</p>
          </div>
          <div className="control-list">
            <h3>Core schema scaffold</h3>
            <p>{platformReadiness.persistenceFoundationStatus}</p>
          </div>
          <div className="control-list">
            <h3>Database runtime</h3>
            <p>{platformReadiness.databaseModeStatus}</p>
          </div>
          <div className="control-list">
            <h3>Database repository</h3>
            <p>Scaffolded behind the repository selector; write methods intentionally throw until a future approved adapter pass.</p>
          </div>
          <div className="control-list">
            <h3>RLS / auth</h3>
            <p>{platformReadiness.rlsStatus} {platformReadiness.authStatus}</p>
          </div>
          <div className="control-list">
            <h3>Next phase</h3>
            <p>D1/D2 table migration plus a limited read repository pilot.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Persistence Phase 2</p>
            <h2>D1/D2 read pilot boundary</h2>
          </div>
          <span className="muted">Pipeline and Projects are not converted by default.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>D1/D2 schema migration</h3>
            <p>{platformReadiness.persistencePhase2Status}</p>
          </div>
          <div className="control-list">
            <h3>Optional seed SQL</h3>
            <p>Available at `supabase/seed/phase2_d1_d2_demo_seed.sql` for future local database pilots.</p>
          </div>
          <div className="control-list">
            <h3>Pipeline DB read pilot</h3>
            <p>Scaffolded behind database mode; seed-backed runtime remains active.</p>
          </div>
          <div className="control-list">
            <h3>Projects DB read pilot</h3>
            <p>{platformReadiness.d1D2ReadPilotStatus}</p>
          </div>
          <div className="control-list">
            <h3>Database env status</h3>
            <p>{databaseReadiness.message}</p>
          </div>
          <div className="control-list">
            <h3>Supabase URL</h3>
            <p>{databaseReadiness.supabaseUrlPresent ? "Present" : "Missing"}</p>
          </div>
          <div className="control-list">
            <h3>Publishable key</h3>
            <p>{databaseReadiness.supabasePublishableKeyPresent ? "Present" : "Missing"}</p>
          </div>
          <div className="control-list">
            <h3>Compatibility anon key</h3>
            <p>{databaseReadiness.supabaseAnonKeyPresent ? "Present" : "Missing"}</p>
          </div>
          <div className="control-list">
            <h3>Secret key</h3>
            <p>{databaseReadiness.supabaseSecretKeyPresent ? "Present server-side" : "Missing"}</p>
          </div>
          <div className="control-list">
            <h3>Service role alias</h3>
            <p>{databaseReadiness.supabaseServiceRoleKeyPresent ? "Present server-side" : "Missing"}</p>
          </div>
          <div className="control-list">
            <h3>Database read pilot</h3>
            <p>{databaseReadiness.databaseReadPilotReady ? "Ready to attempt read-only Supabase calls" : "Waiting on local Supabase env"}</p>
          </div>
          <div className="control-list">
            <h3>Workflow instances</h3>
            <p>{databasePilotCounts.workflowInstanceCount ?? "Not read"} ({databasePilotCounts.status})</p>
          </div>
          <div className="control-list">
            <h3>Opportunities / Projects</h3>
            <p>
              {databasePilotCounts.opportunityCount ?? "Not read"} opportunities / {databasePilotCounts.projectCount ?? "Not read"} projects
            </p>
          </div>
          <div className="control-list">
            <h3>Read pilot note</h3>
            <p>{databasePilotCounts.message}</p>
          </div>
          <div className="control-list">
            <h3>Write persistence</h3>
            <p>Not implemented. Database mode is read-only; production auth, RLS, and writes are not enabled.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Persistence Readiness</p>
            <h2>Database implementation gate</h2>
          </div>
          <span className="muted">Planning complete; runtime remains seed-backed.</span>
        </div>
        <div className="operating-columns">
          <div className="control-list">
            <h3>Persistence status</h3>
            <p>{platformReadiness.persistenceStatus}</p>
          </div>
          <div className="control-list">
            <h3>Repository contract</h3>
            <p>Defined in `lib/d5o/data/contracts.ts` and documented in `docs/data-repository-contract.md`.</p>
          </div>
          <div className="control-list">
            <h3>Data source mode</h3>
            <p>`RYBEXOS_DATA_SOURCE` defaults to seed. Database mode is reserved for a future isolated implementation pass.</p>
          </div>
          <div className="control-list">
            <h3>RBAC / auth gap</h3>
            <p>{platformReadiness.rbacStatus}</p>
          </div>
          <div className="control-list">
            <h3>Audit gap</h3>
            <p>{platformReadiness.auditStatus}</p>
          </div>
          <div className="control-list">
            <h3>Next gate</h3>
            <p>{platformReadiness.nextRecommendedBuild}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Persistence Review Gate</p>
            <h2>Ready for human schema review before persistence implementation</h2>
          </div>
          <span className="muted">No database runtime, migrations, auth, or ORM added.</span>
        </div>
        <div className="readiness-table">
          {persistenceReviewGate.map((item) => {
            const tone = item.status === "complete" ? "success" : item.status === "blocked" ? "critical" : "warning";

            return (
              <div className="readiness-row" key={item.label}>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
                <div>
                  <span className={`chip chip-${tone}`}>{item.status}</span>
                </div>
                <div>
                  <p>
                    {item.status === "complete"
                      ? "Documented and ready for review."
                      : "Needs human decision before migrations are written."}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Module Maturity</p>
            <h2>Implementation status map</h2>
          </div>
          <span className="muted">Current maturity is prototype-hardening, not production backend.</span>
        </div>
        {moduleImplementationStatuses.length > 0 ? (
          <div className="readiness-table">
            {moduleImplementationStatuses.map((item) => (
              <div className="readiness-row" key={item.moduleId}>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.route}</p>
                </div>
                <div>
                  <span className="chip chip-info">{item.currentMaturity.replaceAll("_", " ")}</span>
                  <p>{item.persistenceStatus}</p>
                </div>
                <div>
                  <p>{item.rbacStatus}</p>
                  <small className="muted">{item.recommendedNextHardening}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No module status records"
            message="The implementation status map should list every primary RybexOS module."
          />
        )}
      </section>

      <div className="content-grid">
        <section className="panel">
          <p className="eyebrow">Route Safety</p>
          <h2>Implemented route checklist</h2>
          <ul className="compact-list">
            {implementedRouteList.map((route) => (
              <li key={route}>
                <span className="artifact-state artifact-complete" />
                <span>
                  <strong>{route}</strong>
                  <small className="muted">Expected 200 in smoke checks</small>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="panel">
          <p className="eyebrow">Demo Role</p>
          <h2>{demoUser.title}</h2>
          <p className="muted">Current role context is non-persistent and used for demo readiness only.</p>
          <ul className="compact-list">
            {accessibleModules.map((item) => (
              <li key={item.href}>
                <span className="artifact-state artifact-complete" />
                <span>
                  <strong>{item.label}</strong>
                  <small className="muted">{item.href}</small>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="panel">
        <p className="eyebrow">Readiness Docs</p>
        <h2>Demo and architecture package</h2>
        <div className="operating-columns">
          {[
            "docs/persistence-architecture.md",
            "docs/database-schema-plan.md",
            "docs/persistence-technology-decision.md",
            "docs/migration-sequence.md",
            "docs/data-repository-contract.md",
            "docs/seed-to-database-mapping.md",
            "docs/schema-risk-review.md",
            "docs/persistence-implementation-checklist.md",
            "docs/schema-coverage-review.md",
            "docs/relationship-model-review.md",
            "docs/status-history-review.md",
            "docs/audit-requirements-review.md",
            "docs/rbac-rls-review.md",
            "docs/attachment-strategy-review.md",
            "docs/reporting-query-review.md",
            "docs/database-local-setup.md",
            "docs/persistence-phase-2-d1-d2.md",
            "docs/persistence-phase-3-workflow-transactions.md",
            "docs/persistence-phase-4-workflow-transaction-writes.md",
            "docs/auth-rbac-foundation.md",
            "docs/rls-storage-security-foundation.md",
            "docs/production-readiness-gap-review.md",
            "docs/pilot-readiness-scorecard.md",
            "docs/controlled-pilot-launch-plan.md",
            "docs/pilot-user-test-scripts.md",
            "docs/pilot-risk-register.md",
            "docs/evidence-attachment-foundation.md",
            "docs/supabase-storage-evidence-pilot.md",
            "docs/notification-escalation-foundation.md",
            "docs/route-inventory.md",
            "docs/deployment-readiness.md",
            "docs/stakeholder-demo-package.md",
            "docs/package-export-guide.md",
            "docs/local-visual-qa-runbook.md",
            "docs/visual-qa-report-template.md",
            "docs/demo-readiness.md",
            "docs/demo-script.md",
            "docs/demo-click-path.md",
            "docs/demo-cheat-sheet.md",
            "docs/ceo-demo-path.md",
            "docs/visual-qa-checklist.md",
            "docs/workflow-operating-model.md",
            "docs/visual-remediation-plan.md",
            "docs/enterprise-os-backlog.md",
            "docs/capability-maturity-map.md",
            "docs/production-roadmap.md",
            "docs/enterprise-dependency-map.md",
            "docs/recommended-next-implementation.md",
            "docs/workflow-transaction-design.md",
            "docs/workflow-transactions-mvp.md",
            "supabase/migrations/0004_rls_security_scaffold.sql",
            "supabase/storage/rybexos-evidence-bucket.sql",
            "docs/developer-notes.md"
          ].map((doc) => (
            <div className="control-list" key={doc}>
              <h3>{doc}</h3>
              <p>Maintained in-repo for implementation, demo, and stakeholder alignment.</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
