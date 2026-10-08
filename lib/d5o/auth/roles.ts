import type { UserRole } from "../types";

export type CanonicalWorkspaceRole =
  | "executive"
  | "operations_leader"
  | "business_development_lead"
  | "project_manager"
  | "billing_commercial_lead"
  | "field_supervisor"
  | "closeout_lead"
  | "admin"
  | "read_only_auditor";

export const canonicalWorkspaceRoles = [
  "executive",
  "operations_leader",
  "business_development_lead",
  "project_manager",
  "billing_commercial_lead",
  "field_supervisor",
  "closeout_lead",
  "admin",
  "read_only_auditor"
] as const satisfies readonly CanonicalWorkspaceRole[];

export function isCanonicalWorkspaceRole(role: string | undefined): role is CanonicalWorkspaceRole {
  return Boolean(role && canonicalWorkspaceRoles.includes(role as CanonicalWorkspaceRole));
}

export function normalizeWorkspaceRole(role: UserRole | CanonicalWorkspaceRole | string | undefined): CanonicalWorkspaceRole | undefined {
  if (!role) return undefined;
  if (isCanonicalWorkspaceRole(role)) return role;

  const legacyMap: Record<string, CanonicalWorkspaceRole> = {
    superintendent: "field_supervisor",
    safety_manager: "project_manager",
    quality_manager: "project_manager",
    finance_admin: "billing_commercial_lead"
  };

  return legacyMap[role];
}

export function requireCanonicalWorkspaceRole(role: UserRole | CanonicalWorkspaceRole | string | undefined) {
  const normalized = normalizeWorkspaceRole(role);

  if (!normalized) {
    throw new Error(`Unsupported workspace role: ${role ?? "missing"}.`);
  }

  return normalized;
}
