import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const path of [
  "docs/foundation-0f-cutover-production-hardening-plan.md",
  "docs/foundation-0f-authenticated-browser-session-bridge-plan.md",
  "lib/d5o/security/production-config.ts",
  "lib/d5o/security/production-readiness.ts",
  "lib/d5o/security/production-module-availability.ts",
  "proxy.ts",
  "lib/d5o/auth/supabase-browser.ts",
  "app/auth/sign-in/page.tsx",
  "app/auth/sign-in/actions.ts",
  "app/auth/sign-out/route.ts",
  "app/api/auth/session-proof/route.ts",
  "lib/d5o/evidence/scanner/types.ts",
  "lib/d5o/evidence/scanner/scanner.ts",
  "lib/d5o/evidence/scanner/local-scanner.ts",
  "lib/d5o/observability/context.ts",
  "lib/d5o/observability/logger.ts",
  "lib/d5o/observability/errors.ts",
  "app/api/health/route.ts",
  "app/api/readiness/route.ts",
  "scripts/verify-production-config.mjs",
  "scripts/verify-production-no-local-fallback.mjs",
  "scripts/verify-foundation-0f-auth-session-bridge.mjs",
  "scripts/qa-foundation-0f-auth-session.mjs",
  "scripts/migrate-core-local-to-supabase.mjs",
  "scripts/qa-foundation-0f-backup-restore.mjs",
  "scripts/qa-foundation-0f-resilience.mjs",
  "scripts/verify-foundation-0f-security.mjs",
  "scripts/qa-foundation-0f-performance.mjs",
  "scripts/qa-foundation-0f-core-journey.mjs",
  "scripts/run-foundation-0f-local-gate.mjs"
]) {
  check(exists(path), `${path} must exist.`);
}

const packageJson = JSON.parse(read("package.json"));
for (const script of [
  "foundation-0f:verify",
  "foundation-0f:gate-local",
  "production:verify-config",
  "production:verify-no-fallback",
  "core:migrate-local:dry-run",
  "core:migrate-local:apply",
  "foundation-0f:verify-auth-bridge",
  "foundation-0f:qa-auth-session"
]) {
  check(Boolean(packageJson.scripts?.[script]), `package.json must expose ${script}.`);
}

const migration = exists("supabase/migrations/0010_production_cutover_hardening.sql")
  ? read("supabase/migrations/0010_production_cutover_hardening.sql")
  : "";
check(migration.includes("evidence_links_require_clean_scan"), "0010 must enforce clean scanner status on evidence links.");
check(!migration.includes("using (true)"), "0010 must not add permissive policies.");

const availability = read("lib/d5o/security/production-module-availability.ts");
for (const href of ["/command-center", "/billing", "/field-execution", "/rfis-submittals", "/changes", "/closeout"]) {
  check(availability.includes(href), `${href} must be production-enabled.`);
}
for (const href of ["/pipeline", "/projects", "/mobilization", "/safety", "/quality", "/reports", "/pilot"]) {
  check(availability.includes(href) && availability.includes("unavailable_until_migrated"), `${href} must be contained until migrated.`);
}

const scanner = read("lib/d5o/evidence/scanner/scanner.ts");
check(scanner.includes("scanner_unavailable") && scanner.includes("scanResultSatisfiesProductionEvidence"), "Scanner boundary must fail closed and define clean-only acceptance.");

const productionConfig = read("lib/d5o/security/production-config.ts");
const envExample = read(".env.example");
for (const token of [
  "RYBEXOS_RUNTIME_MODE",
  "RYBEXOS_AUTH_MODE",
  "RYBEXOS_DATA_SOURCE",
  "RYBEXOS_BILLING_V2_PERSISTENCE",
  "RYBEXOS_FIELD_ISSUE_PERSISTENCE",
  "RYBEXOS_CLOSEOUT_FINAL_BILLING_PERSISTENCE",
  "RYBEXOS_EVIDENCE_STORE",
  "RYBEXOS_SCANNER_MODE"
]) {
  check(productionConfig.includes(token) || envExample.includes(token), `${token} must be validated.`);
}

const evidenceAction = read("app/actions/evidence-uploads.ts");
check(!/NEXT_PUBLIC_.*SERVICE_ROLE|NEXT_PUBLIC_.*SECRET/.test(read(".env.example")), "Service-role variables must not be NEXT_PUBLIC.");
check(!read("package.json").includes("package-output/rybexos-demo-package"), "0F scripts must not reference package-output export.");
check(!evidenceAction.includes("console.log(process.env"), "Evidence actions must not log secrets.");

const proxy = read("proxy.ts");
check(proxy.includes("createServerClient") && proxy.includes("auth.getUser"), "Proxy must verify Supabase SSR sessions.");
check(proxy.includes("/auth/sign-in") && proxy.includes("NextResponse.redirect"), "Proxy must redirect unauthenticated protected page requests to sign-in.");
check(!exists("middleware.ts"), "Deprecated root middleware.ts must be removed when proxy.ts is active.");

if (failures.length > 0) {
  console.error("Foundation 0F static verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Foundation 0F static verification passed.");
