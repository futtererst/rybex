import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "components/d5o/workflow-completion/GuidedCompletionFlow.tsx",
  "components/d5o/workflow-completion/WorkflowCompletionPanel.tsx",
  "lib/d5o/workflow-completion/editable-field-contracts.ts",
  "components/d5o/end-user/FocusedTaskPanel.tsx",
  "docs/manual-pilot-failure-billing-task.md",
  "scripts/qa-pilot-mode.mjs",
  "scripts/qa-workflow-completion.mjs"
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) {
    failures.push(`Missing required file: ${file}`);
  }
}

const guided = read("components/d5o/workflow-completion/GuidedCompletionFlow.tsx");
for (const phrase of [
  "Complete billing backup task",
  "Follow these steps to clear the billing blocker.",
  "Billing Backup Blocker -&gt; Pay Application Review Readiness",
  "billing-v2-business-process-guide",
  "billing-v2-business-object",
  "billing-v2-handoff-owner",
  "billing-v2-historical-record-location",
  "Return to Pilot Mode",
  "guided-completion-flow",
  "guided-completion-complete"
]) {
  if (!guided.includes(phrase)) {
    failures.push(`GuidedCompletionFlow missing visible phrase or selector: ${phrase}`);
  }
}

const fieldContracts = read("lib/d5o/workflow-completion/editable-field-contracts.ts");
for (const phrase of [
  "Backup note",
  "Evidence reference",
  "Resolution note",
  "backup-note-input",
  "billing-evidence-reference-input",
  "billing-resolution-note-input",
  "save-backup-note",
  "save-billing-evidence-reference",
  "save-billing-resolution-note"
]) {
  if (!fieldContracts.includes(phrase)) {
    failures.push(`Billing editable field contract missing: ${phrase}`);
  }
}

const registry = read("lib/d5o/workflow-completion/workflow-completion-registry.ts");
for (const phrase of [
  "billing-backup-cash-recovery",
  "Mark backup attached",
  "Send to review",
  "Resolve billing blocker",
  "mark-backup-attached",
  "send-to-review",
  "resolve-billing-blocker"
]) {
  if (!registry.includes(phrase)) {
    failures.push(`Billing completion registry missing guided task contract phrase: ${phrase}`);
  }
}

const panel = read("components/d5o/workflow-completion/WorkflowCompletionPanel.tsx");
if (!panel.includes("GuidedCompletionFlow")) {
  failures.push("WorkflowCompletionPanel must render GuidedCompletionFlow.");
}
if (!panel.includes("resetWorkflow")) {
  failures.push("WorkflowCompletionPanel must expose provider reset for completed pilot task clarity.");
}

const focusedTask = read("components/d5o/end-user/FocusedTaskPanel.tsx");
if (!focusedTask.includes("return-to-pilot-mode") || !focusedTask.includes("Return to Pilot Mode")) {
  failures.push("FocusedTaskPanel must include Return to Pilot Mode behavior.");
}

const pilotQa = read("scripts/qa-pilot-mode.mjs");
for (const phrase of [
  "runBillingManualFailureRegression",
  "Complete billing backup task",
  "backup-note-input",
  "billing-evidence-reference-input",
  "billing-resolution-note-input",
  "Mark backup attached",
  "Send to review",
  "Resolve billing blocker",
  "guided-completion-flow",
  "guided-completion-complete",
  "resolved"
]) {
  if (!pilotQa.includes(phrase)) {
    failures.push(`pilot-mode QA missing manual failure regression phrase: ${phrase}`);
  }
}

const workflowQa = read("scripts/qa-workflow-completion.mjs");
if (!workflowQa.includes("Guided completion flow visible")) {
  failures.push("workflow-completion QA must assert guided completion flow visibility.");
}

const docs = read("docs/manual-pilot-failure-billing-task.md");
for (const phrase of ["observed failure", "root cause", "fix applied", "before", "after"]) {
  if (!docs.toLowerCase().includes(phrase)) {
    failures.push(`Manual failure doc missing section: ${phrase}`);
  }
}

if (failures.length > 0) {
  console.error("Pilot billing task usability verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Pilot billing task usability verification passed.");

function read(file) {
  const filePath = resolve(root, file);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}
