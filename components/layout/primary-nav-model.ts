import { demoUser, getDemoAccessibleModules } from "@/lib/d5o/demo-user";
import { primaryNavItems } from "@/lib/d5o/modules";
import { canAccessModule, type CanonicalWorkspaceRole, type RybexModuleId } from "@/lib/d5o/rbac";

export type PrimaryNavProps = {
  productionMode?: boolean;
  currentRole?: CanonicalWorkspaceRole;
  currentRoleLabel?: string;
  currentUserName?: string;
};

export type PrimaryNavItem = (typeof primaryNavItems)[number] & {
  canAccess: boolean;
};

const moduleIdByHref: Readonly<Record<string, RybexModuleId>> = {
  "/command-center": "command-center",
  "/pipeline": "pipeline",
  "/projects": "projects",
  "/mobilization": "mobilization",
  "/field-execution": "field-execution",
  "/rfis-submittals": "rfis-submittals",
  "/changes": "changes",
  "/billing": "billing",
  "/safety": "safety",
  "/quality": "quality",
  "/closeout": "closeout",
  "/reports": "reports",
  "/admin": "admin"
};

export const corePrimaryNavHrefs = new Set([
  "/command-center",
  "/field-execution",
  "/rfis-submittals",
  "/changes",
  "/billing",
  "/closeout"
]);

export function getPrimaryNavItems(currentRole: CanonicalWorkspaceRole | undefined): PrimaryNavItem[] {
  if (!currentRole) {
    return getDemoAccessibleModules();
  }

  return primaryNavItems.map((item) => ({
    ...item,
    canAccess: canAccessModule(currentRole, moduleIdByHref[item.href])
  }));
}

export function getPrimaryNavGroups(navItems: PrimaryNavItem[], productionMode: boolean) {
  return {
    coreItems: navItems.filter((item) => corePrimaryNavHrefs.has(item.href)),
    otherItems: productionMode
      ? []
      : navItems.filter((item) => !corePrimaryNavHrefs.has(item.href))
  };
}

export function isPrimaryNavItemActive(pathname: string, href: string) {
  if (href === "/command-center") {
    return pathname === "/" || pathname === href || pathname.startsWith(`${href}/`);
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getVisibleRoleContext({
  productionMode,
  currentRoleLabel,
  currentUserName
}: Pick<PrimaryNavProps, "productionMode" | "currentRoleLabel" | "currentUserName">) {
  return {
    roleLabel: currentRoleLabel ?? (productionMode ? "Role unavailable" : demoUser.title),
    userName: currentUserName ?? (productionMode ? "Unauthenticated user" : demoUser.name)
  };
}
