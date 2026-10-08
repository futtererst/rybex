import { readFileSync } from "node:fs";
import { analyzePrototypeSnapshot } from "./preflight-prototype-snapshot.mjs";
import { q, sql } from "./implementation-context.mjs";

const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/m1/check-prototype-source-bindings.mjs <snapshot.json>");
const preflight = analyzePrototypeSnapshot(JSON.parse(readFileSync(source, "utf8")));
const fixtures = JSON.parse(readFileSync("artifacts/d5o-m1-s1-implementation-20260928T004316Z/domain-implementation-20260928-01/FIXTURE-PLAN-8beb15ad.json", "utf8"));
const fixture = fixtures.scenarios.find((item) => item.name === preflight.workspace);
if (!fixture?.workspace) throw new Error("unknown_synthetic_workspace");
const keys = preflight.records.map((record) => q(record.sourceKey)).join(",");
const query = `select coalesce(jsonb_agg(jsonb_build_object(
  'sourceKey',s.source_key,'workId',s.work_id,'title',w.title,
  'workTypeKey',w.work_type_key,'gateKey',w.gate_key,
  'configurationVersionId',w.configuration_version_id,'lifecycleState',w.lifecycle_state
) order by s.source_key),'[]'::jsonb)
from public.d5o_work_sources s
join public.d5o_work_records w on w.id=s.work_id and w.workspace_id=s.workspace_id
where s.workspace_id=${q(fixture.workspace)}::uuid
  and s.source_system='d5o-local-prototype' and s.entity_type='work_record'
  and s.source_key in (${keys || "null"});`;
const bindings = JSON.parse(sql(query));
const byKey = new Map(bindings.map((item) => [item.sourceKey, item]));
const records = preflight.records.map((record) => ({
  sourceKey: record.sourceKey,
  presentedType: record.presentedType,
  presentedStage: record.presentedStage,
  configurationFit: record.configurationFit,
  binding: byKey.get(record.sourceKey) ?? null,
  disposition: byKey.has(record.sourceKey) ? "RECONCILE_EXISTING_BINDING" : "UNMAPPED — DO NOT INFER IDENTITY"
}));
console.log(JSON.stringify({
  workspace: preflight.workspace,
  workspaceId: fixture.workspace,
  sourceSha256: preflight.sourceSha256,
  recordCount: records.length,
  boundCount: bindings.length,
  records,
  importDecision: "NOT_READY — configuration, history, proof and authority reconciliation required"
}, null, 2));
