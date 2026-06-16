import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const registryPath = "lib/d5o/workflow-completion/workflow-completion-registry.ts";
const definitionPath = "lib/d5o/workflow-completion/definition-types.ts";
const qaContractsPath = "lib/d5o/workflow-completion/qa-contracts.ts";
const servicePath = "lib/d5o/workflow-completion/completion-service.ts";
const panelPath = "components/d5o/workflow-completion/WorkflowCompletionPanel.tsx";

for (const file of [registryPath, definitionPath, qaContractsPath, servicePath, panelPath]) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`Missing completion standardization file: ${file}`);
  }
}

const registry = read(registryPath);
for (const workflowId of [
  "billing-backup-cash-recovery",
  "field-issue-escalation",
  "closeout-requirement-final-billing-release"
]) {
  if (!registry.includes(`"${workflowId}"`)) {
    failures.push(`Registry missing workflow ${workflowId}.`);
  }
}

for (const requiredField of [
  "startState",
  "terminalStates",
  "states",
  "actions",
  "requiredEvidence",
  "linkedOutputTypes",
  "permissionRequirements",
  "notificationBehavior",
  "auditBehavior",
  "routeTarget",
  "focusKey",
  "qaSelectors",
  "qaContract",
  "localQaSupported",
  "databaseQaSupported",
  "databasePilotActionSelectors",
  "demoSeedData"
]) {
  if (!registry.includes(requiredField)) {
    failures.push(`Registry entries must include ${requiredField}.`);
  }
}

for (const phrase of [
  "CompletionWorkflowDefinition",
  "CompletionStateDefinition",
  "CompletionActionDefinition",
  "CompletionTransitionDefinition",
  "CompletionEvidenceRequirementDefinition",
  "CompletionLinkedOutputDefinition",
  "CompletionPermissionRule",
  "CompletionNotificationRule",
  "CompletionAuditRule",
  "CompletionQaContract"
]) {
  if (!read(definitionPath).includes(phrase)) {
    failures.push(`Definition types missing ${phrase}.`);
  }
}

const service = read(servicePath);
for (const phrase of [
  "getCompletionDefinitionForItem",
  "getAvailableCompletionActionDefinitions",
  "action.fromStates.includes",
  "action.toState",
  "action.resultMessage",
  "action.createsLinkedOutput"
]) {
  if (!service.includes(phrase)) {
    failures.push(`Completion service is not definition-driven enough; missing ${phrase}.`);
  }
}

const panel = read(panelPath);
for (const phrase of [
  "getCompletionDefinitionForItem",
  "getAvailableCompletionActionDefinitions",
  "definition.actions",
  "definition.qaSelectors",
  "GuidedCompletionFlow"
]) {
  if (!panel.includes(phrase)) {
    failures.push(`WorkflowCompletionPanel must render from definitions; missing ${phrase}.`);
  }
}

if (/if \(item\.workflowType === "field_issue_escalation"\)/.test(panel)) {
  failures.push("WorkflowCompletionPanel should not fork into a field-issue-only component branch.");
}

if (/if \(item\.workflowType === "billing_backup_blocker"\)/.test(panel)) {
  failures.push("WorkflowCompletionPanel should not fork into a billing-only component branch.");
}

const qaContracts = read(qaContractsPath);
for (const phrase of ["getCompletionQaContract", "getAllCompletionQaContracts"]) {
  if (!qaContracts.includes(phrase)) {
    failures.push(`QA contract module missing ${phrase}.`);
  }
}

const packageJson = read("package.json");
for (const script of [
  "workflow-completion:qa-all",
  "workflow-completion:verify-db",
  "workflow-completion:qa-db",
  "completion-registry:verify",
  "closeout-completion:verify"
]) {
  if (!packageJson.includes(`"${script}"`)) {
    failures.push(`package.json missing ${script}.`);
  }
}

if (failures.length > 0) {
  console.error("Completion registry verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Completion registry verification passed: registered flows, definitions, QA contracts, and definition-driven rendering are present.");

function read(file) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}
