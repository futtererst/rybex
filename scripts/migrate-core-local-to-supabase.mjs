import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !apply;
const outputPath = join(root, "visual-qa-output", "foundation-0f", dryRun ? "core-migration-dry-run.json" : "core-migration-apply.json");
const commands = [
  ["billing-v2", "node", ["scripts/migrate-billing-v2-local-to-supabase.mjs", dryRun ? "--dry-run" : "--apply"]],
  ["field-issue", "node", ["scripts/migrate-field-issue-local-to-supabase.mjs", dryRun ? "--dry-run" : "--apply"]],
  ["closeout", "node", ["scripts/migrate-closeout-local-to-supabase.mjs", dryRun ? "--dry-run" : "--apply"]]
];

if (process.env.RYBEXOS_RUNTIME_MODE === "production") {
  throw new Error("Core local migration orchestration is local/test only and must not run in production runtime.");
}

const sourceFiles = [
  ".rybexos-local/billing-v2-store.json",
  ".rybexos-local/field-issue-escalation-store.json",
  ".rybexos-local/closeout-final-billing-store.json"
];

const results = [];
for (const [domain, command, args] of commands) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 20
  });
  results.push({
    domain,
    command: `${command} ${args.join(" ")}`,
    status: result.status === 0 ? "pass" : "fail",
    exitCode: result.status,
    stderr: redact(result.stderr ?? result.error?.message ?? "")
  });
  if (result.status !== 0) break;
}

const payload = {
  runTimestamp: new Date().toISOString(),
  mode: dryRun ? "dry-run" : "apply",
  wroteDatabase: apply,
  sourceFileChecksums: sourceFiles.map((file) => ({
    file,
    exists: existsSync(join(root, file)),
    sha256: existsSync(join(root, file)) ? sha256(readFileSync(join(root, file))) : null
  })),
  results,
  status: results.every((result) => result.status === "pass") ? "pass" : "fail",
  note: "This orchestrates existing domain migration scripts and does not duplicate domain migration logic."
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

if (payload.status !== "pass") {
  console.error("Core local-to-Supabase migration orchestration failed.");
  process.exit(1);
}

console.log(`Core local-to-Supabase migration ${dryRun ? "dry-run" : "apply"} passed.`);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function redact(value) {
  return String(value ?? "")
    .replace(/sb_publishable_[A-Za-z0-9_\-.]+/g, "[REDACTED_PUBLISHABLE_KEY]")
    .replace(/sb_secret_[A-Za-z0-9_\-.]+/g, "[REDACTED_SECRET_KEY]")
    .replace(/eyJ[A-Za-z0-9_\-.]+/g, "[REDACTED_JWT]");
}
