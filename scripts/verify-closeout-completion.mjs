import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "lib/d5o/workflow-completion/types.ts",
  "lib/d5o/workflow-completion/definition-types.ts",
  "lib/d5o/workflow-completion/workflow-completion-registry.ts",
  "lib/d5o/workflow-completion/completion-service.ts",
  "lib/d5o/workflow-completion/local-completion-store.ts",
  "components/d5o/workflow-completion/WorkflowCompletionPanel.tsx",
  "components/d5o/end-user/FocusedTaskPanel.tsx",
  "lib/d5o/end-user/task-outcome-contract.ts",
  "lib/d5o/end-user/derive-primary-action.ts",
  "scripts/qa-closeout-completion.mjs",
  "docs/workflow-completion-standard.md",
  "docs/workflow-completion-engine.md",
  "docs/workflow-completion-expansion-plan.md",
  "docs/closeout-requirement-completion-workflow-trace.md",
  "docs/closeout-completion-qa-report.md"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`Missing required closeout completion file: ${file}`);
  }
}

const packageJson = read("package.json");
for (const script of ["closeout-completion:qa", "closeout-completion:verify"]) {
  if (!packageJson.includes(`"${script}"`)) {
    failures.push(`package.json must include ${script}.`);
  }
}

const verifyAll = read("scripts/verify-all.mjs");
for (const script of ["workflow-completion:verify", "completion-registry:verify", "closeout-completion:verify"]) {
  if (!verifyAll.includes(script)) {
    failures.push(`npm run verify must include ${script}.`);
  }
}

const typesSource = read("lib/d5o/workflow-completion/types.ts");
for (const phrase of [
  "closeout_requirement_completion",
  "closeout_release",
  "mark_closeout_evidence_attached",
  "waive_closeout_requirement",
  "send_closeout_item_to_review",
  "resolve_closeout_blocker",
  "reopen_closeout_blocker",
  "closeout_package_update",
  "final_billing_release_note"
]) {
  if (!typesSource.includes(phrase)) {
    failures.push(`Workflow completion types must include ${phrase}.`);
  }
}

const registrySource = read("lib/d5o/workflow-completion/workflow-completion-registry.ts");
for (const phrase of [
  "closeout-requirement-final-billing-release",
  "Missing as-built redline package for Fiber Backbone Segment A",
  "Closeout evidence marked attached",
  "Closeout item sent to review",
  "Closeout blocker resolved. Acceptance and final billing can proceed for this item.",
  "Final billing release note",
  "closeout-completion-panel",
  "closeout-state",
  "mark-closeout-evidence-attached",
  "send-closeout-item-to-review",
  "resolve-closeout-blocker",
  "closeout-linked-output-record",
  "closeout-result-banner",
  "qaContract"
]) {
  if (!registrySource.includes(phrase)) {
    failures.push(`Completion registry missing closeout phrase: ${phrase}.`);
  }
}

const serviceSource = read("lib/d5o/workflow-completion/completion-service.ts");
for (const phrase of [
  "getCloseoutCompletionContext",
  "getCloseoutProofAction",
  "getCloseoutProofFocusId",
  "getCompletionDefinitionForItem",
  "action.createsLinkedOutput"
]) {
  if (!serviceSource.includes(phrase)) {
    failures.push(`Completion service must include closeout definition helper: ${phrase}.`);
  }
}

const panelSource = read("components/d5o/workflow-completion/WorkflowCompletionPanel.tsx");
for (const phrase of [
  "definition.qaSelectors.completionPanel",
  "definition.qaSelectors.state",
  "action.qaSelector",
  "definition.qaSelectors.linkedOutput",
  "displayFacts",
  "reopen_closeout_blocker"
]) {
  if (!panelSource.includes(phrase)) {
    failures.push(`WorkflowCompletionPanel must support closeout through definitions: ${phrase}.`);
  }
}

const focusedSource = read("components/d5o/end-user/FocusedTaskPanel.tsx");
for (const phrase of ["getCloseoutCompletionContext", "getCloseoutProofFocusId", "WorkflowCompletionPanel"]) {
  if (!focusedSource.includes(phrase)) {
    failures.push(`FocusedTaskPanel must include ${phrase}.`);
  }
}

const outcomeSource = read("lib/d5o/end-user/task-outcome-contract.ts");
for (const phrase of [
  "Complete closeout requirement",
  "closeout_requirement_completion",
  "getCloseoutProofFocusId",
  "closeout-requirement-final-billing-release"
]) {
  if (!outcomeSource.includes(phrase)) {
    failures.push(`Task outcome contract must include ${phrase}.`);
  }
}

const primaryActionSource = read("lib/d5o/end-user/derive-primary-action.ts");
if (!primaryActionSource.includes("getCloseoutProofAction")) {
  failures.push("Closeout primary action must use getCloseoutProofAction.");
}

const qaSource = read("scripts/qa-closeout-completion.mjs");
for (const phrase of [
  "/closeout?focus=closeout-requirement-final-billing-release#focused-task",
  "Mark closeout evidence attached",
  "Send closeout item to review",
  "Resolve closeout blocker"
]) {
  if (!qaSource.includes(phrase)) {
    failures.push(`Closeout QA script must include ${phrase}.`);
  }
}

const allQaSource = read("scripts/qa-all-completion-workflows.mjs");
if (!allQaSource.includes("closeout-requirement-final-billing-release")) {
  failures.push("workflow-completion:qa-all must include the closeout proof flow.");
}

const rbacSource = read("lib/d5o/rbac.ts");
for (const permission of [
  "edit_closeout",
  "edit_evidence",
  "waive_evidence_requirement",
  "resolve_workflow_action"
]) {
  if (!rbacSource.includes(`"${permission}"`)) {
    failures.push(`RBAC is missing closeout permission ${permission}.`);
  }
}

const docs = [
  "docs/workflow-completion-standard.md",
  "docs/workflow-completion-engine.md",
  "docs/workflow-completion-expansion-plan.md",
  "docs/closeout-requirement-completion-workflow-trace.md",
  "docs/closeout-completion-qa-report.md"
].map((file) => read(file)).join("\n");
for (const phrase of [
  "Closeout Requirement",
  "Acceptance / Final Billing Release",
  "local/demo",
  "not database-backed"
]) {
  if (!docs.includes(phrase)) {
    failures.push(`Closeout completion docs must include ${phrase}.`);
  }
}

if (failures.length > 0) {
  console.error("Closeout completion verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Closeout completion verification passed: proof flow, selectors, scripts, and docs are wired.");

function read(file) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}
