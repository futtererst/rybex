import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { boundary, context } from "./implementation-context.mjs";

const target = process.argv[2];
const credentials = {
  rybex: ".rybexos-local/m1-s1/d5o-config-admin-credentials.json",
  rotork: ".rybexos-local/m1-s1/d5o-rotork-config-admin-credentials.json",
};
if (!(target in credentials)) throw new Error("workspace_key_required");
boundary();

const actor = JSON.parse(readFileSync(credentials[target], "utf8"));
const source = readFileSync("components/d5o/platform/phase-configuration.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, structuredClone });
const contract = { schemaVersion: 1, workTypes: structuredClone(exports.stageAlignedPhaseConfigurationCatalog[target]) };
if (!contract.workTypes.length || contract.workTypes.some((item) => item.version !== "prototype-v2")) throw new Error("stage_contract_unavailable");
const contractSha256 = createHash("sha256").update(JSON.stringify(contract)).digest("hex");

const { anon } = await context();
const login = await anon.auth.signInWithPassword({ email: actor.email, password: actor.password });
if (login.error || login.data.user?.id !== actor.userId) throw new Error("synthetic_admin_login_failed");
const mapping = await anon.from("config_tenants").select("id,active_configuration_version_id")
  .eq("workspace_id", actor.workspace).neq("status", "archived");
if (mapping.error || mapping.data?.length !== 1) throw new Error("configuration_mapping_ambiguous");
const oldId = mapping.data[0].active_configuration_version_id;
const active = await anon.from("config_configuration_versions").select("id,status,config_manifest_json")
  .eq("id", oldId).single();
if (active.error || active.data?.status !== "published") throw new Error("published_source_unavailable");
const currentContract = active.data.config_manifest_json?.d5oPresentation?.phaseContract;
if (currentContract?.workTypes?.every((item) => item.version === "prototype-v2")) {
  console.log(JSON.stringify({ status: "ALREADY_ACTIVE", workspace: target, activeVersionId: oldId }));
  process.exit(0);
}
if (!currentContract?.workTypes?.every((item) => item.version === "prototype-v1")) throw new Error("unexpected_active_contract_generation");

const versions = await anon.from("config_configuration_versions")
  .select("id,status,config_manifest_json");
if (versions.error) throw new Error(`version_inventory_unavailable: ${versions.error.message}`);
const existing = (versions.data ?? []).filter((item) => item.status === "draft" && item.config_manifest_json?.d5oSourceVersionId === oldId);
if (existing.length) throw new Error("existing_source_draft_requires_review");

async function command(name, args) {
  const result = await anon.rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}

const draftId = (await command("d5o_configuration_create_draft_v1", {
  p_workspace: actor.workspace, p_expected_active: oldId,
})).draftVersionId;
if (!draftId) throw new Error("draft_identity_unavailable");
const draft = await anon.from("config_configuration_versions").select("config_manifest_json").eq("id", draftId).single();
if (draft.error || !draft.data) throw new Error("draft_manifest_unavailable");
const labels = active.data.config_manifest_json.d5oPresentation?.phaseLabels
  ?? Object.fromEntries(contract.workTypes[0].phases.map((phase) => [phase.key, phase.label]));
const manifest = {
  ...draft.data.config_manifest_json,
  d5oPresentation: {
    schemaVersion: 1, phaseLabels: labels,
    changeReason: "Align Discover qualification, Define baseline and Develop commercial work",
    phaseContract: contract,
  },
};
await command("d5o_configuration_save_draft_v1", { p_workspace: actor.workspace, p_draft: draftId, p_manifest: manifest });
const candidate = await command("d5o_configuration_publish_v1", {
  p_workspace: actor.workspace, p_draft: draftId, p_expected_active: oldId,
});
if (candidate.publishedVersionId !== draftId) throw new Error("candidate_identity_mismatch");
const activated = await command("d5o_configuration_activate_v1", {
  p_workspace: actor.workspace, p_candidate: draftId, p_expected_active: oldId,
});
if (activated.activeVersionId !== draftId) throw new Error("activation_identity_mismatch");
const verified = await anon.from("config_tenants").select("active_configuration_version_id")
  .eq("workspace_id", actor.workspace).single();
if (verified.error || verified.data?.active_configuration_version_id !== draftId) throw new Error("activation_not_visible");
console.log(JSON.stringify({ status: "PASS", workspace: target, previousVersionId: oldId,
  activeVersionId: draftId, contractSha256, workTypes: contract.workTypes.map((item) => item.workTypeKey) }));
