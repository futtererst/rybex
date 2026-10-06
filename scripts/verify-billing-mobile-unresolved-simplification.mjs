import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const billingPage = read("app/billing/page.tsx");
const billingWorkflow = read("components/d5o/billing-v2/BillingV2WorkflowClient.tsx");
const understandStep = read("components/d5o/billing-v2/BillingV2StepUnderstandBlocker.tsx");
const billingOutcome = read("components/d5o/billing-v2/BillingV2StepOutcomeRecord.tsx");
const css = read("app/globals.css");
const packageJson = JSON.parse(read("package.json"));

assert(packageJson.scripts?.["billing:verify-mobile-unresolved"], "package.json must expose billing:verify-mobile-unresolved.");
assert(packageJson.scripts?.["billing-v2:verify-persisted-slice"], "Billing persisted-slice verifier must remain available.");
assert(packageJson.scripts?.["billing-v2:qa"], "Billing browser QA command must remain available.");

assert(billingPage.includes("mobile-workbench-summary"), "Billing page must keep a compact mobile cash blocker summary.");
assert(billingPage.includes("Missing backup is holding ${activeBillingPackage.payApplicationLabel}"), "Billing mobile summary must name the blocked pay application.");
assert(billingPage.includes("Cash at risk"), "Billing page must show amount at risk.");
assert(billingPage.includes("Why it is blocked"), "Billing page must show blocker reason.");
assert(billingPage.includes("Next step"), "Billing page must show the next step.");
assert(billingPage.includes("billing-page-unresolved"), "Billing page must expose an unresolved marker for mobile-only simplification.");

assert(understandStep.includes("Start the backup package"), "Unresolved Billing first step must lead with the current action.");
assert(understandStep.includes("billing-mobile-action-summary"), "Unresolved Billing first step must include a compact mobile action summary.");
assert(understandStep.includes("billing-mobile-progress-line"), "Unresolved Billing first step must merge proof progress into the action surface.");
assert(understandStep.includes("data-qa=\"billing-v2-start-package\""), "Unresolved Billing first step must preserve the start-package CTA selector.");
assert(understandStep.includes("billing-step-why"), "The longer why-this-matters block must be identifiable for mobile compression.");

assert(before(bodyOf(billingPage), "billing-situation-hero", "BillingV2GuidedWorkflow"), "Billing situation summary must remain before the workflow.");
assert(before(billingWorkflow, "BillingV2ActiveStepWorkspace", "billing-workflow-support"), "Current Billing action must appear before support panel.");
assert(before(billingWorkflow, "billing-workflow-support", "guided-supporting-details"), "Support panel must appear before supporting details.");
assert(before(bodyOf(billingPage), "BillingV2GuidedWorkflow", "Supporting billing details"), "Active Billing workflow must appear before supporting billing details.");
assert(!billingWorkflow.includes("Supporting billing package details"), "Mobile Billing must not preserve a separate package-details disclosure label.");
assert(billingWorkflow.includes("billing-workbench-step-${activeStep}"), "Billing workflow must expose the active step for scoped mobile simplification.");

assert(billingWorkflow.includes("Required now"), "Billing support panel must keep Required now.");
assert(billingWorkflow.includes("Complete"), "Billing support panel must keep Complete.");
assert(billingWorkflow.includes("Next"), "Billing support panel must keep Next.");
assert(billingWorkflow.includes("billing-workbench-recovered"), "Billing recovered state marker must remain.");

for (const expectedCss of [
  ".billing-mobile-action-summary",
  ".billing-mobile-progress-line",
  ".billing-page-unresolved .billing-situation-facts",
  ".billing-workbench-step-understand:not(.billing-workbench-recovered) .billing-workflow-support",
  ".billing-workbench-step-understand:not(.billing-workbench-recovered) > section > .guided-supporting-details",
  ".billing-current-step-card .billing-step-why",
  ".billing-current-step-card .section-heading p",
  ".billing-current-step-card .section-heading .chip",
  ".billing-workflow-support section",
  "grid-template-columns: 92px minmax(0, 1fr)",
  ".billing-situation-facts div:first-child",
  ".billing-workbench .guided-step-summary"
]) {
  assert(css.includes(expectedCss), `CSS must include Billing mobile simplification rule: ${expectedCss}.`);
}

assert(css.includes(".billing-workbench .guided-step-summary") && css.includes("display: none"), "Billing mobile progress must remain hidden before the action.");
assert(css.includes(".billing-current-step-card .focused-task-grid") && css.includes("display: none"), "Billing mobile metadata grid must remain hidden before action.");
assert(css.includes(".billing-page-unresolved .billing-situation-facts") && css.includes("display: none"), "Billing unresolved mobile must not render the nested cash/blocker/next-step facts panel.");
assert(css.includes(".billing-workbench-step-understand:not(.billing-workbench-recovered) .billing-workflow-support") && css.includes("display: none"), "Billing unresolved mobile must not render a separate Required/Complete/Next support card before supporting details.");

assert(billingOutcome.includes("Billing blocker cleared"), "Resolved Billing mobile must still lead with billing blocker cleared.");
assert(billingOutcome.includes("Amount unblocked"), "Resolved Billing mobile must show the unblocked amount.");
assert(billingOutcome.includes("Payment has not yet been recorded"), "Resolved Billing mobile must clarify that payment is not recorded.");
assert(billingOutcome.includes("Approval recorded"), "Resolved Billing mobile must still show approval recorded.");
assert(billingOutcome.includes("Evidence package"), "Resolved Billing mobile must still show evidence package complete.");
assert(billingOutcome.includes("Command Center"), "Resolved Billing mobile must still show Command Center updated.");
assert(billingPage.includes("Supporting billing records"), "Resolved Billing must use one supporting billing records disclosure.");

assert(billingPage.includes("Closeout release approved"), "Final-release projection must use accurate closeout release approval language.");
assert(billingPage.includes("Other Billing blockers may still require action"), "Final-release projection must distinguish remaining billing blockers.");
assert(billingPage.includes("Linked item"), "Final-release projection must name the linked item.");
assert(billingPage.includes("Payment"), "Final-release projection must show payment status.");
assert(billingPage.includes("Not recorded"), "Final-release projection must not imply payment was received.");
assert(billingPage.includes("Remaining blocker"), "Final-release projection must name remaining blocker context.");

for (const term of [
  "slice",
  "canonical",
  "overlay",
  "local store",
  "adapter",
  "registry",
  "persisted",
  "seed",
  "QA",
  "workflow engine"
]) {
  for (const [label, content] of [
    ["billing page", billingPage],
    ["billing workflow", billingWorkflow],
    ["billing understand step", understandStep],
    ["billing outcome", billingOutcome]
  ]) {
    assert(!visibleCopy(content).includes(term), `${label} must not expose internal architecture language: ${term}.`);
  }
}

if (failures.length > 0) {
  console.error("Billing mobile unresolved simplification verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Billing mobile unresolved simplification checks passed.");
console.log(JSON.stringify({
  page: "/billing",
  mobileTarget: "unresolved cash blocker",
  currentActionBeforeSupport: true,
  resolvedOutcomePreserved: true,
  finalReleaseProjectionPreserved: true,
  humanReviewStillRequired: true
}, null, 2));

function read(filePath) {
  const fullPath = join(root, filePath);
  assert(existsSync(fullPath), `${filePath} must exist.`);
  return readFileSync(fullPath, "utf8");
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

function visibleCopy(content) {
  const jsxText = Array.from(content.matchAll(/>([^<>{}][^<>{}]*)</g))
    .map((match) => match[1]);
  const copyProps = Array.from(content.matchAll(/\b(?:title|summary|subtitle|context|eyebrow|ctaLabel)=["`]([^"`]+)["`]/g))
    .map((match) => match[1]);
  return [...jsxText, ...copyProps].join("\n");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
