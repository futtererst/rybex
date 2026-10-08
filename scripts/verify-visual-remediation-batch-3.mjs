import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const planPath = "docs/visual-remediation-batch-3-plan.md";
const rfiPage = read("app/rfis-submittals/page.tsx");
const changesPage = read("app/changes/page.tsx");
const commandCenter = read("app/command-center/page.tsx");
const billingPage = read("app/billing/page.tsx");
const fieldPage = read("app/field-execution/page.tsx");
const closeoutPage = read("app/closeout/page.tsx");
const css = read("app/globals.css");
const packageJson = JSON.parse(read("package.json"));

assert(existsSync(join(root, planPath)), "Visual remediation batch 3 plan must exist.");
assert(packageJson.scripts?.["visual-remediation:verify-batch-3"], "package.json must expose visual-remediation:verify-batch-3.");
assert(packageJson.scripts?.["visual-remediation:verify-batch-2"], "Batch 2 verifier must remain available.");
assert(packageJson.scripts?.["visual-remediation:verify"], "Batch 1 verifier must remain available.");

assert(rfiPage.includes("rfis-submittals-page downstream-record-page"), "RFIs/Submittals must expose downstream page class for compact mobile treatment.");
assert(rfiPage.includes("`${fieldIssueRfi.rfiNumber} created`"), "Created RFI mobile hero must state that the RFI was created.");
assert(rfiPage.includes("downstream-mobile-summary"), "Created RFI must include compact mobile summary copy.");
assert(rfiPage.includes("exists because the field issue needs a formal answer"), "Created RFI compact summary must explain why the RFI exists.");
assert(rfiPage.includes("data-qa=\"downstream-rfi-record\""), "Created RFI card must remain the featured record.");
assert(rfiPage.includes("data-qa=\"rfi-source-record-trace\""), "RFI source trace must remain available.");

assert(changesPage.includes("changes-page downstream-record-page"), "Changes must expose downstream page class for compact mobile treatment.");
assert(changesPage.includes("Change exposure created"), "Created Changes mobile hero must state that exposure was created.");
assert(changesPage.includes("downstream-mobile-summary"), "Created Changes must include compact mobile summary copy.");
assert(changesPage.includes("protects {currency.format(fieldIssueChange.valueEstimate)}"), "Created Changes compact summary must explain the protected exposure.");
assert(changesPage.includes("data-qa=\"downstream-change-record\""), "Created Changes card must remain the featured exposure.");
assert(changesPage.includes("data-qa=\"change-source-entitlement-trace\""), "Changes source trace must remain available.");
assert(!changesPage.includes("No linked RFI"), "Batch 2 linked-RFI contradiction must not return.");
assert(!changesPage.includes("?? \"RFI review\""), "Changes trace must not imply RFI review when no RFI is linked.");

assert(commandCenter.includes("command-c-plus-lead"), "Command Center must include a stronger executive first-action line.");
assert(commandCenter.includes("command-action-primary"), "Command Center must include a stronger rank-1 action treatment.");
assert(commandCenter.includes("supportingBlockers = unresolvedTriageItems.filter((_, index) => index > 0 && index < 3)"), "Command Center must keep only two subordinate blockers above the fold.");
assert(!commandCenter.includes("358"), "Command Center must not reintroduce the 358 trust defect.");
assert(commandCenter.includes("href: \"/billing\""), "Command Center Billing CTA must still route to Billing.");
assert(commandCenter.includes("href: \"/field-execution\""), "Command Center Field CTA must still route to Field Execution.");
assert(commandCenter.includes("href: \"/closeout\""), "Command Center Closeout CTA must still route to Closeout.");

for (const expectedCss of [
  ".downstream-record-page > .page-header",
  ".downstream-mobile-summary",
  ".featured-rfi-next .button-secondary",
  ".featured-change-next .button-secondary",
  ".rfi-situation-facts div:nth-child(5)",
  ".change-entitlement-facts div:nth-child(6)",
  ".command-c-plus-hero",
  ".command-action-primary",
  ".command-action-supporting-row",
  "box-shadow: 0 20px 38px rgba(15, 23, 42, 0.08)"
]) {
  assert(css.includes(expectedCss), `CSS must include Batch 3 visual rule: ${expectedCss}.`);
}

assert(billingPage.includes("billing-page active-workbench-page"), "Billing must remain an active workbench page.");
assert(fieldPage.includes("field-execution-page active-workbench-page"), "Field Execution must remain an active workbench page.");
assert(closeoutPage.includes("closeout-page active-workbench-page"), "Closeout must remain an active workbench page.");
assert(css.includes(".billing-workbench .guided-step-summary"), "Billing compact workbench order must remain styled.");
assert(css.includes(".field-workbench .guided-step-summary"), "Field compact workbench order must remain styled.");
assert(css.includes(".closeout-workbench .guided-step-summary"), "Closeout compact workbench order must remain styled.");

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
    ["RFIs/Submittals", rfiPage],
    ["Changes", changesPage],
    ["Command Center", commandCenter],
    ["Billing", billingPage],
    ["Field Execution", fieldPage],
    ["Closeout", closeoutPage]
  ]) {
    assert(!visibleCopy(content).includes(term), `${label} must not expose internal architecture language: ${term}.`);
  }
}

if (failures.length > 0) {
  console.error("Visual remediation batch 3 verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Visual remediation batch 3 checks passed.");
console.log(JSON.stringify({
  downstreamMobile: "compact created-state RFI and Changes structures",
  commandCenter: "stronger executive framing and rank-1 action queue",
  workbenches: "light shared hierarchy refinements only",
  humanReviewStillRequired: true
}, null, 2));

function read(filePath) {
  const fullPath = join(root, filePath);
  assert(existsSync(fullPath), `${filePath} must exist.`);
  return readFileSync(fullPath, "utf8");
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
