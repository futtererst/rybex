import type { RybexPermission, CanonicalWorkspaceRole } from "../rbac";
import { getPermissionsForRole } from "../rbac";
import type { UserRole } from "../types";
import { getAuthMode, type RybexAuthMode } from "./auth-mode";
import { getRequestContext } from "./request-context";

export type CurrentRybexUser = {
  id?: string;
  name: string;
  email?: string;
  role?: UserRole | CanonicalWorkspaceRole;
  canonicalRole?: CanonicalWorkspaceRole;
  source: RybexAuthMode;
  authenticated: boolean;
  authorizationStatus: "authorized" | "unauthenticated" | "no_membership" | "unsupported" | "workspace_selection_required";
  message: string;
};

export type CurrentWorkspaceMembership = {
  organizationId?: string;
  workspaceId?: string;
  role?: UserRole | CanonicalWorkspaceRole;
  roleKey?: UserRole | CanonicalWorkspaceRole;
  canonicalRole?: CanonicalWorkspaceRole;
  permissions: RybexPermission[];
  source: RybexAuthMode;
  status: "resolved" | "unresolved";
  message: string;
};

export async function getCurrentRybexUser(): Promise<CurrentRybexUser> {
  const context = await getRequestContext();

  if (!context.authenticated || !context.user || !context.role) {
    return {
      name: "Unauthenticated RybexOS user",
      source: getAuthMode(),
      authenticated: false,
      authorizationStatus: mapAuthorizationStatus(context.status),
      message: context.message
    };
  }

  return {
    id: context.user.id,
    name: context.user.name,
    email: context.user.email,
    role: context.role,
    canonicalRole: context.role,
    source: context.authMode,
    authenticated: true,
    authorizationStatus: "authorized",
    message: context.message
  };
}

export async function getCurrentWorkspaceMembership(): Promise<CurrentWorkspaceMembership> {
  const context = await getRequestContext();

  if (!context.authenticated || !context.membership || !context.role) {
    return {
      permissions: [],
      source: context.authMode,
      status: "unresolved",
      message: context.message
    };
  }

  return {
    workspaceId: context.membership.workspaceId,
    role: context.role,
    roleKey: context.role,
    canonicalRole: context.role,
    permissions: context.permissions,
    source: context.authMode,
    status: "resolved",
    message: context.message
  };
}

export async function getCurrentUserRole(): Promise<UserRole | CanonicalWorkspaceRole | undefined> {
  const membership = await getCurrentWorkspaceMembership();

  return membership.role;
}

export async function getCurrentUserPermissions(): Promise<RybexPermission[]> {
  const role = await getCurrentUserRole();

  return role ? getPermissionsForRole(role) : [];
}

export function getDatabaseSafeActorUserId(user: CurrentRybexUser) {
  return user.id && isUuid(user.id) ? user.id : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function mapAuthorizationStatus(status: Awaited<ReturnType<typeof getRequestContext>>["status"]): CurrentRybexUser["authorizationStatus"] {
  if (status === "workspace_selection_required") return "workspace_selection_required";
  if (status === "no_membership") return "no_membership";
  if (status === "unsupported" || status === "production_not_ready" || status === "no_profile") return "unsupported";
  return "unauthenticated";
}
