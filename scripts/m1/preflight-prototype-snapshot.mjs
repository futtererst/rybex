import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const packs = {
  rybex: "config/template-packs/d5o-m1-proof-rybex-v1.json",
  rotork: "config/template-packs/d5o-m1-proof-rotork-v1.json"
};

export function analyzePrototypeSnapshot(envelope) {
  assert(envelope && typeof envelope === "object", "snapshot envelope required");
  const { payload, payloadSha256 } = envelope;
  assert(payload && typeof payload === "object" && typeof payloadSha256 === "string", "invalid snapshot envelope");
  assert.equal(createHash("sha256").update(JSON.stringify(payload)).digest("hex"), payloadSha256, "snapshot checksum mismatch");
  assert.equal(payload.format, "d5o-prototype-source-snapshot-v1");
  assert.equal(payload.authority, "presentation-state-only");
  assert(payload.workspace === "rybex" || payload.workspace === "rotork", "unknown workspace");
  assert(Array.isArray(payload.records), "records required");
  assert(payload.prototypeConfiguration && Array.isArray(payload.prototypeConfiguration.workTypes), "prototype Work Type settings missing");
  assert(payload.sharedCatalog && payload.sharedCatalog.workspace === payload.workspace, "shared catalog missing or cross-workspace");
  assert(payload.scheduleReferences && payload.scheduleReferences.workspace === payload.workspace
    && Array.isArray(payload.scheduleReferences.assignments)
    && Array.isArray(payload.scheduleReferences.packageDemands), "shared schedule missing");
  const pack = JSON.parse(readFileSync(packs[payload.workspace], "utf8"));
  const ids = new Set();
  const packageIds = new Set();
  const packageOwners = new Map();
  const records = payload.records.map((item) => {
    assert.equal(item.source?.system, "d5o-local-prototype");
    assert.equal(item.source?.type, "work_record");
    assert.equal(item.canonicalWorkId, null, "snapshot cannot assert a canonical binding");
    assert.equal(item.presentation?.workspace, payload.workspace, "cross-workspace record");
    assert.equal(item.source.key, item.presentation.id, "source identity mismatch");
    assert(!ids.has(item.source.key), "duplicate source identity");
    ids.add(item.source.key);
    const packages = item.presentation.packages ?? [];
    assert(Array.isArray(packages), "invalid package list");
    for (const workPackage of packages) {
      assert(typeof workPackage.id === "string" && workPackage.id, "invalid package identity");
      assert(!packageIds.has(workPackage.id), "duplicate package identity");
      packageIds.add(workPackage.id);
      packageOwners.set(workPackage.id, item.source.key);
    }
    return {
      sourceKey: item.source.key,
      title: item.presentation.title,
      presentedType: item.presentation.type,
      typePresentInPrototypeSettings: payload.prototypeConfiguration.workTypes.includes(item.presentation.type),
      presentedStage: item.presentation.stage,
      packageCount: packages.length,
      configurationFit: item.presentation.type === pack.workType.label
        ? "TYPE_MATCH_ONLY — state, proof and authority still require reconciliation"
        : "COMPATIBLE_WORK_TYPE_CONFIGURATION_REQUIRED",
      canonicalWorkId: null
    };
  });
  assert(Array.isArray(payload.sharedCatalog.records) && Array.isArray(payload.sharedCatalog.packages), "invalid shared catalog");
  for (const record of payload.sharedCatalog.records) {
    assert(record.workspace === payload.workspace && ids.has(record.id), "catalog record missing from presentation snapshot");
  }
  for (const workPackage of payload.sharedCatalog.packages) {
    assert(packageOwners.get(workPackage.id) === workPackage.workId, "catalog package missing or attached to another Work Record");
  }
  const schedule = payload.scheduleReferences;
  const unresolvedReferences = [];
  if (schedule) {
    for (const demand of schedule.packageDemands ?? []) {
      if (!ids.has(demand.workId) || packageOwners.get(demand.packageId) !== demand.workId)
        unresolvedReferences.push({ kind: "package_demand", workId: demand.workId, packageId: demand.packageId });
    }
    for (const assignment of schedule.assignments ?? []) {
      if (!ids.has(assignment.workId) || packageOwners.get(assignment.packageId) !== assignment.workId)
        unresolvedReferences.push({ kind: "crew_assignment", workId: assignment.workId, packageId: assignment.packageId });
    }
  }
  return {
    workspace: payload.workspace,
    browserOrigin: payload.browserOrigin ?? "UNRECORDED — older snapshot",
    sourceSha256: payloadSha256,
    recordCount: records.length,
    records,
    unresolvedReferences,
    importDecision: "NOT_READY — explicit canonical identity, configuration, state and proof reconciliation required",
    sourceOnly: true
  };
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/preflight-prototype-snapshot.mjs")) {
  const source = process.argv[2];
  if (!source) throw new Error("Usage: node scripts/m1/preflight-prototype-snapshot.mjs <snapshot.json>");
  console.log(JSON.stringify(analyzePrototypeSnapshot(JSON.parse(readFileSync(source, "utf8"))), null, 2));
}
