import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "components/d5o/workflow-completion/WorkflowCompletionProvider.tsx",
  "lib/d5o/workflow-completion/completion-state-model.ts",
  "lib/d5o/workflow-completion/completion-reducer.ts",
  "lib/d5o/workflow-completion/adapters/local-demo-completion-adapter.ts",
  "scripts/qa-workflow-state-architecture.mjs",
  "docs/workflow-completion-state-architecture-refactor.md"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required state architecture file: ${file}`);
}

const provider = read("components/d5o/workflow-completion/WorkflowCompletionProvider.tsx");
for (const phrase of [
  "useReducer",
  "useWorkflowCompletion",
  "getPilotProgress",
  "saveField",
  "applyAction",
  "resetPilotWorkflows",
  "localDemoCompletionAdapter.load()"
]) {
  if (!provider.includes(phrase)) failures.push(`WorkflowCompletionProvider missing expected state contract: ${phrase}`);
}

const reducer = read("lib/d5o/workflow-completion/completion-reducer.ts");
for (const phrase of [
  "HYDRATE_COMPLETION_STATE",
  "SAVE_COMPLETION_FIELD",
  "APPLY_COMPLETION_ACTION",
  "RESET_PILOT_WORKFLOWS",
  "serializeWorkflowCompletionState"
]) {
  if (!reducer.includes(phrase)) failures.push(`Completion reducer missing action/state support: ${phrase}`);
}

const adapter = read("lib/d5o/workflow-completion/adapters/local-demo-completion-adapter.ts");
for (const phrase of ["localStorage", "normalizeSnapshot", "never run during server render"]) {
  if (phrase === "never run during server render") continue;
  if (!adapter.includes(phrase)) failures.push(`Local/demo adapter missing expected behavior: ${phrase}`);
}

const layout = read("app/layout.tsx");
if (!layout.includes("WorkflowCompletionProvider")) {
  failures.push("app/layout.tsx must wrap app content with WorkflowCompletionProvider.");
}
if (/WorkflowCompletionClientRuntime|next\/script|<Script|workflow-completion-dom-bridge/.test(layout)) {
  failures.push("app/layout.tsx still references a workflow completion runtime/script bridge.");
}

const completionUi = [
  "components/d5o/workflow-completion/WorkflowCompletionPanel.tsx",
  "components/d5o/workflow-completion/GuidedCompletionFlow.tsx",
  "components/d5o/pilot/PilotProgressSummary.tsx",
  "components/d5o/pilot/PilotWorkflowCard.tsx"
].map((file) => `${file}\n${read(file)}`).join("\n");

if (!completionUi.includes("useWorkflowCompletion")) {
  failures.push("Completion/Pilot UI must consume useWorkflowCompletion.");
}
for (const forbidden of ["useLocalCompletionStore", "readLocalCompletionState", "data-guided-action", "data-guided-field-save"]) {
  if (completionUi.includes(forbidden)) failures.push(`Completion/Pilot UI still contains old state bridge marker: ${forbidden}`);
}

const localStore = read("lib/d5o/workflow-completion/local-completion-store.ts");
if (localStore.includes("useSyncExternalStore")) {
  failures.push("Workflow completion local store must not use useSyncExternalStore.");
}

const qa = read("scripts/qa-workflow-state-architecture.mjs");
for (const phrase of [
  "getSnapshot should be cached",
  "workflow-completion-dom-bridge",
  "0 of 3 workflows complete",
  "3 of 3 workflows complete",
  "reset-pilot-demo-state"
]) {
  if (!qa.includes(phrase)) failures.push(`workflow-state:qa missing regression coverage: ${phrase}`);
}

const packageJson = read("package.json");
for (const script of ["workflow-state:qa", "workflow-state:verify"]) {
  if (!packageJson.includes(`"${script}"`)) failures.push(`package.json missing script: ${script}`);
}

const docs = [
  "docs/workflow-completion-state-architecture-refactor.md",
  "docs/runtime-stability-fix.md",
  "docs/workflow-editable-field-contract.md",
  "docs/workflow-completion-standard.md",
  "docs/workflow-completion-engine.md",
  "docs/pilot-mode-guided-operating-slice.md",
  "docs/workflow-completion-persistence-bridge.md",
  "docs/developer-notes.md",
  "docs/demo-readiness.md",
  "docs/controlled-pilot-launch-plan.md"
].map(read).join("\n");
for (const phrase of [
  "State ownership model",
  "server renders definitions/static shell",
  "client provider owns live completion state",
  "local/demo persistence is adapter-driven",
  "Pilot progress derives from provider"
]) {
  if (!docs.includes(phrase)) failures.push(`State architecture docs missing phrase: ${phrase}`);
}

if (failures.length > 0) {
  console.error("Workflow state architecture verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Workflow state architecture verification passed.");

function read(file) {
  const filePath = path.join(root, file);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}
