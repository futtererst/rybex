import { getPermissionsForRole, hasPermission, type RybexPermission } from "../rbac";
import type { UserRole } from "../types";
import type { WorkflowTransactionType } from "../workflow/transactions";
import type { OperatingWorkflowType } from "../workflow/types";
import { getCurrentUserRole } from "./current-user";
import {
  checkWorkflowTransactionPermission,
  getPermissionsForWorkflowTransaction,
  type WorkflowTransactionPermissionCheck
} from "./workflow-transaction-permissions";

export async function canCurrentUser(permission: RybexPermission) {
  const role = await getCurrentUserRole();

  return role ? hasPermission(role, permission) : false;
}

export async function requirePermission(permission: RybexPermission) {
  const role = await getCurrentUserRole();

  if (!role || !hasPermission(role, permission)) {
    throw new Error(`Permission required: ${permission}.`);
  }

  return {
    role,
    permission
  };
}

export async function requireAnyPermission(permissions: RybexPermission[]) {
  const role = await getCurrentUserRole();

  if (!role || !permissions.some((permission) => hasPermission(role, permission))) {
    throw new Error(`Permission required: ${permissions.join(" or ")}.`);
  }

  return {
    role,
    permissions: getPermissionsForRole(role)
  };
}

export function assertWorkflowTransactionPermission(
  transactionType: WorkflowTransactionType,
  workflowType: OperatingWorkflowType,
  role: UserRole
): WorkflowTransactionPermissionCheck {
  const check = checkWorkflowTransactionPermission(role, transactionType, workflowType);

  if (!check.allowed) {
    throw new Error(check.message);
  }

  return check;
}

export {
  checkWorkflowTransactionPermission,
  getPermissionsForWorkflowTransaction
};
