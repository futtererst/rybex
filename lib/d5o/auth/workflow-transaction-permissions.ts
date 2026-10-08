import { getPermissionsForRole, hasPermission, type CanonicalWorkspaceRole, type RybexPermission } from "../rbac";
import type { UserRole } from "../types";
import type { WorkflowTransactionType } from "../workflow/transactions";
import type { OperatingWorkflowType } from "../workflow/types";

export type WorkflowTransactionPermissionRule = {
  transactionType: WorkflowTransactionType;
  workflowType?: OperatingWorkflowType;
  requiredPermissions: RybexPermission[];
  description: string;
};

const defaultResolvePermissions: Partial<Record<OperatingWorkflowType, RybexPermission[]>> = {
  pursuit_control: ["approve_go_no_go", "edit_pipeline"],
  contract_baseline: ["approve_d2_gate", "edit_project_setup"],
  mobilization_readiness: ["approve_d3_gate", "edit_mobilization"],
  field_execution: ["submit_daily_report", "approve_daily_report"],
  information_control: ["edit_rfis_submittals"],
  change_recovery: ["edit_changes"],
  billing_cash_control: ["edit_billing"],
  safety_control: ["edit_safety"],
  quality_control: ["edit_quality"],
  closeout_acceptance: ["edit_closeout"],
  optimize_learning: ["edit_lessons_learned"],
  system_readiness: ["manage_admin"]
};

export const workflowTransactionPermissionRules: WorkflowTransactionPermissionRule[] = [
  {
    transactionType: "approve_go_no_go",
    requiredPermissions: ["approve_go_no_go"],
    description: "Approve the D1 pursuit decision."
  },
  {
    transactionType: "hold_go_no_go",
    requiredPermissions: ["approve_go_no_go", "edit_pipeline"],
    description: "Hold a pursuit decision for clarification."
  },
  {
    transactionType: "approve_d2_gate",
    requiredPermissions: ["approve_d2_gate"],
    description: "Approve the D2 contract baseline gate."
  },
  {
    transactionType: "hold_d2_gate",
    requiredPermissions: ["approve_d2_gate", "edit_project_setup"],
    description: "Hold the D2 gate for baseline correction."
  },
  {
    transactionType: "approve_d3_field_start",
    requiredPermissions: ["approve_d3_gate"],
    description: "Approve D3 field start."
  },
  {
    transactionType: "hold_d3_field_start",
    requiredPermissions: ["approve_d3_gate", "edit_mobilization"],
    description: "Hold D3 field start for readiness correction."
  },
  {
    transactionType: "submit_daily_report",
    requiredPermissions: ["submit_daily_report"],
    description: "Submit a D4 daily report."
  },
  {
    transactionType: "create_rfi_from_signal",
    requiredPermissions: ["edit_rfis_submittals"],
    description: "Create an RFI from a workflow signal."
  },
  {
    transactionType: "create_change_event_from_signal",
    requiredPermissions: ["edit_changes"],
    description: "Create a change event from a workflow signal."
  },
  {
    transactionType: "resolve_workflow_action",
    requiredPermissions: ["view_command_center"],
    description: "Resolve the workflow action using workflow-specific permission rules."
  }
];

export type WorkflowTransactionPermissionCheck = {
  allowed: boolean;
  role: UserRole | CanonicalWorkspaceRole;
  requiredPermissions: RybexPermission[];
  message: string;
};

export function getPermissionsForWorkflowTransaction(
  transactionType: WorkflowTransactionType,
  workflowType: OperatingWorkflowType
): RybexPermission[] {
  if (transactionType === "resolve_workflow_action") {
    return defaultResolvePermissions[workflowType] ?? ["edit_project_setup", "edit_mobilization", "edit_changes"];
  }

  const rule = workflowTransactionPermissionRules.find((candidate) => candidate.transactionType === transactionType);

  return rule?.requiredPermissions ?? [];
}

export function checkWorkflowTransactionPermission(
  role: UserRole | CanonicalWorkspaceRole,
  transactionType: WorkflowTransactionType,
  workflowType: OperatingWorkflowType
): WorkflowTransactionPermissionCheck {
  const requiredPermissions = getPermissionsForWorkflowTransaction(transactionType, workflowType);
  const rolePermissions = getPermissionsForRole(role);
  const allowed =
    requiredPermissions.length === 0 ||
    requiredPermissions.some((permission) => hasPermission(role, permission));

  return {
    allowed,
    role,
    requiredPermissions,
    message: allowed
      ? "Permission granted."
      : `Permission required: ${requiredPermissions.join(" or ")}. Current role has ${rolePermissions.length} permissions.`
  };
}
