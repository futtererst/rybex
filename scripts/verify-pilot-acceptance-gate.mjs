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

const packageJson = read("package.json");
for (const script of [
  "pilot:acceptance",
  "pilot:acceptance-visual",
  "pilot:acceptance-verify"
]) {
  if (!packageJson.includes(`"${script}"`)) failures.push(`package.json missing ${script}.`);
}

for (const file of [
  "docs/pilot-slice-lockdown.md",
  "docs/pilot-slice-acceptance-report.md",
  "docs/pilot-manual-acceptance-checklist.md",
  "scripts/run-pilot-acceptance-production.mjs",
  "scripts/run-pilot-acceptance-visual.mjs",
  "scripts/qa-workflow-state-architecture.mjs",
  "scripts/qa-runtime-stability.mjs",
  "scripts/qa-workflow-execution.mjs",
  "scripts/qa-workflow-business-outcomes.mjs",
  "scripts/verify-workflow-business-outcomes.mjs",
  "components/d5o/workflow-completion/WorkflowCompletionProvider.tsx",
  "components/d5o/workflow-completion/WorkflowOutcomeRecordPanel.tsx",
  "components/d5o/workflow-completion/WorkflowHistoricalRecordPanel.tsx",
  "docs/workflow-business-outcome-layer.md",
  "app/pilot/page.tsx"
]) {
  if (!exists(file)) failures.push(`Missing Pilot acceptance file: ${file}`);
}

if (exists("public/workflow-completion-dom-bridge.js")) {
  failures.push("Obsolete public workflow completion DOM bridge exists.");
}

const layout = read("app/layout.tsx");
for (const forbidden of ["next/script", "<Script", "workflow-completion-dom-bridge", "WorkflowCompletionClientRuntime"]) {
  if (layout.includes(forbidden)) failures.push(`app/layout.tsx contains forbidden workflow bridge pattern: ${forbidden}`);
}
if (!layout.includes("WorkflowCompletionProvider")) {
  failures.push("app/layout.tsx must wrap app content with WorkflowCompletionProvider.");
}

const workflowCompletionComponents = listFiles("components/d5o/workflow-completion", [".tsx", ".ts"]).map(read).join("\n");
if (/<script\b/i.test(workflowCompletionComponents) || /dangerouslySetInnerHTML/i.test(workflowCompletionComponents)) {
  failures.push("Workflow completion components must not render script tags.");
}

const panel = read("components/d5o/workflow-completion/WorkflowCompletionPanel.tsx");
if (panel.includes("local-completion-store") || panel.includes("useLocalCompletionStore")) {
  failures.push("WorkflowCompletionPanel must use provider/hook, not the old local completion store.");
}
if (!panel.includes("useWorkflowCompletion")) {
  failures.push("WorkflowCompletionPanel must consume useWorkflowCompletion.");
}

const progress = read("components/d5o/pilot/PilotProgressSummary.tsx");
if (!progress.includes("useWorkflowCompletion")) {
  failures.push("PilotProgressSummary must derive progress from the workflow completion provider.");
}
if (/readLocalCompletionState|useLocalCompletionStore|localStorage/.test(progress)) {
  failures.push("PilotProgressSummary must not read a separate local/demo progress source.");
}

const pilotSlice = read("lib/d5o/pilot/pilot-slice.ts");
for (const workflowId of [
  "billing-backup-cash-recovery",
  "field-issue-escalation",
  "closeout-requirement-final-billing-release"
]) {
  if (!pilotSlice.includes(workflowId)) failures.push(`Pilot slice missing workflow id: ${workflowId}`);
}
for (const route of [
  "/billing?focus=billing-billing-backup-cash-recovery&pilot=1#focused-task",
  "/field-execution?focus=field-issue-escalation&pilot=1#focused-task",
  "/closeout?focus=closeout-requirement-final-billing-release&pilot=1#focused-task"
]) {
  if (!pilotSlice.includes(route)) failures.push(`Pilot slice target route missing focus metadata: ${route}`);
}

const registry = read("lib/d5o/workflow-completion/workflow-completion-registry.ts");
for (const workflowId of [
  "billing-backup-cash-recovery",
  "field-issue-escalation",
  "closeout-requirement-final-billing-release"
]) {
  if (!registry.includes(`"${workflowId}"`)) failures.push(`Completion registry missing workflow id: ${workflowId}`);
}

const workflowExecutionQa = read("scripts/qa-workflow-execution.mjs");
for (const selector of [
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
  if (!workflowExecutionQa.includes(selector)) failures.push(`workflow-execution QA missing required editable field selector: ${selector}`);
}

const workflowOutcomeQa = read("scripts/qa-workflow-business-outcomes.mjs");
for (const phrase of [
  "workflow-outcome-record-panel",
  "workflow-outcome-business-object",
  "pilot-workflow-outcome-summary",
  "workflow-outcome-next-step",
  "workflow-outcome-next-step-cta"
]) {
  if (!workflowOutcomeQa.toLowerCase().includes(phrase.toLowerCase())) {
    failures.push(`workflow-outcomes QA missing required business outcome check: ${phrase}`);
  }
}

const taskOutcome = read("lib/d5o/end-user/task-outcome-contract.ts");
for (const route of ["focus=", "#focused-task"]) {
  if (!taskOutcome.includes(route)) failures.push(`Task outcome contracts missing route metadata: ${route}`);
}
for (const vague of ["Open priority", "Open action details", "Open workflow", "Review details"]) {
  if (taskOutcome.includes(vague) || read("components/d5o/end-user/ActionCockpit.tsx").includes(vague)) {
    failures.push(`Known vague CTA label returned: ${vague}`);
  }
}

const visualCapture = read("scripts/capture-visual-qa.mjs");
for (const route of [
  "/pilot",
  "/billing?focus=billing-billing-backup-cash-recovery&pilot=1#focused-task",
  "/field-execution?focus=field-issue-escalation&pilot=1#focused-task",
  "/closeout?focus=closeout-requirement-final-billing-release&pilot=1#focused-task"
]) {
  if (!visualCapture.includes(route)) failures.push(`visual:capture missing Pilot acceptance route: ${route}`);
}

const docs = [
  "docs/pilot-slice-lockdown.md",
  "docs/pilot-slice-acceptance-report.md",
  "docs/pilot-manual-acceptance-checklist.md",
  "docs/developer-notes.md",
  "docs/demo-readiness.md",
  "docs/controlled-pilot-launch-plan.md",
  "README.md"
].map(read).join("\n");
for (const phrase of [
  "Controlled internal pilot candidate",
  "not production ready",
  "pilot:acceptance",
  "pilot:acceptance-visual",
  "local dev runtime",
  "production build server"
]) {
  if (!docs.toLowerCase().includes(phrase.toLowerCase())) failures.push(`Pilot acceptance docs missing phrase: ${phrase}`);
}

if (failures.length > 0) {
  console.error("Pilot acceptance gate verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Pilot acceptance gate verification passed.");

function listFiles(dir, extensions) {
  const out = [];
  walk(path.join(root, dir));
  return out.map((file) => path.relative(root, file).replaceAll("\\", "/"));

  function walk(current) {
    if (!fs.existsSync(current)) return;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) walk(path.join(current, entry));
      return;
    }
    if (extensions.includes(path.extname(current))) out.push(current);
  }
}
