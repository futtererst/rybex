import { normalizeWorkspaceRole, type CanonicalWorkspaceRole } from "./auth/roles";
import type { UserRole } from "./types";

export type LegacyRybexPermission =
  | "view_command_center"
  | "view_pipeline"
  | "edit_pipeline"
  | "approve_go_no_go"
  | "view_projects"
  | "edit_project_setup"
  | "approve_d2_gate"
  | "view_mobilization"
  | "edit_mobilization"
  | "approve_d3_gate"
  | "view_field_execution"
  | "submit_daily_report"
  | "approve_daily_report"
  | "view_rfis_submittals"
  | "edit_rfis_submittals"
  | "view_changes"
  | "edit_changes"
  | "approve_change_event"
  | "view_billing"
  | "edit_billing"
  | "approve_pay_application"
  | "edit_evidence"
  | "resolve_workflow_action"
  | "waive_evidence_requirement"
  | "review_billing_backup"
  | "view_safety"
  | "edit_safety"
  | "view_quality"
  | "edit_quality"
  | "view_closeout"
  | "edit_closeout"
  | "approve_closeout"
  | "view_optimize"
  | "edit_lessons_learned"
  | "manage_admin";

export type FoundationPermission =
  | "workspace.view"
  | "workspace.manage"
  | "membership.view"
  | "membership.manage"
  | "project.view"
  | "project.manage"
  | "audit.view"
  | "evidence.view"
  | "opportunity.view"
  | "opportunity.create"
  | "opportunity.edit"
  | "opportunity.qualify"
  | "opportunity.submit_decision"
  | "opportunity.pursuit_authorize"
  | "opportunity.pursuit_hold"
  | "opportunity.pursuit_decline"
  | "opportunity.assignment_manage"
  | "opportunity.evidence_view"
  | "opportunity.evidence_add"
  | "billing.view"
  | "billing.edit"
  | "billing.submit_review"
  | "billing.record_decision"
  | "billing.clear_blocker"
  | "field_issue.view"
  | "field_issue.assess"
  | "field_issue.add_evidence"
  | "field_issue.choose_path"
  | "field_issue.create_rfi"
  | "field_issue.create_change"
  | "field_issue.resolve"
  | "closeout.view"
  | "closeout.assess"
  | "closeout.add_evidence"
  | "closeout.validate"
  | "closeout.submit_review"
  | "closeout.record_decision"
  | "closeout.clear_blocker";

export type RybexPermission = LegacyRybexPermission | FoundationPermission;

export type RybexModuleId =
  | "command-center"
  | "pipeline"
  | "projects"
  | "mobilization"
  | "field-execution"
  | "rfis-submittals"
  | "changes"
  | "billing"
  | "safety"
  | "quality"
  | "closeout"
  | "reports"
  | "admin";

const modulePermissionMap: Record<RybexModuleId, RybexPermission> = {
  "command-center": "view_command_center",
  pipeline: "view_pipeline",
  projects: "view_projects",
  mobilization: "view_mobilization",
  "field-execution": "view_field_execution",
  "rfis-submittals": "view_rfis_submittals",
  changes: "view_changes",
  billing: "view_billing",
  safety: "view_safety",
  quality: "view_quality",
  closeout: "view_closeout",
  reports: "view_optimize",
  admin: "manage_admin"
};

const sharedRead: RybexPermission[] = [
  "view_command_center",
  "view_projects",
  "workspace.view",
  "membership.view",
  "project.view",
  "audit.view",
  "evidence.view"
];

const billingRead: RybexPermission[] = ["view_billing", "review_billing_backup", "billing.view"];
const billingEdit: RybexPermission[] = [
  ...billingRead,
  "edit_billing",
  "approve_pay_application",
  "edit_evidence",
  "resolve_workflow_action",
  "waive_evidence_requirement",
  "billing.edit",
  "billing.submit_review",
  "billing.record_decision",
  "billing.clear_blocker"
];

const fieldRead: RybexPermission[] = ["view_field_execution", "view_rfis_submittals", "field_issue.view"];
const fieldEdit: RybexPermission[] = [
  ...fieldRead,
  "submit_daily_report",
  "edit_rfis_submittals",
  "edit_changes",
  "edit_evidence",
  "resolve_workflow_action",
  "field_issue.assess",
  "field_issue.add_evidence",
  "field_issue.choose_path",
  "field_issue.create_rfi",
  "field_issue.create_change",
  "field_issue.resolve"
];

const closeoutRead: RybexPermission[] = ["view_closeout", "closeout.view"];
const closeoutEdit: RybexPermission[] = [
  ...closeoutRead,
  "edit_closeout",
  "approve_closeout",
  "edit_evidence",
  "resolve_workflow_action",
  "closeout.assess",
  "closeout.add_evidence",
  "closeout.validate",
  "closeout.submit_review",
  "closeout.record_decision",
  "closeout.clear_blocker"
];

const opportunityRead: RybexPermission[] = [
  "view_pipeline",
  "opportunity.view",
  "opportunity.evidence_view"
];

const opportunityEdit: RybexPermission[] = [
  ...opportunityRead,
  "edit_pipeline",
  "opportunity.create",
  "opportunity.edit",
  "opportunity.qualify",
  "opportunity.submit_decision",
  "opportunity.pursuit_authorize",
  "opportunity.pursuit_hold",
  "opportunity.pursuit_decline",
  "opportunity.assignment_manage",
  "opportunity.evidence_add"
];

const canonicalRolePermissions: Record<CanonicalWorkspaceRole, RybexPermission[]> = {
  executive: [
    ...sharedRead,
    ...opportunityRead,
    "approve_go_no_go",
    "view_mobilization",
    ...fieldRead,
    "view_changes",
    "approve_change_event",
    ...billingRead,
    "view_safety",
    "view_quality",
    ...closeoutRead,
    "view_optimize"
  ],
  operations_leader: [
    ...sharedRead,
    ...opportunityEdit,
    "approve_go_no_go",
    "edit_project_setup",
    "approve_d2_gate",
    "view_mobilization",
    "edit_mobilization",
    "approve_d3_gate",
    "approve_daily_report",
    ...fieldEdit,
    "view_changes",
    "approve_change_event",
    ...billingEdit,
    "view_safety",
    "view_quality",
    ...closeoutEdit,
    "view_optimize",
    "edit_lessons_learned"
  ],
  business_development_lead: [
    ...sharedRead,
    ...opportunityEdit,
    "view_projects",
    "evidence.view",
    "edit_evidence"
  ],
  project_manager: [
    ...sharedRead,
    ...opportunityRead,
    "edit_project_setup",
    "view_mobilization",
    "edit_mobilization",
    "approve_daily_report",
    ...fieldEdit,
    "view_changes",
    "edit_changes",
    ...billingRead,
    "edit_evidence",
    "view_safety",
    "view_quality",
    ...closeoutRead,
    "view_optimize",
    "edit_lessons_learned",
    "project.manage"
  ],
  billing_commercial_lead: [
    ...sharedRead,
    "view_changes",
    ...billingEdit,
    "view_closeout",
    "view_optimize"
  ],
  field_supervisor: [
    "project.view",
    ...fieldEdit,
    "view_mobilization",
    "view_safety",
    "edit_safety",
    "view_quality",
    "edit_quality",
    "evidence.view"
  ],
  closeout_lead: [
    ...sharedRead,
    ...billingRead,
    ...closeoutEdit,
    "view_quality",
    "view_optimize"
  ],
  admin: [
    ...sharedRead,
    "workspace.manage",
    "membership.manage",
    "project.manage",
    ...opportunityEdit,
    "approve_go_no_go",
    "edit_project_setup",
    "approve_d2_gate",
    "view_mobilization",
    "edit_mobilization",
    "approve_d3_gate",
    "approve_daily_report",
    ...fieldEdit,
    "view_changes",
    "edit_changes",
    "approve_change_event",
    ...billingEdit,
    "view_safety",
    "edit_safety",
    "view_quality",
    "edit_quality",
    ...closeoutEdit,
    "view_optimize",
    "edit_lessons_learned",
    "manage_admin"
  ],
  read_only_auditor: [
    ...sharedRead,
    "view_command_center",
    ...opportunityRead,
    "view_mobilization",
    "view_field_execution",
    "view_rfis_submittals",
    "view_changes",
    "view_billing",
    "view_safety",
    "view_quality",
    "view_closeout",
    "view_optimize"
  ]
};

const defaultRouteByCanonicalRole: Record<CanonicalWorkspaceRole, string> = {
  executive: "/command-center",
  operations_leader: "/command-center",
  business_development_lead: "/pipeline",
  project_manager: "/projects",
  billing_commercial_lead: "/billing",
  field_supervisor: "/field-execution",
  closeout_lead: "/closeout",
  admin: "/admin",
  read_only_auditor: "/command-center"
};

export const allRybexPermissions = [
  "view_command_center",
  "view_pipeline",
  "edit_pipeline",
  "approve_go_no_go",
  "view_projects",
  "edit_project_setup",
  "approve_d2_gate",
  "view_mobilization",
  "edit_mobilization",
  "approve_d3_gate",
  "view_field_execution",
  "submit_daily_report",
  "approve_daily_report",
  "view_rfis_submittals",
  "edit_rfis_submittals",
  "view_changes",
  "edit_changes",
  "approve_change_event",
  "view_billing",
  "edit_billing",
  "approve_pay_application",
  "edit_evidence",
  "resolve_workflow_action",
  "waive_evidence_requirement",
  "review_billing_backup",
  "view_safety",
  "edit_safety",
  "view_quality",
  "edit_quality",
  "view_closeout",
  "edit_closeout",
  "approve_closeout",
  "view_optimize",
  "edit_lessons_learned",
  "manage_admin",
  "workspace.view",
  "workspace.manage",
  "membership.view",
  "membership.manage",
  "project.view",
  "project.manage",
  "audit.view",
  "evidence.view",
  "opportunity.view",
  "opportunity.create",
  "opportunity.edit",
  "opportunity.qualify",
  "opportunity.submit_decision",
  "opportunity.assignment_manage",
  "opportunity.evidence_view",
  "opportunity.evidence_add",
  "billing.view",
  "billing.edit",
  "billing.submit_review",
  "billing.record_decision",
  "billing.clear_blocker",
  "field_issue.view",
  "field_issue.assess",
  "field_issue.add_evidence",
  "field_issue.choose_path",
  "field_issue.create_rfi",
  "field_issue.create_change",
  "field_issue.resolve",
  "closeout.view",
  "closeout.assess",
  "closeout.add_evidence",
  "closeout.validate",
  "closeout.submit_review",
  "closeout.record_decision",
  "closeout.clear_blocker"
] as const satisfies readonly RybexPermission[];

export const allUserRoles = [
  "executive",
  "operations_leader",
  "business_development_lead",
  "project_manager",
  "billing_commercial_lead",
  "field_supervisor",
  "closeout_lead",
  "admin",
  "read_only_auditor",
  "estimator",
  "superintendent",
  "safety_manager",
  "quality_manager",
  "finance_admin"
] as const satisfies readonly UserRole[];

export function getPermissionsForRole(role: UserRole | CanonicalWorkspaceRole) {
  const canonicalRole = normalizeWorkspaceRole(role);

  return canonicalRole ? canonicalRolePermissions[canonicalRole] : [];
}

export function hasPermission(role: UserRole | CanonicalWorkspaceRole, permission: RybexPermission) {
  return getPermissionsForRole(role).includes(permission);
}

export function canAccessModule(role: UserRole | CanonicalWorkspaceRole, moduleId: RybexModuleId) {
  return hasPermission(role, modulePermissionMap[moduleId]);
}

export function getDefaultRouteForRole(role: UserRole | CanonicalWorkspaceRole) {
  const canonicalRole = normalizeWorkspaceRole(role);

  return canonicalRole ? defaultRouteByCanonicalRole[canonicalRole] : "/command-center";
}

export { canonicalWorkspaceRoles, normalizeWorkspaceRole, type CanonicalWorkspaceRole } from "./auth/roles";
