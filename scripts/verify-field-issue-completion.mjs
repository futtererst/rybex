import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "lib/d5o/workflow-completion/types.ts",
  "lib/d5o/workflow-completion/completion-service.ts",
  "lib/d5o/workflow-completion/local-completion-store.ts",
  "components/d5o/workflow-completion/WorkflowCompletionPanel.tsx",
  "components/d5o/end-user/FocusedTaskPanel.tsx",
  "lib/d5o/end-user/task-outcome-contract.ts",
  "lib/d5o/end-user/derive-primary-action.ts",
  "scripts/qa-field-issue-completion.mjs",
  "docs/workflow-completion-expansion-plan.md",
  "docs/field-issue-escalation-workflow-trace.md",
  "docs/field-issue-completion-qa-report.md"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`Missing required field issue completion file: ${file}`);
  }
}

const packageJson = read("package.json");
for (const script of ["field-issue-completion:qa", "field-issue-completion:verify"]) {
  if (!packageJson.includes(`"${script}"`)) {
    failures.push(`package.json must include ${script}.`);
  }
}

const verifyAll = read("scripts/verify-all.mjs");
for (const script of ["workflow-completion:verify", "field-issue-completion:verify"]) {
  if (!verifyAll.includes(script)) {
    failures.push(`npm run verify must include ${script}.`);
  }
}

const typesSource = read("lib/d5o/workflow-completion/types.ts");
for (const phrase of [
  "field_issue_escalation",
  "create_rfi_from_field_issue",
  "create_change_event_from_field_issue",
  "mark_field_issue_controlled",
  "resolve_field_issue",
  "WorkflowCompletionLinkedOutput",
  "WorkflowCompletionSourceIssue"
]) {
  if (!typesSource.includes(phrase)) {
    failures.push(`Workflow completion types must include ${phrase}.`);
  }
}

const serviceSource = read("lib/d5o/workflow-completion/completion-service.ts");
const registrySource = read("lib/d5o/workflow-completion/workflow-completion-registry.ts");
for (const phrase of [
  "getCompletionDefinitionForItem",
  "getAvailableCompletionActionDefinitions",
  "action.resultMessage"
]) {
  if (!serviceSource.includes(phrase)) {
    failures.push(`Completion service must use definition-driven field proof logic: ${phrase}.`);
  }
}

for (const phrase of [
  "field-issue-escalation",
  "Unclear conduit routing discovered in Zone B",
  "RFI draft created from field issue",
  "Change event draft created from field issue",
  "Field issue marked controlled",
  "Field issue resolved"
]) {
  if (!registrySource.includes(phrase)) {
    failures.push(`Completion registry missing field proof phrase: ${phrase}.`);
  }
}

const panelSource = read("components/d5o/workflow-completion/WorkflowCompletionPanel.tsx");
for (const selector of [
  "definition.qaSelectors.completionPanel",
  "definition.qaSelectors.state",
  "action.qaSelector",
  "definition.qaSelectors.linkedOutput",
  "definition.qaSelectors.resultBanner"
]) {
  if (!panelSource.includes(selector)) {
    failures.push(`WorkflowCompletionPanel must render selector from definition: ${selector}.`);
  }
}

const focusedSource = read("components/d5o/end-user/FocusedTaskPanel.tsx");
for (const phrase of ["getFieldIssueCompletionContext", "getFieldIssueProofFocusId", "WorkflowCompletionPanel"]) {
  if (!focusedSource.includes(phrase)) {
    failures.push(`FocusedTaskPanel must include ${phrase}.`);
  }
}

const outcomeSource = read("lib/d5o/end-user/task-outcome-contract.ts");
for (const phrase of ["Escalate field issue", "field_issue_escalation", "getFieldIssueProofFocusId"]) {
  if (!outcomeSource.includes(phrase)) {
    failures.push(`Task outcome contract must include ${phrase}.`);
  }
}

const primaryActionSource = read("lib/d5o/end-user/derive-primary-action.ts");
if (!primaryActionSource.includes("getFieldIssueProofAction")) {
  failures.push("Field Execution primary action must use getFieldIssueProofAction.");
}

const qaSource = read("scripts/qa-field-issue-completion.mjs");
for (const phrase of [
  "/field-execution?focus=field-issue-escalation#focused-task",
  "Create RFI from field issue",
  "Mark issue controlled",
  "Resolve field issue"
]) {
  if (!qaSource.includes(phrase)) {
    failures.push(`Field issue QA script must include ${phrase}.`);
  }
}

const rbacSource = read("lib/d5o/rbac.ts");
for (const permission of [
  "submit_daily_report",
  "edit_rfis_submittals",
  "edit_changes",
  "resolve_workflow_action"
]) {
  if (!rbacSource.includes(`"${permission}"`)) {
    failures.push(`RBAC is missing field issue permission ${permission}.`);
  }
}

const docs = [
  "docs/workflow-completion-expansion-plan.md",
  "docs/field-issue-escalation-workflow-trace.md",
  "docs/field-issue-completion-qa-report.md"
].map((file) => read(file)).join("\n");
for (const phrase of [
  "Field Issue",
  "RFI / Change",
  "local/demo",
  "not database-backed"
]) {
  if (!docs.includes(phrase)) {
    failures.push(`Field issue completion docs must include ${phrase}.`);
  }
}

if (failures.length > 0) {
  console.error("Field issue completion verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Field issue completion verification passed: proof flow, selectors, scripts, and docs are wired.");

function read(file) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}
