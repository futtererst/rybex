import { readFileSync } from "node:fs";
import { analyzePrototypeSnapshot } from "./preflight-prototype-snapshot.mjs";
import { q, sql } from "./implementation-context.mjs";

const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/m1/assess-prototype-configuration.mjs <snapshot.json>");
const snapshot = analyzePrototypeSnapshot(JSON.parse(readFileSync(source, "utf8")));
const fixtures = JSON.parse(readFileSync("artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01/FIXTURE-PLAN-8beb15ad.json", "utf8"));
const fixture = fixtures.scenarios.find((item) => item.name === snapshot.workspace);
if (!fixture?.workspace) throw new Error("unknown_synthetic_workspace");

// This is an inventory of published configuration, not an import or a substitute
// for the authenticated command resolver. In particular, label equality cannot
// establish that a browser-local decision or proof has canonical authority.
const rows = JSON.parse(sql(`select coalesce(jsonb_agg(jsonb_build_object(
  'tenantId',t.id,'tenantStatus',t.status,'activeVersionId',t.active_configuration_version_id,
  'versionId',v.id,'versionStatus',v.status,'versionNumber',v.version,
  'workTypeKey',wt.work_item_type_key,'workTypeLabel',wt.label,
  'gateKey',wt.lifecycle_json->>'gateKey',
  'initialState',wt.lifecycle_json->>'initialState',
  'completeState',wt.lifecycle_json->>'completeState',
  'gatePresent',exists(select 1 from public.config_gate_definitions g
    where g.configuration_version_id=v.id and g.gate_key=wt.lifecycle_json->>'gateKey' and g.status='active')
  ) order by t.id,v.version,wt.work_item_type_key),'[]'::jsonb)
  from public.config_tenants t
  left join public.config_configuration_versions v on v.id=t.active_configuration_version_id
  left join public.config_work_item_type_definitions wt
    on wt.configuration_version_id=v.id and wt.status='active'
  where t.workspace_id=${q(fixture.workspace)}::uuid and t.status<>'archived';`));
const tenantIds = [...new Set(rows.map((row) => row.tenantId))];
const tenantResolution = tenantIds.length === 1 ? "ONE_ELIGIBLE_TENANT" : tenantIds.length === 0 ? "NO_ELIGIBLE_TENANT" : "AMBIGUOUS_TENANTS";
const records = snapshot.records.map((record) => {
  const candidates = rows.filter((row) => row.workTypeLabel === record.presentedType && row.gatePresent
    && row.versionStatus === "published" && ["active", "published"].includes(row.tenantStatus));
  const possible = candidates.map((row) => ({
    workTypeKey: row.workTypeKey, gateKey: row.gateKey, configurationVersionId: row.versionId,
    initialState: row.initialState, completeState: row.completeState,
    presentedStateMatch: record.presentedStage === row.initialState ? "INITIAL" : record.presentedStage === row.completeState ? "COMPLETE" : "NONE"
  }));
  return {
    sourceKey: record.sourceKey, title: record.title,
    presentedType: record.presentedType, presentedStage: record.presentedStage,
    candidates: possible,
    disposition: tenantResolution !== "ONE_ELIGIBLE_TENANT" ? "TENANT_RESOLUTION_FAILURE"
      : possible.length === 0 ? "NO_COMPATIBLE_PUBLISHED_WORK_TYPE"
      : possible.length > 1 ? "AMBIGUOUS_WORK_TYPE_LABEL"
      : possible[0].presentedStateMatch === "NONE" ? "STAGE_NOT_REPRESENTED_BY_ONE_GATE_CONTRACT"
      : "CONFIGURATION_CANDIDATE_ONLY — proof, authority and history still unverified"
  };
});
console.log(JSON.stringify({
  workspace: snapshot.workspace, workspaceId: fixture.workspace,
  sourceSha256: snapshot.sourceSha256, tenantResolution,
  activeConfigurationRows: rows, records,
  importDecision: "NOT_READY — no browser-local fact, proof or decision is authoritative"
}, null, 2));
