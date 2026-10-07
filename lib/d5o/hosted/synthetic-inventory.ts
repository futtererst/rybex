import type { WorkspaceKey } from "@/components/d5o/platform/work-types";
import { defaultPhaseContract } from "@/components/d5o/platform/published-phase-configuration";
import type { ConfigurationInventory } from "@/lib/d5o/configuration/version-inventory";

/** Presentation-only configuration for the synthetic hosted prototype.
 * This is deliberately distinct from d5o_hosted.configuration_versions and
 * cannot authorize an M1 Work Record command or a real business decision. */
export function hostedSyntheticInventory(workspace: WorkspaceKey): ConfigurationInventory {
  const versionId = `synthetic-hosted-preview-v2:${workspace}`;
  return {
    workspaceId: `synthetic:${workspace}`,
    status: "ready",
    tenantId: `synthetic:${workspace}`,
    activeVersionId: versionId,
    canAdminister: false,
    versions: [{
      id: versionId,
      tenant_configuration_id: `synthetic:${workspace}`,
      version: 2,
      status: "published",
      base_configuration_version_id: null,
      published_at: null,
      effective_from: null,
      effective_to: null,
      config_manifest_json: {
        d5oPresentation: {
          schemaVersion: 1,
          changeReason: "Synthetic hosted prototype; no delegated business authority",
          phaseContract: defaultPhaseContract(workspace)
        }
      }
    }]
  };
}
