import type { RybexModuleId } from "./rbac";

export type ModuleMaturity =
  | "foundation"
  | "demo_seeded"
  | "workflow_shell"
  | "persistence_ready"
  | "rbac_ready"
  | "production_ready";

export type ModuleImplementationStatus = {
  moduleId: RybexModuleId;
  label: string;
  route: string;
  currentMaturity: ModuleMaturity;
  implementedRoutes: string[];
  dataSource: "typed_seed_data" | "database" | "hybrid";
  persistenceStatus: string;
  rbacStatus: string;
  knownLimitations: string[];
  recommendedNextHardening: string;
};

export const platformReadiness = {
  lifecycleStatus: "Full D5O lifecycle implemented with typed seed data.",
  dataProviderStatus: "Seed-backed provider layer established.",
  persistenceStatus: "Persistence Phase 4 pilot: workflow transaction writes are available only when database mode and database transaction store are explicitly enabled.",
  persistenceReviewGateStatus: "Schema/security review decisions recorded; workflow transaction write pilot is gated for local Supabase verification before production hardening.",
  persistenceFoundationStatus: "Core foundation schema scaffolded in supabase/migrations/0001_core_foundation.sql.",
  persistencePhase2Status: "D1/D2 schema scaffolded in supabase/migrations/0002_d1_d2_pipeline_projects.sql with optional local seed SQL.",
  workflowTransactionMvpStatus: "Implemented in local browser state for demo workflow movement.",
  workflowTransactionPersistenceStatus: "Schema scaffolded in supabase/migrations/0003_workflow_transactions.sql; repository contracts and mapping adapters exist.",
  workflowTransactionDatabaseRuntimeStatus: "Explicit pilot only. Default remains local; database writes require RYBEXOS_DATA_SOURCE=database and RYBEXOS_WORKFLOW_TRANSACTION_STORE=database.",
  workflowTransactionAuditStatus: "Pilot writes create workflow_transactions, audit_events, and status_history rows when the database transaction store is enabled.",
  evidenceFoundationStatus: "Evidence model, derivation, UI components, local demo evidence actions, a narrow private Supabase Storage upload pilot, and storage security scaffold are implemented. Production file management is not enabled.",
  notificationFoundationStatus: "In-app notification derivation, escalation rules, and local demo notification actions are implemented. External delivery is not enabled.",
  d1D2ReadPilotStatus: "Pipeline and Projects database read pilot methods are scaffolded behind database mode; no routes are converted by default.",
  databaseModeStatus: "Scaffolded but disabled by default. RYBEXOS_DATA_SOURCE remains seed unless explicitly changed later.",
  seedModeStatus: "Active/default demo runtime.",
  rlsStatus: "Scaffolded in supabase/migrations/0004_rls_security_scaffold.sql; broad active policies are not enabled.",
  authStatus: "Auth mode foundation added. Demo auth remains default; Supabase auth/session resolver is planned but not production-ready.",
  auditPersistenceStatus: "Audit/status-history tables scaffolded; workflow transaction pilot can write audit and status rows when explicitly enabled.",
  rbacStatus: "RBAC architecture ready; workflow transaction writes now enforce role permissions. Full auth/RLS enforcement is still pending.",
  auditStatus: "Audit architecture ready; persistent audit writes not implemented.",
  demoReadinessStatus: "Executive demo docs, CEO path, route smoke checks, and visual QA checklist complete.",
  visualPolishStatus: "Shared visual primitives and executive page hierarchy complete.",
  nextRecommendedBuild: "Add production Supabase auth/session resolution and enable RLS table-by-table only after reviewing the security scaffold."
};

export const implementedRouteList = [
  "/command-center",
  "/pipeline",
  "/pipeline/new",
  "/projects",
  "/projects/new",
  "/mobilization",
  "/mobilization/new",
  "/field-execution",
  "/field-execution/daily-report/new",
  "/rfis-submittals",
  "/rfis-submittals/rfi/new",
  "/rfis-submittals/submittal/new",
  "/changes",
  "/changes/new",
  "/billing",
  "/billing/pay-application/new",
  "/safety",
  "/safety/record/new",
  "/safety/jha/new",
  "/quality",
  "/quality/inspection/new",
  "/quality/deficiency/new",
  "/closeout",
  "/closeout/package/new",
  "/reports",
  "/reports/lessons-learned/new",
  "/admin"
] as const;

const sharedLimitations = [
  "Uses typed seed/demo records as the active runtime source.",
  "Guided create flows preview operating decisions but do not save records yet.",
  "RBAC permissions are modeled and enforced for workflow transaction writes; full route middleware and RLS are pending.",
  "Persistence Phase 4 workflow transaction write pilot is available only when explicitly enabled; database runtime is not the default.",
  "Evidence can be marked attached/verified/waived in local demo state; a narrow Supabase Storage upload pilot and security scaffold exist, but production file storage security is pending.",
  "Notifications are in-app/local demo alerts only; email, SMS, push, Teams, and Slack delivery are pending."
];

export const moduleImplementationStatuses: ModuleImplementationStatus[] = [
  status("command-center", "Command Center", "/command-center", ["/command-center"], "persistence_ready", "Implement persisted operating aggregates after core project/module records exist."),
  status("pipeline", "Pipeline", "/pipeline", ["/pipeline", "/pipeline/new"], "persistence_ready", "Persist opportunities, scoring history, and go/no-go approvals after Phase 1 tables."),
  status("projects", "Projects", "/projects", ["/projects", "/projects/new"], "persistence_ready", "Persist contract baseline records, scope matrices, and D2 approval history in Phase 2."),
  status("mobilization", "Mobilization", "/mobilization", ["/mobilization", "/mobilization/new"], "persistence_ready", "Persist mobilization plans, work packages, and D3 gate approvals in Phase 3."),
  status("field-execution", "Field Execution", "/field-execution", ["/field-execution", "/field-execution/daily-report/new"], "persistence_ready", "Persist daily reports, signoffs, quantities, and field prompts in Phase 3."),
  status("rfis-submittals", "RFIs / Submittals", "/rfis-submittals", ["/rfis-submittals", "/rfis-submittals/rfi/new", "/rfis-submittals/submittal/new"], "persistence_ready", "Persist RFI/submittal registers and link them to work packages and changes in Phase 4."),
  status("changes", "Change Control", "/changes", ["/changes", "/changes/new"], "persistence_ready", "Persist notice, pricing, backup, approval, and billing status history in Phase 4."),
  status("billing", "Billing", "/billing", ["/billing", "/billing/pay-application/new"], "persistence_ready", "Persist pay applications, SOV lines, lien waivers, and exposure records in Phase 5."),
  status("safety", "Safety", "/safety", ["/safety", "/safety/record/new", "/safety/jha/new"], "persistence_ready", "Persist safety observations, incidents, JHAs, toolbox talks, and corrective actions in Phase 5."),
  status("quality", "Quality", "/quality", ["/quality", "/quality/inspection/new", "/quality/deficiency/new"], "persistence_ready", "Persist inspections, deficiencies, tests, punch items, and verification evidence in Phase 5."),
  status("closeout", "Closeout", "/closeout", ["/closeout", "/closeout/package/new"], "persistence_ready", "Persist acceptance packages, requirements, warranties, as-builts, and retainage status in Phase 6."),
  status("reports", "Optimize", "/reports", ["/reports", "/reports/lessons-learned/new"], "persistence_ready", "Persist lessons learned, production rates, partner profiles, and improvement actions in Phase 6."),
  {
    ...status("admin", "Admin", "/admin", ["/admin"], "rbac_ready", "Add authenticated admin controls after persistence, identity, and RLS are selected."),
    knownLimitations: [
      "System readiness is read-only.",
      "Role, permission, persistence, and audit architecture are displayed but not administered in UI yet."
    ]
  }
];

function status(
  moduleId: RybexModuleId,
  label: string,
  route: string,
  implementedRoutes: string[],
  currentMaturity: ModuleMaturity,
  recommendedNextHardening: string
): ModuleImplementationStatus {
  return {
    moduleId,
    label,
    route,
    currentMaturity,
    implementedRoutes,
    dataSource: "typed_seed_data",
    persistenceStatus: "Phase 3 scaffolded: keep seed/local providers active until database adapters are implemented and explicitly enabled.",
    rbacStatus: "Foundation added: workflow transaction permissions enforced; full auth/RLS pending.",
    knownLimitations: sharedLimitations,
    recommendedNextHardening
  };
}
