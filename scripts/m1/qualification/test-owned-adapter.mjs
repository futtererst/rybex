import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { ownedGateAdapter } from "./owned-gate-adapter.mjs";
const original = process.env.M1_GATE_MANIFEST;
const m = JSON.parse(readFileSync(original, "utf8"));
const dir = mkdtempSync(join(m.evidence, "adapter-negative-"));
const results = [];
function test(name, fn) { fn(); results.push({ name, status: "PASS" }); }
try {
  process.env.M1_GATE_MODE = "owned";
  test("Valid manifest constructs adapter without mutation", () => assert(ownedGateAdapter()));
  process.env.M1_GATE_MANIFEST = "";
  test("Missing manifest fails closed", () => assert.throws(ownedGateAdapter));
  process.env.M1_GATE_MANIFEST = "relative.json";
  test("Relative manifest fails closed", () => assert.throws(ownedGateAdapter));
  for (const [name, patch] of [
    ["Shared project rejected", { project: "d5o-platform" }],
    ["Remote endpoint rejected", { api: "https://example.supabase.co" }],
    ["Alternate browser port rejected", { appPort: 61431 }],
    ["Alternate scanner port rejected", { scannerPort: 61431 }],
    ["Different source root rejected", { root: "C:/unapproved-source" }],
    ["Ownership checksum drift rejected", { ownershipSha256: "0".repeat(64) }],
    ["Base checksum drift rejected", { baseSha256: "0".repeat(64) }],
    ["Unsealed driver rejected", { driverSha256: "0".repeat(64) }],
    ["Migration checksum drift rejected", { replay: m.replay.map((x,i) => i === 0 ? { ...x, sha256: "0".repeat(64) } : x) }],
  ]) {
    const path = join(dir, "case.json");writeFileSync(path, JSON.stringify({ ...m, ...patch }));process.env.M1_GATE_MANIFEST = path;
    test(name, () => assert.throws(ownedGateAdapter));
  }
} finally { process.env.M1_GATE_MANIFEST = original; rmSync(dir, { recursive: true }); }
writeFileSync(resolve(m.evidence,"ADAPTER-NEGATIVE-RESULTS.json"),JSON.stringify(results,null,2));
console.log(JSON.stringify({pass:results.length,total:results.length}));
