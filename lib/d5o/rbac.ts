import type { UserRole } from "./types";

export type RybexPermission =
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

const rolePermissions: Record<UserRole, RybexPermission[]> = {
  executive: [
    "view_command_center",
    "view_pipeline",
    "approve_go_no_go",
    "view_projects",
    "view_mobilization",
    "view_field_execution",
    "view_rfis_submittals",
    "view_changes",
    "approve_change_event",
    "view_billing",
    "review_billing_backup",
    "approve_pay_application",
    "view_safety",
    "view_quality",
    "view_closeout",
    "approve_closeout",
    "view_optimize"
  ],
  operations_leader: [
    "view_command_center",
    "view_pipeline",
    "approve_go_no_go",
    "view_projects",
    "edit_project_setup",
    "approve_d2_gate",
    "view_mobilization",
    "edit_mobilization",
    "approve_d3_gate",
    "view_field_execution",
    "approve_daily_report",
    "view_rfis_submittals",
    "edit_rfis_submittals",
    "view_changes",
    "edit_changes",
    "approve_change_event",
    "view_billing",
    "edit_evidence",
    "resolve_workflow_action",
    "review_billing_backup",
    "view_safety",
    "view_quality",
    "view_closeout",
    "approve_closeout",
    "view_optimize",
    "edit_lessons_learned"
  ],
  project_manager: [
    "view_command_center",
    "view_pipeline",
    "view_projects",
    "edit_project_setup",
    "view_mobilization",
    "edit_mobilization",
    "view_field_execution",
    "approve_daily_report",
    "view_rfis_submittals",
    "edit_rfis_submittals",
    "view_changes",
    "edit_changes",
    "view_billing",
    "edit_billing",
    "edit_evidence",
    "resolve_workflow_action",
    "waive_evidence_requirement",
    "review_billing_backup",
    "view_safety",
    "view_quality",
    "view_closeout",
    "edit_closeout",
    "view_optimize",
    "edit_lessons_learned"
  ],
  estimator: [
    "view_command_center",
    "view_pipeline",
    "edit_pipeline",
    "view_projects",
    "view_rfis_submittals",
    "view_changes",
    "view_optimize"
  ],
  superintendent: [
    "view_command_center",
    "view_projects",
    "view_mobilization",
    "edit_mobilization",
    "view_field_execution",
    "approve_daily_report",
    "view_rfis_submittals",
    "view_changes",
    "view_safety",
    "view_quality",
    "view_closeout"
  ],
  field_supervisor: [
    "view_field_execution",
    "submit_daily_report",
    "view_mobilization",
    "view_rfis_submittals",
    "view_safety",
    "edit_safety",
    "view_quality",
    "edit_quality"
  ],
  safety_manager: [
    "view_command_center",
    "view_projects",
    "view_mobilization",
    "view_field_execution",
    "view_safety",
    "edit_safety",
    "view_closeout",
    "view_optimize"
  ],
  quality_manager: [
    "view_command_center",
    "view_projects",
    "view_mobilization",
    "view_field_execution",
    "view_quality",
    "edit_quality",
    "view_closeout",
    "view_optimize"
  ],
  finance_admin: [
    "view_command_center",
    "view_projects",
    "view_changes",
    "view_billing",
    "edit_billing",
    "approve_pay_application",
    "edit_evidence",
    "resolve_workflow_action",
    "waive_evidence_requirement",
    "review_billing_backup",
    "view_closeout",
    "view_optimize"
  ],
  admin: [
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
    "manage_admin"
  ]
};

const defaultRouteByRole: Record<UserRole, string> = {
  executive: "/command-center",
  operations_leader: "/command-center",
  project_manager: "/projects",
  estimator: "/pipeline",
  superintendent: "/field-execution",
  field_supervisor: "/field-execution",
  safety_manager: "/safety",
  quality_manager: "/quality",
  finance_admin: "/billing",
  admin: "/admin"
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
  "manage_admin"
] as const satisfies readonly RybexPermission[];

export const allUserRoles = [
  "executive",
  "operations_leader",
  "project_manager",
  "estimator",
  "superintendent",
  "field_supervisor",
  "safety_manager",
  "quality_manager",
  "finance_admin",
  "admin"
] as const satisfies readonly UserRole[];

export function getPermissionsForRole(role: UserRole) {
  return rolePermissions[role];
}

export function hasPermission(role: UserRole, permission: RybexPermission) {
  return rolePermissions[role].includes(permission);
}

export function canAccessModule(role: UserRole, moduleId: RybexModuleId) {
  return hasPermission(role, modulePermissionMap[moduleId]);
}

export function getDefaultRouteForRole(role: UserRole) {
  return defaultRouteByRole[role];
}
