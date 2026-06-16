import { primaryNavItems } from "./modules";
import { canAccessModule, getPermissionsForRole, type RybexModuleId } from "./rbac";
import type { UserRole } from "./types";

export type DemoUser = {
  id: string;
  name: string;
  role: UserRole;
  title: string;
};

export const demoUser: DemoUser = {
  id: "user-demo-operations",
  name: "Alyssa Morgan",
  role: "operations_leader",
  title: "Operations Leader"
};

export function getDemoAccessibleModules() {
  return primaryNavItems.map((item) => {
    const moduleId = item.href.replace("/", "") || "command-center";
    const normalizedModuleId = moduleId === "command-center" ? "command-center" : moduleId;

    return {
      ...item,
      canAccess: canAccessModule(demoUser.role, normalizedModuleId as RybexModuleId)
    };
  });
}

export function getDemoRolePermissions() {
  return getPermissionsForRole(demoUser.role);
}
