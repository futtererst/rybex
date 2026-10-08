import { spawnSync } from "node:child_process";

const checks = [
  ["configuration:verify-migration-order", "scripts/verify-configuration-foundation-migration-order.mjs"],
  ["configuration:verify-schema-static", "scripts/verify-configuration-foundation-schema-static.mjs"],
  ["configuration:verify-rls-static", "scripts/verify-configuration-foundation-rls-static.mjs"],
  ["configuration:verify-template-packs-static", "scripts/verify-configuration-foundation-template-pack-seeds-static.mjs"],
  ["configuration:verify-effective-resolution-static", "scripts/verify-configuration-effective-resolution-static.mjs"],
  ["configuration:verify-no-regression", "scripts/verify-configuration-foundation-no-regression.mjs"],
];

const failures = [];

for (const [label, script] of checks) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    failures.push(`${label} exited with status ${result.status ?? "unknown"}`);
  }
}

if (failures.length > 0) {
  console.error("\nConfiguration Foundation static verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\nConfiguration Foundation static verification suite passed.");
