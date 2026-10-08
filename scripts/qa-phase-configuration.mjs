import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../components/d5o/platform/phase-configuration.ts", import.meta.url), "utf8");
const policySource = fs.readFileSync(new URL("../components/d5o/platform/design-policy.ts", import.meta.url), "utf8");
const policyExports = {};
vm.runInNewContext(ts.transpileModule(policySource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: policyExports });
const deployPolicyExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../components/d5o/platform/deploy-policy.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: deployPolicyExports });
const operatePolicyExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../components/d5o/platform/operate-policy.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: operatePolicyExports });
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, structuredClone, require: (name) => ({ "./design-policy": policyExports, "./deploy-policy": deployPolicyExports, "./operate-policy": operatePolicyExports })[name] });
const { prototypePhaseConfigurations: packs, prototypeLifecycleConfigurations: lifecyclePacks, validatePhaseConfiguration: validate, evaluateRule: evaluate, resolvePrototypePhaseConfiguration: resolve } = exports;

for (const key of ["rybex", "rotork"]) {
  const pack = packs[key];
  assert.deepEqual(Array.from(pack.phases, (phase) => phase.key), ["discover", "define", "develop", "design", "deploy", "operate"]);
  assert.deepEqual(Array.from(validate(pack)), [], `${key} reference manifest must be structurally valid`);
  assert.equal(pack.schemaVersion, 1);
  assert.ok(pack.phases.find((phase) => phase.key === "define").components.find((item) => item.key === "commercial_source"));
  assert.deepEqual(Array.from(validate(lifecyclePacks[key])), [], `${key} lifecycle manifest must be structurally valid`);
}
assert.equal(resolve("rybex", "Technical delivery"), packs.rybex);
assert.equal(resolve("rotork", "modernization-service"), packs.rotork);
assert.equal(resolve("rybex", "Lifecycle service"), lifecyclePacks.rybex);
assert.equal(resolve("rotork", "Lifecycle service"), lifecyclePacks.rotork);
assert.equal(resolve("rybex", "Paid pilot"), null, "unconfigured work type must fail closed");
assert.equal(resolve("rotork", "Technical delivery"), null, "workspace mapping must not borrow another pack");

const define = packs.rybex.phases.find((phase) => phase.key === "define");
const commercialRule = define.components.find((item) => item.key === "commercial_source").rules[0];
const draft = { discovery: { estimate: { status: "Draft" } } };
const approved = { discovery: { estimate: { status: "Approved" } } };
assert.equal(evaluate(draft, commercialRule), false, "draft pricing cannot satisfy Define commercial review");
assert.equal(evaluate(approved, commercialRule), true, "approved pricing can satisfy the source rule");
assert.equal(evaluate(undefined, commercialRule), false, "missing Work Record must fail closed");
const relabeled = { ...commercialRule, message: "A new presentation label" };
assert.equal(evaluate(draft, relabeled), false, "a label change cannot alter authority");
assert.equal(evaluate(approved, relabeled), true, "a label change cannot alter authority");
const invalid = structuredClone(packs.rybex);
invalid.phases[1].components.push(structuredClone(invalid.phases[1].components[0]));
assert.ok(validate(invalid).some((message) => message.includes("Duplicate component key")));
const incompleteSchema = structuredClone(packs.rybex);
incompleteSchema.phases[1].components.find((item) => item.key === "scope_items").rules[0].fields = ["deliverable"];
assert.ok(validate(incompleteSchema).some((message) => message.includes("lacks valid register fields")), "required fields cannot be omitted from the rule");
const scopeRule = define.components.find((item) => item.key === "scope_items").rules[0];
assert.equal(evaluate({ definition: { registers: { scope_items: [] } } }, scopeRule), false, "empty register cannot satisfy review");
assert.equal(evaluate({ definition: { registers: { scope_items: [{ deliverable: "Cable", boundary: "", owner: "Lead" }] } } }, scopeRule), false, "incomplete register row cannot satisfy review");
assert.equal(evaluate({ definition: { registers: { scope_items: [{ deliverable: "Cable", boundary: "Building A", owner: "Lead" }] } } }, scopeRule), true, "complete structured row satisfies review");
console.log("Phase configuration contract: 4 workspace/work-type packs, 6 phases, exact Work Type resolution, structured register validation, draft/approved source guard, label invariance and collision guard PASS");
