import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "lib/d5o/workflow-completion/editable-field-contracts.ts",
  "components/d5o/workflow-completion/GuidedCompletionFlow.tsx",
  "components/d5o/workflow-completion/WorkflowCompletionPanel.tsx",
  "scripts/qa-workflow-execution.mjs",
  "docs/workflow-editable-field-contract.md"
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) {
    failures.push(`Missing required file: ${file}`);
  }
}

const contracts = read("lib/d5o/workflow-completion/editable-field-contracts.ts");
for (const phrase of [
  "CompletionEditableField",
  "CompletionFieldValidationRule",
  "CompletionFieldSaveAction",
  "CompletionSavedFieldValue",
  "backup-note-input",
  "billing-evidence-reference-input",
  "billing-resolution-note-input",
  "field-escalation-note-input",
  "field-control-path-input",
  "rfi-draft-title-input",
  "rfi-question-input",
  "field-control-reason-input",
  "field-resolution-note-input",
  "closeout-evidence-note-input",
  "closeout-evidence-reference-input",
  "closeout-acceptance-note-input"
]) {
  if (!contracts.includes(phrase)) failures.push(`Editable field contract missing ${phrase}.`);
}

const types = read("lib/d5o/workflow-completion/types.ts");
for (const action of [
  "save_backup_note",
  "save_evidence_reference",
  "save_billing_resolution_note",
  "save_escalation_note",
  "save_control_path",
  "save_rfi_draft_details",
  "save_control_reason",
  "save_field_resolution_note",
  "save_closeout_evidence_note",
  "save_closeout_evidence_reference",
  "save_closeout_acceptance_note"
]) {
  if (!types.includes(action)) failures.push(`WorkflowCompletionActionType missing ${action}.`);
}

const guided = read("components/d5o/workflow-completion/GuidedCompletionFlow.tsx");
for (const phrase of [
  "getEditableFieldsForWorkflow",
  "guided-editable-field-step",
  "completion-saved-field-summary",
  "disabled-reason",
  "Save RFI draft title",
  "Save closeout evidence reference"
]) {
  if (!guided.includes(phrase)) failures.push(`GuidedCompletionFlow missing ${phrase}.`);
}

const store = read("lib/d5o/workflow-completion/local-completion-store.ts");
for (const phrase of ["savedFieldsByItemId", "readLocalCompletionState"]) {
  if (!store.includes(phrase)) failures.push(`Local completion compatibility reader missing ${phrase}.`);
}

const provider = read("components/d5o/workflow-completion/WorkflowCompletionProvider.tsx");
for (const phrase of ["saveField", "getSavedFields", "localDemoCompletionAdapter"]) {
  if (!provider.includes(phrase)) failures.push(`WorkflowCompletionProvider missing ${phrase}.`);
}

const panel = read("components/d5o/workflow-completion/WorkflowCompletionPanel.tsx");
for (const phrase of ["savedFields", "missingFieldsForAction", "getSavedFields"]) {
  if (!panel.includes(phrase)) failures.push(`WorkflowCompletionPanel missing ${phrase}.`);
}

const qa = read("scripts/qa-workflow-execution.mjs");
for (const phrase of [
  "Add missing billing backup",
  "Escalate field issue",
  "Complete closeout requirement",
  "billing-v2-backup-summary-input",
  "billing-v2-related-source-input",
  "billing-v2-amount-input",
  "billing-v2-add-reference",
  "billing-v2-review-note-input",
  "billing-v2-resolution-note-input",
  "field-escalation-note-input",
  "field-control-path-input",
  "rfi-draft-title-input",
  "rfi-question-input",
  "field-control-reason-input",
  "field-resolution-note-input",
  "closeout-evidence-note-input",
  "closeout-evidence-reference-input",
  "closeout-acceptance-note-input",
  "expectDisabled",
  "expectPilotComplete"
]) {
  if (!qa.includes(phrase)) failures.push(`Workflow execution QA missing ${phrase}.`);
}

const packageJson = read("package.json");
for (const script of ['"workflow-execution:qa"', '"workflow-execution:verify"']) {
  if (!packageJson.includes(script)) failures.push(`package.json missing ${script}.`);
}

const docs = read("docs/workflow-editable-field-contract.md");
for (const phrase of ["Backup note", "Escalation note", "Closeout evidence note", "local/demo", "not production persistence"]) {
  if (!docs.includes(phrase)) failures.push(`Editable field contract doc missing ${phrase}.`);
}

if (failures.length > 0) {
  console.error("Workflow execution QA verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Workflow execution QA verification passed.");

function read(file) {
  const filePath = resolve(root, file);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}
