import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "rybexos-controlled-pilot-reset-"));
const outDir = join(tempRoot, "dist");
const tempTsconfig = join(tempRoot, "tsconfig.controlled-pilot-reset.json");

writeFileSync(tempTsconfig, JSON.stringify({
  extends: join(repoRoot, "tsconfig.json"),
  compilerOptions: {
    noEmit: false,
    outDir,
    rootDir: repoRoot,
    module: "CommonJS",
    moduleResolution: "Node",
    ignoreDeprecations: "6.0",
    declaration: false,
    sourceMap: false,
    incremental: false,
    tsBuildInfoFile: join(tempRoot, "tsconfig.tsbuildinfo")
  },
  files: [
    join(repoRoot, "lib", "d5o", "billing-v2", "persisted-store.ts"),
    join(repoRoot, "lib", "d5o", "field-issue-escalation", "persisted-store.ts"),
    join(repoRoot, "lib", "d5o", "closeout-final-billing", "persisted-store.ts")
  ]
}, null, 2));

compile(tempTsconfig);

const billing = await import(pathToFileURL(join(outDir, "lib", "d5o", "billing-v2", "persisted-store.js")).href);
const fieldIssue = await import(pathToFileURL(join(outDir, "lib", "d5o", "field-issue-escalation", "persisted-store.js")).href);
const closeout = await import(pathToFileURL(join(outDir, "lib", "d5o", "closeout-final-billing", "persisted-store.js")).href);

const billingPackage = await billing.resetBillingV2PersistedStoreForTesting();
const issue = await fieldIssue.resetFieldIssueEscalationStoreForTesting();
const closeoutBlocker = await closeout.resetCloseoutFinalBillingStoreForTesting();

console.log("Controlled pilot demo reset complete.");
console.log(JSON.stringify({
  resetStores: [
    {
      slice: "Billing V2 backup cash recovery",
      store: ".rybexos-local/billing-v2-store.json",
      canonicalId: billingPackage.id,
      state: billingPackage.state,
      openBlockers: (await billing.listOpenBillingBlockers()).length
    },
    {
      slice: "Field Issue Escalation",
      store: ".rybexos-local/field-issue-escalation-store.json",
      canonicalId: issue.id,
      state: issue.state,
      openBlockers: (await fieldIssue.listOpenFieldIssues()).length
    },
    {
      slice: "Closeout Final Billing Release",
      store: ".rybexos-local/closeout-final-billing-store.json",
      canonicalId: closeoutBlocker.id,
      state: closeoutBlocker.state,
      openBlockers: (await closeout.listOpenCloseoutFinalBillingBlockers()).length
    }
  ],
  modifiedScope: "Only persisted operating-slice local stores were reset.",
  supabaseRequired: false
}, null, 2));

function compile(tsconfigPath) {
  try {
    execFileSync(process.execPath, [
      join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
      "--project",
      tsconfigPath
    ], {
      cwd: repoRoot,
      env: process.env,
      stdio: "pipe"
    });
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout.toString());
    if (error.stderr) process.stderr.write(error.stderr.toString());
    throw error;
  }
}
