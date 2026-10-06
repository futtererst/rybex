import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const repoRoot = process.cwd();
const artifactPath = join(
  repoRoot,
  "artifacts",
  "configuration-foundation-executable-database-baseline",
  "CFG-RUNTIME-01-FOUNDATION-BASELINE-MANIFEST.json",
);

const files = [
  ...Array.from({ length: 10 }, (_, index) => {
    const number = String(17 + index).padStart(4, "0");
    const names = {
      "0017": "configuration_foundation_core",
      "0018": "configuration_template_packs_versions",
      "0019": "configuration_tenant_activation_versions",
      "0020": "configuration_phase_gate_definitions",
      "0021": "configuration_work_types_streams_lanes",
      "0022": "configuration_roles_permissions_decision_rights",
      "0023": "configuration_artifact_evidence_definitions",
      "0024": "configuration_kpi_financial_workforce_handoff_governance",
      "0025": "configuration_audit_effective_resolution",
      "0026": "configuration_template_pack_seed_data",
    };
    return `supabase/migrations/${number}_${names[number]}.sql`;
  }),
  "scripts/configuration-foundation-static-utils.mjs",
  "scripts/verify-configuration-foundation.mjs",
  "scripts/verify-configuration-foundation-migration-order.mjs",
  "scripts/verify-configuration-foundation-schema-static.mjs",
  "scripts/verify-configuration-foundation-rls-static.mjs",
  "scripts/verify-configuration-foundation-template-pack-seeds-static.mjs",
  "scripts/verify-configuration-effective-resolution-static.mjs",
  "scripts/verify-configuration-foundation-no-regression.mjs",
  "scripts/verify-configuration-foundation-negative-controls.mjs",
  "scripts/verify-configuration-foundation-database.mjs",
];

const hashes = files.map((relativePath) => {
  const absolutePath = join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing baseline source file: ${relativePath}`);
  }
  const bytes = readFileSync(absolutePath);
  return {
    path: relativePath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
});

const seedMigration = readFileSync(join(repoRoot, "supabase/migrations/0026_configuration_template_pack_seed_data.sql"), "utf8");
const noOpSeed = /intentionally inserts no records|seed data is deferred/i.test(seedMigration) && !/\binsert\s+into\b/i.test(seedMigration);

const manifest = {
  manifestType: "CFG-RUNTIME-01 foundation executable database baseline freeze",
  createdAt: new Date().toISOString(),
  independentReviewVerdict: "CONFIGURATION FOUNDATION EXECUTABLE DATABASE CANDIDATE INDEPENDENT REVIEW PASSED WITH CONDITIONS",
  acceptedMinorConditions: [
    {
      condition: "Disposable database concurrency test needed an internal timeout.",
      disposition: "Addressed by transaction child-process timeout in scripts/verify-configuration-foundation-database.mjs.",
    },
    {
      condition: "Node .cmd shell invocation emitted [DEP0190].",
      disposition: "Addressed by invoking .cmd through cmd.exe without shell: true on Windows.",
    },
  ],
  exactMigrationSet: hashes
    .filter((entry) => entry.path.startsWith("supabase/migrations/"))
    .map((entry) => entry.path),
  seedMigration0026: {
    noOp: noOpSeed,
    insertsTemplatePackData: /\binsert\s+into\b/i.test(seedMigration),
  },
  noGoStatuses: {
    stagingMutation: "not authorized",
    productionMutation: "not authorized",
    ConfigurationStudio: "not authorized",
    P1_01B_3: "paused",
    demoReadiness: "No-Go",
    productionReadiness: "No-Go",
  },
  hashes,
};

if (!noOpSeed) {
  throw new Error("0026 is not a no-op seed-deferral migration.");
}

mkdirSync(dirname(artifactPath), { recursive: true });
writeFileSync(artifactPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${artifactPath}`);
