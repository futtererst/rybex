import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "lib/d5o/workflow-completion/types.ts",
  "lib/d5o/workflow-completion/definition-types.ts",
  "lib/d5o/workflow-completion/workflow-completion-registry.ts",
  "lib/d5o/workflow-completion/qa-contracts.ts",
  "lib/d5o/workflow-completion/completion-service.ts",
  "lib/d5o/workflow-completion/completion-store-mode.ts",
  "lib/d5o/workflow-completion/database-completion-store.ts",
  "lib/d5o/workflow-completion/local-completion-store.ts",
  "app/actions/workflow-completions.ts",
  "components/d5o/workflow-completion/WorkflowCompletionPanel.tsx",
  "components/d5o/workflow-completion/EvidenceResolutionControl.tsx",
  "components/d5o/workflow-completion/CompletionProgressStepper.tsx",
  "components/d5o/workflow-completion/CompletionResultBanner.tsx",
  "scripts/qa-workflow-completion.mjs",
  "scripts/qa-field-issue-completion.mjs",
  "scripts/qa-closeout-completion.mjs",
  "scripts/verify-workflow-completion-db.mjs",
  "scripts/qa-workflow-completion-db.mjs",
  "scripts/qa-all-completion-workflows.mjs",
  "docs/workflow-completion-engine.md",
  "docs/billing-backup-workflow-trace.md",
  "docs/workflow-completion-expansion-plan.md",
  "docs/field-issue-escalation-workflow-trace.md",
  "docs/closeout-requirement-completion-workflow-trace.md",
  "docs/workflow-completion-qa-report.md"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`Missing required workflow completion file: ${file}`);
  }
}

const packageJson = read("package.json");
if (!packageJson.includes('"workflow-completion:qa"')) {
  failures.push("package.json must include workflow-completion:qa.");
}
if (!packageJson.includes('"workflow-completion:verify"')) {
  failures.push("package.json must include workflow-completion:verify.");
}
if (!packageJson.includes('"workflow-completion:qa-all"')) {
  failures.push("package.json must include workflow-completion:qa-all.");
}
if (!packageJson.includes('"workflow-completion:verify-db"')) {
  failures.push("package.json must include workflow-completion:verify-db.");
}
if (!packageJson.includes('"workflow-completion:qa-db"')) {
  failures.push("package.json must include workflow-completion:qa-db.");
}
if (!packageJson.includes('"completion-registry:verify"')) {
  failures.push("package.json must include completion-registry:verify.");
}
if (!packageJson.includes('"field-issue-completion:qa"')) {
  failures.push("package.json must include field-issue-completion:qa.");
}
if (!packageJson.includes('"field-issue-completion:verify"')) {
  failures.push("package.json must include field-issue-completion:verify.");
}
if (!packageJson.includes('"closeout-completion:qa"')) {
  failures.push("package.json must include closeout-completion:qa.");
}
if (!packageJson.includes('"closeout-completion:verify"')) {
  failures.push("package.json must include closeout-completion:verify.");
}

const cockpitSource = read("components/d5o/end-user/ActionCockpit.tsx");
if (!cockpitSource.includes("taskOutcome.focusId")) {
  failures.push("ActionCockpit must dispatch task focus from task outcome metadata.");
}

const focusedSource = read("components/d5o/end-user/FocusedTaskPanel.tsx");
for (const phrase of ["WorkflowCompletionPanel", "You are here to", "workflowCompletionId"]) {
  if (!focusedSource.includes(phrase)) {
    failures.push(`FocusedTaskPanel must include ${phrase}.`);
  }
}

const outcomeSource = read("lib/d5o/end-user/task-outcome-contract.ts");
for (const phrase of [
  "Add missing billing backup",
  "Complete closeout requirement",
  "workflowCompletionId",
  "billing_backup_blocker",
  "closeout_requirement_completion",
  "getBillingBackupProofFocusId"
]) {
  if (!outcomeSource.includes(phrase)) {
    failures.push(`Task outcome contract must include ${phrase}.`);
  }
}

const serviceSource = read("lib/d5o/workflow-completion/completion-service.ts");
for (const phrase of [
  "getCompletionDefinitionForItem",
  "getAvailableCompletionActionDefinitions",
  "action.fromStates.includes",
  "action.toState",
  "action.resultMessage",
  "appendLinkedOutput"
]) {
  if (!serviceSource.includes(phrase)) {
    failures.push(`Completion service missing definition-driven phrase: ${phrase}.`);
  }
}

const storeModeSource = read("lib/d5o/workflow-completion/completion-store-mode.ts");
for (const phrase of ["RYBEXOS_WORKFLOW_COMPLETION_STORE", "database", "local"]) {
  if (!storeModeSource.includes(phrase)) {
    failures.push(`Completion store mode helper must include ${phrase}.`);
  }
}

const databaseStoreSource = read("lib/d5o/workflow-completion/database-completion-store.ts");
for (const phrase of [
  "workflow_transactions",
  "workflow_instances",
  "workflow_evidence_requirements",
  "audit_events",
  "status_history",
  "project_id",
  "rybexos_completion_pilot"
]) {
  if (!databaseStoreSource.includes(phrase)) {
    failures.push(`Database completion store missing required phrase: ${phrase}.`);
  }
}

if (databaseStoreSource.includes("related_project_id")) {
  failures.push("Database completion store must use project_id, not related_project_id.");
}

const serverActionSource = read("app/actions/workflow-completions.ts");
for (const phrase of ["use server", "commitWorkflowCompletion", "persistWorkflowCompletionAction", "hasPermission"]) {
  if (!serverActionSource.includes(phrase)) {
    failures.push(`Workflow completion server action missing ${phrase}.`);
  }
}

const registrySource = read("lib/d5o/workflow-completion/workflow-completion-registry.ts");
for (const phrase of [
  "billing-backup-cash-recovery",
  "field-issue-escalation",
  "closeout-requirement-final-billing-release",
  "bb-lake-001",
  "mark_evidence_attached",
  "waive_evidence",
  "send_to_review",
  "resolve_workflow_blocker",
  "Billing blocker resolved",
  "create_rfi_from_field_issue",
  "create_change_event_from_field_issue",
  "Field issue resolved",
  "mark_closeout_evidence_attached",
  "send_closeout_item_to_review",
  "resolve_closeout_blocker",
  "Closeout blocker resolved",
  "terminalStates",
  "qaContract",
  "routeTarget",
  "permissionRequirements",
  "resultMessage"
]) {
  if (!registrySource.includes(phrase)) {
    failures.push(`Completion registry missing required phrase: ${phrase}.`);
  }
}

const qaContractsSource = read("lib/d5o/workflow-completion/qa-contracts.ts");
if (!qaContractsSource.includes("getAllCompletionQaContracts")) {
  failures.push("QA contract helper must expose getAllCompletionQaContracts.");
}

const dbVerifierSource = read("scripts/verify-workflow-completion-db.mjs");
for (const phrase of [
  "RYBEXOS_WORKFLOW_COMPLETION_STORE",
  "SUPABASE_SECRET_KEY",
  "rybexos_completion_pilot",
  "workflow_transactions",
  "audit_events",
  "status_history"
]) {
  if (!dbVerifierSource.includes(phrase)) {
    failures.push(`Workflow completion DB verifier missing ${phrase}.`);
  }
}

const rbacSource = read("lib/d5o/rbac.ts");
for (const permission of [
  "edit_evidence",
  "resolve_workflow_action",
  "waive_evidence_requirement",
  "review_billing_backup",
  "edit_closeout"
]) {
  if (!rbacSource.includes(`"${permission}"`)) {
    failures.push(`RBAC is missing completion permission ${permission}.`);
  }
}

const qaReport = read("docs/workflow-completion-qa-report.md");
if (!qaReport.includes("Billing Backup Blocker -> Cash Recovery")) {
  failures.push("Workflow completion QA report must document the proof scenario.");
}

const fieldTrace = read("docs/field-issue-escalation-workflow-trace.md");
if (!fieldTrace.includes("Field Issue") || !fieldTrace.includes("RFI / Change")) {
  failures.push("Field issue escalation workflow trace must document the second proof scenario.");
}

const closeoutTrace = read("docs/closeout-requirement-completion-workflow-trace.md");
if (!closeoutTrace.includes("Closeout Requirement") || !closeoutTrace.includes("Acceptance / Final Billing Release")) {
  failures.push("Closeout requirement workflow trace must document the third proof scenario.");
}

if (failures.length > 0) {
  console.error("Workflow completion verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Workflow completion verification passed: completion engine files, proof task, docs, and scripts are present.");

function read(file) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}
