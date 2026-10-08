import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const pages = [
  {
    name: "Billing",
    file: "app/billing/page.tsx",
    heroQa: "billing-situation-hero",
    workflowMarker: "BillingV2GuidedWorkflow",
    supportingMarker: "CollapsedDetails",
    heroTerms: ["Recover blocked billing", "Cash at risk", "Current status", "Next step"],
    forbiddenHeaderTerms: ["Billing readiness score:"]
  },
  {
    name: "Field Execution",
    file: "app/field-execution/page.tsx",
    heroQa: "field-issue-situation-hero",
    workflowMarker: "FieldIssueEscalationWorkflowClient",
    supportingMarker: "CollapsedDetails",
    heroTerms: ["Escalate field issue", "Schedule / commercial impact", "Current status", "Next step"],
    forbiddenHeaderTerms: ["Daily field control"]
  },
  {
    name: "Closeout",
    file: "app/closeout/page.tsx",
    heroQa: "closeout-situation-hero",
    workflowMarker: "CloseoutFinalBillingWorkflowClient",
    supportingMarker: "CollapsedDetails",
    heroTerms: ["Release final billing", "Final billing / retainage at risk", "Current status", "Next step"],
    forbiddenHeaderTerms: ["Acceptance package"]
  }
];

for (const page of pages) {
  assertFile(page.file);
  const content = read(page.file);
  const body = bodyOf(content);
  assert(content.includes(`data-qa="${page.heroQa}"`), `${page.name} must include a situation hero.`);
  assert(content.includes("workbench-situation-hero"), `${page.name} hero must use the shared workbench situation class.`);
  assert(content.includes("workbench-situation-copy"), `${page.name} hero must use the shared hero copy class.`);
  assert(content.includes("workbench-situation-facts"), `${page.name} hero must use the shared hero facts class.`);
  for (const term of page.heroTerms) {
    assert(content.includes(term), `${page.name} hero must include: ${term}`);
  }
  assert(before(body, page.heroQa, page.workflowMarker), `${page.name} hero must appear before the active workflow.`);
  assert(before(body, page.workflowMarker, page.supportingMarker), `${page.name} active workflow must appear before supporting details.`);
  for (const term of page.forbiddenHeaderTerms) {
    assert(!content.includes(term), `${page.name} generic page header should not compete with the hero using: ${term}`);
  }
}

const workflows = [
  {
    name: "Billing",
    file: "components/d5o/billing-v2/BillingV2WorkflowClient.tsx",
    currentStep: "BillingV2ActiveStepWorkspace",
    currentStepFile: "components/d5o/billing-v2/BillingV2ActiveStepWorkspace.tsx",
    currentStepClass: "billing-current-step-card",
    support: "workbench-support-panel billing-workflow-support",
    outcomeFile: "components/d5o/billing-v2/BillingV2StepOutcomeRecord.tsx",
    outcomeTerms: ["no longer blocked", "ready for commercial review"]
  },
  {
    name: "Field Execution",
    file: "components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx",
    currentStep: "field-current-step-card",
    currentStepFile: "components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx",
    currentStepClass: "field-current-step-card",
    support: "workbench-support-panel field-workflow-support",
    outcomeFile: "components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx",
    outcomeTerms: ["Original field issue resolved", "Command Center updated", "View in"]
  },
  {
    name: "Closeout",
    file: "components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx",
    currentStep: "closeout-current-step-card",
    currentStepFile: "components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx",
    currentStepClass: "closeout-current-step-card",
    support: "workbench-support-panel closeout-workflow-support",
    outcomeFile: "components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx",
    outcomeTerms: ["Final billing and retainage released", "Billing projection updated", "Command Center updated"]
  }
];

for (const workflow of workflows) {
  assertFile(workflow.file);
  const content = read(workflow.file);
  assert(content.includes(workflow.currentStep), `${workflow.name} must expose one dominant current-step region.`);
  assert(read(workflow.currentStepFile).includes(workflow.currentStepClass), `${workflow.name} current-step component must use ${workflow.currentStepClass}.`);
  assert(content.includes(workflow.support), `${workflow.name} must use the shared compact support panel class.`);
  assert(before(content, workflow.currentStep, workflow.support), `${workflow.name} current step must appear before support details in DOM order.`);
  for (const label of ["Required now", "Complete", "Next"]) {
    assert(content.includes(`<span>${label}</span>`), `${workflow.name} support panel must use label: ${label}`);
  }
  for (const oldLabel of ["What is required", "What is complete", "What happens next"]) {
    assert(!content.includes(oldLabel), `${workflow.name} support panel should not use old verbose label: ${oldLabel}`);
  }
  const outcome = read(workflow.outcomeFile);
  for (const term of workflow.outcomeTerms) {
    assert(outcome.includes(term), `${workflow.name} outcome state must include downstream/resolved language: ${term}`);
  }
}

const css = read("app/globals.css");
for (const className of [
  ".workbench-situation-hero",
  ".workbench-situation-copy",
  ".workbench-situation-facts",
  ".workbench-support-panel",
  ".billing-current-step-card",
  ".field-current-step-card",
  ".closeout-current-step-card"
]) {
  assert(css.includes(className), `CSS must include shared/current-step class ${className}.`);
}
assert(css.includes(".billing-guided-layout") && css.includes(".field-guided-layout") && css.includes(".closeout-guided-layout"), "CSS must keep all three guided layouts.");

for (const file of [
  ...pages.map((page) => page.file),
  ...workflows.map((workflow) => workflow.file)
]) {
  const visibleText = read(file)
    .split("\n")
    .filter((line) => !/^\s*import\b/.test(line))
    .filter((line) => !/from\s+["']/.test(line))
    .filter((line) => !/data-qa=/.test(line))
    .filter((line) => !/className=/.test(line))
    .filter((line) => !/\.slice\(/.test(line))
    .join("\n");
  for (const term of [
    "slice",
    "canonical",
    "overlay",
    "local store",
    "adapter",
    "registry",
    "persisted store",
    "seed",
    "QA",
    "workflow engine"
  ]) {
    assert(!visibleText.includes(term), `${file} should not expose internal architecture language: ${term}.`);
  }
}

const packageJson = JSON.parse(read("package.json"));
assert(packageJson.scripts?.["core-workbench:verify"], "package.json must expose core-workbench:verify.");

if (failures.length > 0) {
  console.error("Core workbench consistency verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Core workbench consistency checks passed.");
console.log(JSON.stringify({
  pages: pages.map((page) => page.name),
  sharedPattern: "situation hero + dominant current step + Required now/Complete/Next support + collapsed supporting details",
  humanReviewStillRequired: true
}, null, 2));

function read(filePath) {
  return readFileSync(join(root, filePath), "utf8");
}

function assertFile(filePath) {
  assert(existsSync(join(root, filePath)), `${filePath} must exist.`);
}

function before(content, first, second) {
  const firstIndex = content.indexOf(first);
  const secondIndex = content.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

function bodyOf(content) {
  const bodyStart = content.indexOf("return (");
  return bodyStart >= 0 ? content.slice(bodyStart) : content;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
