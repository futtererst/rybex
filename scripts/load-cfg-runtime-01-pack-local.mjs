import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  assertLocalSupabaseUrl,
  defaultPackPath,
  readJsonFile,
  sha256,
  stableJson,
  validatePipelineQualificationPack,
} from "./cfg-runtime-01-utils.mjs";
import { ids } from "./foundation-0b-test-utils.mjs";

const workspaceId = process.env.CFG_RUNTIME_01_WORKSPACE_ID || ids.workspaceA;
const tenantKey = process.env.CFG_RUNTIME_01_TENANT_KEY || "rybex-local-pipeline-qualification";
const configKey = process.env.CFG_RUNTIME_01_CONFIG_KEY || "p1-01a-pipeline-qualification";
const activationScope = process.env.CFG_RUNTIME_01_ACTIVATION_SCOPE || "pipeline-qualification";
const packPath = process.env.CFG_RUNTIME_01_PACK_PATH || defaultPackPath;
const localDbContainer = process.env.CFG_RUNTIME_01_DB_CONTAINER || "supabase_db_rybex-2-local";

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
}

const pack = readJsonFile(packPath);
validatePipelineQualificationPack(pack);
const packHash = sha256(pack);
const effectiveFrom = new Date(Date.now() - 60_000).toISOString();
const sql = buildSql();
const resultJson = psqlValue(sql);
console.log(resultJson);

function psqlValue(sqlText) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", localDbContainer, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A"],
    {
      input: sqlText,
      encoding: "utf8",
      shell: false,
      maxBuffer: 1024 * 1024 * 20,
    },
  );
  if (result.status !== 0) {
    throw new Error(`Local pack load failed.\n${result.stdout || ""}\n${result.stderr || ""}`.trim());
  }
  return result.stdout.trim();
}

function buildSql() {
  const phase = pack.phase;
  const gate = pack.gate;
  const role = pack.roles[0];
  const permission = pack.permissions[0];
  const evidence = pack.evidenceTypes[0];
  const requirement = pack.gateEvidenceRequirements[0];
  const right = pack.decisionRights[0];
  const manifest = {
    source: "cfg-runtime-01",
    packKey: pack.packKey,
    packVersion: pack.version,
    packHash,
  };

  return `
do $$
<<cfg_runtime_01>>
declare
  workspace_row workspaces%rowtype;
  template_pack_id uuid;
  template_pack_version_id uuid;
  tenant_id uuid;
  activation_id uuid;
  tenant_configuration_id uuid;
  configuration_version_id uuid;
  phase_id uuid;
  gate_id uuid;
  role_id uuid;
  permission_id uuid;
  evidence_id uuid;
  existing_hash text;
  tenant_count integer;
begin
  select * into workspace_row from workspaces where id = '${workspaceId}'::uuid;
  if not found then
    raise exception 'target workspace % was not found', '${workspaceId}';
  end if;

  select count(*) into tenant_count
  from config_tenants
  where workspace_id = workspace_row.id
    and status <> 'archived';

  if tenant_count > 1 then
    raise exception 'workspace % has ambiguous active tenants', workspace_row.id;
  end if;

  select ctp.id into template_pack_id from config_template_packs ctp where ctp.pack_key = ${q(pack.packKey)};
  if template_pack_id is null then
    insert into config_template_packs (pack_key, name, domain, owner_type, status, metadata_json)
    values (${q(pack.packKey)}, ${q(pack.packName)}, ${q(pack.domain)}, 'platform', 'released', jsonb_build_object('source','cfg-runtime-01','packHash',${q(packHash)}))
    returning id into template_pack_id;
  else
    if not exists (
      select 1 from config_template_packs ctp
      where ctp.id = cfg_runtime_01.template_pack_id and ctp.name = ${q(pack.packName)} and ctp.domain = ${q(pack.domain)}
    ) then
      raise exception 'template pack % already exists with conflicting identity', ${q(pack.packKey)};
    end if;
  end if;

  select id, defaults_json->>'packHash'
  into template_pack_version_id, existing_hash
  from config_template_pack_versions tpv
  where tpv.template_pack_id = cfg_runtime_01.template_pack_id and tpv.semver = ${q(pack.version)}
  limit 1;

  if template_pack_version_id is null then
    insert into config_template_pack_versions (template_pack_id, semver, status, defaults_json, compatibility_json, released_at)
    values (cfg_runtime_01.template_pack_id, ${q(pack.version)}, 'released', jsonb_build_object('pack', ${json(pack)}, 'packHash', ${q(packHash)}), '{"status":"compatible","findings":[]}'::jsonb, now())
    returning id into template_pack_version_id;
  elsif existing_hash is distinct from ${q(packHash)} then
    raise exception 'template pack version %@% is immutable and has conflicting content', ${q(pack.packKey)}, ${q(pack.version)};
  end if;

  select ct.id into tenant_id
  from config_tenants ct
  where ct.workspace_id = workspace_row.id and ct.status <> 'archived'
  limit 1;

  if tenant_id is null then
    insert into config_tenants (tenant_key, name, organization_id, workspace_id, status, metadata_json)
    values (${q(tenantKey)}, 'Rybex Local Pipeline Qualification', workspace_row.organization_id, workspace_row.id, 'active', jsonb_build_object('source','cfg-runtime-01','workspaceSlug',workspace_row.slug))
    returning id into tenant_id;
  elsif not exists (select 1 from config_tenants ct where ct.id = cfg_runtime_01.tenant_id and ct.tenant_key = ${q(tenantKey)}) then
    raise exception 'workspace % already has a different active tenant', workspace_row.id;
  end if;

  select ctta.id into activation_id
  from config_tenant_template_activations ctta
  where ctta.tenant_id = cfg_runtime_01.tenant_id and ctta.activation_scope = ${q(activationScope)} and ctta.status = 'active'
  limit 1;

  if activation_id is null then
    insert into config_tenant_template_activations (tenant_id, template_pack_version_id, activation_scope, status, effective_from, activated_at, compatibility_json)
    values (cfg_runtime_01.tenant_id, cfg_runtime_01.template_pack_version_id, ${q(activationScope)}, 'active', ${q(effectiveFrom)}::timestamptz, now(), '{"status":"compatible","findings":[]}'::jsonb)
    returning id into activation_id;
  elsif not exists (
    select 1 from config_tenant_template_activations ctta
    where ctta.id = cfg_runtime_01.activation_id and ctta.template_pack_version_id = cfg_runtime_01.template_pack_version_id
  ) then
    raise exception 'tenant already has active activation for a different template-pack version';
  end if;

  select ctc.id into tenant_configuration_id
  from config_tenant_configurations ctc
  where ctc.tenant_id = cfg_runtime_01.tenant_id and ctc.config_key = ${q(configKey)}
  limit 1;

  if tenant_configuration_id is null then
    insert into config_tenant_configurations (tenant_id, activation_id, config_key, name, mode, status, metadata_json)
    values (cfg_runtime_01.tenant_id, cfg_runtime_01.activation_id, ${q(configKey)}, 'P1-01A Pipeline Qualification', ${q(pack.mode)}, 'draft', jsonb_build_object('source','cfg-runtime-01','packHash',${q(packHash)}))
    returning id into tenant_configuration_id;
  elsif not exists (
    select 1 from config_tenant_configurations ctc
    where ctc.id = cfg_runtime_01.tenant_configuration_id and ctc.activation_id = cfg_runtime_01.activation_id
  ) then
    raise exception 'tenant configuration exists with a different activation';
  end if;

  select id, config_manifest_json->>'packHash'
  into configuration_version_id, existing_hash
  from config_configuration_versions ccv
  where ccv.tenant_configuration_id = cfg_runtime_01.tenant_configuration_id and ccv.version = 1
  limit 1;

  if configuration_version_id is null then
    insert into config_configuration_versions (tenant_configuration_id, version, status, source_template_pack_version_id, config_manifest_json, diff_json)
    values (cfg_runtime_01.tenant_configuration_id, 1, 'draft', cfg_runtime_01.template_pack_version_id, ${json(manifest)}, '{"changed_objects":[]}'::jsonb)
    returning id into configuration_version_id;
  elsif existing_hash is distinct from ${q(packHash)} then
    raise exception 'configuration version 1 already exists with conflicting pack content';
  end if;

  if exists (select 1 from config_configuration_versions ccv where ccv.id = cfg_runtime_01.configuration_version_id and ccv.status <> 'published') then
    insert into config_phase_definitions (configuration_version_id, phase_key, label, sort_order, status, metadata_json)
    values (cfg_runtime_01.configuration_version_id, ${q(phase.key)}, ${q(phase.label)}, ${Number(phase.sortOrder ?? 10)}, 'active', '{"source":"cfg-runtime-01"}'::jsonb)
    on conflict on constraint config_phase_definitions_configuration_version_id_phase_key_key do update set label = excluded.label
    returning id into phase_id;

    insert into config_gate_definitions (configuration_version_id, phase_id, gate_key, label, purpose, sort_order, status, entry_rule_json, exit_rule_json)
    values (cfg_runtime_01.configuration_version_id, cfg_runtime_01.phase_id, ${q(gate.key)}, ${q(gate.label)}, ${q(gate.purpose)}, 10, 'active', '{}'::jsonb, '{"requiresConfiguredEvidence":true,"requiresDecisionOwner":true}'::jsonb)
    on conflict on constraint config_gate_definitions_configuration_version_id_gate_key_key do update set label = excluded.label
    returning id into gate_id;

    insert into config_role_definitions (configuration_version_id, role_key, label, role_family, description, status, eligibility_rule_json)
    values (cfg_runtime_01.configuration_version_id, ${q(role.key)}, ${q(role.label)}, ${q(role.family)}, ${q(role.description)}, 'active', jsonb_build_object('workspaceMembershipRole', ${q(role.key)}))
    on conflict on constraint config_role_definitions_configuration_version_id_role_key_key do update set label = excluded.label
    returning id into role_id;

    insert into config_permission_definitions (configuration_version_id, permission_key, label, permission_scope, status, default_grant_rule_json)
    values (cfg_runtime_01.configuration_version_id, ${q(permission.key)}, ${q(permission.label)}, ${q(permission.scope)}, 'active', '{}'::jsonb)
    on conflict on constraint config_permission_definitions_configuration_version_id_permission_key_key do update set label = excluded.label
    returning id into permission_id;

    insert into config_evidence_type_definitions (configuration_version_id, evidence_type_key, label, status, completion_rule_json, validation_rule_json)
    values (cfg_runtime_01.configuration_version_id, ${q(evidence.key)}, ${q(evidence.label)}, 'active', ${json(evidence.completionRule)}, jsonb_build_object('sourceRelationshipType', ${q(evidence.key)}))
    on conflict on constraint config_evidence_type_definitions_configuration_version_id_evidence_type_key_key do update set label = excluded.label
    returning id into evidence_id;

    insert into config_gate_evidence_requirements (configuration_version_id, gate_id, evidence_type_id, requirement_level, blocking_rule_json, status)
    values (cfg_runtime_01.configuration_version_id, cfg_runtime_01.gate_id, cfg_runtime_01.evidence_id, ${q(requirement.requirementLevel)}, jsonb_build_object('blocks_gate', ${Boolean(requirement.blocking)}, 'condition', 'missing'), 'active')
    on conflict do nothing;

    insert into config_decision_right_definitions (configuration_version_id, decision_right_key, label, role_definition_id, permission_definition_id, gate_definition_id, record_scope_json, approval_rule_json, status)
    values (cfg_runtime_01.configuration_version_id, ${q(right.key)}, ${q(right.label)}, cfg_runtime_01.role_id, cfg_runtime_01.permission_id, cfg_runtime_01.gate_id, ${json(right.recordScope)}, '{"requiresAssignedDecisionOwner":true}'::jsonb, 'active')
    on conflict on constraint config_decision_right_definitions_configuration_version_id_decision_right_key_key do update set label = excluded.label;

    update config_configuration_versions
    set status = 'published',
        effective_from = ${q(effectiveFrom)}::timestamptz,
        published_at = now()
    where id = cfg_runtime_01.configuration_version_id;
  end if;

  update config_tenant_configurations
  set status = 'active',
      active_version_id = cfg_runtime_01.configuration_version_id,
      metadata_json = jsonb_build_object('source','cfg-runtime-01','packHash',${q(packHash)})
  where id = cfg_runtime_01.tenant_configuration_id;

  update config_tenants
  set active_configuration_version_id = cfg_runtime_01.configuration_version_id
  where id = cfg_runtime_01.tenant_id;

  insert into config_configuration_audit_events (
    tenant_id, tenant_configuration_id, configuration_version_id, template_pack_id,
    template_pack_version_id, event_type, event_source, correlation_id, after_json,
    diff_json, reason, metadata_json
  )
  values (
    cfg_runtime_01.tenant_id, cfg_runtime_01.tenant_configuration_id, cfg_runtime_01.configuration_version_id, cfg_runtime_01.template_pack_id,
    cfg_runtime_01.template_pack_version_id, 'activated', 'cfg_runtime_01_loader', '${randomUUID()}'::uuid,
    jsonb_build_object('packKey', ${q(pack.packKey)}, 'packVersion', ${q(pack.version)}, 'packHash', ${q(packHash)}),
    '{"changed_objects":[]}'::jsonb, 'CFG-RUNTIME-01 local compatibility pack activation',
    jsonb_build_object('packSource', ${q(packPath)}, 'packHash', ${q(packHash)})
  );
end;
$$;

select jsonb_build_object(
  'ok', true,
  'workspaceId', ${q(workspaceId)},
  'tenantId', (select id from config_tenants where workspace_id = ${q(workspaceId)}::uuid and status <> 'archived' limit 1),
  'templatePackKey', ${q(pack.packKey)},
  'templatePackVersion', ${q(pack.version)},
  'packHash', ${q(packHash)},
  'configurationVersionId', (
    select active_configuration_version_id from config_tenants where workspace_id = ${q(workspaceId)}::uuid and status <> 'archived' limit 1
  ),
  'provenanceLabel', ${q(`${pack.packName} ${pack.version}`)}
)::text;
`;
}

function q(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function json(value) {
  return `${q(stableJson(value))}::jsonb`;
}
