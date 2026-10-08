import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

const majorPages = [
  ["app/command-center/page.tsx", "command-center"],
  ["app/pipeline/page.tsx", "pipeline"],
  ["app/projects/page.tsx", "projects"],
  ["app/mobilization/page.tsx", "mobilization"],
  ["app/field-execution/page.tsx", "field-execution"],
  ["app/rfis-submittals/page.tsx", "rfis-submittals"],
  ["app/changes/page.tsx", "changes"],
  ["app/billing/page.tsx", "billing"],
  ["app/safety/page.tsx", "safety"],
  ["app/quality/page.tsx", "quality"],
  ["app/closeout/page.tsx", "closeout"],
  ["app/reports/page.tsx", "reports"]
];

const bannedLabels = [
  "Open priority",
  "Open action details",
  "Review details",
  "Open workflow",
  "Learn more"
];

function readRequired(path, label = path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    failures.push(`Missing ${label}.`);
    return "";
  }
  return readFileSync(absolute, "utf8");
}

const focusedTaskPanel = readRequired("components/d5o/end-user/FocusedTaskPanel.tsx", "FocusedTaskPanel");
const actionLayout = readRequired("components/d5o/end-user/ActionWorkspaceLayout.tsx", "ActionWorkspaceLayout");
const cockpit = readRequired("components/d5o/end-user/ActionCockpit.tsx", "ActionCockpit");
const contract = readRequired("lib/d5o/end-user/task-outcome-contract.ts", "task outcome contract utility");
const derivation = readRequired("lib/d5o/end-user/derive-primary-action.ts", "primary action derivation");
const workflowQa = readRequired("scripts/qa-user-workflows.mjs", "user workflow QA script");
const outcomeQa = readRequired("scripts/qa-cta-outcomes.mjs", "CTA outcome QA script");

if (!focusedTaskPanel.includes("You are here to") || !focusedTaskPanel.includes("data-qa=\"focused-task-panel\"")) {
  failures.push("FocusedTaskPanel must render a visible 'You are here to' focused task surface.");
}

if (!actionLayout.includes("FocusedTaskPanel")) {
  failures.push("ActionWorkspaceLayout must render FocusedTaskPanel.");
}

for (const required of ["buildTaskOutcomeContract", "buildFocusedTaskHref", "targetHref", "concreteCtaLabel", "nextStepInstruction"]) {
  if (!contract.includes(required)) {
    failures.push(`Task outcome contract is missing ${required}.`);
  }
}

for (const banned of bannedLabels) {
  if (cockpit.includes(banned) || derivation.includes(banned)) {
    failures.push(`Primary cockpit path still contains banned vague label: ${banned}.`);
  }
}

for (const [file, pageId] of majorPages) {
  const source = readRequired(file);
  if (!source.includes("ActionWorkspaceLayout")) {
    failures.push(`${file} must use ActionWorkspaceLayout.`);
  }
  if (!source.includes(`getEndUserWorkspaceSummary("${pageId}")`)) {
    failures.push(`${file} must use the end-user summary for ${pageId}.`);
  }
}

for (const script of [
  ["scripts/qa-user-workflows.mjs", workflowQa],
  ["scripts/qa-cta-outcomes.mjs", outcomeQa]
]) {
  const [name, content] = script;
  for (const required of ["bannedVagueLabels", "genericRouteOnly", "sectionOnlyHighlight", "focused-task-panel", "You are here to"]) {
    if (!content.includes(required)) {
      failures.push(`${name} does not verify task outcome failure case: ${required}.`);
    }
  }
}

for (const doc of [
  "docs/user-workflow-qa-report.md",
  "docs/user-workflow-remediation-backlog.md",
  "docs/cta-outcome-clarity-qa-report.md",
  "docs/cta-outcome-remediation-backlog.md"
]) {
  const content = readRequired(doc);
  if (content && !/Manual Founder Review Failures|Historical Manual Review Failures Resolved/.test(content)) {
    failures.push(`${doc} must include manual review failure context or resolved historical manual review context.`);
  }
}

if (failures.length > 0) {
  console.error("Task outcome contract verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Task outcome contract verification passed.");
