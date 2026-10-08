import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

assertFile("docs/page-layout-visual-journey-blueprint.md");
const blueprint = read("docs/page-layout-visual-journey-blueprint.md");
for (const heading of ["## Billing", "## Field Execution", "## Closeout", "## Command Center", "## RFIs/Submittals", "## Changes"]) {
  assert(blueprint.includes(heading), `Blueprint must cover ${heading}.`);
}
assert(blueprint.includes("The app is still not demo-ready"), "Blueprint must be explicit that the app is not demo-ready.");

const billingPage = read("app/billing/page.tsx");
const billingPageBody = bodyOf(billingPage);
assert(billingPage.includes('data-qa="billing-situation-hero"'), "Billing page must include the situation hero.");
assert(billingPage.includes("Recover blocked billing"), "Billing hero must use the plain-English recovery title.");
assert(billingPage.includes("Cash at risk"), "Billing hero must show cash at risk.");
assert(before(billingPageBody, "billing-situation-hero", "BillingV2GuidedWorkflow"), "Billing situation hero must appear before the workflow.");
assert(before(billingPageBody, "BillingV2GuidedWorkflow", "CollapsedDetails"), "Billing workflow must appear before supporting details.");
assert(before(billingPageBody, "CollapsedDetails", "BillingDashboard"), "Legacy billing dashboard content must live inside supporting details.");

const workflow = read("components/d5o/billing-v2/BillingV2WorkflowClient.tsx");
assert(workflow.includes("billing-workbench"), "Billing workflow must use the redesigned workbench wrapper.");
assert(workflow.includes("billing-guided-layout"), "Billing workflow must use the two-zone guided layout.");
assert(workflow.includes("billing-workflow-support"), "Billing workflow must include the compact support zone.");
assert(workflow.includes("billing-v2-situation-header"), "Billing workflow must retain a situation marker for QA.");
assert(workflow.includes("BillingV2ActiveStepWorkspace"), "Billing workflow must render the current step workspace.");
assert(before(workflow, "BillingV2ActiveStepWorkspace", "billing-workflow-support"), "Current step must appear before support details in DOM order.");
assert(workflow.includes("Required now"), "Support zone must explain what is required now.");
assert(workflow.includes("Complete"), "Support zone must explain what is complete.");
assert(workflow.includes("Next"), "Support zone must explain what happens next.");

const activeStep = read("components/d5o/billing-v2/BillingV2ActiveStepWorkspace.tsx");
assert(activeStep.includes("billing-current-step-card"), "Billing active step must expose the dominant current-step card.");
assert(activeStep.includes('data-qa="billing-v2-active-step"'), "Billing active step must keep the existing QA marker.");

const fieldPage = read("app/field-execution/page.tsx");
const fieldPageBody = bodyOf(fieldPage);
assert(fieldPage.includes('data-qa="field-issue-situation-hero"'), "Field Execution page must include the field issue situation hero.");
assert(fieldPage.includes("Escalate field issue"), "Field Execution hero must use the plain-English escalation title.");
assert(fieldPage.includes("Project / location"), "Field Execution hero must show project/location.");
assert(fieldPage.includes("Schedule / commercial impact"), "Field Execution hero must show schedule/commercial impact.");
assert(before(fieldPageBody, "field-issue-situation-hero", "FieldIssueEscalationWorkflowClient"), "Field issue situation hero must appear before the workflow.");
assert(before(fieldPageBody, "FieldIssueEscalationWorkflowClient", "CollapsedDetails"), "Field issue workflow must appear before supporting field details.");
assert(before(fieldPageBody, "CollapsedDetails", "FieldExecutionDashboard"), "Legacy field dashboard content must live inside supporting details.");
assert(fieldPage.includes("Supporting field details"), "Field Execution supporting details must use the simplified label.");

const fieldWorkflow = read("components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx");
assert(fieldWorkflow.includes("field-workbench"), "Field issue workflow must use the redesigned workbench wrapper.");
assert(fieldWorkflow.includes("field-guided-layout"), "Field issue workflow must use the two-zone guided layout.");
assert(fieldWorkflow.includes("field-workflow-support"), "Field issue workflow must include the compact support zone.");
assert(fieldWorkflow.includes("field-current-step-card"), "Field issue workflow must expose a dominant current-step card.");
assert(before(fieldWorkflow, "field-current-step-card", "field-workflow-support"), "Field current step must appear before support details in DOM order.");
assert(fieldWorkflow.includes("Required now"), "Field support zone must explain what is required now.");
assert(fieldWorkflow.includes("Complete"), "Field support zone must explain what is complete.");
assert(fieldWorkflow.includes("Next"), "Field support zone must explain what happens next.");
assert(fieldWorkflow.includes("RFI-FI-001 created") || fieldWorkflow.includes("recordNumber"), "Field outcome must show the downstream record number.");
assert(fieldWorkflow.includes("Original field issue resolved"), "Field outcome must say the original field issue was resolved.");
assert(fieldWorkflow.includes("View in"), "Field outcome must link to the downstream module.");

const closeoutPage = read("app/closeout/page.tsx");
const closeoutPageBody = bodyOf(closeoutPage);
assert(closeoutPage.includes('data-qa="closeout-situation-hero"'), "Closeout page must include the final billing release situation hero.");
assert(closeoutPage.includes("Release final billing"), "Closeout hero must use the plain-English release title.");
assert(closeoutPage.includes("Final billing / retainage at risk"), "Closeout hero must show final billing or retainage at risk.");
assert(closeoutPage.includes("Current status"), "Closeout hero must show current status.");
assert(before(closeoutPageBody, "closeout-situation-hero", "CloseoutFinalBillingWorkflowClient"), "Closeout situation hero must appear before the workflow.");
assert(before(closeoutPageBody, "CloseoutFinalBillingWorkflowClient", "CollapsedDetails"), "Closeout workflow must appear before supporting closeout details.");
assert(before(closeoutPageBody, "CollapsedDetails", "CloseoutDashboard"), "Legacy closeout dashboard content must live inside supporting details.");
assert(closeoutPage.includes("Supporting closeout details"), "Closeout supporting details must use the simplified label.");

const closeoutWorkflow = read("components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx");
assert(closeoutWorkflow.includes("closeout-workbench"), "Closeout workflow must use the redesigned workbench wrapper.");
assert(closeoutWorkflow.includes("closeout-guided-layout"), "Closeout workflow must use the two-zone guided layout.");
assert(closeoutWorkflow.includes("closeout-workflow-support"), "Closeout workflow must include the compact support zone.");
assert(closeoutWorkflow.includes("closeout-current-step-card"), "Closeout workflow must expose a dominant current-step card.");
assert(before(closeoutWorkflow, "closeout-current-step-card", "closeout-workflow-support"), "Closeout current step must appear before support details in DOM order.");
assert(closeoutWorkflow.includes("Required now"), "Closeout support zone must explain what is required now.");
assert(closeoutWorkflow.includes("Complete"), "Closeout support zone must explain what is complete.");
assert(closeoutWorkflow.includes("Next"), "Closeout support zone must explain what happens next.");
assert(closeoutWorkflow.includes("Continue final billing processing"), "Closeout outcome must show the final billing processing next action.");
assert(closeoutWorkflow.includes("Payment has not yet been recorded"), "Closeout outcome must avoid implying payment was received.");
assert(closeoutPage.includes("Billing projection updated") || closeoutPage.includes("Billing updated"), "Closeout outcome must show the billing projection update.");

const css = read("app/globals.css");
for (const className of [
  ".billing-situation-hero",
  ".billing-workbench",
  ".billing-guided-layout",
  ".billing-current-step-card",
  ".billing-workflow-support",
  ".billing-workflow-brief",
  ".workbench-situation-hero",
  ".workbench-situation-copy",
  ".workbench-situation-facts",
  ".workbench-support-panel",
  ".field-situation-hero",
  ".field-workbench",
  ".field-guided-layout",
  ".field-current-step-card",
  ".field-workflow-support",
  ".field-workflow-brief",
  ".closeout-situation-hero",
  ".closeout-workbench",
  ".closeout-guided-layout",
  ".closeout-current-step-card",
  ".closeout-workflow-support",
  ".closeout-workflow-brief"
]) {
  assert(css.includes(className), `CSS must define ${className}.`);
}
assert(css.includes(".billing-workbench .guided-step-summary"), "Billing progress must be scoped to the Billing workbench.");
assert(css.includes(".billing-guided-layout") && css.includes("grid-template-columns: 1fr"), "Mobile rules must stack the Billing guided layout.");
assert(css.includes(".field-workbench .guided-step-summary"), "Field progress must be scoped to the Field workbench.");
assert(css.includes(".field-guided-layout") && css.includes("grid-template-columns: 1fr"), "Mobile rules must stack the Field guided layout.");
assert(css.includes(".closeout-workbench .guided-step-summary"), "Closeout progress must be scoped to the Closeout workbench.");
assert(css.includes(".closeout-guided-layout") && css.includes("grid-template-columns: 1fr"), "Mobile rules must stack the Closeout guided layout.");

for (const file of [
  "app/billing/page.tsx",
  "components/d5o/billing-v2/BillingV2WorkflowClient.tsx",
  "components/d5o/billing-v2/BillingV2ActiveStepWorkspace.tsx",
  "components/d5o/billing-v2/BillingV2StepUnderstandBlocker.tsx",
  "app/field-execution/page.tsx",
  "components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx",
  "app/closeout/page.tsx",
  "components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx"
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
assert(packageJson.scripts?.["billing-v2:qa"], "Billing browser QA command must remain available.");
assert(packageJson.scripts?.["billing-v2:verify-persisted-slice"], "Billing persisted-slice verifier must remain available.");
assert(packageJson.scripts?.["field-issue:qa"], "Field Issue browser QA command must remain available.");
assert(packageJson.scripts?.["field-issue:verify-persisted-slice"], "Field Issue persisted-slice verifier must remain available.");
assert(packageJson.scripts?.["closeout-final-billing:qa"], "Closeout Final Billing browser QA command must remain available.");
assert(packageJson.scripts?.["closeout-final-billing:verify-persisted-slice"], "Closeout Final Billing persisted-slice verifier must remain available.");

if (failures.length > 0) {
  console.error("Page layout visual journey verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Page layout visual journey checks passed.");
console.log(JSON.stringify({
  redesignedPages: ["/billing", "/field-execution", "/closeout"],
  blueprint: "docs/page-layout-visual-journey-blueprint.md",
  verifiedPattern: "situation hero + current step card + compact support + collapsed supporting details",
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
