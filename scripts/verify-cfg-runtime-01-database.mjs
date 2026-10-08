import { ownedGateAdapter } from "./m1/qualification/owned-gate-adapter.mjs";
import { referencePayload, context as evidenceContext, ok as evidenceCommand } from "./m1/p1-cfg-evidence/fixtures.mjs";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { rewriteSupabaseConfigForProject } from "./local-supabase-config-utils.mjs";
import { ensureLoopbackNetwork, removeLoopbackNetwork } from "./local-supabase-loopback-network.mjs";

const repoRoot = process.cwd();
const migrationRoot = join(repoRoot, "supabase", "migrations");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const results = [];
const m1Gate = ownedGateAdapter();

const ids = {
  bdA: "10000000-0000-0000-0000-000000000101",
  opsA: "10000000-0000-0000-0000-000000000102",
  adminA: "10000000-0000-0000-0000-000000000103",
  userB: "10000000-0000-0000-0000-000000000201",
  opsB: "10000000-0000-0000-0000-000000000202",
  bdC: "10000000-0000-0000-0000-000000000301",
  orgA: "20000000-0000-0000-0000-000000000101",
  orgB: "20000000-0000-0000-0000-000000000201",
  orgC: "20000000-0000-0000-0000-000000000301",
  workspaceA: "30000000-0000-0000-0000-000000000101",
  workspaceB: "30000000-0000-0000-0000-000000000201",
  workspaceC: "30000000-0000-0000-0000-000000000301",
  tenantA: "72000000-0000-0000-0000-000000000101",
  tenantB: "72000000-0000-0000-0000-000000000201",
  configA: "74000000-0000-0000-0000-000000000101",
  configB: "74000000-0000-0000-0000-000000000201",
  versionA1: "75000000-0000-0000-0000-000000000101",
  versionA2: "75000000-0000-0000-0000-000000000102",
  versionB1: "75000000-0000-0000-0000-000000000201",
  oppMissing: "60000000-0000-0000-0000-000000000101",
  oppWrongOwner: "60000000-0000-0000-0000-000000000102",
  oppReady: "60000000-0000-0000-0000-000000000103",
  oppTenantB: "60000000-0000-0000-0000-000000000201",
  oppNoConfig: "60000000-0000-0000-0000-000000000301",
};

function record(name, passed, detail = "") {
  results.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}${detail ? ` - ${detail}` : ""}`);
  if (!passed) {
    throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  }
}

function commandInvocation(command, args) {
  if (process.platform === "win32" && command.endsWith(".cmd")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  }
  return { command, args };
}

function run(command, args, options = {}) {
  const invocation = commandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd || repoRoot,
    input: options.input,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 30,
  });
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status ?? "unknown"}\n${result.stdout || ""}\n${result.stderr || ""}`.trim());
  }
  return result;
}

function assertLocalOnlyEnvironment() {
  for (const key of ["SUPABASE_PROJECT_REF", "SUPABASE_ACCESS_TOKEN"]) {
    if (process.env[key]) {
      throw new Error(`${key} is set; refusing disposable database validation in a linked Supabase context.`);
    }
  }
  for (const key of ["DATABASE_URL", "SUPABASE_DB_URL", "POSTGRES_URL"]) {
    if (!process.env[key]) continue;
    const parsed = new URL(process.env[key]);
    if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
      throw new Error(`${key} points to ${parsed.hostname}; refusing remote database validation.`);
    }
  }
}

function assertPrerequisites() {
  const docker = run("docker", ["--version"], { allowFailure: true });
  record("Docker CLI is available", docker.status === 0, (docker.stdout || docker.stderr || "").trim());
  const supabase = run(npxCommand, ["supabase", "--version"], { allowFailure: true });
  record("Supabase CLI is available through npx", supabase.status === 0, (supabase.stdout || supabase.stderr || "").trim());
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function getFreePorts(count) {
  const ports = [];
  for (let index = 0; index < count; index += 1) {
    ports.push(await getFreePort());
  }
  return ports;
}

function copySupabaseProject(projectDir, projectId, ports) {
  mkdirSync(join(projectDir, "supabase", "migrations"), { recursive: true });
  cpSync(join(repoRoot, "supabase", "config.toml"), join(projectDir, "supabase", "config.toml"));
  let config = readFileSync(join(projectDir, "supabase", "config.toml"), "utf8");
  config = rewriteSupabaseConfigForProject(config, projectId, ports);
  writeFileSync(join(projectDir, "supabase", "config.toml"), config);
}

function migrationFiles(range) {
  const files = readdirSync(migrationRoot).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort();
  if (range === "all") return files.filter((name) => Number(name.slice(0, 4)) <= 27);
  if (range === "accepted") return files.filter((name) => Number(name.slice(0, 4)) <= 16);
  if (range === "configuration-runtime") return files.filter((name) => Number(name.slice(0, 4)) >= 17 && Number(name.slice(0, 4)) <= 27);
  throw new Error(`unknown migration range ${range}`);
}

function findDatabaseContainer(projectId) {
  const result = run("docker", ["ps", "--format", "{{.Names}}"]);
  const names = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const exact = `supabase_db_${projectId}`;
  if (names.includes(exact)) return exact;
  const match = names.find((name) => name.includes(projectId) && name.includes("db"));
  if (!match) throw new Error(`No disposable DB container for ${projectId}. Running: ${names.join(", ")}`);
  return match;
}

async function startDisposable(label) {
  if (m1Gate) return m1Gate.begin(`cfg01-${label}`);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const projectId = `rybex-cfg01-${label}-${suffix}`.slice(0, 50);
  const projectDir = join(tmpdir(), `rybex-cfg01-${label}-${suffix}`);
  const [api, db, shadow, studio, inbucket, smtp, pop3, analytics] = await getFreePorts(8);
  const ports = { api, db, shadow, studio, inbucket, smtp, pop3, analytics };
  copySupabaseProject(projectDir, projectId, ports);
  console.log(`Disposable CFG-RUNTIME-01 project: ${projectId}`);
  console.log(`Disposable CFG-RUNTIME-01 workdir: ${projectDir}`);
  console.log(`Disposable CFG-RUNTIME-01 DB: 127.0.0.1:${db}`);
  const exclude = "edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector";
  const networkName = ensureLoopbackNetwork(projectId);
  const start = run(process.execPath, [join(repoRoot, "scripts", "run-supabase-loopback.mjs"), "start", "--workdir", projectDir, "--exclude", exclude, "--network-id", networkName, "--yes"], { allowFailure: true });
  if (start.status !== 0) {
    run(npxCommand, ["supabase", "stop", "--workdir", projectDir, "--project-id", projectId, "--no-backup", "--yes"], { allowFailure: true });
    removeLoopbackNetwork(projectId);
    rmSync(projectDir, { recursive: true, force: true });
    throw new Error(`Disposable Supabase start failed.\n${start.stdout || ""}\n${start.stderr || ""}`.trim());
  }
  return { projectId, projectDir, ports, containerName: findDatabaseContainer(projectId) };
}

function stopDisposable(disposable) {
  if (m1Gate) return m1Gate.end(disposable);
  if (!disposable) return;
  run(npxCommand, ["supabase", "stop", "--workdir", disposable.projectDir, "--project-id", disposable.projectId, "--no-backup", "--yes"], { allowFailure: true });
  removeLoopbackNetwork(disposable.projectId);
  rmSync(disposable.projectDir, { recursive: true, force: true });
}

function psql(containerName, sql, options = {}) {
  return run("docker", ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-X", "-q"], {
    input: sql,
    allowFailure: options.allowFailure,
  });
}

function psqlValue(containerName, sql) {
  return psql(containerName, `\\pset tuples_only on\n\\pset format unaligned\n${sql.trim()}\n`).stdout.trim();
}

function expectSqlFailure(containerName, name, sql, pattern) {
  const result = psql(containerName, sql, { allowFailure: true });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  record(name, result.status !== 0 && pattern.test(output), output.trim());
}

function applyMigrations(containerName, range) {
  if (m1Gate) { const [first, end] = ({all:[1,27],accepted:[1,16],"configuration-runtime":[17,27]})[range] ?? []; return m1Gate.apply(containerName, first, end); }
  for (const fileName of migrationFiles(range)) {
    const sql = readFileSync(join(migrationRoot, fileName), "utf8");
    psql(containerName, `\\echo Applying ${fileName}\n${sql}\n`);
    console.log(`Applied ${fileName}`);
  }
}

function acceptedFixtureSql() {
  return `
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('${ids.bdA}','authenticated','authenticated','bd-a@cfg.test', now(), now(), now()),
  ('${ids.opsA}','authenticated','authenticated','ops-a@cfg.test', now(), now(), now()),
  ('${ids.adminA}','authenticated','authenticated','admin-a@cfg.test', now(), now(), now()),
  ('${ids.userB}','authenticated','authenticated','bd-b@cfg.test', now(), now(), now()),
  ('${ids.opsB}','authenticated','authenticated','ops-b@cfg.test', now(), now(), now()),
  ('${ids.bdC}','authenticated','authenticated','bd-c@cfg.test', now(), now(), now())
on conflict (id) do nothing;

insert into organizations (id, name, slug) values
  ('${ids.orgA}','CFG Org A','cfg-org-a'),
  ('${ids.orgB}','CFG Org B','cfg-org-b'),
  ('${ids.orgC}','CFG Org C','cfg-org-c')
on conflict (id) do nothing;

insert into workspaces (id, organization_id, name, slug) values
  ('${ids.workspaceA}','${ids.orgA}','CFG Workspace A','cfg-workspace-a'),
  ('${ids.workspaceB}','${ids.orgB}','CFG Workspace B','cfg-workspace-b'),
  ('${ids.workspaceC}','${ids.orgC}','CFG Workspace C','cfg-workspace-c')
on conflict (id) do nothing;

insert into user_profiles (id, organization_id, workspace_id, auth_user_id, user_id, email, display_name, default_role, active_workspace_id)
values
  ('40000000-0000-0000-0000-000000000101','${ids.orgA}','${ids.workspaceA}','${ids.bdA}','${ids.bdA}','bd-a@cfg.test','BD A','business_development_lead','${ids.workspaceA}'),
  ('40000000-0000-0000-0000-000000000102','${ids.orgA}','${ids.workspaceA}','${ids.opsA}','${ids.opsA}','ops-a@cfg.test','Ops A','operations_leader','${ids.workspaceA}'),
  ('40000000-0000-0000-0000-000000000103','${ids.orgA}','${ids.workspaceA}','${ids.adminA}','${ids.adminA}','admin-a@cfg.test','Admin A','admin','${ids.workspaceA}'),
  ('40000000-0000-0000-0000-000000000201','${ids.orgB}','${ids.workspaceB}','${ids.userB}','${ids.userB}','bd-b@cfg.test','BD B','business_development_lead','${ids.workspaceB}'),
  ('40000000-0000-0000-0000-000000000202','${ids.orgB}','${ids.workspaceB}','${ids.opsB}','${ids.opsB}','ops-b@cfg.test','Ops B','operations_leader','${ids.workspaceB}'),
  ('40000000-0000-0000-0000-000000000301','${ids.orgC}','${ids.workspaceC}','${ids.bdC}','${ids.bdC}','bd-c@cfg.test','BD C','business_development_lead','${ids.workspaceC}')
on conflict (id) do nothing;

insert into workspace_memberships (id, organization_id, workspace_id, user_profile_id, user_id, role, status)
values
  ('50000000-0000-0000-0000-000000000101','${ids.orgA}','${ids.workspaceA}','40000000-0000-0000-0000-000000000101','${ids.bdA}','business_development_lead','active'),
  ('50000000-0000-0000-0000-000000000102','${ids.orgA}','${ids.workspaceA}','40000000-0000-0000-0000-000000000102','${ids.opsA}','operations_leader','active'),
  ('50000000-0000-0000-0000-000000000103','${ids.orgA}','${ids.workspaceA}','40000000-0000-0000-0000-000000000103','${ids.adminA}','admin','active'),
  ('50000000-0000-0000-0000-000000000201','${ids.orgB}','${ids.workspaceB}','40000000-0000-0000-0000-000000000201','${ids.userB}','business_development_lead','active'),
  ('50000000-0000-0000-0000-000000000202','${ids.orgB}','${ids.workspaceB}','40000000-0000-0000-0000-000000000202','${ids.opsB}','operations_leader','active'),
  ('50000000-0000-0000-0000-000000000301','${ids.orgC}','${ids.workspaceC}','40000000-0000-0000-0000-000000000301','${ids.bdC}','business_development_lead','active')
on conflict (id) do nothing;

insert into opportunities (
  id, organization_id, workspace_id, stable_opportunity_key, name, gc_client, customer_gc,
  project_type, project_location, opportunity_location, scope_summary, estimated_value,
  anticipated_start, bid_due_date, owner_user_id, decision_owner_user_id, decision_due_at,
  lifecycle_status, status, intake_complete, qualification_complete, decision_readiness_status,
  duplicate_fingerprint, duplicate_confirmed
) values
  ('${ids.oppMissing}','${ids.orgA}','${ids.workspaceA}','CFG-MISSING','Missing Evidence','Client A','Client A','Data Center','NC','NC','Scope A',100000,'2026-08-01','2026-07-20','${ids.bdA}','${ids.opsA}','2026-07-18','qualifying','under_review',true,true,'ready_for_decision','cfg-missing',false),
  ('${ids.oppWrongOwner}','${ids.orgA}','${ids.workspaceA}','CFG-WRONG-OWNER','Wrong Owner','Client A','Client A','Data Center','NC','NC','Scope A',100000,'2026-08-01','2026-07-20','${ids.bdA}','${ids.bdA}','2026-07-18','qualifying','under_review',true,true,'ready_for_decision','cfg-wrong-owner',false),
  ('${ids.oppReady}','${ids.orgA}','${ids.workspaceA}','CFG-READY','Ready Opportunity','Client A','Client A','Data Center','NC','NC','Scope A',100000,'2026-08-01','2026-07-20','${ids.bdA}','${ids.opsA}','2026-07-18','qualifying','under_review',true,true,'ready_for_decision','cfg-ready',false),
  ('${ids.oppTenantB}','${ids.orgB}','${ids.workspaceB}','CFG-TENANT-B','Tenant B Opportunity','Client B','Client B','Industrial Service','OH','OH','Scope B',90000,'2026-08-01','2026-07-20','${ids.userB}','${ids.opsB}','2026-07-18','qualifying','under_review',true,true,'ready_for_decision','cfg-tenant-b',false),
  ('${ids.oppNoConfig}','${ids.orgC}','${ids.workspaceC}','CFG-NO-CONFIG','No Config Opportunity','Client C','Client C','Data Center','SC','SC','Scope C',80000,'2026-08-01','2026-07-20','${ids.bdC}',null,null,'qualifying','under_review',true,true,'ready_for_decision','cfg-no-config',false)
on conflict (id) do nothing;

insert into opportunity_qualifications (
  id, workspace_id, opportunity_id, status, strategic_fit, customer_relationship, geography_fit,
  project_type_fit, scope_clarity, design_maturity, commercial_terms_risk, schedule_feasibility,
  crew_capacity_fit, material_lead_time_risk, permits_access_risk, safety_quality_complexity,
  subcontractor_dependency, cash_flow_risk, margin_confidence, contractual_risk, risk_summary,
  assumptions, recommendation, completeness_result, prepared_by, completed_at
) values
  ('63000000-0000-0000-0000-000000000101','${ids.workspaceA}','${ids.oppMissing}','complete','good','known','good','good','clear','mature','low','good','good','low','low','low','low','low','good','low','Complete qualification package for missing evidence scenario.','Assumptions A','pursue','complete','${ids.bdA}',now()),
  ('63000000-0000-0000-0000-000000000102','${ids.workspaceA}','${ids.oppWrongOwner}','complete','good','known','good','good','clear','mature','low','good','good','low','low','low','low','low','good','low','Complete qualification package for wrong owner scenario.','Assumptions A','pursue','complete','${ids.bdA}',now()),
  ('63000000-0000-0000-0000-000000000103','${ids.workspaceA}','${ids.oppReady}','complete','good','known','good','good','clear','mature','low','good','good','low','low','low','low','low','good','low','Complete qualification package for ready scenario.','Assumptions A','pursue','complete','${ids.bdA}',now()),
  ('63000000-0000-0000-0000-000000000201','${ids.workspaceB}','${ids.oppTenantB}','complete','good','known','good','good','clear','mature','low','good','good','low','low','low','low','low','good','low','Complete qualification package for tenant B scenario.','Assumptions B','pursue','complete','${ids.userB}',now()),
  ('63000000-0000-0000-0000-000000000301','${ids.workspaceC}','${ids.oppNoConfig}','complete','good','known','good','good','clear','mature','low','good','good','low','low','low','low','low','good','low','Complete qualification package for no config scenario.','Assumptions C','pursue','complete','${ids.bdC}',now())
on conflict (opportunity_id) do nothing;


`;
}

function configFixtureSql() {
  return `
insert into config_template_packs (id, pack_key, name, domain, status, metadata_json)
values ('70000000-0000-0000-0000-000000000101','rybex-d5o-pipeline-qualification','D5O Pipeline Qualification','data_center_infrastructure','released','{"source":"cfg-runtime-01-test"}'::jsonb);
insert into config_template_pack_versions (id, template_pack_id, semver, status, defaults_json, released_at)
values ('71000000-0000-0000-0000-000000000101','70000000-0000-0000-0000-000000000101','1.0.0','released','{"source":"cfg-runtime-01-test"}'::jsonb, now());
insert into config_tenants (id, tenant_key, name, organization_id, workspace_id, status)
values
  ('${ids.tenantA}','tenant-a','Tenant A','${ids.orgA}','${ids.workspaceA}','active'),
  ('${ids.tenantB}','tenant-b','Tenant B','${ids.orgB}','${ids.workspaceB}','active');
insert into config_tenant_template_activations (id, tenant_id, template_pack_version_id, activation_scope, status, effective_from)
values
  ('73000000-0000-0000-0000-000000000101','${ids.tenantA}','71000000-0000-0000-0000-000000000101','pipeline-qualification','active','2026-01-01T00:00:00Z'),
  ('73000000-0000-0000-0000-000000000201','${ids.tenantB}','71000000-0000-0000-0000-000000000101','pipeline-qualification','active','2026-01-01T00:00:00Z');
insert into config_tenant_configurations (id, tenant_id, activation_id, config_key, name, mode, status)
values
  ('${ids.configA}','${ids.tenantA}','73000000-0000-0000-0000-000000000101','p1-01a-pipeline-qualification','Tenant A P1-01A','startup_no_history','draft'),
  ('${ids.configB}','${ids.tenantB}','73000000-0000-0000-0000-000000000201','p1-01a-pipeline-qualification','Tenant B P1-01A','startup_no_history','draft');
insert into config_configuration_versions (id, tenant_configuration_id, version, status, source_template_pack_version_id, config_manifest_json, diff_json)
values
  ('${ids.versionA1}','${ids.configA}',1,'draft','71000000-0000-0000-0000-000000000101','{"evidence":"qualification_decision_support"}'::jsonb,'{}'::jsonb),
  ('${ids.versionB1}','${ids.configB}',1,'draft','71000000-0000-0000-0000-000000000101','{"evidence":"tenant_b_alternate_support"}'::jsonb,'{}'::jsonb);
${definitionSql(ids.versionA1, "qualification_decision_support", "Qualification decision support", ids.opsA)}
${definitionSql(ids.versionB1, "tenant_b_alternate_support", "Tenant B alternate support", ids.opsB)}
update config_configuration_versions set status = 'published', effective_from = '2026-01-01T00:00:00Z', published_at = now() where id in ('${ids.versionA1}','${ids.versionB1}');
update config_tenant_configurations set status = 'active', active_version_id = '${ids.versionA1}' where id = '${ids.configA}';
update config_tenant_configurations set status = 'active', active_version_id = '${ids.versionB1}' where id = '${ids.configB}';
update config_tenants set active_configuration_version_id = '${ids.versionA1}' where id = '${ids.tenantA}';
update config_tenants set active_configuration_version_id = '${ids.versionB1}' where id = '${ids.tenantB}';
`;
}

function definitionSql(configurationVersionId, evidenceKey, evidenceLabel) {
  const prefix = configurationVersionId.slice(-3);
  return `
insert into config_phase_definitions (id, configuration_version_id, phase_key, label, sort_order, status)
values ('76000000-0000-0000-0000-000000000${prefix}','${configurationVersionId}','pipeline-qualification','Pipeline Qualification',10,'active');
insert into config_gate_definitions (id, configuration_version_id, phase_id, gate_key, label, purpose, sort_order, status, entry_rule_json, exit_rule_json)
values ('77000000-0000-0000-0000-000000000${prefix}','${configurationVersionId}','76000000-0000-0000-0000-000000000${prefix}','pricing-review','Pricing Review','Confirm configured readiness before pricing review.',10,'active','{}'::jsonb,'{"requiresConfiguredEvidence":true}'::jsonb);
insert into config_role_definitions (id, configuration_version_id, role_key, label, role_family, description, status, eligibility_rule_json)
values ('78000000-0000-0000-0000-000000000${prefix}','${configurationVersionId}','operations_leader','Operations Leader','configured','Accountable Pricing Review decision owner.','active','{"workspaceMembershipRole":"operations_leader"}'::jsonb);
insert into config_permission_definitions (id, configuration_version_id, permission_key, label, permission_scope, status, default_grant_rule_json)
values ('79000000-0000-0000-0000-000000000${prefix}','${configurationVersionId}','pricing_review.authorize','Authorize Pricing Review','decision','active','{}'::jsonb);
insert into config_evidence_type_definitions (id, configuration_version_id, evidence_type_key, label, completion_rule_json, validation_rule_json, status)
values ('80000000-0000-0000-0000-000000000${prefix}','${configurationVersionId}','${evidenceKey}','${evidenceLabel}','{"uploadStatus":"uploaded","scanStatus":"clean","verificationStatus":"accepted","checksumRequired":true}'::jsonb,'{"sourceRelationshipType":"${evidenceKey}"}'::jsonb,'active');
insert into config_gate_evidence_requirements (id, configuration_version_id, gate_id, evidence_type_id, requirement_level, blocking_rule_json, status)
values ('81000000-0000-0000-0000-000000000${prefix}','${configurationVersionId}','77000000-0000-0000-0000-000000000${prefix}','80000000-0000-0000-0000-000000000${prefix}','required','{"blocks_gate":true,"condition":"missing"}'::jsonb,'active');
insert into config_decision_right_definitions (id, configuration_version_id, decision_right_key, label, role_definition_id, permission_definition_id, gate_definition_id, record_scope_json, approval_rule_json, status)
values ('82000000-0000-0000-0000-000000000${prefix}','${configurationVersionId}','pricing-review-decision-owner','Pricing Review decision owner','78000000-0000-0000-0000-000000000${prefix}','79000000-0000-0000-0000-000000000${prefix}','77000000-0000-0000-0000-000000000${prefix}','{"record":"opportunity"}'::jsonb,'{"requiresAssignedDecisionOwner":true}'::jsonb,'active');
`;
}

function runCatalogAssertions(containerName) {
  const columns = Number(psqlValue(containerName, `
select count(*) from information_schema.columns
where table_schema = 'public' and table_name = 'opportunities'
  and column_name in ('pricing_review_configuration_version_id','pricing_review_gate_key');
`));
  record("0027 provenance columns exist", columns === 2, `columns=${columns}`);
  const fnCount = Number(psqlValue(containerName, `
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('p1_01a_pricing_review_configuration_v1','p1_01a_pricing_review_readiness_v1','submit_opportunity_for_decision_v1');
`));
  record("0027 server functions exist", fnCount >= 3, `functions=${fnCount}`);
  const seedRows = Number(psqlValue(containerName, "select count(*) from config_template_packs;"));
  record("0026 inserts no seed rows on fresh install", seedRows === 0, `template_packs=${seedRows}`);
}

function authSql(userId, sql) {
  return `
begin;
set local role authenticated;
set local request.jwt.claim.sub = '${userId}';
set local request.jwt.claim.role = 'authenticated';
${sql}
commit;
`;
}

function jsonValue(containerName, userId, sql) {
  return psqlValue(containerName, authSql(userId, sql));
}

export async function runRuntimeAssertions(containerName) {
  const evidence = await evidenceContext();
  if(containerName!=="supabase_db_rybex-cfg03-q-m1-s1-recovery-20260928")throw new Error("cfg01_fixture_boundary");
  for(const [id,email] of [[ids.bdA,"bd-a@cfg.test"],[ids.opsA,"ops-a@cfg.test"],[ids.adminA,"admin-a@cfg.test"],[ids.userB,"bd-b@cfg.test"],[ids.opsB,"ops-b@cfg.test"],[ids.bdC,"bd-c@cfg.test"]]) {
    const made=await evidence.service.auth.admin.createUser({id,email,password:evidence.env.FOUNDATION_0A_TEST_PASSWORD,email_confirm:true});if(made.error)throw made.error;
  }
  psql(containerName, acceptedFixtureSql());
  psql(containerName, configFixtureSql());
  async function validEvidence(opportunityId,email,relationship="qualification_decision_support") {
    const actor=await evidence.login(email);
    const payload=await referencePayload(evidence.service,actor,opportunityId,1,"decision_support",relationship);
    await evidenceCommand(actor,"attach_opportunity_decision_support_evidence_v1",{p_opportunity_id:opportunityId,p_payload:payload,p_expected_version:1,p_command_id:randomUUID(),p_correlation_id:"cfg01-custody"});
  }
  await validEvidence(ids.oppWrongOwner,"bd-a@cfg.test");
  await validEvidence(ids.oppReady,"bd-a@cfg.test");
  await validEvidence(ids.oppTenantB,"bd-b@cfg.test");

  const noConfig = jsonValue(containerName, ids.bdC, `select public.p1_01a_pricing_review_readiness_v1('${ids.oppNoConfig}')::text;`);
  record("no valid tenant configuration fails closed", /"available": false/.test(noConfig) && /no_tenant_mapping/.test(noConfig), noConfig);

  const missing = jsonValue(containerName, ids.bdA, `select public.submit_opportunity_for_decision_v1('${ids.oppMissing}','cfg-runtime-missing-0001',1,'cfg-runtime')::text;`);
  record("missing configured evidence rejects advancement", /"success": false/.test(missing) && /missing_configured_evidence/.test(missing), missing);

  const wrongOwner = jsonValue(containerName, ids.bdA, `select public.submit_opportunity_for_decision_v1('${ids.oppWrongOwner}','cfg-runtime-wrong-owner-0001',1,'cfg-runtime')::text;`);
  record("wrong decision-owner accountability rejects advancement", /"success": false/.test(wrongOwner) && /invalid_decision_owner_accountability/.test(wrongOwner), wrongOwner);

  const forged = jsonValue(containerName, ids.bdA, `select public.submit_opportunity_for_decision_v1('${ids.oppMissing}','cfg-runtime-forged-0001',1,'client-says-ready')::text;`);
  record("server ignores forged client readiness", /"success": false/.test(forged) && /configured_pricing_review_requirements_unmet/.test(forged), forged);

  const success = jsonValue(containerName, ids.bdA, `select public.submit_opportunity_for_decision_v1('${ids.oppReady}','cfg-runtime-ready-0001',1,'cfg-runtime')::text;`);
  record("configured requirements allow successful advancement", /"success": true/.test(success) && /"lifecycle_status": "decision_required"/.test(success), success);

  const provenance = psqlValue(containerName, `
select pricing_review_configuration_version_id::text || '|' || pricing_review_gate_key
from opportunities where id = '${ids.oppReady}';
`);
  record("successful advancement persists configuration provenance", provenance === `${ids.versionA1}|pricing-review`, provenance);

  const auditProvenance = Number(psqlValue(containerName, `
select count(*) from audit_events
where entity_id = '${ids.oppReady}' and action = 'opportunity.submitted_for_decision'
  and after_values->>'configurationVersionId' = '${ids.versionA1}';
`));
  record("audit event includes governing configuration version", auditProvenance >= 1, `audit=${auditProvenance}`);

  const tenantBInitial = jsonValue(containerName, ids.userB, `select public.p1_01a_pricing_review_readiness_v1('${ids.oppTenantB}')::text;`);
  record("Tenant B receives alternate requirement from configuration", /tenant_b_alternate_support/.test(tenantBInitial) && /"ready": false/.test(tenantBInitial), tenantBInitial);

  await validEvidence(ids.oppTenantB,"bd-b@cfg.test","tenant_b_alternate_support");

  const tenantBReady = jsonValue(containerName, ids.userB, `select public.p1_01a_pricing_review_readiness_v1('${ids.oppTenantB}')::text;`);
  record("Tenant B becomes ready only when its configured evidence is satisfied", /"ready": true/.test(tenantBReady) && /tenant_b_alternate_support/.test(tenantBReady), tenantBReady);

  const crossTenant = jsonValue(containerName, ids.bdA, `select public.p1_01a_pricing_review_readiness_v1('${ids.oppTenantB}')::text;`);
  record("Tenant A user cannot resolve Tenant B configuration", /"available": false/.test(crossTenant) && /forbidden/.test(crossTenant), crossTenant);

  psql(containerName, `
update config_configuration_versions set effective_to = '2026-06-01T00:00:00Z' where id = '${ids.versionA1}';
insert into config_configuration_versions (id, tenant_configuration_id, version, status, source_template_pack_version_id, config_manifest_json, diff_json)
values ('${ids.versionA2}','${ids.configA}',2,'draft','71000000-0000-0000-0000-000000000101','{"evidence":"tenant_a_v2_support"}'::jsonb,'{}'::jsonb);
${definitionSql(ids.versionA2, "tenant_a_v2_support", "Tenant A v2 support")}
update config_configuration_versions set status = 'published', effective_from = '2026-06-01T00:00:00Z', published_at = now() where id = '${ids.versionA2}';
update config_tenant_configurations set active_version_id = '${ids.versionA2}' where id = '${ids.configA}';
update config_tenants set active_configuration_version_id = '${ids.versionA2}' where id = '${ids.tenantA}';
`);

  const subsequentBehavior = jsonValue(containerName, ids.bdA, `select public.p1_01a_pricing_review_readiness_v1('${ids.oppMissing}')::text;`);
  record("active version change alters subsequent behavior without code changes", /tenant_a_v2_support/.test(subsequentBehavior), subsequentBehavior);
  const historical = psqlValue(containerName, `select pricing_review_configuration_version_id::text from opportunities where id = '${ids.oppReady}';`);
  record("historical decision retains original configuration version", historical === ids.versionA1, historical);

  const rlsRead = psqlValue(containerName, authSql(ids.adminA, `select count(*) from config_tenant_configurations where tenant_id = '${ids.tenantB}';`));
  record("workspace A admin cannot read workspace B tenant configuration", rlsRead === "0", `count=${rlsRead}`);
  psql(containerName, authSql(ids.adminA, `update config_template_packs set name = 'Bad Global Write' where id = '70000000-0000-0000-0000-000000000101';`));
  const packName = psqlValue(containerName, `select name from config_template_packs where id = '70000000-0000-0000-0000-000000000101';`);
  record("ordinary authenticated admin cannot mutate global template packs", packName === "D5O Pipeline Qualification", packName);
}

function runFreshScenario() {
  return startDisposable("fresh").then((disposable) => {
    try {
      applyMigrations(disposable.containerName, "all");
      runCatalogAssertions(disposable.containerName);
      record("fresh installation 0001-0027 applies successfully", true, disposable.projectId);
      return disposable.projectId;
    } finally {
      stopDisposable(disposable);
    }
  });
}

async function runUpgradeScenario({ historicalSchemaOnly = false } = {}) {
  if (historicalSchemaOnly && !m1Gate) throw new Error("Historical split requires the manifest-owned harness");
  const disposable = await startDisposable("upgrade");
  try {
    applyMigrations(disposable.containerName, "accepted");
    psql(disposable.containerName, acceptedFixtureSql());
    const beforeCounts = psqlValue(disposable.containerName, `
select jsonb_build_object(
  'organizations',(select count(*) from organizations),
  'workspaces',(select count(*) from workspaces),
  'opportunities',(select count(*) from opportunities),
  'qualifications',(select count(*) from opportunity_qualifications)
)::text;
`);
    const beforeHash = createHash("sha256").update(psqlValue(disposable.containerName, `
select string_agg(id::text || ':' || lifecycle_status || ':' || version::text, ',' order by id) from opportunities;
`)).digest("hex");
    applyMigrations(disposable.containerName, "configuration-runtime");
    const afterCounts = psqlValue(disposable.containerName, `
select jsonb_build_object(
  'organizations',(select count(*) from organizations),
  'workspaces',(select count(*) from workspaces),
  'opportunities',(select count(*) from opportunities),
  'qualifications',(select count(*) from opportunity_qualifications)
)::text;
`);
    const afterHash = createHash("sha256").update(psqlValue(disposable.containerName, `
select string_agg(id::text || ':' || lifecycle_status || ':' || version::text, ',' order by id) from opportunities;
`)).digest("hex");
    record("upgrade preserves accepted P1 representative counts", beforeCounts === afterCounts, `${beforeCounts} -> ${afterCounts}`);
    record("upgrade preserves accepted P1 identifying hashes", beforeHash === afterHash, `${beforeHash} -> ${afterHash}`);
    runCatalogAssertions(disposable.containerName);
    // Historical prefix 0027 predates the approved current custody RPCs.
    // Current runtime assertions remain mandatory in their separate qualified phase.
    if (historicalSchemaOnly) {
      record("historical upgrade schema preserved; current-runtime proof remains separately required", true, disposable.projectId);
      return disposable.projectId;
    }
    await runRuntimeAssertions(disposable.containerName);
    record("upgrade installation and CFG-RUNTIME-01 executable proof passed", true, disposable.projectId);
    return disposable.projectId;
  } finally {
    stopDisposable(disposable);
  }
}

if (process.env.P1_CFG01_LIBRARY !== "1") {
try {
  assertLocalOnlyEnvironment();
  assertPrerequisites();
  const cfgTail = migrationFiles("configuration-runtime");
  record("CFG-RUNTIME migration set is exact 0017-0027", cfgTail.length === 11 && cfgTail[0].startsWith("0017_") && cfgTail.at(-1).startsWith("0027_"), cfgTail.join(", "));
  const freshProject = await runFreshScenario();
  const upgradeProject = await runUpgradeScenario();
  record("disposable-only database validation completed", true, `fresh=${freshProject}; upgrade=${upgradeProject}`);
  console.log("CFG-RUNTIME-01 disposable database verification passed.");
} catch (error) {
  console.error("CFG-RUNTIME-01 disposable database verification failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

}
export function referenceResults(){return results;}

export { runFreshScenario, runUpgradeScenario };
