import { sql } from "./m1/implementation-context.mjs";

const workspaces = [
  ["rybex", "5488a1a7-d6eb-460c-88a4-4629d742d705"],
  ["rotork", "fd59e25e-8fa3-496c-8e1f-58a3f0c0fdb6"],
];
const results = [];
for (const [name, workspace] of workspaces) {
  const line = sql(`select jsonb_build_object(
    'active',t.active_configuration_version_id,
    'workTypes',jsonb_array_length(v.config_manifest_json->'d5oPresentation'->'phaseContract'->'workTypes'),
    'oldPins',(select count(*) from d5o_work_records wr where wr.workspace_id=t.workspace_id and wr.configuration_version_id<>t.active_configuration_version_id),
    'source',v.config_manifest_json->>'d5oSourceVersionId',
    'status',v.status)
    from config_tenants t join config_configuration_versions v on v.id=t.active_configuration_version_id
    where t.workspace_id='${workspace}' and t.status<>'archived'`);
  const rows = line.split(/\r?\n/).filter(Boolean);
  if (rows.length !== 1) throw new Error(`${name}: mapping_not_unique`);
  const result = JSON.parse(rows[0]);
  if (result.status !== "published" || result.workTypes !== 2 || !result.source) throw new Error(`${name}: phase_contract_not_published`);
  results.push({ workspace: name, ...result });
}
console.log(JSON.stringify({ status: "PASS", results }));
