import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const planPath = "docs/visual-remediation-batch-1-plan.md";

const billingPage = read("app/billing/page.tsx");
const billingWorkflow = read("components/d5o/billing-v2/BillingV2WorkflowClient.tsx");
const billingOutcome = read("components/d5o/billing-v2/BillingV2StepOutcomeRecord.tsx");
const fieldWorkflow = read("components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx");
const closeoutWorkflow = read("components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx");
const changesPage = read("app/changes/page.tsx");
const commandCenter = read("app/command-center/page.tsx");
const css = read("app/globals.css");
const journeyCapture = read("scripts/capture-journey-state-screenshots.mjs");
const packageJson = JSON.parse(read("package.json"));

assert(existsSync(join(root, planPath)), "Visual remediation batch plan must exist.");
assert(packageJson.scripts?.["visual-remediation:verify"], "package.json must expose visual-remediation:verify.");

assert(before(billingOutcome, "Cash blocker cleared", "Supporting billing history"), "Billing resolved outcome must lead with concise cash blocker language before supporting history.");
assert(before(billingOutcome, "Amount recovered", "Supporting billing history"), "Billing resolved outcome must show recovered amount before supporting history.");
assert(before(billingOutcome, "Command Center", "Supporting billing history"), "Billing resolved outcome must state Command Center update before supporting history.");
assert(before(billingOutcome, "Open billing records", "Supporting billing history"), "Billing resolved action must appear before dense supporting history.");
assert(billingOutcome.includes("billing-history-details"), "Billing evidence/history must be demoted into supporting billing history.");
assert(!before(billingOutcome, "Evidence captured", "Open billing records"), "Evidence history must not appear before the resolved next action.");

assert(billingPage.includes("data-qa=\"billing-final-release-projection\""), "Billing must expose a concise closeout final billing projection summary.");
assert(before(bodyOf(billingPage), "billing-final-release-projection", "Supporting billing details"), "Billing final-release projection summary must appear before dense supporting billing details.");
assert(billingPage.includes("final billing paid | retainage released"), "Billing final-release projection must show the release state in business language.");
assert(journeyCapture.includes("desktop-billing-final-release-projection.png"), "Journey-state capture must still capture the closeout-to-billing projection.");
assert(!journeyCapture.includes("const toggle = page.locator('[data-qa=\"details-toggle\"]').first();"), "Closeout-to-billing screenshot capture must not expand dense billing details.");

assert(changesPage.includes("Direct change path"), "Changes must use direct change path language when no RFI is linked.");
assert(!changesPage.includes("No linked RFI"), "Changes must not show the old No linked RFI contradiction.");
assert(!changesPage.includes("?? \"RFI review\""), "Changes must not imply RFI review when no RFI is linked.");
assert(changesPage.includes("changeEvent.linkedRfiIds.length > 0"), "Changes must still support a real linked-RFI state when one exists.");

assert(!commandCenter.includes("count={overdueOperationalItems"), "Command Center supporting details must not expose the raw count.");
assert(!commandCenter.includes(">358<") && !commandCenter.includes(" 358"), "Command Center must not show the old 358 trust defect.");
assert(commandCenter.includes("Reference only. Recently resolved items, watch-list items, and background health signals. The ranked actions above are the current priorities."), "Command Center supporting copy should be business-facing instead of count-led.");

assert(billingWorkflow.includes("billing-workbench-recovered"), "Billing workflow must mark recovered state for compact mobile treatment.");
assert(fieldWorkflow.includes("field-workbench-resolved"), "Field workflow must mark resolved state for compact mobile treatment.");
assert(closeoutWorkflow.includes("closeout-workbench-resolved"), "Closeout workflow must mark resolved state for compact mobile treatment.");
assert(css.includes(".billing-workbench-recovered .guided-step-summary"), "CSS must hide resolved Billing progress scaffolding on mobile.");
assert(css.includes(".field-workbench-resolved .guided-step-summary"), "CSS must hide resolved Field progress scaffolding on mobile.");
assert(css.includes(".closeout-workbench-resolved .guided-step-summary"), "CSS must hide resolved Closeout progress scaffolding on mobile.");
assert(css.includes(".field-workbench:not(.field-workbench-resolved) .field-current-step-card .completion-facts div:nth-child(n+3)"), "Mobile Field first-step metadata must be reduced.");
assert(css.includes(".closeout-workbench:not(.closeout-workbench-resolved) .closeout-current-step-card .completion-facts div:nth-child(n+2)"), "Mobile Closeout first-step metadata must be reduced.");

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
    ["billing outcome", billingOutcome],
    ["billing page", billingPage],
    ["changes page", changesPage],
    ["command center", commandCenter]
  ]) {
    assert(!visibleCopy(content).includes(term), `${label} must not expose internal architecture language: ${term}.`);
  }
}

const screenshotPaths = [
  "visual-qa-output/journey-states/billing-resolved/mobile-billing-resolved.png",
  "visual-qa-output/journey-states/closeout-resolved/desktop-billing-final-release-projection.png",
  "visual-qa-output/journey-states/field-change-created/desktop-changes-change-created.png",
  "visual-qa-output/page-layout/mobile/command-center.png",
  "visual-qa-output/page-layout/mobile/billing.png",
  "visual-qa-output/page-layout/mobile/field-execution.png",
  "visual-qa-output/page-layout/mobile/closeout.png"
];

const planMtime = statSync(join(root, planPath)).mtimeMs;
for (const screenshotPath of screenshotPaths) {
  const fullPath = join(root, screenshotPath);
  assert(existsSync(fullPath), `Required screenshot must exist: ${screenshotPath}`);
  if (existsSync(fullPath)) {
    assert(statSync(fullPath).mtimeMs >= planMtime, `Required screenshot must be regenerated for this pass: ${screenshotPath}`);
  }
}

if (failures.length > 0) {
  console.error("Visual remediation batch 1 verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Visual remediation batch 1 checks passed.");
console.log(JSON.stringify({
  billingResolvedMobile: "concise outcome before supporting history",
  billingCloseoutProjection: "summary visible before dense billing details",
  changesLinkedRfi: "no contradictory linked-RFI copy",
  commandCenter: "raw supporting count removed",
  mobileScreenshots: "current screenshot paths exist and are newer than the batch plan",
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
