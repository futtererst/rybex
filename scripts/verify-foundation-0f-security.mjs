import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const outputPath = join(root, "visual-qa-output", "foundation-0f", "security-result.json");
const failures = [];
const checks = [];
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const check = (condition, name, detail = "") => {
  checks.push({ name, status: condition ? "pass" : "fail", detail });
  if (!condition) failures.push(name);
};

const proxy = exists("proxy.ts") ? read("proxy.ts") : "";
const availability = read("lib/d5o/security/production-module-availability.ts");
const packageJson = read("package.json");
const migrations = [
  "supabase/migrations/0005_identity_workspace_security.sql",
  "supabase/migrations/0006_shared_command_audit_evidence.sql",
  "supabase/migrations/0007_billing_v2_production_persistence.sql",
  "supabase/migrations/0008_field_issue_rfi_change_production_persistence.sql",
  "supabase/migrations/0009_closeout_production_persistence.sql",
  "supabase/migrations/0010_production_cutover_hardening.sql"
].map((path) => ({ path, text: exists(path) ? read(path) : "" }));

check(proxy.includes("isProductionRouteAvailable") && proxy.includes("503"), "Production unavailable routes are contained before render.");
check(proxy.includes("createServerClient") && proxy.includes("auth.getUser"), "Proxy verifies Supabase SSR sessions before protected render.");
check(!exists("middleware.ts"), "Deprecated middleware is not active beside proxy.");
check(availability.includes("/pipeline") && availability.includes("unavailable_until_migrated"), "Unsupported modules are explicitly unavailable.");
check(!/NEXT_PUBLIC_.*(SERVICE|SECRET|ROLE)/i.test(read(".env.example")), "Service-role key is not exposed as NEXT_PUBLIC.");
check(migrations.every((migration) => migration.text.includes("enable row level security") || migration.path.includes("0010")), "0A-0E business migrations enable RLS.");
check(!migrations.some((migration) => /using\s*\(\s*true\s*\)/i.test(migration.text)), "No broad USING (true) policy appears in 0A-0F migrations.");
check(!migrations.some((migration) => /security definer/i.test(migration.text) && !/set search_path = public/i.test(migration.text)), "SECURITY DEFINER functions set safe search_path.");
check(read("lib/d5o/evidence/scanner/scanner.ts").includes("scanner_unavailable"), "Evidence scanner is required/fails closed.");
check(read("supabase/migrations/0010_production_cutover_hardening.sql").includes("evidence_links_require_clean_scan"), "Clean scan trigger exists.");
check(read("lib/d5o/observability/logger.ts").includes("[REDACTED"), "Structured logging redacts sensitive values.");
check(!packageJson.includes("package-output/rybexos-demo-package"), "Historical package-output tree is not referenced by scripts.");

const audit = spawnSync("npm.cmd", ["audit", "--omit=dev", "--json"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
  maxBuffer: 1024 * 1024 * 20
});
let auditSummary = { status: "not_run" };
try {
  const parsed = JSON.parse(audit.stdout || "{}");
  const vulnerabilities = parsed.metadata?.vulnerabilities ?? {};
  const high = Number(vulnerabilities.high ?? 0);
  const critical = Number(vulnerabilities.critical ?? 0);
  auditSummary = { status: audit.status === 0 || high + critical === 0 ? "pass" : "fail", high, critical };
  check(high + critical === 0, "No high/critical production dependency audit findings.", `high:${high} critical:${critical}`);
} catch {
  auditSummary = { status: "fail", detail: "npm audit did not return parseable JSON." };
  check(false, "Dependency audit completed with parseable JSON.");
}

const payload = {
  runTimestamp: new Date().toISOString(),
  status: failures.length === 0 ? "pass" : "fail",
  checks,
  dependencyAudit: auditSummary
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

if (failures.length > 0) {
  console.error("Foundation 0F security verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Foundation 0F security verification passed.");
