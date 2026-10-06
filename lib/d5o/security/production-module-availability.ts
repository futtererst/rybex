export type ProductionModuleAvailability = "production_enabled" | "unavailable_until_migrated" | "administration_only";

export type ProductionModuleDefinition = {
  id: string;
  label: string;
  href: string;
  availability: ProductionModuleAvailability;
  reason: string;
};

export const productionModuleDefinitions: ProductionModuleDefinition[] = [
  enabled("command_center", "Command Center", "/command-center"),
  enabled("billing", "Billing", "/billing"),
  enabled("field_execution", "Field Execution", "/field-execution"),
  enabled("rfis_submittals", "RFIs/Submittals", "/rfis-submittals"),
  enabled("changes", "Changes", "/changes"),
  enabled("closeout", "Closeout", "/closeout"),
  admin("admin", "Admin", "/admin"),
  unavailable("pipeline", "Pipeline", "/pipeline"),
  unavailable("projects", "Projects", "/projects"),
  unavailable("mobilization", "Mobilization", "/mobilization"),
  unavailable("safety", "Safety", "/safety"),
  unavailable("quality", "Quality", "/quality"),
  unavailable("reports", "Reports / Optimize", "/reports"),
  unavailable("pilot", "Pilot", "/pilot"),
  unavailable("workflow_demo", "Workflow demonstrations", "/workflow")
];

const enabledPrefixes = productionModuleDefinitions
  .filter((definition) => definition.availability !== "unavailable_until_migrated")
  .map((definition) => definition.href);

const unavailablePrefixes = productionModuleDefinitions
  .filter((definition) => definition.availability === "unavailable_until_migrated")
  .map((definition) => definition.href);

export function getProductionEnabledModules() {
  return productionModuleDefinitions.filter((definition) => definition.availability === "production_enabled");
}

export function getProductionUnavailableModules() {
  return productionModuleDefinitions.filter((definition) => definition.availability === "unavailable_until_migrated");
}

export function getProductionModuleAvailability(pathname: string): ProductionModuleAvailability {
  const normalized = normalizePath(pathname);

  if (normalized === "/" || enabledPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    const matched = productionModuleDefinitions.find((definition) => normalized === definition.href || normalized.startsWith(`${definition.href}/`));
    return matched?.availability ?? "production_enabled";
  }

  if (unavailablePrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    return "unavailable_until_migrated";
  }

  if (normalized.startsWith("/api/health") || normalized.startsWith("/api/readiness")) {
    return "administration_only";
  }

  return "unavailable_until_migrated";
}

export function isProductionRouteAvailable(pathname: string) {
  return getProductionModuleAvailability(pathname) !== "unavailable_until_migrated";
}

function enabled(id: string, label: string, href: string): ProductionModuleDefinition {
  return {
    id,
    label,
    href,
    availability: "production_enabled",
    reason: "Approved production-mode core journey module for Foundation 0F."
  };
}

function admin(id: string, label: string, href: string): ProductionModuleDefinition {
  return {
    id,
    label,
    href,
    availability: "administration_only",
    reason: "Allowed only for diagnostics and security administration."
  };
}

function unavailable(id: string, label: string, href: string): ProductionModuleDefinition {
  return {
    id,
    label,
    href,
    availability: "unavailable_until_migrated",
    reason: "This module is seed-backed or scaffolded and has not passed a production persistence gate."
  };
}

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}
