import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const planPath = "docs/visual-remediation-batch-2-plan.md";

const billingPage = read("app/billing/page.tsx");
const fieldPage = read("app/field-execution/page.tsx");
const closeoutPage = read("app/closeout/page.tsx");
const commandCenter = read("app/command-center/page.tsx");
const css = read("app/globals.css");
const capture = read("scripts/capture-journey-state-screenshots.mjs");
const packageJson = JSON.parse(read("package.json"));

assert(existsSync(join(root, planPath)), "Visual remediation batch 2 plan must exist.");
assert(packageJson.scripts?.["visual-remediation:verify-batch-2"], "package.json must expose visual-remediation:verify-batch-2.");
assert(packageJson.scripts?.["visual-remediation:verify"], "Batch 1 verifier must remain available.");

assert(billingPage.includes("billing-page active-workbench-page"), "Billing page must expose the active workbench page class.");
assert(billingPage.includes("mobile-workbench-summary"), "Billing page must include compact mobile summary copy.");
assert(billingPage.includes("Missing backup is holding this pay application"), "Billing mobile must explain the cash blocker in compact language.");
assert(billingPage.includes("Final billing release complete"), "Billing final-release projection must use clarified release language.");
assert(billingPage.includes("Other billing blockers may still require action"), "Billing final-release projection must distinguish released final billing from other open blockers.");
assert(billingPage.includes("Released item"), "Billing final-release projection must name the released item.");
assert(billingPage.includes("Remaining blocker"), "Billing final-release projection must name any remaining billing blocker.");

assert(fieldPage.includes("field-execution-page active-workbench-page"), "Field Execution page must expose the active workbench page class.");
assert(fieldPage.includes("mobile-workbench-summary"), "Field Execution page must include compact mobile summary copy.");
assert(closeoutPage.includes("closeout-page active-workbench-page"), "Closeout page must expose the active workbench page class.");
assert(closeoutPage.includes("mobile-workbench-summary"), "Closeout page must include compact mobile summary copy.");

assert(commandCenter.includes("command-center-page"), "Command Center must expose a page class for mobile triage styling.");
assert(commandCenter.includes("command-mobile-priority-summary"), "Command Center mobile must include a stronger top-priority summary.");
assert(commandCenter.includes("command-center-rank-1-action"), "Command Center mobile must include a dominant rank-1 action.");
assert(commandCenter.includes("First action:"), "Command Center executive framing must name the first action.");
assert(!commandCenter.includes(">358<") && !commandCenter.includes(" 358"), "Command Center must not reintroduce the 358 trust defect.");

for (const expectedCss of [
  ".active-workbench-page > .page-header",
  ".command-center-page > .page-header",
  ".mobile-workbench-summary",
  ".command-mobile-priority-summary",
  ".command-c-plus-hero",
  ".command-action-primary",
  ".billing-workbench .guided-step-summary",
  ".field-workbench .guided-step-summary",
  ".closeout-workbench .guided-step-summary",
  ".billing-current-step-card .focused-task-grid",
  ".billing-situation-facts div:nth-child(3)",
  ".field-situation-facts div:nth-child(2)",
  ".closeout-situation-facts div:nth-child(2)"
]) {
  assert(css.includes(expectedCss), `CSS must include Batch 2 mobile rule: ${expectedCss}.`);
}

assert(css.includes("display: none"), "Batch 2 CSS must hide duplicate mobile scaffolding.");
assert(css.includes("border-left: 6px solid var(--accent)"), "Command Center rank-1 action must have stronger visual weight.");
assert(css.includes("background: var(--color-orange)") && css.includes(".command-action-primary-cta"), "Command Center rank-1 CTA must be visually button-like.");

for (const expectedCapture of [
  "field-rfi-created/mobile-rfis-submittals-rfi-created.png",
  "field-change-created/mobile-changes-change-created.png"
]) {
  assert(capture.includes(expectedCapture), `Journey-state capture must declare ${expectedCapture}.`);
}
assert(capture.includes("mkdtemp"), "Journey-state captures must continue to use temporary local stores.");
assert(capture.includes("RYBEXOS_FIELD_ISSUE_STORE_PATH"), "Field downstream screenshots must be captured from isolated Field Issue state.");

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
    ["field page", fieldPage],
    ["closeout page", closeoutPage],
    ["command center", commandCenter]
  ]) {
    assert(!visibleCopy(content).includes(term), `${label} must not expose internal architecture language: ${term}.`);
  }
}

const screenshotPaths = [
  "visual-qa-output/page-layout/mobile/billing.png",
  "visual-qa-output/page-layout/mobile/field-execution.png",
  "visual-qa-output/page-layout/mobile/closeout.png",
  "visual-qa-output/page-layout/mobile/command-center.png",
  "visual-qa-output/journey-states/billing-resolved/mobile-billing-resolved.png",
  "visual-qa-output/journey-states/closeout-resolved/desktop-billing-final-release-projection.png",
  "visual-qa-output/journey-states/field-rfi-created/mobile-rfis-submittals-rfi-created.png",
  "visual-qa-output/journey-states/field-change-created/mobile-changes-change-created.png"
];

if (existsSync(join(root, planPath))) {
  const planMtime = statSync(join(root, planPath)).mtimeMs;
  for (const screenshotPath of screenshotPaths) {
    const fullPath = join(root, screenshotPath);
    assert(existsSync(fullPath), `Required Batch 2 screenshot must exist: ${screenshotPath}`);
    if (existsSync(fullPath)) {
      assert(statSync(fullPath).mtimeMs >= planMtime, `Required Batch 2 screenshot must be regenerated after the plan: ${screenshotPath}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Visual remediation batch 2 verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Visual remediation batch 2 checks passed.");
console.log(JSON.stringify({
  billingMobile: "compact cash blocker summary before action",
  workbenchMobile: "shared compact rule across Billing, Field Execution, and Closeout",
  commandCenterMobile: "stronger top-priority region",
  billingProjection: "closeout release distinguished from remaining billing blockers",
  downstreamMobileCaptures: [
    "visual-qa-output/journey-states/field-rfi-created/mobile-rfis-submittals-rfi-created.png",
    "visual-qa-output/journey-states/field-change-created/mobile-changes-change-created.png"
  ],
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
