import { getDatabaseReadinessStatus } from "../data/database-diagnostics";
import { demoUser, getDemoRolePermissions } from "../demo-user";
import type { RybexPermission } from "../rbac";
import { getPermissionsForRole } from "../rbac";
import type { UserRole } from "../types";
import { getAuthMode, type RybexAuthMode } from "./auth-mode";

export type CurrentRybexUser = {
  id?: string;
  name: string;
  email?: string;
  role?: UserRole;
  source: RybexAuthMode;
  authenticated: boolean;
  authorizationStatus: "authorized" | "unauthenticated" | "no_membership" | "unsupported";
  message: string;
};

export type CurrentWorkspaceMembership = {
  organizationId?: string;
  workspaceId?: string;
  role?: UserRole;
  roleKey?: UserRole;
  permissions: RybexPermission[];
  source: RybexAuthMode;
  status: "resolved" | "unresolved";
  message: string;
};

export async function getCurrentRybexUser(): Promise<CurrentRybexUser> {
  if (getAuthMode() === "demo") {
    return {
      id: demoUser.id,
      name: demoUser.name,
      role: demoUser.role,
      source: "demo",
      authenticated: true,
      authorizationStatus: "authorized",
      message: "Demo auth mode is active. Current user is the non-persistent demo role."
    };
  }

  const readiness = getDatabaseReadinessStatus();

  if (!readiness.databaseReadPilotReady) {
    return {
      name: "Unauthenticated Supabase user",
      source: "supabase",
      authenticated: false,
      authorizationStatus: "unauthenticated",
      message: "Supabase auth mode requested, but Supabase environment variables are incomplete."
    };
  }

  return {
    name: "Unauthenticated Supabase user",
    source: "supabase",
    authenticated: false,
    authorizationStatus: "unsupported",
    message: "Supabase auth mode is reserved for the next pass. No login/session resolver is active yet."
  };
}

export async function getCurrentWorkspaceMembership(): Promise<CurrentWorkspaceMembership> {
  const user = await getCurrentRybexUser();

  if (user.source === "demo" && user.role) {
    return {
      role: user.role,
      roleKey: user.role,
      permissions: getDemoRolePermissions(),
      source: "demo",
      status: "resolved",
      message: "Demo workspace membership resolved from the current demo role."
    };
  }

  return {
    permissions: [],
    source: user.source,
    status: "unresolved",
    message: user.message
  };
}

export async function getCurrentUserRole(): Promise<UserRole | undefined> {
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
