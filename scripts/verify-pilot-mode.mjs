import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "app/pilot/page.tsx",
  "components/d5o/pilot/PilotModeHeader.tsx",
  "components/d5o/pilot/PilotWorkflowCard.tsx",
  "components/d5o/pilot/PilotProgressSummary.tsx",
  "components/d5o/pilot/PilotModeGuardrails.tsx",
  "components/d5o/pilot/PilotCompletionTimeline.tsx",
  "lib/d5o/pilot/pilot-slice.ts",
  "scripts/qa-pilot-mode.mjs",
  "docs/pilot-mode-guided-operating-slice.md"
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) {
    failures.push(`Missing required Pilot Mode file: ${file}`);
  }
}

const packageJson = read("package.json");
for (const scriptName of ["pilot-mode:qa", "pilot-mode:verify"]) {
  if (!packageJson.includes(`"${scriptName}"`)) {
    failures.push(`package.json missing script: ${scriptName}`);
  }
}

const pilotSlice = read("lib/d5o/pilot/pilot-slice.ts");
const includedWorkflows = [
  "billing-backup-cash-recovery",
  "field-issue-escalation",
  "closeout-requirement-final-billing-release"
];

for (const workflowId of includedWorkflows) {
  if (!pilotSlice.includes(workflowId)) {
    failures.push(`Pilot slice missing workflow: ${workflowId}`);
  }
}

if ((pilotSlice.match(/businessValue: "/g) ?? []).length !== 3) {
  failures.push("Pilot slice must define exactly three workflow business values.");
}

for (const route of [
  "/billing?focus=billing-billing-backup-cash-recovery&pilot=1#focused-task",
  "/field-execution?focus=field-issue-escalation&pilot=1#focused-task",
  "/closeout?focus=closeout-requirement-final-billing-release&pilot=1#focused-task"
]) {
  if (!pilotSlice.includes(route)) {
    failures.push(`Pilot target route missing focus/pilot metadata: ${route}`);
  }
}

const registry = read("lib/d5o/workflow-completion/workflow-completion-registry.ts");
for (const workflowId of includedWorkflows) {
  if (!registry.includes(`"${workflowId}"`)) {
    failures.push(`Completion registry missing pilot workflow: ${workflowId}`);
  }
}

const commandCenter = read("app/command-center/page.tsx");
if (!commandCenter.includes("/pilot") || !commandCenter.includes("Open Pilot Mode")) {
  failures.push("Command Center must link to Pilot Mode.");
}

const focusedTaskPanel = read("components/d5o/end-user/FocusedTaskPanel.tsx");
if (!focusedTaskPanel.includes("return-to-pilot-mode") || !focusedTaskPanel.includes("pilot") || !focusedTaskPanel.includes("/pilot")) {
  failures.push("FocusedTaskPanel must expose a Pilot Mode return link when pilot=1 is present.");
}

const adminPage = read("app/admin/page.tsx");
if (!adminPage.includes("Pilot Mode Readiness") || !adminPage.includes("Guided operating slice available")) {
  failures.push("Admin must report Pilot Mode readiness.");
}

const smokeRoutes = read("scripts/smoke-routes.mjs");
if (!smokeRoutes.includes('"/pilot"')) {
  failures.push("Smoke routes must include /pilot.");
}

const docs = read("docs/pilot-mode-guided-operating-slice.md");
for (const phrase of ["not production ready", "local/demo", "database completion pilot", "Reset Pilot Demo State"]) {
  if (!docs.toLowerCase().includes(phrase.toLowerCase())) {
    failures.push(`Pilot Mode docs must include: ${phrase}`);
  }
}

if (failures.length > 0) {
  console.error("Pilot Mode verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Pilot Mode verification passed.");

function read(file) {
  const filePath = resolve(root, file);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}
