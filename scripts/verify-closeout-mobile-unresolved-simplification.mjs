import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const closeoutPage = read("app/closeout/page.tsx");
const closeoutWorkflow = read("components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx");
const billingPage = read("app/billing/page.tsx");
const closeoutOutcome = closeoutWorkflow;
const css = read("app/globals.css");
const packageJson = JSON.parse(read("package.json"));

assert(packageJson.scripts?.["closeout:verify-mobile-unresolved"], "package.json must expose closeout:verify-mobile-unresolved.");
assert(packageJson.scripts?.["closeout-final-billing:verify-persisted-slice"], "Closeout persisted-slice verifier must remain available.");
assert(packageJson.scripts?.["closeout-final-billing:qa"], "Closeout browser QA command must remain available.");

assert(closeoutPage.includes("closeout-page-unresolved"), "Closeout page must expose an unresolved marker for mobile-only simplification.");
assert(closeoutPage.includes("mobile-workbench-summary"), "Closeout page must keep one compact mobile final-billing blocker summary.");
assert(closeoutPage.includes("retainageExposureAmount.toLocaleString"), "Compact closeout summary must include amount at risk from canonical data.");
assert(closeoutPage.includes("Final billing and retainage cannot be released until the closeout requirement is completed."), "Compact closeout summary must explain the blocker reason.");
assert(closeoutPage.includes("Status: ${getCloseoutReleaseStatus(closeoutFinalBillingState).toLowerCase()}"), "Compact closeout summary must include current status.");
assert(closeoutPage.includes("Next: ${getCloseoutPageNextStep(closeoutFinalBillingState).toLowerCase()}"), "Compact closeout summary must include next step.");

assert(closeoutWorkflow.includes("closeout-workbench-step-${activeStep}"), "Closeout workflow must expose the active step for scoped mobile simplification.");
assert(closeoutWorkflow.includes("title=\"Assess closeout requirements\""), "Initial Closeout action surface must lead with the honest first action.");
assert(closeoutWorkflow.includes("Confirm what acceptance, evidence, and approval are still required before final billing and retainage can be released."), "Initial Closeout action must explain the assessment purpose.");
assert(closeoutWorkflow.includes("The workflow will guide acceptance evidence, readiness validation, review, approval, and final release."), "Initial Closeout action must explain the future evidence/review/approval/release path.");
assert(closeoutWorkflow.includes("closeout-mobile-requirement-line"), "Initial Closeout action must include one concise requirement statement.");
assert(closeoutWorkflow.includes("data-qa=\"closeout-final-billing-start\""), "Initial Closeout action must preserve the start selector.");
assert(closeoutWorkflow.includes("Assess closeout requirements"), "Initial Closeout CTA must match the actual first workflow action.");
assert(!visibleCopy(closeoutWorkflow).includes("Release final billing") || closeoutWorkflow.includes("title=\"Release final billing and retainage\""), "Initial Closeout CTA must not imply immediate release before approval.");

assert(before(bodyOf(closeoutPage), "closeout-situation-hero", "CloseoutFinalBillingWorkflowClient"), "Compact Closeout summary must appear before the workflow action.");
assert(before(closeoutWorkflow, "closeout-current-step-card", "closeout-workflow-support"), "Closeout current action must appear before the support panel.");
assert(before(bodyOf(closeoutPage), "CloseoutFinalBillingWorkflowClient", "Supporting closeout details"), "Supporting closeout details must appear below the active workflow.");

for (const expectedCss of [
  ".closeout-page-unresolved .closeout-situation-facts",
  ".closeout-workbench-step-understand:not(.closeout-workbench-resolved) .closeout-workflow-support",
  ".closeout-workbench-step-understand:not(.closeout-workbench-resolved) > .guided-supporting-details",
  ".closeout-workbench-step-understand:not(.closeout-workbench-resolved) .closeout-current-step-card .completion-facts",
  ".closeout-mobile-path-line",
  ".closeout-mobile-requirement-line",
  ".closeout-page #details-records .progressive-details summary::after"
]) {
  assert(css.includes(expectedCss), `CSS must include Closeout unresolved mobile simplification rule: ${expectedCss}.`);
}

assert(css.includes(".closeout-page-unresolved .closeout-situation-facts") && css.includes("display: none"), "Closeout unresolved mobile must not render separate amount/status/next-step fact cards.");
assert(css.includes(".closeout-workbench-step-understand:not(.closeout-workbench-resolved) .closeout-workflow-support") && css.includes("display: none"), "Closeout pre-start mobile must not render Required/Complete/Next support stack.");
assert(css.includes(".closeout-workbench-step-understand:not(.closeout-workbench-resolved) .closeout-current-step-card .completion-facts") && css.includes("display: none"), "Closeout pre-start mobile must not render separate requirement/owner/finance/due cards.");
assert(css.includes(".closeout-workbench-step-understand:not(.closeout-workbench-resolved) > .guided-supporting-details") && css.includes("display: none"), "Initial mobile state must show only the page-level Supporting closeout details disclosure.");

assert(closeoutPage.includes("Supporting closeout details"), "Closeout page must keep one page-level Supporting closeout details disclosure.");
assert(css.includes(".closeout-page #details-records .progressive-details summary small") && css.includes("display: none"), "Closeout supporting details helper copy must stay hidden while collapsed on mobile.");

assert(closeoutPage.includes("closeout-situation-hero"), "Desktop Closeout situation hero must remain.");
assert(closeoutWorkflow.includes("closeout-current-step-card"), "Desktop Closeout current-step region must remain.");
assert(closeoutWorkflow.includes("closeout-workflow-support"), "Desktop Closeout support panel must remain.");
assert(closeoutWorkflow.includes("closeout-workbench-resolved"), "Resolved Closeout state marker must remain.");
assert(closeoutOutcome.includes("Continue final billing processing"), "Resolved Closeout next action must remain intact.");
assert(closeoutOutcome.includes("Payment has not yet been recorded"), "Resolved Closeout must clarify that payment is not recorded.");
assert(closeoutPage.includes("Billing projection updated") || closeoutPage.includes("Billing updated"), "Resolved Closeout must keep billing projection outcome language.");
assert(closeoutPage.includes("Command Center updated"), "Resolved Closeout page must keep Command Center outcome language.");
assert(billingPage.includes("Closeout release approved"), "Billing final-release projection must remain semantically accurate.");
assert(billingPage.includes("Not recorded"), "Billing final-release projection must not imply payment was received.");
assert(billingPage.includes("Other Billing blockers may still require action"), "Billing final-release projection must still distinguish remaining blockers.");

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
    ["closeout page", closeoutPage],
    ["closeout workflow", closeoutWorkflow]
  ]) {
    assert(!visibleCopy(content).includes(term), `${label} must not expose internal architecture language: ${term}.`);
  }
}

if (failures.length > 0) {
  console.error("Closeout mobile unresolved simplification verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Closeout mobile unresolved simplification checks passed.");
console.log(JSON.stringify({
  page: "/closeout",
  mobileTarget: "unresolved final billing release blocker",
  twoPrimarySurfacesBeforeSupport: true,
  initialCta: "Assess closeout requirements",
  resolvedOutcomePreserved: true,
  billingProjectionPreserved: true,
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
  const copyProps = Array.from(content.matchAll(/\b(?:title|summary|subtitle|context|eyebrow|ctaLabel|text)=["`]([^"`]+)["`]/g))
    .map((match) => match[1]);
  return [...jsxText, ...copyProps].join("\n");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
