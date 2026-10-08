import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { sql, j } from "./m1/implementation-context.mjs";

const source = readFileSync("components/d5o/platform/phase-configuration.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const policySource = readFileSync("components/d5o/platform/design-policy.ts", "utf8");
const policyCompiled = ts.transpileModule(policySource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const policyExports = {};
vm.runInNewContext(policyCompiled, { exports: policyExports });
const exports = {};
vm.runInNewContext(compiled, { exports, require: (key) => key === "./design-policy" ? policyExports : undefined, structuredClone });
const contract = { schemaVersion: 1, workTypes: exports.prototypePhaseConfigurationCatalog.rybex };
const manifest = { synthetic: true, d5oPresentation: { schemaVersion: 1, phaseLabels: { discover: "Discover", define: "Define" }, changeReason: "Synthetic phase contract verification", phaseContract: contract } };
const result = sql(`select rybex_internal.d5o_configuration_manifest_check(${j(manifest)}); select 'valid_contract_pass';`);
if (!result.includes("valid_contract_pass")) throw new Error(`valid_contract_rejected: ${result}`);
const invalid = structuredClone(manifest);
invalid.d5oPresentation.phaseContract.workTypes[0].phases[1].components.find((item) => item.key === "commercial_source").rules[0].fact = "bad.fact";
const denied = sql(`do $$ begin
  begin perform rybex_internal.d5o_configuration_manifest_check(${j(invalid)});
    raise exception 'invalid_contract_accepted';
  exception when others then if sqlerrm <> 'invalid_phase_rule' then raise; end if; end;
end $$; select 'invalid_contract_rejected';`);
if (!denied.includes("invalid_contract_rejected")) throw new Error(`invalid_contract_not_rejected: ${denied}`);
console.log("Published phase contract database manifest: valid contract PASS; invalid fact rejected PASS");
