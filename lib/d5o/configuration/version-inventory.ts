export type ConfigurationInventoryStatus = "ready" | "no_mapping" | "ambiguous_mapping" | "unavailable_version";

export type TenantMapping = {
  id: string;
  workspace_id: string;
  status: string;
  active_configuration_version_id: string | null;
};

export type ConfigurationVersionSummary = {
  id: string;
  tenant_configuration_id: string;
  version: number;
  status: string;
  base_configuration_version_id: string | null;
  published_at: string | null;
  effective_from: string | null;
  effective_to: string | null;
  config_manifest_json?: Record<string, unknown>;
};

export type ConfigurationInventory = {
  workspaceId: string;
  status: ConfigurationInventoryStatus;
  tenantId: string | null;
  activeVersionId: string | null;
  versions: ConfigurationVersionSummary[];
  canAdminister: boolean;
};

export function resolveConfigurationInventory(
  workspaceId: string,
  mappings: TenantMapping[],
  versions: ConfigurationVersionSummary[],
  canAdminister: boolean,
): ConfigurationInventory {
  const eligible = mappings.filter((item) => item.workspace_id === workspaceId && item.status !== "archived");
  const base = { workspaceId, tenantId: null, activeVersionId: null, versions: [] as ConfigurationVersionSummary[], canAdminister };
  if (!eligible.length) return { ...base, status: "no_mapping" };
  if (eligible.length !== 1) return { ...base, status: "ambiguous_mapping" };
  const mapping = eligible[0];
  const active = versions.find((item) => item.id === mapping.active_configuration_version_id);
  if (!active || active.status !== "published") return {
    ...base, status: "unavailable_version", tenantId: mapping.id,
    versions: canAdminister ? versions.filter((item) => item.status === "draft" || item.status === "review") : [],
  };
  return {
    status: "ready", workspaceId, tenantId: mapping.id, activeVersionId: active.id,
    versions: [...versions].filter((item) => canAdminister || item.status === "published" || item.status === "superseded").sort((a, b) => b.version - a.version), canAdminister,
  };
}
