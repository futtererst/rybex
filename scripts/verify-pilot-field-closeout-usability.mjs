import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "components/d5o/workflow-completion/GuidedCompletionFlow.tsx",
  "components/d5o/workflow-completion/WorkflowCompletionPanel.tsx",
  "components/d5o/workflow-completion/WorkflowCompletionProvider.tsx",
  "lib/d5o/workflow-completion/editable-field-contracts.ts",
  "docs/manual-pilot-failure-field-closeout.md",
  "scripts/qa-pilot-field-closeout-human-execution.mjs"
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) failures.push(`Missing required file: ${file}`);
}

const guided = read("components/d5o/workflow-completion/GuidedCompletionFlow.tsx");
for (const phrase of [
  "Escalate field issue",
  "Choose the control path for this field issue.",
  "Complete closeout requirement",
  "Satisfy this closeout item so acceptance and final billing can move.",
  "guided-editable-field-step",
  "Return to Pilot Mode"
]) {
  if (!guided.includes(phrase)) failures.push(`GuidedCompletionFlow missing human execution phrase: ${phrase}`);
}

const fieldContracts = read("lib/d5o/workflow-completion/editable-field-contracts.ts");
for (const phrase of [
  "Escalation note",
  "Closeout evidence note",
  "field-escalation-note-input",
  "save-field-escalation-note",
  "closeout-evidence-note-input",
  "save-closeout-evidence-note"
]) {
  if (!fieldContracts.includes(phrase)) failures.push(`Editable field contracts missing human execution phrase: ${phrase}`);
}

const registry = read("lib/d5o/workflow-completion/workflow-completion-registry.ts");
for (const phrase of [
  "Create RFI from field issue",
  "Create change event from field issue",
  "Mark issue controlled",
  "Resolve field issue",
  "Mark closeout evidence attached",
  "Send closeout item to review",
  "Resolve closeout blocker"
]) {
  if (!registry.includes(phrase)) failures.push(`Completion registry missing human execution action label: ${phrase}`);
}

const runtimeSupport = [
  read("components/d5o/workflow-completion/WorkflowCompletionPanel.tsx"),
  read("components/d5o/workflow-completion/WorkflowCompletionProvider.tsx"),
  read("lib/d5o/workflow-completion/adapters/local-demo-completion-adapter.ts")
].join("\n");
for (const phrase of [
  "saveField",
  "savedFields",
  "localDemoCompletionAdapter"
]) {
  if (!runtimeSupport.includes(phrase)) failures.push(`Workflow completion runtime missing saved-note support: ${phrase}`);
}

if (guided.includes("data-guided-field-save") || guided.includes("data-guided-action")) {
  failures.push("GuidedCompletionFlow should use React handlers, not bridge-only guided data attributes.");
}

const qa = read("scripts/qa-pilot-field-closeout-human-execution.mjs");
for (const phrase of [
  "runFieldIssueHumanFlow",
  "runCloseoutHumanFlow",
  "Saved escalation note:",
  "Saved closeout evidence note:",
  "Create RFI from field issue",
  "Mark issue controlled",
  "Resolve field issue",
  "Mark closeout evidence attached",
  "Send closeout item to review",
  "Resolve closeout blocker",
  "Complete",
  "resolved"
]) {
  if (!qa.includes(phrase)) failures.push(`Pilot Field/Closeout QA missing assertion phrase: ${phrase}`);
}

const docs = read("docs/manual-pilot-failure-field-closeout.md");
for (const phrase of ["observed field", "observed closeout", "defects", "root cause", "fix applied", "final expected behavior"]) {
  if (!docs.toLowerCase().includes(phrase)) failures.push(`Manual Field/Closeout doc missing section: ${phrase}`);
}

if (failures.length > 0) {
  console.error("Pilot Field/Closeout usability verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Pilot Field/Closeout usability verification passed.");

function read(file) {
  const path = resolve(root, file);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}
