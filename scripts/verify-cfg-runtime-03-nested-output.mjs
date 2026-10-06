import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { prepareCfgRuntime03EvidenceOutput } from "./cfg-runtime-03-evidence-output.mjs";
import { resolveCfgRuntime03OutputDirectory } from "./cfg-runtime-03-repository-boundary.mjs";

const parent = prepareCfgRuntime03EvidenceOutput({ scriptUrl: import.meta.url });
let parentFinalized = false;
process.on("exit", () => { if (!parentFinalized) parent.abort(); });

const savedInvocation = process.env.CFG_RUNTIME_03_INVOCATION_ID;
const savedNestedParent = process.env.CFG_RUNTIME_03_NESTED_OUTPUT_PARENT;
try {
  process.env.CFG_RUNTIME_03_INVOCATION_ID = `${savedInvocation}-child`;
  process.env.CFG_RUNTIME_03_NESTED_OUTPUT_PARENT = parent.temporaryRoot;
  const child = prepareCfgRuntime03EvidenceOutput({ scriptUrl: import.meta.url });
  writeFileSync(join(child.temporaryRoot, "child-proof.txt"), "nested child output\n");
  child.finalize();
  const directOutput = resolveCfgRuntime03OutputDirectory(
    parent.root,
    process.env.CFG_RUNTIME_03_ACTIVE_RUN_ROOT,
    "direct-resolver-proof",
    { create: true },
  );
  writeFileSync(join(directOutput, "proof.txt"), "nested direct resolver output\n");
} finally {
  process.env.CFG_RUNTIME_03_INVOCATION_ID = savedInvocation;
  if (savedNestedParent === undefined) delete process.env.CFG_RUNTIME_03_NESTED_OUTPUT_PARENT;
  else process.env.CFG_RUNTIME_03_NESTED_OUTPUT_PARENT = savedNestedParent;
}

writeFileSync(join(parent.temporaryRoot, "parent-proof.txt"), "parent output\n");
const committed = parent.finalize();
parentFinalized = true;
console.log(`Nested output ownership verification passed: ${relative(process.cwd(), committed)}`);
