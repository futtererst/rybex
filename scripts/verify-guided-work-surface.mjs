import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const workflowChecks = [
  {
    name: "Billing V2 cash recovery",
    file: "components/d5o/billing-v2/BillingV2WorkflowClient.tsx",
    required: [
      "data-qa=\"billing-v2-situation-header\"",
      "data-qa=\"billing-v2-step-progress\"",
      "BillingV2ActiveStepWorkspace",
      "guided-supporting-details",
      "cash at risk"
    ],
    actionFiles: [
      "components/d5o/billing-v2/BillingV2StepUnderstandBlocker.tsx",
      "components/d5o/billing-v2/BillingV2StepBuildPackage.tsx",
      "components/d5o/billing-v2/BillingV2StepAddProof.tsx",
      "components/d5o/billing-v2/BillingV2StepCommercialReview.tsx",
      "components/d5o/billing-v2/BillingV2StepReviewDecision.tsx",
      "components/d5o/billing-v2/BillingV2StepClearBlocker.tsx"
    ],
    outcomeFile: "components/d5o/billing-v2/BillingV2StepOutcomeRecord.tsx",
    outcomeTerms: ["ready for commercial review", "no longer blocked"]
  },
  {
    name: "Field Issue Escalation",
    file: "components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx",
    required: [
      "data-qa=\"field-issue-situation-header\"",
      "data-qa=\"field-issue-step-progress\"",
      "data-qa=\"field-issue-current-step\"",
      "guided-supporting-details",
      "Create the RFI or change event before resolving this field issue."
    ],
    actionFiles: ["components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx"],
    outcomeFile: "components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx",
    outcomeTerms: ["Resolved outcome", "Field issue escalated and cleared", "downstream record"]
  },
  {
    name: "Closeout Final Billing Release",
    file: "components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx",
    required: [
      "data-qa=\"closeout-final-billing-situation-header\"",
      "data-qa=\"closeout-final-billing-step-progress\"",
      "data-qa=\"closeout-final-billing-current-step\"",
      "guided-supporting-details",
      "Validate release readiness before requesting closeout approval."
    ],
    actionFiles: ["components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx"],
    outcomeFile: "components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx",
    outcomeTerms: ["Resolved outcome", "Final billing and retainage released", "billing projection is released"]
  }
];

for (const check of workflowChecks) {
  assertFile(check.file);
  const content = readFile(check.file);
  for (const required of check.required) {
    assert(content.includes(required), `${check.name} is missing guided work-surface marker or disabled-state copy: ${required}`);
  }
  assert(check.actionFiles.some((file) => readFile(file).includes("button button-primary")), `${check.name} must expose a primary action in the current step.`);

  const outcomeContent = readFile(check.outcomeFile);
  for (const term of check.outcomeTerms) {
    assert(outcomeContent.includes(term), `${check.name} outcome must use resolved business language: ${term}`);
  }
}

const billingProof = readFile("components/d5o/billing-v2/BillingV2StepAddProof.tsx");
assert(!billingProof.includes("operating-columns"), "Billing proof step should not render dense evidence columns.");
assert(billingProof.includes("Current proof needed"), "Billing proof step should show one current proof item.");
assert(billingProof.includes("Add all required evidence before sending for review."), "Billing proof step must explain blocked review state.");

const activeStep = readFile("components/d5o/billing-v2/BillingV2ActiveStepWorkspace.tsx");
assert(activeStep.includes("guided-current-step"), "Billing active workspace must render the dominant current step region.");

const css = readFile("app/globals.css");
for (const className of [
  ".guided-work-surface",
  ".guided-situation-strip",
  ".guided-step-summary",
  ".guided-current-step",
  ".guided-supporting-details",
  ".nav-link-contained"
]) {
  assert(css.includes(className), `CSS is missing ${className}.`);
}

const nav = readFile("components/layout/PrimaryNav.tsx");
assert(nav.includes("Other modules"), "Sidebar must group scaffold-heavy modules under Other modules.");
assert(nav.includes("nav-link-contained"), "Sidebar must visually demote contained modules.");
for (const href of ["/command-center", "/field-execution", "/rfis-submittals", "/changes", "/billing", "/closeout"]) {
  assert(nav.includes(`"${href}"`), `Sidebar core path should keep ${href} prominent.`);
}

for (const page of [
  "app/billing/page.tsx",
  "app/field-execution/page.tsx",
  "app/closeout/page.tsx"
]) {
  const content = readFile(page);
  assert(
    before(content, "BillingV2GuidedWorkflow", "CollapsedDetails") ||
      before(content, "FieldIssueEscalationWorkflowClient", "CollapsedDetails") ||
      before(content, "CloseoutFinalBillingWorkflowClient", "CollapsedDetails"),
    `${page} must show the focused workflow before supporting details.`
  );
}

for (const file of [
  ...workflowChecks.map((check) => check.file),
  "components/d5o/billing-v2/BillingV2StepAddProof.tsx",
  "components/d5o/billing-v2/BillingV2StepCommercialReview.tsx",
  "components/d5o/billing-v2/BillingV2StepClearBlocker.tsx",
  "components/d5o/billing-v2/BillingV2StepOutcomeRecord.tsx",
  "components/layout/PrimaryNav.tsx"
]) {
  const visibleText = readFile(file)
    .split("\n")
    .filter((line) => !/^\s*import\b/.test(line))
    .filter((line) => !/from\s+["']/.test(line))
    .filter((line) => !/data-qa=/.test(line))
    .filter((line) => !/className=/.test(line))
    .join("\n");
  for (const term of [
    "local store",
    "adapter",
    "registry",
    "persisted store",
    "seed",
    "QA",
    "workflow engine",
    "local/demo",
    "Production binary",
    "Production review"
  ]) {
    assert(!visibleText.includes(term), `${file} should not expose internal architecture language: ${term}.`);
  }
}

if (failures.length > 0) {
  console.error("Guided work surface verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Guided work surface checks passed.");
console.log(JSON.stringify({
  workflows: workflowChecks.map((check) => check.name),
  currentStepPattern: "situation header + progress summary + dominant current step + supporting details",
  sidebarContainment: "core path prominent, other modules grouped",
  humanReviewStillRequired: true
}, null, 2));

function readFile(filePath) {
  return readFileSync(join(root, filePath), "utf8");
}

function assertFile(filePath) {
  assert(existsSync(join(root, filePath)), `${filePath} must exist.`);
}

function before(content, first, second) {
  const bodyStart = content.indexOf("return (");
  const body = bodyStart >= 0 ? content.slice(bodyStart) : content;
  const firstIndex = body.indexOf(first);
  const secondIndex = body.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
