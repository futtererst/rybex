import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(file) {
  const filePath = path.join(root, file);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

for (const file of [
  "lib/d5o/workflow-completion/business-outcome-types.ts",
  "lib/d5o/workflow-completion/business-outcomes.ts",
  "components/d5o/workflow-completion/WorkflowOutcomeRecordPanel.tsx",
  "components/d5o/workflow-completion/WorkflowHistoricalRecordPanel.tsx",
  "scripts/qa-workflow-business-outcomes.mjs",
  "docs/workflow-business-outcome-layer.md"
]) {
  if (!exists(file)) failures.push(`Missing workflow business outcome asset: ${file}`);
}

const registry = read("lib/d5o/workflow-completion/workflow-completion-registry.ts");
for (const workflowId of [
  "billing-backup-cash-recovery",
  "field-issue-escalation",
  "closeout-requirement-final-billing-release"
]) {
  if (!registry.includes(`id: "${workflowId}"`)) failures.push(`Registry missing workflow: ${workflowId}`);
}

for (const phrase of [
  "outcomeDefinition",
  "Billing backup completion and pay application readiness",
  "Field issue control and escalation",
  "Closeout requirement completion and acceptance readiness",
  "Pay App 003 / billing backup package",
  "Field issue from daily execution",
  "Closeout requirement / closeout package item"
]) {
  if (!registry.includes(phrase)) failures.push(`Registry missing outcome definition phrase: ${phrase}`);
}

const stateModel = read("lib/d5o/workflow-completion/completion-state-model.ts");
const reducer = read("lib/d5o/workflow-completion/completion-reducer.ts");
const provider = read("components/d5o/workflow-completion/WorkflowCompletionProvider.tsx");
for (const phrase of ["outcomeRecord", "generateWorkflowOutcomeRecord"]) {
  if (!stateModel.includes("outcomeRecord") && phrase === "outcomeRecord") failures.push("Completion state model missing outcomeRecord.");
  if (!reducer.includes(phrase)) failures.push(`Completion reducer missing ${phrase}.`);
}
if (!provider.includes("getOutcomeRecord")) failures.push("WorkflowCompletionProvider missing getOutcomeRecord.");

const panel = read("components/d5o/workflow-completion/WorkflowCompletionPanel.tsx");
for (const phrase of ["WorkflowOutcomeRecordPanel", "WorkflowHistoricalRecordPanel", "getOutcomeRecord"]) {
  if (!panel.includes(phrase)) failures.push(`WorkflowCompletionPanel missing ${phrase}.`);
}

const pilotCard = read("components/d5o/pilot/PilotWorkflowCard.tsx");
for (const phrase of ["pilot-workflow-outcome-summary", "pilot-workflow-next-business-step", "pilot-workflow-historical-record"]) {
  if (!pilotCard.includes(phrase)) failures.push(`Pilot card missing outcome summary marker: ${phrase}`);
}

const qa = read("scripts/qa-workflow-business-outcomes.mjs");
for (const phrase of [
  "workflow-outcome-record-panel",
  "workflow-historical-record-panel",
  "workflow-outcome-next-step-cta",
  "pilot-workflow-outcome-summary",
  "billing-v2-outcome-record",
  "billing-v2-historical-record",
  "Field issue control and escalation",
  "Closeout requirement completion and acceptance readiness"
]) {
  if (!qa.includes(phrase)) failures.push(`Workflow outcome QA missing assertion: ${phrase}`);
}

const packageJson = read("package.json");
for (const script of ["workflow-outcomes:qa", "workflow-outcomes:verify"]) {
  if (!packageJson.includes(`"${script}"`)) failures.push(`package.json missing ${script}.`);
}

const verifyAll = read("scripts/verify-all.mjs");
if (!verifyAll.includes("workflow-outcomes:verify")) failures.push("npm run verify must include workflow-outcomes:verify.");

const docs = [
  "docs/workflow-business-outcome-layer.md",
  "docs/workflow-completion-standard.md",
  "docs/workflow-completion-engine.md",
  "docs/workflow-editable-field-contract.md",
  "docs/pilot-mode-guided-operating-slice.md",
  "docs/pilot-slice-lockdown.md",
  "docs/pilot-slice-acceptance-report.md",
  "docs/demo-readiness.md",
  "docs/controlled-pilot-launch-plan.md",
  "docs/developer-notes.md",
  "README.md"
].map(read).join("\n");
for (const phrase of [
  "business outcome record",
  "historical record",
  "local/demo",
  "database pilot",
  "not production ready"
]) {
  if (!docs.toLowerCase().includes(phrase.toLowerCase())) failures.push(`Docs missing workflow outcome phrase: ${phrase}`);
}

if (failures.length > 0) {
  console.error("Workflow business outcome verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Workflow business outcome verification passed.");
