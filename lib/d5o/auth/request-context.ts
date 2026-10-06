import "server-only";

import { demoUser } from "../demo-user";
import { getPermissionsForRole, normalizeWorkspaceRole, type CanonicalWorkspaceRole, type RybexPermission } from "../rbac";
import { assertProductionRuntimeReady, getRuntimeMode, productionLocalAdapterError, type RybexRuntimeMode } from "../security/runtime-mode";
import { getAuthMode } from "./auth-mode";
import { createRybexSupabaseServerClient, canCreateSupabaseServerClient } from "./supabase-server";

export type RequestContextStatus =
  | "authorized"
  | "unauthenticated"
  | "no_profile"
  | "no_membership"
  | "workspace_selection_required"
  | "unsupported"
  | "production_not_ready";

export type RybexRequestContext = {
  runtimeMode: RybexRuntimeMode;
  authMode: ReturnType<typeof getAuthMode>;
  authenticated: boolean;
  status: RequestContextStatus;
  message: string;
  correlationId: string;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
  profile?: {
    id: string;
    userId: string;
    displayName: string;
    email?: string;
    activeWorkspaceId?: string;
    status: string;
  };
  workspace?: {
    id: string;
    name?: string;
    slug?: string;
  };
  membership?: {
    id: string;
    workspaceId: string;
    userId: string;
    role: CanonicalWorkspaceRole;
    status: string;
  };
  role?: CanonicalWorkspaceRole;
  permissions: RybexPermission[];
};

type ProfileRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  active_workspace_id: string | null;
  status: string | null;
};

type MembershipRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  status: string;
  workspaces?: {
    id: string;
    name: string | null;
    slug: string | null;
  } | null;
};

export async function getRequestContext(): Promise<RybexRequestContext> {
  const runtimeMode = getRuntimeMode();
  const authMode = getAuthMode();
  const correlationId = createCorrelationId();

  if (runtimeMode === "production") {
    const readiness = assertProductionRuntimeReady();
    if (!readiness.ok) {
      return contextBase("production_not_ready", readiness.message, correlationId);
    }
  }

  if (runtimeMode !== "production" && authMode === "demo") {
    const role = normalizeWorkspaceRole(demoUser.role) ?? "operations_leader";

    return {
      ...contextBase("authorized", "Local/test demo request context resolved.", correlationId),
      authenticated: true,
      user: {
        id: demoUser.id,
        name: demoUser.name
      },
      profile: {
        id: demoUser.id,
        userId: demoUser.id,
        displayName: demoUser.name,
        status: "active"
      },
      workspace: {
        id: "workspace-local-rybex",
        name: "Local RybexOS Workspace",
        slug: "local-rybex"
      },
      membership: {
        id: "membership-local-rybex-demo",
        workspaceId: "workspace-local-rybex",
        userId: demoUser.id,
        role,
        status: "active"
      },
      role,
      permissions: getPermissionsForRole(role)
    };
  }

  if (!canCreateSupabaseServerClient()) {
    return contextBase(
      runtimeMode === "production" ? "production_not_ready" : "unauthenticated",
      "Supabase auth mode requested, but Supabase environment variables are incomplete.",
      correlationId
    );
  }

  const supabase = await createRybexSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const authUser = userData.user;

  if (userError || !authUser) {
    return contextBase("unauthenticated", "No authenticated Supabase user is available for this request.", correlationId);
  }

  const profileResult = await supabase
    .from("user_profiles")
    .select("id,user_id,display_name,email,active_workspace_id,status")
    .eq("user_id", authUser.id)
    .limit(1);
  const profile = (profileResult.data?.[0] ?? null) as ProfileRow | null;

  if (profileResult.error || !profile || profile.status === "suspended") {
    return contextBase("no_profile", "Authenticated user does not have an active RybexOS profile.", correlationId);
  }

  const membershipResult = await supabase
    .from("workspace_memberships")
    .select("id,workspace_id,user_id,role,status,workspaces(id,name,slug)")
    .eq("user_id", authUser.id)
    .eq("status", "active");
  const memberships = (membershipResult.data ?? []) as MembershipRow[];

  if (membershipResult.error || memberships.length === 0) {
    return contextBase("no_membership", "Authenticated user does not have an active workspace membership.", correlationId);
  }

  const activeMembership = resolveActiveMembership(profile.active_workspace_id, memberships);

  if (!activeMembership) {
    return contextBase("workspace_selection_required", "Multiple active workspaces require a valid active workspace selection.", correlationId);
  }

  const role = normalizeWorkspaceRole(activeMembership.role);

  if (!role) {
    return contextBase("unsupported", `Unsupported workspace role: ${activeMembership.role}.`, correlationId);
  }

  return {
    ...contextBase("authorized", "Supabase request context resolved.", correlationId),
    authenticated: true,
    user: {
      id: authUser.id,
      name: profile.display_name ?? authUser.email ?? "RybexOS user",
      email: authUser.email ?? profile.email ?? undefined
    },
    profile: {
      id: profile.id,
      userId: profile.user_id,
      displayName: profile.display_name ?? authUser.email ?? "RybexOS user",
      email: profile.email ?? authUser.email ?? undefined,
      activeWorkspaceId: profile.active_workspace_id ?? undefined,
      status: profile.status ?? "active"
    },
    workspace: {
      id: activeMembership.workspace_id,
      name: activeMembership.workspaces?.name ?? undefined,
      slug: activeMembership.workspaces?.slug ?? undefined
    },
    membership: {
      id: activeMembership.id,
      workspaceId: activeMembership.workspace_id,
      userId: activeMembership.user_id,
      role,
      status: activeMembership.status
    },
    role,
    permissions: getPermissionsForRole(role)
  };
}

export async function requireRequestContext(permission?: RybexPermission) {
  const context = await getRequestContext();

  if (!context.authenticated || !context.role) {
    throw new Error(context.message);
  }

  if (permission && !context.permissions.includes(permission)) {
    throw new Error(`Permission required: ${permission}.`);
  }

  return context;
}

export function assertCanUseLocalBusinessAdapter(domain: string) {
  if (getRuntimeMode() === "production") {
    throw new Error(productionLocalAdapterError(domain));
  }
}

function contextBase(status: RequestContextStatus, message: string, correlationId: string): RybexRequestContext {
  return {
    runtimeMode: getRuntimeMode(),
    authMode: getAuthMode(),
    authenticated: false,
    status,
    message,
    correlationId,
    permissions: []
  };
}

function resolveActiveMembership(activeWorkspaceId: string | null, memberships: MembershipRow[]) {
  if (activeWorkspaceId) {
    return memberships.find((membership) => membership.workspace_id === activeWorkspaceId) ?? null;
  }

  return memberships.length === 1 ? memberships[0] : null;
}

function createCorrelationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
