import { ownedGateAdapter } from "./m1/qualification/owned-gate-adapter.mjs";
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
const concurrentPsqlTimeoutMs = 15_000;

const expectedConfigMigrations = [
  "0017_configuration_foundation_core.sql",
  "0018_configuration_template_packs_versions.sql",
  "0019_configuration_tenant_activation_versions.sql",
  "0020_configuration_phase_gate_definitions.sql",
  "0021_configuration_work_types_streams_lanes.sql",
  "0022_configuration_roles_permissions_decision_rights.sql",
  "0023_configuration_artifact_evidence_definitions.sql",
  "0024_configuration_kpi_financial_workforce_handoff_governance.sql",
  "0025_configuration_audit_effective_resolution.sql",
  "0026_configuration_template_pack_seed_data.sql",
];

const expectedConfigTables = [
  "config_tenants",
  "config_organizations",
  "config_operating_entities",
  "config_template_packs",
  "config_template_pack_versions",
  "config_tenant_template_activations",
  "config_tenant_configurations",
  "config_configuration_versions",
  "config_phase_definitions",
  "config_gate_definitions",
  "config_gate_questions",
  "config_gate_evidence_requirements",
  "config_gate_decision_outcomes",
  "config_work_item_type_definitions",
  "config_work_class_definitions",
  "config_workstreams",
  "config_service_lanes",
  "config_role_definitions",
  "config_permission_definitions",
  "config_decision_right_definitions",
  "config_artifact_type_definitions",
  "config_evidence_type_definitions",
  "config_kpi_definitions",
  "config_financial_model_definitions",
  "config_workforce_qualification_rules",
  "config_handoff_definitions",
  "config_governance_forum_definitions",
  "config_exception_rules",
  "config_workforce_gate_dependency_links",
  "config_handoff_required_evidence_links",
  "config_governance_forum_participant_role_links",
  "config_governance_forum_kpi_links",
  "config_exception_approval_role_links",
  "config_configuration_audit_events",
];

const results = [];
const m1Gate = ownedGateAdapter();
if (process.env.M1_GATE_LIBRARY === "1" && !m1Gate) throw new Error("Owned library entry requires explicit M1 gate mode and manifest");

function record(name, passed, detail = "") {
  results.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}${detail ? ` - ${detail}` : ""}`);
  if (!passed) {
    throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  }
}

function run(command, args, options = {}) {
  const invocation = commandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd || repoRoot,
    input: options.input,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 20,
  });

  if (options.allowFailure) {
    return result;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status ?? "unknown"}\n${result.stdout || ""}\n${result.stderr || ""}`.trim(),
    );
  }

  return result;
}

function commandInvocation(command, args) {
  if (process.platform === "win32" && command.endsWith(".cmd")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  }
  return { command, args };
}

function assertLocalOnlyEnvironment() {
  for (const key of ["SUPABASE_PROJECT_REF", "SUPABASE_ACCESS_TOKEN"]) {
    if (process.env[key]) {
      throw new Error(`${key} is set; refusing to run disposable database validation in a potentially linked Supabase context.`);
    }
  }

  for (const key of ["DATABASE_URL", "SUPABASE_DB_URL", "POSTGRES_URL"]) {
    const value = process.env[key];
    if (!value) {
      continue;
    }
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`${key} is set but is not a URL; refusing database validation.`);
    }
    if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
      throw new Error(`${key} points to ${parsed.hostname}; refusing remote database validation.`);
    }
  }
}

function assertPrerequisites() {
  const docker = run("docker", ["--version"], { allowFailure: true });
  record("Docker CLI is available", docker.status === 0, (docker.stdout || docker.stderr || "").trim());
  const supabase = run(npxCommand, ["supabase", "--version"], { allowFailure: true });
  record(
    "Supabase CLI is available through npx",
    supabase.status === 0,
    (supabase.stdout || supabase.stderr || supabase.error?.message || `status=${supabase.status}`).trim(),
  );
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
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(join(projectDir, "supabase"), { recursive: true });
  cpSync(join(repoRoot, "supabase", "config.toml"), join(projectDir, "supabase", "config.toml"));
  mkdirSync(join(projectDir, "supabase", "migrations"), { recursive: true });

  let config = readFileSync(join(projectDir, "supabase", "config.toml"), "utf8");
  config = rewriteSupabaseConfigForProject(config, projectId, ports);
  writeFileSync(join(projectDir, "supabase", "config.toml"), config);
}

function sortedMigrationFiles(range) {
  const files = readdirSync(migrationRoot)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .sort();

  if (range === "all") {
    return files.filter((name) => Number(name.slice(0, 4)) <= 26);
  }
  if (range === "accepted") {
    return files.filter((name) => Number(name.slice(0, 4)) <= 16);
  }
  if (range === "configuration") {
    return files.filter((name) => Number(name.slice(0, 4)) >= 17 && Number(name.slice(0, 4)) <= 26);
  }
  throw new Error(`Unknown migration range: ${range}`);
}

function dockerContainerNames() {
  const result = run("docker", ["ps", "--format", "{{.Names}}"]);
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function findDatabaseContainer(projectId) {
  const names = dockerContainerNames();
  const exact = `supabase_db_${projectId}`;
  if (names.includes(exact)) {
    return exact;
  }
  const match = names.find((name) => name.includes(projectId) && name.includes("db"));
  if (!match) {
    throw new Error(`Unable to find disposable database container for ${projectId}. Running containers: ${names.join(", ")}`);
  }
  return match;
}

function psql(containerName, sql, options = {}) {
  const result = run(
    "docker",
    ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-X", "-q"],
    { input: sql, allowFailure: options.allowFailure },
  );
  return result;
}

function psqlValue(containerName, sql) {
  const result = psql(containerName, `\\pset tuples_only on\n\\pset format unaligned\n${sql.trim()}\n`);
  return result.stdout.trim();
}

function applyMigrations(containerName, projectDir, range) {
  if (m1Gate) { const [first, end] = ({all:[1,26],accepted:[1,16],configuration:[17,26]})[range] ?? []; return m1Gate.apply(containerName, first, end); }
  for (const fileName of sortedMigrationFiles(range)) {
    const filePath = join(migrationRoot, fileName);
    const sql = readFileSync(filePath, "utf8");
    psql(containerName, `\\echo Applying ${fileName}\n${sql}\n`);
    console.log(`Applied ${fileName}`);
  }
}

async function startDisposableSupabase(label) {
  if (m1Gate) return m1Gate.begin(`foundation-${label}`);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const projectId = `rybex-cf-${label}-${suffix}`.slice(0, 50);
  const projectDir = join(tmpdir(), `rybex-cf-${label}-${suffix}`);
  const [api, db, shadow, studio, inbucket, smtp, pop3, analytics] = await getFreePorts(8);
  const ports = { api, db, shadow, studio, inbucket, smtp, pop3, analytics };
  copySupabaseProject(projectDir, projectId, ports);

  console.log(`Disposable Supabase project: ${projectId}`);
  console.log(`Disposable Supabase workdir: ${projectDir}`);
  console.log(`Disposable local DB port: 127.0.0.1:${db}`);

  const exclude = "edge-runtime,gotrue,imgproxy,kong,logflare,mailpit,postgres-meta,postgrest,realtime,storage-api,studio,supavisor,vector";
  const networkName = ensureLoopbackNetwork(projectId);
  const start = run(process.execPath, [join(repoRoot, "scripts", "run-supabase-loopback.mjs"), "start", "--workdir", projectDir, "--exclude", exclude, "--network-id", networkName, "--yes"], {
    allowFailure: true,
  });
  if (start.status !== 0) {
    run(npxCommand, ["supabase", "stop", "--workdir", projectDir, "--project-id", projectId, "--no-backup", "--yes"], {
      allowFailure: true,
    });
    removeLoopbackNetwork(projectId);
    rmSync(projectDir, { recursive: true, force: true });
    throw new Error(`Disposable Supabase start failed.\n${start.stdout || ""}\n${start.stderr || ""}`.trim());
  }

  const containerName = findDatabaseContainer(projectId);
  return { projectId, projectDir, ports, containerName };
}

function stopDisposableSupabase(disposable) {
  if (m1Gate) return m1Gate.end(disposable);
  if (!disposable) {
    return;
  }
  run(npxCommand, ["supabase", "stop", "--workdir", disposable.projectDir, "--project-id", disposable.projectId, "--no-backup", "--yes"], {
    allowFailure: true,
  });
  removeLoopbackNetwork(disposable.projectId);
  rmSync(disposable.projectDir, { recursive: true, force: true });
}

function expectSqlSuccess(containerName, name, sql) {
  const result = psql(containerName, sql, { allowFailure: true });
  record(name, result.status === 0, (result.stderr || result.stdout).trim());
  return result;
}

function expectSqlFailure(containerName, name, sql, expectedPattern) {
  const result = psql(containerName, sql, { allowFailure: true });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const failedAsExpected = result.status !== 0 && expectedPattern.test(output);
  record(name, failedAsExpected, output.trim());
  return result;
}

function hashQuery(containerName, sql) {
  const value = psqlValue(containerName, sql);
  return createHash("sha256").update(value).digest("hex");
}

function fixtureSql() {
  return `
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001','authenticated','authenticated','admin-a@example.test', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000002','authenticated','authenticated','member-a@example.test', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000003','authenticated','authenticated','admin-b@example.test', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000004','authenticated','authenticated','member-b@example.test', now(), now(), now())
on conflict (id) do nothing;

insert into organizations (id, name, slug)
values
  ('20000000-0000-0000-0000-000000000001','Org A','org-a'),
  ('20000000-0000-0000-0000-000000000002','Org B','org-b')
on conflict (id) do nothing;

insert into workspaces (id, organization_id, name, slug)
values
  ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Workspace A','workspace-a'),
  ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Workspace B','workspace-b')
on conflict (id) do nothing;

insert into user_profiles (id, organization_id, workspace_id, auth_user_id, user_id, email, display_name, default_role, active_workspace_id)
values
  ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','admin-a@example.test','Admin A','admin','30000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','member-a@example.test','Member A','project_manager','30000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','admin-b@example.test','Admin B','admin','30000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','member-b@example.test','Member B','project_manager','30000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

insert into workspace_memberships (id, organization_id, workspace_id, user_profile_id, user_id, role, status)
values
  ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','admin','active'),
  ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','project_manager','active'),
  ('50000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','admin','active'),
  ('50000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004','project_manager','active')
on conflict (id) do nothing;

insert into opportunities (
  id, organization_id, workspace_id, name, gc_client, stable_opportunity_key,
  lifecycle_status, decision_readiness_status, owner_user_id, decision_owner_user_id,
  pursuit_authorization_status, bid_submission_status, estimated_value, bid_due_date
) values
  ('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Data Center Intake A','Client A','OPP-A','decision_required','decision_approved','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','approved','submitted_pending_outcome',1200000,'2027-01-31'),
  ('60000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Data Center Intake B','Client B','OPP-B','decision_required','decision_approved','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000003','approved','submitted_pending_outcome',900000,'2027-02-28')
on conflict (id) do nothing;

insert into opportunity_pursuit_authorization_events (
  id, workspace_id, opportunity_id, event_type, decision_action, from_status, to_status, actor_user_id, package_version, command_id
) values
  ('61000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','opportunity.pursuit_authorization_recorded','approve_pursuit','ready_for_authorization','approved','10000000-0000-0000-0000-000000000001',1,'fixture-pursuit-a')
on conflict do nothing;

insert into opportunity_bid_submission_events (
  id, workspace_id, opportunity_id, event_type, bid_action, from_status, to_status, actor_user_id, package_version, command_id
) values
  ('62000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','opportunity.bid_submission_action_recorded','record_submission','submission_approved_ready_to_send','submitted_pending_outcome','10000000-0000-0000-0000-000000000001',1,'fixture-bid-a')
on conflict do nothing;
`;
}

function seedConfigurationBase(containerName) {
  psql(containerName, `
insert into config_template_packs (id, pack_key, name, domain, status, metadata_json)
values ('70000000-0000-0000-0000-000000000001','generic-d5o','Generic D5O','enterprise','released','{}'::jsonb);

insert into config_template_pack_versions (id, template_pack_id, semver, status, defaults_json)
values ('71000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','0.1.0','released','{}'::jsonb);

insert into config_tenants (id, tenant_key, name, organization_id, workspace_id)
values
 ('72000000-0000-0000-0000-000000000001','tenant-a','Tenant A','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
 ('72000000-0000-0000-0000-000000000002','tenant-b','Tenant B','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002');

insert into config_tenant_template_activations (id, tenant_id, template_pack_version_id, activation_scope, status, effective_from)
values
 ('73000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','tenant','active','2027-01-01T00:00:00Z'),
 ('73000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000001','tenant','active','2027-01-01T00:00:00Z');

insert into config_tenant_configurations (id, tenant_id, activation_id, config_key, name, status)
values
 ('74000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','default','Tenant A Default','draft'),
 ('74000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000002','default','Tenant B Default','draft');

insert into config_configuration_versions (id, tenant_configuration_id, version, status, effective_from, effective_to)
values
 ('75000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001',1,'draft',null,null),
 ('75000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000002',1,'draft',null,null),
 ('75000000-0000-0000-0000-000000000011','74000000-0000-0000-0000-000000000001',2,'published','2027-01-01T00:00:00Z','2027-02-01T00:00:00Z'),
 ('75000000-0000-0000-0000-000000000012','74000000-0000-0000-0000-000000000001',3,'published','2027-02-01T00:00:00Z','2027-03-01T00:00:00Z');

update config_tenant_configurations
set active_version_id = '75000000-0000-0000-0000-000000000011'
where id = '74000000-0000-0000-0000-000000000001';

update config_tenants
set active_configuration_version_id = '75000000-0000-0000-0000-000000000011'
where id = '72000000-0000-0000-0000-000000000001';
`);
}

function runCatalogAssertions(containerName) {
  const tableCount = Number(psqlValue(containerName, `
select count(*)
from information_schema.tables
where table_schema = 'public'
  and table_name = any(array[${expectedConfigTables.map((table) => `'${table}'`).join(",")}]);
`));
  record("catalog contains every Configuration Foundation table", tableCount === expectedConfigTables.length, `${tableCount}/${expectedConfigTables.length}`);

  const rlsCount = Number(psqlValue(containerName, `
select count(*)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = any(array[${expectedConfigTables.map((table) => `'${table}'`).join(",")}])
  and c.relrowsecurity;
`));
  record("RLS is enabled on every Configuration Foundation table", rlsCount === expectedConfigTables.length, `${rlsCount}/${expectedConfigTables.length}`);

  const missingPolicyCount = Number(psqlValue(containerName, `
select count(*)
from unnest(array[${expectedConfigTables.map((table) => `'${table}'`).join(",")}]) as expected(table_name)
where not exists (
  select 1 from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = expected.table_name
);
`));
  record("Configuration Foundation tables have RLS policies", missingPolicyCount === 0, `${missingPolicyCount} without policy`);

  const invalidFkCount = Number(psqlValue(containerName, `
select count(*)
from pg_constraint
where contype = 'f'
  and connamespace = 'public'::regnamespace
  and not convalidated;
`));
  record("foreign keys are valid in PostgreSQL catalogs", invalidFkCount === 0, `${invalidFkCount} invalid`);

  const seedRows = Number(psqlValue(containerName, `
select count(*) from config_template_packs;
`));
  record("0026 inserted no seed records", seedRows === 0, `${seedRows} template-pack rows before test fixtures`);
}

function runRlsAttacks(containerName) {
  seedConfigurationBase(containerName);

  expectSqlSuccess(containerName, "workspace A admin can read own tenant", `
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.role = 'authenticated';
select * from config_tenant_configurations where tenant_id = '72000000-0000-0000-0000-000000000001';
commit;
`);

  const crossTenantCount = psqlValue(containerName, `
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.role = 'authenticated';
select count(*) from config_tenant_configurations where tenant_id = '72000000-0000-0000-0000-000000000002';
commit;
`);
  record("workspace A admin cannot read workspace B tenant configuration", crossTenantCount === "0", `count=${crossTenantCount}`);

  expectSqlSuccess(containerName, "workspace A admin cross-tenant update statement is safely no-op", `
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.role = 'authenticated';
update config_tenant_configurations set name = 'Cross Tenant Write' where id = '74000000-0000-0000-0000-000000000002';
commit;
`);
  const tenantBName = psqlValue(containerName, `
select name from config_tenant_configurations where id = '74000000-0000-0000-0000-000000000002';
`);
  record("workspace A admin cannot mutate workspace B tenant configuration", tenantBName === "Tenant B Default", `name=${tenantBName}`);

  expectSqlFailure(containerName, "ordinary authenticated user cannot mutate global template packs", `
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
set local request.jwt.claim.role = 'authenticated';
insert into config_template_packs (pack_key, name, domain, status)
values ('forbidden-pack','Forbidden','enterprise','draft');
commit;
`, /violates row-level security|permission denied/i);

  expectSqlFailure(containerName, "tenant activation co-tenancy rejects cross-tenant activation reference", `
insert into config_tenant_configurations (tenant_id, activation_id, config_key, name)
values ('72000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000002','bad-cross-activation','Bad Cross Activation');
`, /foreign key|violates/i);

  expectSqlFailure(containerName, "configuration-version ownership reassignment is rejected", `
update config_configuration_versions
set tenant_configuration_id = '74000000-0000-0000-0000-000000000002'
where id = '75000000-0000-0000-0000-000000000001';
`, /cannot change tenant_configuration_id|configuration versions cannot/i);

  expectSqlFailure(containerName, "corrected update policy rejects cross-tenant target", `
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.role = 'authenticated';
update config_configuration_versions
set tenant_configuration_id = '74000000-0000-0000-0000-000000000002'
where id = '75000000-0000-0000-0000-000000000001';
commit;
`, /row-level security|cannot change tenant_configuration_id|permission denied/i);

  expectSqlSuccess(containerName, "service-role claim can create global template-pack metadata", `
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.role = 'service_role';
insert into config_template_packs (pack_key, name, domain, status)
values ('service-created-pack','Service Created','enterprise','draft');
rollback;
`);

  const unsafeFunctions = Number(psqlValue(containerName, `
select count(*)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'config_%'
  and p.prosecdef
  and not exists (
    select 1
    from unnest(coalesce(p.proconfig, array[]::text[])) as setting(value)
    where setting.value like 'search_path=public,%'
       or setting.value = 'search_path=public'
  );
`));
  record("SECURITY DEFINER config functions use fixed safe search_path", unsafeFunctions === 0, `${unsafeFunctions} unsafe`);
}

function runSameVersionTests(containerName) {
  psql(containerName, `
insert into config_phase_definitions (id, configuration_version_id, phase_key, label)
values ('76000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','phase-a','Phase A');
insert into config_gate_definitions (id, configuration_version_id, phase_id, gate_key, label, purpose)
values ('77000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000001','gate-a','Gate A','Test gate');
insert into config_role_definitions (id, configuration_version_id, role_key, label)
values ('78000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','role-a','Role A');
insert into config_artifact_type_definitions (id, configuration_version_id, artifact_type_key, label, phase_definition_id, owner_role_key)
values ('79000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','artifact-a','Artifact A','76000000-0000-0000-0000-000000000001','role-a');
insert into config_evidence_type_definitions (id, configuration_version_id, evidence_type_key, label, artifact_type_definition_id, owner_role_key)
values ('7a000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','evidence-a','Evidence A','79000000-0000-0000-0000-000000000001','role-a');
insert into config_work_class_definitions (id, configuration_version_id, work_class_key, label)
values ('7b000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','class-a','Class A');
`);

  expectSqlSuccess(containerName, "valid same-version scalar and link references succeed", `
insert into config_gate_decision_outcomes (id, configuration_version_id, gate_id, outcome_key, label, outcome_type, target_gate_key)
values ('7c000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000001','approve','Approve','approve','gate-a');
insert into config_gate_evidence_requirements (id, configuration_version_id, gate_id, evidence_type_id, applies_to_class_key)
values ('7d000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000001','7a000000-0000-0000-0000-000000000001','class-a');
insert into config_handoff_definitions (id, configuration_version_id, handoff_key, label, sending_role_key, receiving_role_key)
values ('7e000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','handoff-a','Handoff A','role-a','role-a');
insert into config_handoff_required_evidence_links (configuration_version_id, handoff_definition_id, evidence_type_key)
values ('75000000-0000-0000-0000-000000000001','7e000000-0000-0000-0000-000000000001','evidence-a');
`);

  expectSqlFailure(containerName, "cross-version scalar reference fails", `
insert into config_phase_definitions (id, configuration_version_id, phase_key, label)
values ('76000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000002','phase-b','Phase B');
insert into config_gate_definitions (id, configuration_version_id, phase_id, gate_key, label, purpose)
values ('77000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000002','bad-cross-version','Bad','Bad');
`, /foreign key|violates/i);

  expectSqlFailure(containerName, "cross-version normalized link reference fails", `
insert into config_phase_definitions (id, configuration_version_id, phase_key, label)
values ('76000000-0000-0000-0000-000000000003','75000000-0000-0000-0000-000000000002','phase-c','Phase C');
insert into config_role_definitions (id, configuration_version_id, role_key, label)
values ('78000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000002','role-b','Role B');
insert into config_artifact_type_definitions (id, configuration_version_id, artifact_type_key, label, phase_definition_id, owner_role_key)
values ('79000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000002','artifact-b','Artifact B','76000000-0000-0000-0000-000000000003','role-b');
insert into config_evidence_type_definitions (id, configuration_version_id, evidence_type_key, label, artifact_type_definition_id, owner_role_key)
values ('7a000000-0000-0000-0000-000000000002','75000000-0000-0000-0000-000000000002','evidence-b','Evidence B','79000000-0000-0000-0000-000000000002','role-b');
insert into config_handoff_required_evidence_links (configuration_version_id, handoff_definition_id, evidence_type_key)
values ('75000000-0000-0000-0000-000000000002','7e000000-0000-0000-0000-000000000001','evidence-b');
`, /foreign key|violates/i);

  expectSqlFailure(containerName, "partial invalid executable key fails", `
insert into config_gate_decision_outcomes (configuration_version_id, gate_id, outcome_key, label, outcome_type, target_gate_key)
values ('75000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000001','bad-target','Bad Target','recycle','missing-gate');
`, /foreign key|violates/i);

  expectSqlSuccess(containerName, "descriptive JSON remains non-authoritative metadata", `
insert into config_kpi_definitions (configuration_version_id, kpi_key, label, formula_json, data_source_json)
values ('75000000-0000-0000-0000-000000000001','json-descriptive','JSON Descriptive','{"notes":"non-authoritative"}'::jsonb,'{"source":"non-authoritative"}'::jsonb);
`);
}

function runLifecycleTests(containerName) {
  expectSqlSuccess(containerName, "touching half-open intervals succeed", `
insert into config_configuration_versions (tenant_configuration_id, version, status, effective_from, effective_to)
values ('74000000-0000-0000-0000-000000000002',2,'published','2027-01-01T00:00:00Z','2027-02-01T00:00:00Z');
insert into config_configuration_versions (tenant_configuration_id, version, status, effective_from, effective_to)
values ('74000000-0000-0000-0000-000000000002',3,'published','2027-02-01T00:00:00Z','2027-03-01T00:00:00Z');
`);

  expectSqlFailure(containerName, "overlapping effective intervals fail", `
insert into config_configuration_versions (tenant_configuration_id, version, status, effective_from, effective_to)
values ('74000000-0000-0000-0000-000000000002',4,'published','2027-01-15T00:00:00Z','2027-02-15T00:00:00Z');
`, /effective intervals|overlap/i);

  expectSqlFailure(containerName, "open-ended overlap fails", `
insert into config_configuration_versions (tenant_configuration_id, version, status, effective_from, effective_to)
values ('74000000-0000-0000-0000-000000000002',5,'published','2027-02-15T00:00:00Z',null);
`, /effective intervals|overlap/i);

  expectSqlSuccess(containerName, "future-dated publication succeeds when non-overlapping", `
insert into config_configuration_versions (tenant_configuration_id, version, status, effective_from, effective_to)
values ('74000000-0000-0000-0000-000000000002',6,'published','2030-01-01T00:00:00Z','2030-02-01T00:00:00Z');
`);

  const effectiveId = psqlValue(containerName, `
select public.config_effective_configuration_version_id('72000000-0000-0000-0000-000000000001','2027-01-15T00:00:00Z');
`);
  record("effective resolution returns the single applicable version", effectiveId === "75000000-0000-0000-0000-000000000011", `id=${effectiveId}`);

  const orderBy = psqlValue(containerName, `
select pg_get_functiondef('public.config_effective_configuration_version_id(uuid,timestamp with time zone)'::regprocedure) like '%cv.id asc%';
`);
  record("effective resolver has stable final unique tie-breaker", orderBy === "t", `result=${orderBy}`);
}

async function runConcurrentPsql(containerName, sqlScripts) {
  const promises = sqlScripts.map((sql) => {
    const child = spawn(
      "docker",
      ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-X", "-q"],
      { cwd: repoRoot, shell: false },
    );
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stderr += `\nTimed out after ${concurrentPsqlTimeoutMs}ms while waiting for concurrent lifecycle proof transaction.`;
      child.kill("SIGTERM");
    }, concurrentPsqlTimeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.stdin.write(sql);
    child.stdin.end();
    return new Promise((resolve) => {
      child.on("close", (status) => {
        clearTimeout(timer);
        resolve({ status: timedOut ? 124 : status, stdout, stderr, timedOut });
      });
    });
  });
  return Promise.all(promises);
}

async function runLifecycleConcurrency(containerName) {
  const insertResults = await runConcurrentPsql(containerName, [
    `
begin;
insert into config_configuration_versions (tenant_configuration_id, version, status, effective_from, effective_to)
values ('74000000-0000-0000-0000-000000000001',40,'published','2031-01-01T00:00:00Z','2031-03-01T00:00:00Z');
select pg_sleep(2);
commit;
`,
    `
begin;
select pg_sleep(0.5);
insert into config_configuration_versions (tenant_configuration_id, version, status, effective_from, effective_to)
values ('74000000-0000-0000-0000-000000000001',41,'published','2031-02-01T00:00:00Z','2031-04-01T00:00:00Z');
commit;
`,
  ]);
  const oneInsertSucceeded = insertResults.filter((result) => result.status === 0).length === 1;
  const oneInsertFailedOverlap = insertResults.some((result) => /effective intervals|overlap/i.test(`${result.stdout}\n${result.stderr}`));
  record("real concurrent overlapping inserts cannot both commit", oneInsertSucceeded && oneInsertFailedOverlap, `statuses=${insertResults.map((r) => r.status).join(",")}`);

  psql(containerName, `
insert into config_configuration_versions (id, tenant_configuration_id, version, status)
values
 ('75000000-0000-0000-0000-000000000041','74000000-0000-0000-0000-000000000001',42,'draft'),
 ('75000000-0000-0000-0000-000000000042','74000000-0000-0000-0000-000000000001',43,'draft');
`);
  const updateResults = await runConcurrentPsql(containerName, [
    `
begin;
update config_configuration_versions
set status = 'published', effective_from = '2032-01-01T00:00:00Z', effective_to = '2032-03-01T00:00:00Z'
where id = '75000000-0000-0000-0000-000000000041';
select pg_sleep(2);
commit;
`,
    `
begin;
select pg_sleep(0.5);
update config_configuration_versions
set status = 'published', effective_from = '2032-02-01T00:00:00Z', effective_to = '2032-04-01T00:00:00Z'
where id = '75000000-0000-0000-0000-000000000042';
commit;
`,
  ]);
  const oneUpdateSucceeded = updateResults.filter((result) => result.status === 0).length === 1;
  const oneUpdateFailedOverlap = updateResults.some((result) => /effective intervals|overlap/i.test(`${result.stdout}\n${result.stderr}`));
  record("real concurrent conflicting updates cannot both commit", oneUpdateSucceeded && oneUpdateFailedOverlap, `statuses=${updateResults.map((r) => r.status).join(",")}`);

  const lockOrder = psqlValue(containerName, `
select position('config_lock_tenant_configuration_lifecycle' in pg_get_functiondef('public.config_validate_configuration_version_lifecycle()'::regprocedure))
       < position('from config_configuration_versions existing' in pg_get_functiondef('public.config_validate_configuration_version_lifecycle()'::regprocedure));
`);
  record("advisory lock is acquired before conflict query", lockOrder === "t", `result=${lockOrder}`);
}

async function runFreshScenario() {
  let disposable;
  try {
    disposable = await startDisposableSupabase("fresh");
    applyMigrations(disposable.containerName, disposable.projectDir, "all");
    runCatalogAssertions(disposable.containerName);
    record("fresh installation 0001-0026 applies successfully", true, disposable.projectId);
    return disposable.projectId;
  } finally {
    stopDisposableSupabase(disposable);
  }
}

async function runUpgradeScenario() {
  let disposable;
  try {
    disposable = await startDisposableSupabase("upgrade");
    applyMigrations(disposable.containerName, disposable.projectDir, "accepted");
    psql(disposable.containerName, fixtureSql());
    const beforeCounts = psqlValue(disposable.containerName, `
select jsonb_build_object(
  'organizations', (select count(*) from organizations),
  'workspaces', (select count(*) from workspaces),
  'memberships', (select count(*) from workspace_memberships),
  'opportunities', (select count(*) from opportunities),
  'pursuit_events', (select count(*) from opportunity_pursuit_authorization_events),
  'bid_events', (select count(*) from opportunity_bid_submission_events)
)::text;
`);
    const beforeHash = hashQuery(disposable.containerName, `
select string_agg(id::text || ':' || name || ':' || lifecycle_status || ':' || pursuit_authorization_status || ':' || bid_submission_status, ',' order by id)
from opportunities;
`);
    applyMigrations(disposable.containerName, disposable.projectDir, "configuration");
    const afterCounts = psqlValue(disposable.containerName, `
select jsonb_build_object(
  'organizations', (select count(*) from organizations),
  'workspaces', (select count(*) from workspaces),
  'memberships', (select count(*) from workspace_memberships),
  'opportunities', (select count(*) from opportunities),
  'pursuit_events', (select count(*) from opportunity_pursuit_authorization_events),
  'bid_events', (select count(*) from opportunity_bid_submission_events)
)::text;
`);
    const afterHash = hashQuery(disposable.containerName, `
select string_agg(id::text || ':' || name || ':' || lifecycle_status || ':' || pursuit_authorization_status || ':' || bid_submission_status, ',' order by id)
from opportunities;
`);
    record("upgrade preserves representative accepted P1 record counts", beforeCounts === afterCounts, `${beforeCounts} -> ${afterCounts}`);
    record("upgrade preserves representative accepted P1 identifying hashes", beforeHash === afterHash, `${beforeHash} -> ${afterHash}`);
    runCatalogAssertions(disposable.containerName);
    runRlsAttacks(disposable.containerName);
    runSameVersionTests(disposable.containerName);
    runLifecycleTests(disposable.containerName);
    await runLifecycleConcurrency(disposable.containerName);
    const templatePackCount = Number(psqlValue(disposable.containerName, "select count(*) from config_template_packs;"));
    record("no Configuration Foundation seed records were invented by migrations", templatePackCount === 1, `${templatePackCount} template-pack row(s), all test fixture controlled`);
    record("upgrade installation and executable database proof passed", true, disposable.projectId);
    return disposable.projectId;
  } finally {
    stopDisposableSupabase(disposable);
  }
}

if (process.env.M1_GATE_LIBRARY !== "1") {
try {
  assertLocalOnlyEnvironment();
  assertPrerequisites();
  const existingConfigMigrations = readdirSync(migrationRoot)
    .filter((name) => /^00(1[7-9]|2[0-9])_configuration_.*\.sql$/.test(name))
    .sort();
  record("authorized Configuration Foundation migration set is exact", JSON.stringify(existingConfigMigrations) === JSON.stringify(expectedConfigMigrations), existingConfigMigrations.join(", "));
  const freshProject = await runFreshScenario();
  const upgradeProject = await runUpgradeScenario();
  record("existing local, linked, staging, and production databases were not targeted", true, `fresh=${freshProject}, upgrade=${upgradeProject}`);
  console.log("\nConfiguration Foundation disposable database validation passed.");
} catch (error) {
  console.error("\nConfiguration Foundation disposable database validation failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

}
export { runFreshScenario, runUpgradeScenario };
export function referenceResults() { return results; }
