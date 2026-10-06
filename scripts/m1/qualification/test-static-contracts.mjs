import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { verifiedHistoricalReference } from "./historical-reference.mjs";

const results = [];
const output = process.env.M1_STATIC_RESULT_PATH;
assert(output, "Explicit evidence output required");
async function test(name, fn) { await fn(); results.push({ name, status: "PASS" }); }
const manifest = process.env.M1_QUALIFICATION_MANIFEST;
const path = "artifacts/p1-01b-1-human-acceptance-baseline/ACCEPTANCE-MANIFEST.json";
await test("Exact historical reference integrity", () => assert.equal(verifiedHistoricalReference(path, manifest), true));
await test("Missing explicit manifest fails", () => assert.throws(() => verifiedHistoricalReference(path, "")));
await test("Relative manifest fails", () => assert.throws(() => verifiedHistoricalReference(path, "relative.json")));
await test("Unapproved reference fails", () => assert.throws(() => verifiedHistoricalReference("../unapproved", manifest)));
const temporary = mkdtempSync(join(tmpdir(), "d5o-historical-reference-"));
try {
  const wrong = JSON.parse(readFileSync(manifest, "utf8"));
  wrong.references[path] = "0".repeat(64);
  const wrongPath = join(temporary, "wrong.json"); writeFileSync(wrongPath, JSON.stringify(wrong));
  await test("Altered expected checksum fails", () => assert.throws(() => verifiedHistoricalReference(path, wrongPath)));
  wrong.references[path] = JSON.parse(readFileSync(manifest, "utf8")).references[path]; wrong.referenceRoot = temporary;
  writeFileSync(wrongPath, JSON.stringify(wrong));
  await test("Missing preserved source fails without fallback", () => assert.throws(() => verifiedHistoricalReference(path, wrongPath)));
} finally { rmSync(temporary, { recursive: true }); }

// Compile the actual unchanged service. Dependency doubles isolate its file guard;
// real database/custody integration is separately required and is not claimed here.
const source = readFileSync(resolve("lib/d5o/opportunities/evidence-custody-service.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const calls = [];
const client = { rpc: async () => { calls.push("intent"); return { error: null, data: { success: true, evidenceId: "fixture", bucket: "fixture", objectPath: "fixture" } }; }, storage: { from: () => ({ upload: async () => { calls.push("upload"); return { error: null }; } }) } };
const crypto = await import("node:crypto");
const dependencies = {
  "server-only": {}, "node:crypto": crypto,
  "../auth/supabase-server": { createRybexSupabaseServerClient: async () => client },
  "../auth/request-context": { requireRequestContext: async () => { calls.push("identity"); } },
  "../evidence/production-evidence-service": { finalizeEvidenceUpload: async () => { calls.push("finalize"); return { success: true }; } },
};
const compiledModule = { exports: {} };
vm.runInNewContext(compiled, { exports: compiledModule.exports, Buffer, require(name) { assert(Object.hasOwn(dependencies, name)); return dependencies[name]; } });
const stage = compiledModule.exports.stageOpportunityEvidence;
function file(type = "text/plain", size = 3) { return { name: "proof.txt", type, size, arrayBuffer: async () => new Uint8Array([97,98,99]).buffer }; }
await test("Valid service file follows intent/upload/finalization", async () => { calls.length = 0; assert.equal((await stage("opportunity", 1, "bid_approval", "proof", file())).success, true); assert.deepEqual(calls, ["identity", "intent", "upload", "finalize"]); });
await test("Oversize service file rejected before custody", async () => { calls.length = 0; assert.equal((await stage("opportunity", 1, "bid_approval", "proof", file("text/plain", 1048577))).error, "unsupported_evidence_file"); assert.deepEqual(calls, ["identity"]); });
await test("Unsupported service MIME rejected before custody", async () => { calls.length = 0; assert.equal((await stage("opportunity", 1, "bid_approval", "proof", file("application/msword"))).error, "unsupported_evidence_file"); assert.deepEqual(calls, ["identity"]); });
await test("Byte count mismatch rejected before custody", async () => { calls.length = 0; assert.equal((await stage("opportunity", 1, "bid_approval", "proof", file("text/plain", 4))).error, "evidence_bytes_mismatch"); assert.deepEqual(calls, ["identity"]); });
writeFileSync(output, JSON.stringify({ status: "PASS", scope: "Historical integrity and actual service guard unit behavior; dependency doubles, not database integration", results }, null, 2));
console.log(JSON.stringify({ pass: results.length, total: results.length }));
