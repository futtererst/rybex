import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");

const trackedFiles = [
  "supabase/migrations/0017_configuration_foundation_core.sql",
  "supabase/migrations/0018_configuration_template_packs_versions.sql",
  "supabase/migrations/0019_configuration_tenant_activation_versions.sql",
  "supabase/migrations/0020_configuration_phase_gate_definitions.sql",
  "supabase/migrations/0021_configuration_work_types_streams_lanes.sql",
  "supabase/migrations/0022_configuration_roles_permissions_decision_rights.sql",
  "supabase/migrations/0023_configuration_artifact_evidence_definitions.sql",
  "supabase/migrations/0024_configuration_kpi_financial_workforce_handoff_governance.sql",
  "supabase/migrations/0025_configuration_audit_effective_resolution.sql",
  "supabase/migrations/0026_configuration_template_pack_seed_data.sql",
  "scripts/configuration-foundation-static-utils.mjs",
  "scripts/verify-configuration-foundation-migration-order.mjs",
  "scripts/verify-configuration-foundation-schema-static.mjs",
  "scripts/verify-configuration-foundation-rls-static.mjs",
  "scripts/verify-configuration-foundation-template-pack-seeds-static.mjs",
  "scripts/verify-configuration-effective-resolution-static.mjs",
  "scripts/verify-configuration-foundation-no-regression.mjs",
  "scripts/verify-configuration-foundation.mjs",
  "scripts/verify-configuration-foundation-negative-controls.mjs",
  "package.json",
];

function hashTrackedFiles() {
  const hash = createHash("sha256");
  for (const relativePath of trackedFiles) {
    const absolutePath = join(repoRoot, relativePath);
    if (existsSync(absolutePath)) {
      hash.update(relativePath);
      hash.update(readFileSync(absolutePath));
    }
  }
  return hash.digest("hex");
}

function copyReviewRoot() {
  const tempRoot = mkdtempSync(join(tmpdir(), "rybex-config-negative-"));
  cpSync(join(repoRoot, "supabase", "migrations"), join(tempRoot, "supabase", "migrations"), { recursive: true });
  cpSync(join(repoRoot, "scripts"), join(tempRoot, "scripts"), { recursive: true });
  cpSync(join(repoRoot, "package.json"), join(tempRoot, "package.json"));
  cpSync(join(repoRoot, "docs", "recommended-next-implementation.md"), join(tempRoot, "docs", "recommended-next-implementation.md"));
  cpSync(join(repoRoot, "artifacts", "p1-01b-1-human-acceptance-baseline"), join(tempRoot, "artifacts", "p1-01b-1-human-acceptance-baseline"), { recursive: true });
  cpSync(join(repoRoot, "artifacts", "p1-01b-2-human-acceptance-baseline"), join(tempRoot, "artifacts", "p1-01b-2-human-acceptance-baseline"), { recursive: true });
  return tempRoot;
}

function readTemp(tempRoot, relativePath) {
  return readFileSync(join(tempRoot, relativePath), "utf8");
}

function writeTemp(tempRoot, relativePath, content) {
  writeFileSync(join(tempRoot, relativePath), content);
}

function replaceInTemp(tempRoot, relativePath, search, replacement, label) {
  const content = readTemp(tempRoot, relativePath);
  const next = typeof search === "string"
    ? content.replace(search, replacement)
    : content.replace(search, replacement);
  if (next === content) {
    throw new Error(`Mutation was not applied for ${label}`);
  }
  writeTemp(tempRoot, relativePath, next);
}

function runVerifier(tempRoot, script) {
  const result = spawnSync(process.execPath, [join(tempRoot, script)], {
    cwd: tempRoot,
    env: {
      ...process.env,
      CONFIGURATION_FOUNDATION_VERIFY_ROOT: tempRoot,
    },
    encoding: "utf8",
    shell: false,
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout || ""}\n${result.stderr || ""}`,
  };
}

const cases = [
  {
    name: "indexed column changed to nonexistent column",
    verifier: "scripts/verify-configuration-foundation-schema-static.mjs",
    expected: "nonexistent_idx_col",
    mutate(tempRoot) {
      replaceInTemp(
        tempRoot,
        "supabase/migrations/0025_configuration_audit_effective_resolution.sql",
        "on config_tenant_template_activations(tenant_id, status, effective_from, effective_to)",
        "on config_tenant_template_activations(tenant_id, nonexistent_idx_col, effective_from, effective_to)",
        this.name,
      );
    },
  },
  {
    name: "platform-admin helper reintroduced",
    verifier: "scripts/verify-configuration-foundation-rls-static.mjs",
    expected: "no false platform-admin helper is defined",
    mutate(tempRoot) {
      const path = "supabase/migrations/0017_configuration_foundation_core.sql";
      writeTemp(tempRoot, path, `${readTemp(tempRoot, path)}\ncreate or replace function public.config_is_platform_admin() returns boolean language sql as $$ select true; $$;\n`);
    },
  },
  {
    name: "global template-pack mutation granted to authenticated",
    verifier: "scripts/verify-configuration-foundation-rls-static.mjs",
    expected: "global template-pack insert is service-role-only",
    mutate(tempRoot) {
      replaceInTemp(
        tempRoot,
        "supabase/migrations/0018_configuration_template_packs_versions.sql",
        "with check (public.config_is_service_role());",
        "with check (true);",
        this.name,
      );
    },
  },
  {
    name: "tenant activation composite enforcement removed",
    verifier: "scripts/verify-configuration-foundation-schema-static.mjs",
    expected: "required structural FK shape exists: config_tenant_configurations_activation_tenant_fkey",
    mutate(tempRoot) {
      replaceInTemp(
        tempRoot,
        "supabase/migrations/0019_configuration_tenant_activation_versions.sql",
        "foreign key (activation_id, tenant_id) references config_tenant_template_activations(id, tenant_id) on delete restrict",
        "foreign key (activation_id) references config_tenant_template_activations(id) on delete restrict",
        this.name,
      );
    },
  },
  {
    name: "same-version scalar relationship constraint removed",
    verifier: "scripts/verify-configuration-foundation-schema-static.mjs",
    expected: "config_gate_decision_outcomes_target_gate_same_configuration_fkey",
    mutate(tempRoot) {
      replaceInTemp(
        tempRoot,
        "supabase/migrations/0020_configuration_phase_gate_definitions.sql",
        /,\n  constraint config_gate_decision_outcomes_target_gate_same_configuration_fkey\n    foreign key \(configuration_version_id, target_gate_key\) references config_gate_definitions\(configuration_version_id, gate_key\) on delete restrict/,
        "",
        this.name,
      );
    },
  },
  {
    name: "array/json same-version validation path removed",
    verifier: "scripts/verify-configuration-foundation-schema-static.mjs",
    expected: "config_governance_forum_participant_role_links table definition exists",
    mutate(tempRoot) {
      replaceInTemp(
        tempRoot,
        "supabase/migrations/0024_configuration_kpi_financial_workforce_handoff_governance.sql",
        "create table if not exists config_governance_forum_participant_role_links",
        "create table if not exists config_governance_forum_participant_role_links_removed",
        this.name,
      );
    },
  },
  {
    name: "advisory lifecycle lock removed",
    verifier: "scripts/verify-configuration-effective-resolution-static.mjs",
    expected: "lifecycle validator uses transaction-scoped advisory lock",
    mutate(tempRoot) {
      replaceInTemp(
        tempRoot,
        "supabase/migrations/0019_configuration_tenant_activation_versions.sql",
        "  perform public.config_lock_tenant_configuration_lifecycle(new.tenant_configuration_id);\n\n",
        "",
        this.name,
      );
    },
  },
  {
    name: "advisory lifecycle lock moved after overlap query",
    verifier: "scripts/verify-configuration-effective-resolution-static.mjs",
    expected: "lifecycle lock occurs before overlap query",
    mutate(tempRoot) {
      replaceInTemp(
        tempRoot,
        "supabase/migrations/0019_configuration_tenant_activation_versions.sql",
        "  perform public.config_lock_tenant_configuration_lifecycle(new.tenant_configuration_id);\n\n",
        "",
        this.name,
      );
      replaceInTemp(
        tempRoot,
        "supabase/migrations/0019_configuration_tenant_activation_versions.sql",
        "  return new;\nend;\n$$;\n\ndrop trigger if exists config_configuration_versions_validate_lifecycle",
        "  perform public.config_lock_tenant_configuration_lifecycle(new.tenant_configuration_id);\n\n  return new;\nend;\n$$;\n\ndrop trigger if exists config_configuration_versions_validate_lifecycle",
        this.name,
      );
    },
  },
  {
    name: "tenant-configuration ownership immutability removed",
    verifier: "scripts/verify-configuration-effective-resolution-static.mjs",
    expected: "configuration-version tenant configuration ownership is immutable",
    mutate(tempRoot) {
      replaceInTemp(
        tempRoot,
        "supabase/migrations/0019_configuration_tenant_activation_versions.sql",
        /config_prevent_configuration_version_reparenting/g,
        "config_prevent_configuration_version_reparenting_removed",
        this.name,
      );
    },
  },
  {
    name: "incorrect update-policy WITH CHECK restored",
    verifier: "scripts/verify-configuration-foundation-rls-static.mjs",
    expected: "configuration-version update WITH CHECK validates proposed tenant configuration",
    mutate(tempRoot) {
      replaceInTemp(
        tempRoot,
        "supabase/migrations/0019_configuration_tenant_activation_versions.sql",
        /create policy config_configuration_versions_update[\s\S]*?with check \(\s*public\.config_can_admin_tenant_configuration\(public\.config_tenant_configuration_tenant_id\(tenant_configuration_id\)\)\s*\);/,
        "create policy config_configuration_versions_update\n  on config_configuration_versions\n  for update\n  to authenticated\n  using (public.config_can_admin_configuration_version(id) and status in ('draft','review'))\n  with check (public.config_can_admin_configuration_version(id));",
        this.name,
      );
    },
  },
  {
    name: "resolver final unique tie-breaker removed",
    verifier: "scripts/verify-configuration-effective-resolution-static.mjs",
    expected: "effective configuration tie-breaker is deterministic",
    mutate(tempRoot) {
      replaceInTemp(
        tempRoot,
        "supabase/migrations/0025_configuration_audit_effective_resolution.sql",
        "order by cv.effective_from desc, cv.version desc, cv.id asc",
        "order by cv.effective_from desc, cv.version desc",
        this.name,
      );
    },
  },
  {
    name: "aggregate propagates constituent verifier failure",
    verifier: "scripts/verify-configuration-foundation.mjs",
    expected: "configuration:verify-migration-order exited with status",
    mutate(tempRoot) {
      unlinkSync(join(tempRoot, "supabase", "migrations", "0026_configuration_template_pack_seed_data.sql"));
    },
  },
];

const beforeHash = hashTrackedFiles();
const results = [];
let failed = false;

for (const testCase of cases) {
  const tempRoot = copyReviewRoot();
  try {
    testCase.mutate(tempRoot);
    const result = runVerifier(tempRoot, testCase.verifier);
    const passed = result.status !== 0 && result.output.includes(testCase.expected);
    results.push({
      name: testCase.name,
      status: result.status,
      expected: testCase.expected,
      passed,
    });
    if (!passed) {
      failed = true;
      console.error(`FAIL: ${testCase.name} - expected nonzero failure containing "${testCase.expected}", got status ${result.status}`);
      console.error(result.output);
    } else {
      console.log(`PASS: ${testCase.name} - verifier failed as expected with status ${result.status}`);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const afterHash = hashTrackedFiles();
if (beforeHash !== afterHash) {
  failed = true;
  console.error("FAIL: tracked source files changed during negative-control execution");
}

if (failed) {
  console.error("\nConfiguration Foundation negative-control verification failed.");
  process.exit(1);
}

console.log("\nConfiguration Foundation negative-control verification passed.");
