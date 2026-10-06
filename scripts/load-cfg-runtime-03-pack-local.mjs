import { randomUUID } from "node:crypto";
import {
  assertLocalSupabaseUrl,
  createLocalServiceClient,
  defaultRuntime03PackPath,
  readJsonFile,
  sha256,
  validatePipelineQualificationRuntime03Pack,
} from "./cfg-runtime-01-utils.mjs";
import { assertNoProhibitedProcessState } from "./cfg-runtime-03-loopback-guard.mjs";
import { ids } from "./foundation-0b-test-utils.mjs";

const workspaceId = process.env.CFG_RUNTIME_03_WORKSPACE_ID || ids.workspaceA;
const tenantKey = process.env.CFG_RUNTIME_03_TENANT_KEY || "rybex-local-pipeline-qualification";
const configKey = process.env.CFG_RUNTIME_03_CONFIG_KEY || "p1-01a-pipeline-qualification";
const activationScope = process.env.CFG_RUNTIME_03_ACTIVATION_SCOPE || "pipeline-qualification";
const packPath = process.env.CFG_RUNTIME_03_PACK_PATH || defaultRuntime03PackPath;

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
}
assertNoProhibitedProcessState({ allowLocalEndpointEnv: true });

const pack = readJsonFile(packPath);
validatePipelineQualificationRuntime03Pack(pack);
const packHash = sha256(pack);
const supabase = createLocalServiceClient();
const effectiveFrom = new Date(Date.now() - 60_000).toISOString();

const result = await load();
console.log(JSON.stringify(result, null, 2));

async function load() {
  const workspace = await single("workspaces", "id,organization_id", { id: workspaceId }, "target workspace");
  const templatePack = await upsertImmutableTemplatePack();
  const templatePackVersion = await upsertImmutableTemplatePackVersion(templatePack.id);
  const tenant = await getOrCreateTenant(workspace);
  const activation = await activateTemplatePack(tenant.id, templatePackVersion.id);
  const tenantConfiguration = await getOrCreateTenantConfiguration(tenant.id, activation.id);
  const configurationVersion = await getOrCreateConfigurationVersion(tenantConfiguration.id, templatePackVersion.id);

  if (configurationVersion.status !== "published") {
    await insertDefinitions(configurationVersion.id);
    await publishConfigurationVersion(tenant.id, tenantConfiguration.id, configurationVersion.id);
  }

  await update("config_tenant_configurations", tenantConfiguration.id, {
    status: "active",
    active_version_id: configurationVersion.id,
    metadata_json: { source: "cfg-runtime-03", packHash },
  });
  await update("config_tenants", tenant.id, { active_configuration_version_id: configurationVersion.id });

  await insert("config_configuration_audit_events", {
    tenant_id: tenant.id,
    tenant_configuration_id: tenantConfiguration.id,
    configuration_version_id: configurationVersion.id,
    template_pack_id: templatePack.id,
    template_pack_version_id: templatePackVersion.id,
    event_type: "activated",
    event_source: "cfg_runtime_03_loader",
    correlation_id: randomUUID(),
    after_json: { packKey: pack.packKey, packVersion: pack.version, packHash },
    diff_json: { changed_objects: ["cfg-runtime-03-bid-submission-approval"] },
    reason: "CFG-RUNTIME-03 local compatibility pack activation",
    metadata_json: { packSource: packPath, packHash },
  });

  return {
    ok: true,
    workspaceId,
    tenantId: tenant.id,
    templatePackKey: pack.packKey,
    templatePackVersion: pack.version,
    packHash,
    configurationVersionId: configurationVersion.id,
    provenanceLabel: `${pack.packName} ${pack.version}`,
  };
}

async function upsertImmutableTemplatePack() {
  const existing = await maybeSingle("config_template_packs", "id,metadata_json", { pack_key: pack.packKey });
  if (existing) return existing;
  return insert("config_template_packs", {
    pack_key: pack.packKey,
    name: pack.packName,
    domain: pack.domain,
    owner_type: "platform",
    status: "released",
    metadata_json: { source: "cfg-runtime-03", packHash },
  });
}

async function upsertImmutableTemplatePackVersion(templatePackId) {
  const existing = await maybeSingle("config_template_pack_versions", "id,defaults_json,status", {
    template_pack_id: templatePackId,
    semver: pack.version,
  });
  const defaults = { pack, packHash };
  if (existing) {
    if (existing.defaults_json?.packHash !== packHash) {
      throw new Error(`template pack version ${pack.packKey}@${pack.version} is immutable and has conflicting content`);
    }
    return existing;
  }
  return insert("config_template_pack_versions", {
    template_pack_id: templatePackId,
    semver: pack.version,
    status: "released",
    defaults_json: defaults,
    compatibility_json: { status: "compatible", findings: [] },
    released_at: new Date().toISOString(),
  });
}

async function getOrCreateTenant(workspace) {
  const existing = await maybeSingle("config_tenants", "id", { workspace_id: workspace.id, status: "active" });
  if (existing) return existing;
  return insert("config_tenants", {
    tenant_key: tenantKey,
    name: "Rybex Local Pipeline Qualification",
    organization_id: workspace.organization_id,
    workspace_id: workspace.id,
    status: "active",
    metadata_json: { source: "cfg-runtime-03" },
  });
}

async function activateTemplatePack(tenantId, templatePackVersionId) {
  await supabase
    .from("config_tenant_template_activations")
    .update({ status: "superseded", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("activation_scope", activationScope)
    .eq("status", "active")
    .neq("template_pack_version_id", templatePackVersionId);

  const existing = await maybeSingle("config_tenant_template_activations", "id", {
    tenant_id: tenantId,
    template_pack_version_id: templatePackVersionId,
    activation_scope: activationScope,
  });
  if (existing) {
    await update("config_tenant_template_activations", existing.id, {
      status: "active",
      effective_from: effectiveFrom,
      activated_at: new Date().toISOString(),
    });
    return existing;
  }
  return insert("config_tenant_template_activations", {
    tenant_id: tenantId,
    template_pack_version_id: templatePackVersionId,
    activation_scope: activationScope,
    status: "active",
    effective_from: effectiveFrom,
    activated_at: new Date().toISOString(),
    compatibility_json: { status: "compatible", findings: [] },
  });
}

async function getOrCreateTenantConfiguration(tenantId, activationId) {
  const existing = await maybeSingle("config_tenant_configurations", "id,active_version_id", {
    tenant_id: tenantId,
    config_key: configKey,
  });
  if (existing) {
    await update("config_tenant_configurations", existing.id, { activation_id: activationId });
    return existing;
  }
  return insert("config_tenant_configurations", {
    tenant_id: tenantId,
    activation_id: activationId,
    config_key: configKey,
    name: "Pipeline Qualification, Pursuit Authorization, and Bid Approval",
    mode: pack.mode,
    status: "draft",
    metadata_json: { source: "cfg-runtime-03", packHash },
  });
}

async function getOrCreateConfigurationVersion(tenantConfigurationId, templatePackVersionId) {
  const existing = await maybeSingle("config_configuration_versions", "id,status,config_manifest_json", {
    tenant_configuration_id: tenantConfigurationId,
    version: 3,
  });
  if (existing) {
    if (existing.config_manifest_json?.packHash !== packHash) {
      throw new Error("configuration version 3 already exists with conflicting pack content");
    }
    return existing;
  }
  const base = await maybeSingle("config_configuration_versions", "id", {
    tenant_configuration_id: tenantConfigurationId,
    version: 2,
  });
  return insert("config_configuration_versions", {
    tenant_configuration_id: tenantConfigurationId,
    version: 3,
    status: "draft",
    base_configuration_version_id: base?.id ?? null,
    source_template_pack_version_id: templatePackVersionId,
    config_manifest_json: { source: "cfg-runtime-03", packKey: pack.packKey, packVersion: pack.version, packHash },
    diff_json: { changed_objects: ["cfg-runtime-03-bid-submission-approval"] },
  });
}

async function insertDefinitions(configurationVersionId) {
  const phase = await upsert("config_phase_definitions", ["configuration_version_id", "phase_key"], {
    configuration_version_id: configurationVersionId,
    phase_key: pack.phase.key,
    label: pack.phase.label,
    sort_order: pack.phase.sortOrder ?? 10,
    status: "active",
    metadata_json: { source: "cfg-runtime-03" },
  });

  const gates = new Map();
  for (const gate of pack.gates) {
    gates.set(gate.key, await upsert("config_gate_definitions", ["configuration_version_id", "gate_key"], {
      configuration_version_id: configurationVersionId,
      phase_id: phase.id,
      gate_key: gate.key,
      label: gate.label,
      purpose: gate.purpose,
      sort_order: gate.sortOrder ?? 0,
      status: "active",
      entry_rule_json: { requirements: gate.entryRequirements ?? [] },
      exit_rule_json: {},
    }));
  }

  const roles = new Map();
  for (const role of pack.roles) {
    roles.set(role.key, await upsert("config_role_definitions", ["configuration_version_id", "role_key"], {
      configuration_version_id: configurationVersionId,
      role_key: role.key,
      label: role.label,
      role_family: role.family ?? "configured",
      description: role.description ?? null,
      eligibility_rule_json: role.key === "submission_approver" ? { workspaceRoles: ["operations_leader", "admin"] } : {},
      status: "active",
    }));
  }

  const permissions = new Map();
  for (const permission of pack.permissions) {
    permissions.set(permission.key, await upsert("config_permission_definitions", ["configuration_version_id", "permission_key"], {
      configuration_version_id: configurationVersionId,
      permission_key: permission.key,
      label: permission.label,
      permission_scope: permission.scope,
      default_grant_rule_json: {},
      status: "active",
    }));
  }

  const evidenceTypes = new Map();
  for (const evidence of pack.evidenceTypes) {
    evidenceTypes.set(evidence.key, await upsert("config_evidence_type_definitions", ["configuration_version_id", "evidence_type_key"], {
      configuration_version_id: configurationVersionId,
      evidence_type_key: evidence.key,
      label: evidence.label,
      claim_tie_rule_json: {},
      completion_rule_json: evidence.completionRule ?? {},
      validation_rule_json: {},
      owner_role_key: evidence.ownerRoleKey ?? null,
      approver_role_key: evidence.approverRoleKey ?? null,
      status: "active",
    }));
  }

  for (const requirement of pack.gateEvidenceRequirements) {
    await upsert("config_gate_evidence_requirements", ["configuration_version_id", "gate_id", "evidence_type_id"], {
      configuration_version_id: configurationVersionId,
      gate_id: gates.get(requirement.gateKey).id,
      evidence_type_id: evidenceTypes.get(requirement.evidenceTypeKey).id,
      requirement_level: requirement.requirementLevel,
      blocking_rule_json: { blocking: requirement.blocking !== false, blocks_gate: requirement.blocking !== false },
      status: "active",
    });
  }

  for (const outcome of pack.decisionOutcomes) {
    await upsert("config_gate_decision_outcomes", ["gate_id", "outcome_key"], {
      configuration_version_id: configurationVersionId,
      gate_id: gates.get(outcome.gateKey).id,
      outcome_key: outcome.outcomeKey,
      label: outcome.label,
      outcome_type: outcome.outcomeType,
      consequence_json: {
        requiresJustification: Boolean(outcome.requiresJustification),
        requiresMitigation: Boolean(outcome.requiresMitigation),
        mapsToAction: outcome.mapsToAction,
      },
      status: "active",
    });
  }

  for (const right of pack.decisionRights) {
    await upsert("config_decision_right_definitions", ["configuration_version_id", "decision_right_key"], {
      configuration_version_id: configurationVersionId,
      decision_right_key: right.key,
      label: right.label,
      role_definition_id: roles.get(right.roleKey).id,
      permission_definition_id: permissions.get(right.permissionKey).id,
      gate_definition_id: gates.get(right.gateKey).id,
      record_scope_json: right.recordScope ?? {},
      approval_rule_json: { requiresAssignedDecisionOwner: true },
      status: "active",
    });
  }

  for (const kpi of pack.kpis ?? []) {
    await upsert("config_kpi_definitions", ["configuration_version_id", "kpi_key"], {
      configuration_version_id: configurationVersionId,
      kpi_key: kpi.key,
      label: kpi.label,
      formula_json: kpi.formula ?? {},
      trend_direction: kpi.trendDirection ?? null,
      status: "active",
    });
  }
}

async function publishConfigurationVersion(tenantId, tenantConfigurationId, configurationVersionId) {
  await supabase
    .from("config_configuration_versions")
    .update({ status: "superseded", effective_to: effectiveFrom })
    .eq("tenant_configuration_id", tenantConfigurationId)
    .eq("status", "published")
    .neq("id", configurationVersionId);
  await update("config_configuration_versions", configurationVersionId, {
    status: "published",
    effective_from: effectiveFrom,
    published_at: new Date().toISOString(),
  });
  await update("config_tenants", tenantId, { active_configuration_version_id: configurationVersionId });
}

async function maybeSingle(table, columns, match) {
  let query = supabase.from(table).select(columns);
  for (const [key, value] of Object.entries(match)) query = query.eq(key, value);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${table} lookup failed: ${error.message}`);
  return data;
}

async function single(table, columns, match, label) {
  const data = await maybeSingle(table, columns, match);
  if (!data) throw new Error(`${label} was not found`);
  return data;
}

async function insert(table, values) {
  const { data, error } = await supabase.from(table).insert(values).select("*").single();
  if (error) throw new Error(`${table} insert failed: ${error.message}`);
  return data;
}

async function update(table, id, values) {
  const { data, error } = await supabase.from(table).update(values).eq("id", id).select("*").single();
  if (error) throw new Error(`${table} update failed: ${error.message}`);
  return data;
}

async function upsert(table, keys, values) {
  let query = supabase.from(table).select("*");
  for (const key of keys) query = query.eq(key, values[key]);
  const { data: existing, error: lookupError } = await query.maybeSingle();
  if (lookupError) throw new Error(`${table} lookup failed: ${lookupError.message}`);
  if (existing) {
    const { data, error } = await supabase.from(table).update(values).eq("id", existing.id).select("*").single();
    if (error) throw new Error(`${table} update failed: ${error.message}`);
    return data;
  }
  return insert(table, values);
}
