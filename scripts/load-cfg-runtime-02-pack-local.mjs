import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  assertLocalSupabaseUrl,
  defaultRuntime02PackPath,
  readJsonFile,
  sha256,
  stableJson,
  validatePipelineQualificationRuntime02Pack,
} from "./cfg-runtime-01-utils.mjs";
import { ids } from "./foundation-0b-test-utils.mjs";

const workspaceId = process.env.CFG_RUNTIME_02_WORKSPACE_ID || ids.workspaceA;
const tenantKey = process.env.CFG_RUNTIME_02_TENANT_KEY || "rybex-local-pipeline-qualification";
const configKey = process.env.CFG_RUNTIME_02_CONFIG_KEY || "p1-01a-pipeline-qualification";
const activationScope = process.env.CFG_RUNTIME_02_ACTIVATION_SCOPE || "pipeline-qualification";
const packPath = process.env.CFG_RUNTIME_02_PACK_PATH || defaultRuntime02PackPath;
const localDbContainer = process.env.CFG_RUNTIME_02_DB_CONTAINER || "supabase_db_rybex-2-local";

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
}

const pack = readJsonFile(packPath);
validatePipelineQualificationRuntime02Pack(pack);
const packHash = sha256(pack);
const effectiveFrom = new Date(Date.now() - 60_000).toISOString();
const activeVersion = Number(psqlValue(`
select coalesce(ccv.version, 0)
from config_tenants ct
join config_configuration_versions ccv on ccv.id = ct.active_configuration_version_id
where ct.workspace_id = '${workspaceId}'::uuid
  and ct.status <> 'archived'
limit 1;
`) || "0");
if (activeVersion > 2) {
  console.log(JSON.stringify({
    ok: true,
    workspaceId,
    templatePackKey: pack.packKey,
    templatePackVersion: pack.version,
    packHash,
    skippedActivation: true,
    activeConfigurationVersion: activeVersion,
  }));
  process.exit(0);
}
const resultJson = psqlValue(buildSql());
console.log(resultJson);

function psqlValue(sqlText) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", localDbContainer, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A"],
    { input: sqlText, encoding: "utf8", shell: false, maxBuffer: 1024 * 1024 * 20 },
  );
  if (result.status !== 0) {
    throw new Error(`Local CFG-RUNTIME-02 pack load failed.\n${result.stdout || ""}\n${result.stderr || ""}`.trim());
  }
  return result.stdout.trim();
}

function buildSql() {
  const phase = pack.phase;
  const gates = pack.gates;
  const manifest = {
    source: "cfg-runtime-02",
    packKey: pack.packKey,
    packVersion: pack.version,
    packHash,
  };

  return `
do $$
<<cfg_runtime_02>>
declare
  workspace_row workspaces%rowtype;
  template_pack_id uuid;
  template_pack_version_id uuid;
  tenant_id uuid;
  activation_id uuid;
  tenant_configuration_id uuid;
  configuration_version_id uuid;
  base_configuration_version_id uuid;
  phase_id uuid;
  gate_row jsonb;
  gate_id uuid;
  role_row jsonb;
  role_id uuid;
  permission_row jsonb;
  permission_id uuid;
  evidence_row jsonb;
  evidence_id uuid;
  requirement_row jsonb;
  outcome_row jsonb;
  right_row jsonb;
  kpi_row jsonb;
  existing_hash text;
begin
  select * into workspace_row from workspaces where id = '${workspaceId}'::uuid;
  if not found then raise exception 'target workspace % was not found', '${workspaceId}'; end if;

  select ctp.id into template_pack_id from config_template_packs ctp where ctp.pack_key = ${q(pack.packKey)};
  if template_pack_id is null then
    insert into config_template_packs (pack_key, name, domain, owner_type, status, metadata_json)
    values (${q(pack.packKey)}, ${q(pack.packName)}, ${q(pack.domain)}, 'platform', 'released', jsonb_build_object('source','cfg-runtime-02','packHash',${q(packHash)}))
    returning id into template_pack_id;
  end if;

  select ctpv.id, ctpv.defaults_json->>'packHash' into template_pack_version_id, existing_hash
  from config_template_pack_versions ctpv
  where ctpv.template_pack_id = cfg_runtime_02.template_pack_id and ctpv.semver = ${q(pack.version)}
  limit 1;

  if template_pack_version_id is null then
    insert into config_template_pack_versions (template_pack_id, semver, status, defaults_json, compatibility_json, released_at)
    values (cfg_runtime_02.template_pack_id, ${q(pack.version)}, 'released', jsonb_build_object('pack', ${json(pack)}, 'packHash', ${q(packHash)}), '{"status":"compatible","findings":[]}'::jsonb, now())
    returning id into template_pack_version_id;
  elsif existing_hash is distinct from ${q(packHash)} then
    raise exception 'template pack version %@% is immutable and has conflicting content', ${q(pack.packKey)}, ${q(pack.version)};
  end if;

  select ct.id into tenant_id from config_tenants ct where ct.workspace_id = workspace_row.id and ct.status <> 'archived' limit 1;
  if tenant_id is null then
    insert into config_tenants (tenant_key, name, organization_id, workspace_id, status, metadata_json)
    values (${q(tenantKey)}, 'Rybex Local Pipeline Qualification', workspace_row.organization_id, workspace_row.id, 'active', jsonb_build_object('source','cfg-runtime-02'))
    returning id into tenant_id;
  end if;

  update config_tenant_template_activations ctta
  set status = 'superseded', updated_at = now()
  where ctta.tenant_id = cfg_runtime_02.tenant_id and ctta.activation_scope = ${q(activationScope)} and ctta.status = 'active'
    and ctta.template_pack_version_id is distinct from cfg_runtime_02.template_pack_version_id;

  select ctta.id into activation_id
  from config_tenant_template_activations ctta
  where ctta.tenant_id = cfg_runtime_02.tenant_id and ctta.activation_scope = ${q(activationScope)} and ctta.template_pack_version_id = cfg_runtime_02.template_pack_version_id
  limit 1;

  if activation_id is null then
    insert into config_tenant_template_activations (tenant_id, template_pack_version_id, activation_scope, status, effective_from, activated_at, compatibility_json)
    values (cfg_runtime_02.tenant_id, cfg_runtime_02.template_pack_version_id, ${q(activationScope)}, 'active', ${q(effectiveFrom)}::timestamptz, now(), '{"status":"compatible","findings":[]}'::jsonb)
    returning id into activation_id;
  else
    update config_tenant_template_activations ctta set status = 'active', effective_from = ${q(effectiveFrom)}::timestamptz, activated_at = coalesce(ctta.activated_at, now()) where ctta.id = cfg_runtime_02.activation_id;
  end if;

  select ctc.id, ctc.active_version_id into tenant_configuration_id, base_configuration_version_id
  from config_tenant_configurations ctc
  where ctc.tenant_id = cfg_runtime_02.tenant_id and ctc.config_key = ${q(configKey)}
  limit 1;

  if tenant_configuration_id is null then
    insert into config_tenant_configurations (tenant_id, activation_id, config_key, name, mode, status, metadata_json)
    values (cfg_runtime_02.tenant_id, cfg_runtime_02.activation_id, ${q(configKey)}, 'Pipeline Qualification and Pursuit Authorization', ${q(pack.mode)}, 'draft', jsonb_build_object('source','cfg-runtime-02','packHash',${q(packHash)}))
    returning id into tenant_configuration_id;
  else
    update config_tenant_configurations ctc set activation_id = cfg_runtime_02.activation_id where ctc.id = cfg_runtime_02.tenant_configuration_id;
  end if;

  select ccv.id, ccv.config_manifest_json->>'packHash' into configuration_version_id, existing_hash
  from config_configuration_versions ccv
  where ccv.tenant_configuration_id = cfg_runtime_02.tenant_configuration_id and ccv.version = 2
  limit 1;

  if configuration_version_id is null then
    insert into config_configuration_versions (tenant_configuration_id, version, status, base_configuration_version_id, source_template_pack_version_id, config_manifest_json, diff_json)
    values (cfg_runtime_02.tenant_configuration_id, 2, 'draft', cfg_runtime_02.base_configuration_version_id, cfg_runtime_02.template_pack_version_id, ${json(manifest)}, '{"changed_objects":["p1-01b-1-pursuit-authorization"]}'::jsonb)
    returning id into configuration_version_id;
  elsif existing_hash is distinct from ${q(packHash)} then
    raise exception 'configuration version 2 already exists with conflicting pack content';
  end if;

  if exists (select 1 from config_configuration_versions ccv where ccv.id = cfg_runtime_02.configuration_version_id and ccv.status <> 'published') then
    insert into config_phase_definitions (configuration_version_id, phase_key, label, sort_order, status, metadata_json)
    values (cfg_runtime_02.configuration_version_id, ${q(phase.key)}, ${q(phase.label)}, ${Number(phase.sortOrder ?? 10)}, 'active', '{"source":"cfg-runtime-02"}'::jsonb)
    on conflict on constraint config_phase_definitions_configuration_version_id_phase_key_key do update set label = excluded.label
    returning id into phase_id;

    for gate_row in select * from jsonb_array_elements(${json(gates)}) loop
      insert into config_gate_definitions (configuration_version_id, phase_id, gate_key, label, purpose, sort_order, status, entry_rule_json, exit_rule_json)
      values (
        cfg_runtime_02.configuration_version_id,
        cfg_runtime_02.phase_id,
        gate_row->>'key',
        gate_row->>'label',
        gate_row->>'purpose',
        coalesce((gate_row->>'sortOrder')::integer, 10),
        'active',
        jsonb_build_object('entryRequirements', coalesce(gate_row->'entryRequirements', '[]'::jsonb)),
        jsonb_build_object('configuredGate', gate_row - 'key' - 'label' - 'purpose' - 'sortOrder' - 'entryRequirements')
      )
      on conflict on constraint config_gate_definitions_configuration_version_id_gate_key_key do update set label = excluded.label;
    end loop;

    for role_row in select * from jsonb_array_elements(${json(pack.roles)}) loop
      insert into config_role_definitions (configuration_version_id, role_key, label, role_family, description, status, eligibility_rule_json)
      values (cfg_runtime_02.configuration_version_id, role_row->>'key', role_row->>'label', role_row->>'family', role_row->>'description', 'active', jsonb_build_object('workspaceMembershipRole', role_row->>'key'))
      on conflict on constraint config_role_definitions_configuration_version_id_role_key_key do update set label = excluded.label;
    end loop;

    for permission_row in select * from jsonb_array_elements(${json(pack.permissions)}) loop
      insert into config_permission_definitions (configuration_version_id, permission_key, label, permission_scope, status, default_grant_rule_json)
      values (cfg_runtime_02.configuration_version_id, permission_row->>'key', permission_row->>'label', permission_row->>'scope', 'active', '{}'::jsonb)
      on conflict on constraint config_permission_definitions_configuration_version_id_permission_key_key do update set label = excluded.label;
    end loop;

    for evidence_row in select * from jsonb_array_elements(${json(pack.evidenceTypes)}) loop
      insert into config_evidence_type_definitions (configuration_version_id, evidence_type_key, label, status, completion_rule_json, validation_rule_json)
      values (cfg_runtime_02.configuration_version_id, evidence_row->>'key', evidence_row->>'label', 'active', evidence_row->'completionRule', jsonb_build_object('sourceRelationshipType', evidence_row->>'key'))
      on conflict on constraint config_evidence_type_definitions_configuration_version_id_evidence_type_key_key do update set label = excluded.label;
    end loop;

    for requirement_row in select * from jsonb_array_elements(${json(pack.gateEvidenceRequirements)}) loop
      select cgd.id into gate_id from config_gate_definitions cgd where cgd.configuration_version_id = cfg_runtime_02.configuration_version_id and cgd.gate_key = requirement_row->>'gateKey';
      select cetd.id into evidence_id from config_evidence_type_definitions cetd where cetd.configuration_version_id = cfg_runtime_02.configuration_version_id and cetd.evidence_type_key = requirement_row->>'evidenceTypeKey';
      if not exists (select 1 from config_gate_evidence_requirements cger where cger.configuration_version_id = cfg_runtime_02.configuration_version_id and cger.gate_id = cfg_runtime_02.gate_id and cger.evidence_type_id = cfg_runtime_02.evidence_id) then
        insert into config_gate_evidence_requirements (configuration_version_id, gate_id, evidence_type_id, requirement_level, blocking_rule_json, status)
        values (cfg_runtime_02.configuration_version_id, cfg_runtime_02.gate_id, cfg_runtime_02.evidence_id, requirement_row->>'requirementLevel', jsonb_build_object('blocks_gate', coalesce((requirement_row->>'blocking')::boolean, true), 'condition', 'missing'), 'active');
      end if;
    end loop;

    for kpi_row in select * from jsonb_array_elements(${json(pack.kpis)}) loop
      insert into config_kpi_definitions (configuration_version_id, kpi_key, label, formula_json, trend_direction, status)
      values (cfg_runtime_02.configuration_version_id, kpi_row->>'key', kpi_row->>'label', kpi_row->'formula', kpi_row->>'trendDirection', 'active')
      on conflict on constraint config_kpi_definitions_configuration_version_id_kpi_key_key do update set label = excluded.label;
    end loop;

    for outcome_row in select * from jsonb_array_elements(${json(pack.decisionOutcomes)}) loop
      select cgd.id into gate_id from config_gate_definitions cgd where cgd.configuration_version_id = cfg_runtime_02.configuration_version_id and cgd.gate_key = outcome_row->>'gateKey';
      insert into config_gate_decision_outcomes (configuration_version_id, gate_id, outcome_key, label, outcome_type, consequence_json, status)
      values (cfg_runtime_02.configuration_version_id, cfg_runtime_02.gate_id, outcome_row->>'outcomeKey', outcome_row->>'label', outcome_row->>'outcomeType', outcome_row - 'gateKey' - 'outcomeKey' - 'label' - 'outcomeType', 'active')
      on conflict on constraint config_gate_decision_outcomes_gate_id_outcome_key_key do update set label = excluded.label;
    end loop;

    for right_row in select * from jsonb_array_elements(${json(pack.decisionRights)}) loop
      select cgd.id into gate_id from config_gate_definitions cgd where cgd.configuration_version_id = cfg_runtime_02.configuration_version_id and cgd.gate_key = right_row->>'gateKey';
      select crd.id into role_id from config_role_definitions crd where crd.configuration_version_id = cfg_runtime_02.configuration_version_id and crd.role_key = right_row->>'roleKey';
      select cpd.id into permission_id from config_permission_definitions cpd where cpd.configuration_version_id = cfg_runtime_02.configuration_version_id and cpd.permission_key = right_row->>'permissionKey';
      insert into config_decision_right_definitions (configuration_version_id, decision_right_key, label, role_definition_id, permission_definition_id, gate_definition_id, record_scope_json, approval_rule_json, status)
      values (cfg_runtime_02.configuration_version_id, right_row->>'key', right_row->>'label', cfg_runtime_02.role_id, cfg_runtime_02.permission_id, cfg_runtime_02.gate_id, right_row->'recordScope', '{"requiresAssignedDecisionOwner":true}'::jsonb, 'active')
      on conflict on constraint config_decision_right_definitions_configuration_version_id_decision_right_key_key do update set label = excluded.label;
    end loop;

    update config_configuration_versions ccv
    set status = 'superseded',
        effective_to = ${q(effectiveFrom)}::timestamptz
    where ccv.tenant_configuration_id = cfg_runtime_02.tenant_configuration_id
      and ccv.id <> cfg_runtime_02.configuration_version_id
      and ccv.status = 'published'
      and (ccv.effective_to is null or ccv.effective_to > ${q(effectiveFrom)}::timestamptz);

    update config_configuration_versions
    set status = 'published', effective_from = ${q(effectiveFrom)}::timestamptz, published_at = now()
    where id = cfg_runtime_02.configuration_version_id;
  end if;

  update config_tenant_configurations
  set status = 'active', active_version_id = cfg_runtime_02.configuration_version_id, metadata_json = jsonb_build_object('source','cfg-runtime-02','packHash',${q(packHash)})
  where id = cfg_runtime_02.tenant_configuration_id;

  update config_tenants
  set active_configuration_version_id = cfg_runtime_02.configuration_version_id
  where id = cfg_runtime_02.tenant_id;

  insert into config_configuration_audit_events (
    tenant_id, tenant_configuration_id, configuration_version_id, template_pack_id,
    template_pack_version_id, event_type, event_source, correlation_id, after_json,
    diff_json, reason, metadata_json
  )
  values (
    cfg_runtime_02.tenant_id, cfg_runtime_02.tenant_configuration_id, cfg_runtime_02.configuration_version_id, cfg_runtime_02.template_pack_id,
    cfg_runtime_02.template_pack_version_id, 'activated', 'cfg_runtime_02_loader', '${randomUUID()}'::uuid,
    jsonb_build_object('packKey', ${q(pack.packKey)}, 'packVersion', ${q(pack.version)}, 'packHash', ${q(packHash)}),
    '{"changed_objects":["p1-01b-1-pursuit-authorization"]}'::jsonb, 'CFG-RUNTIME-02 local compatibility pack activation',
    jsonb_build_object('packSource', ${q(packPath)}, 'packHash', ${q(packHash)})
  );
end;
$$;

select jsonb_build_object(
  'ok', true,
  'workspaceId', ${q(workspaceId)},
  'tenantId', (select ct.id from config_tenants ct where ct.workspace_id = ${q(workspaceId)}::uuid and ct.status <> 'archived' limit 1),
  'templatePackKey', ${q(pack.packKey)},
  'templatePackVersion', ${q(pack.version)},
  'packHash', ${q(packHash)},
  'configurationVersionId', (select ct.active_configuration_version_id from config_tenants ct where ct.workspace_id = ${q(workspaceId)}::uuid and ct.status <> 'archived' limit 1),
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
