import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const migrationPath = join(root, "supabase", "migrations", "0006_shared_command_audit_evidence.sql");
const migration = read(migrationPath);

check(Boolean(migration), "migration 0006 exists");

for (const token of [
  "create schema if not exists rybex_internal",
  "create table if not exists command_idempotency",
  "create table if not exists domain_events",
  "create table if not exists evidence_objects",
  "create table if not exists evidence_links",
  "actor_auth_user_id uuid references auth.users",
  "rybex_internal.claim_or_replay_command",
  "rybex_internal.append_audit_event",
  "rybex_internal.append_domain_event",
  "rybex_internal.complete_command",
  "public.update_workspace_display_name_v1",
  "public.create_evidence_upload_intent_v1",
  "public.finalize_evidence_upload_v1",
  "public.create_evidence_download_grant_v1",
  "prevent_audit_event_mutation",
  "prevent_domain_event_mutation",
  "insert into storage.buckets",
  "'rybexos-evidence'",
  "public = false"
]) {
  check(migration.includes(token), `migration includes ${token}`);
}

for (const table of ["command_idempotency", "domain_events", "evidence_objects", "evidence_links"]) {
  check(new RegExp(`alter table ${table}\\s+enable row level security`, "i").test(migration), `${table} has RLS enabled`);
  check(!new RegExp(`on ${table}[\\s\\S]{0,220}using \\(true\\)`, "i").test(migration), `${table} has no permissive USING (true) policy`);
}

check(/revoke all on schema rybex_internal from public/i.test(migration), "internal schema is not public");
check(/revoke all on function rybex_internal\./i.test(migration), "internal helpers are not public RPCs");
check(/unique \(workspace_id, command_id\)/i.test(migration), "command idempotency unique workspace command key exists");
check(/expected_version/i.test(migration), "reference command includes expected-version concurrency");
check(/storage_evidence_insert_authorized_pending/i.test(migration), "storage insert policy requires pending evidence metadata");
check(!/Final billing paid|Payment complete|cash received/i.test(migration), "migration contains no product-state overclaim wording");

for (const file of [
  "lib/d5o/commands/types.ts",
  "lib/d5o/commands/request-hash.ts",
  "lib/d5o/commands/reference-workspace-command.ts",
  "lib/d5o/evidence/production-evidence-service.ts"
]) {
  const content = read(join(root, file));
  check(Boolean(content), `${file} exists`);
  if (file !== "lib/d5o/commands/types.ts") {
    check(content.includes('import "server-only";'), `${file} is server-only`);
  }
}

const packageJson = JSON.parse(read(join(root, "package.json")));
for (const scriptName of [
  "foundation-0b:verify",
  "foundation-0b:qa-command",
  "foundation-0b:qa-evidence",
  "foundation-0b:gate-local"
]) {
  check(Boolean(packageJson.scripts?.[scriptName]), `package script ${scriptName} exists`);
}

const searchedFiles = [
  "lib/d5o/commands/reference-workspace-command.ts",
  "lib/d5o/evidence/production-evidence-service.ts",
  "scripts/qa-foundation-0b-command-security.mjs",
  "scripts/qa-foundation-0b-evidence-security.mjs",
  "scripts/run-foundation-0b-local-gate.mjs"
];
for (const file of searchedFiles) {
  const content = read(join(root, file));
  check(!/package-output\/rybexos-demo-package|package-output\\rybexos-demo-package/.test(content), `${file} does not reference historical package output`);
}

const clientVisibleFiles = [
  ...listFiles(join(root, "app")),
  ...listFiles(join(root, "components")),
  ...listFiles(join(root, "lib"))
].filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

for (const file of clientVisibleFiles) {
  const content = read(file);
  if (!content) continue;
  const relative = file.replace(`${root}\\`, "").replaceAll("\\", "/");
  const allowedServerBoundary =
    relative.includes("auth/supabase-server.ts") ||
    relative.includes("data/database-client.ts") ||
    relative.includes("data/database-diagnostics.ts") ||
    relative.includes("security/production-config.ts");
  check(!/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/.test(content) || allowedServerBoundary, `${relative} does not expose service-role env outside server boundary`);
}

if (failures.length > 0) {
  console.error("Foundation 0B static verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Foundation 0B static verification passed.");

function check(condition, label) {
  if (!condition) failures.push(label);
}

function read(path) {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (full.includes(`${join("package-output", "rybexos-demo-package")}`)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}
