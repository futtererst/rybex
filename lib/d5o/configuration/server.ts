import "server-only";

import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { assertProofEnvironment } from "@/lib/d5o/work-record/server";
import {
  resolveConfigurationInventory,
  type ConfigurationInventory,
  type ConfigurationVersionSummary,
  type TenantMapping,
} from "./version-inventory";

export async function loadConfigurationInventory(workspaceId: string): Promise<ConfigurationInventory> {
  assertProofEnvironment();
  const context = await getRequestContext();
  if (context.status !== "authorized" || context.workspace?.id !== workspaceId || !context.membership) {
    throw new Error("configuration_workspace_forbidden");
  }
  const client = await createRybexSupabaseServerClient();
  const mappingsResult = await client.from("config_tenants")
    .select("id,workspace_id,status,active_configuration_version_id")
    .eq("workspace_id", workspaceId).neq("status", "archived");
  if (mappingsResult.error) throw new Error(`configuration_mapping_unavailable: ${mappingsResult.error.message}`);
  const mappings = (mappingsResult.data ?? []) as TenantMapping[];
  if (mappings.length !== 1) return resolveConfigurationInventory(workspaceId, mappings, [], context.role === "admin");
  const configsResult = await client.from("config_tenant_configurations").select("id").eq("tenant_id", mappings[0].id);
  if (configsResult.error) throw new Error(`configuration_lineage_unavailable: ${configsResult.error.message}`);
  const configurationIds = ((configsResult.data ?? []) as Array<{ id: string }>).map((item) => item.id);
  if (!configurationIds.length) return resolveConfigurationInventory(workspaceId, mappings, [], context.role === "admin");
  const versionsResult = await client.from("config_configuration_versions")
    .select("id,tenant_configuration_id,version,status,base_configuration_version_id,published_at,effective_from,effective_to,config_manifest_json")
    .in("tenant_configuration_id", configurationIds);
  if (versionsResult.error) throw new Error(`configuration_versions_unavailable: ${versionsResult.error.message}`);
  return resolveConfigurationInventory(workspaceId, mappings, (versionsResult.data ?? []) as ConfigurationVersionSummary[], context.role === "admin");
}
