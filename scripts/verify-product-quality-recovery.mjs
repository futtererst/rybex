import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const targetPages = [
  {
    route: "/command-center",
    file: "app/command-center/page.tsx",
    purpose: "See the blockers that need action now",
    required: ["command-center-c-plus-action-queue", "command-center-rank-1-action", "Ranked operating action queue", "Supporting context"],
    forbidden: ["primaryAction={{", "Pilot Mode:", "Demo data mode", "Complete the three proven operating workflows"]
  },
  {
    route: "/billing",
    file: "app/billing/page.tsx",
    purpose: "Recover blocked cash",
    required: ["active-workflow-mode", "BillingV2GuidedWorkflow", "Supporting billing details"],
    forbidden: ["primaryAction={{", "ActionCockpit"]
  },
  {
    route: "/field-execution",
    file: "app/field-execution/page.tsx",
    purpose: "Turn a field issue into the right RFI or change path",
    required: ["active-workflow-mode", "FieldIssueEscalationWorkflowClient", "Supporting field details"],
    forbidden: ["primaryAction={{", "ActionWorkspaceLayout"]
  },
  {
    route: "/closeout",
    file: "app/closeout/page.tsx",
    purpose: "Release final billing and retainage",
    required: ["active-workflow-mode", "CloseoutFinalBillingWorkflowClient", "Supporting closeout details"],
    forbidden: ["primaryAction={{", "ActionWorkspaceLayout"]
  },
  {
    route: "/rfis-submittals",
    file: "app/rfis-submittals/page.tsx",
    purpose: "Track formal answers and approvals",
    required: ["data-qa=\"downstream-rfi-record\"", "rfi-field-issue-lake-001", "Supporting RFI and submittal details"],
    forbidden: ["ActionWorkspaceLayout", "primaryAction={{"]
  },
  {
    route: "/changes",
    file: "app/changes/page.tsx",
    purpose: "Track field-driven commercial recovery",
    required: ["data-qa=\"downstream-change-record\"", "Field issue change path", "Supporting change records"],
    forbidden: ["ActionWorkspaceLayout", "primaryAction={{"]
  }
];

for (const page of targetPages) {
  assertFile(page.file);
  const content = readFile(page.file);
  assert(content.includes(page.purpose), `${page.route} must state a plain-English page purpose.`);
  for (const required of page.required) {
    assert(content.includes(required), `${page.route} must include ${required}.`);
  }
  for (const forbidden of page.forbidden) {
    assert(!content.includes(forbidden), `${page.route} should not include ${forbidden} above the primary work surface.`);
  }
}

const actionCockpit = readFile("components/d5o/end-user/ActionCockpit.tsx");
assert(!actionCockpit.includes("Also do"), "Action cockpit should not show secondary CTAs as equal above-fold actions.");
assert(actionCockpit.includes("Why it matters"), "Action cockpit should explain why the primary action matters.");

const billingWorkflow = readFile("components/d5o/billing-v2/BillingV2WorkflowClient.tsx");
assert(!billingWorkflow.includes("BillingV2ProcessRail"), "Billing workflow should not render the visual process rail above the fold.");
assert(!billingWorkflow.includes("BillingV2ReadinessContextPanel"), "Billing workflow should not render the readiness rail above the fold.");
assert(billingWorkflow.includes("data-qa=\"billing-v2-situation-header\""), "Billing workflow should expose a business situation header.");

for (const file of [
  "app/command-center/page.tsx",
  "app/billing/page.tsx",
  "app/field-execution/page.tsx",
  "app/closeout/page.tsx",
  "app/rfis-submittals/page.tsx",
  "app/changes/page.tsx",
  "components/d5o/billing-v2/BillingV2WorkflowClient.tsx",
  "components/d5o/billing-v2/BillingV2StepOutcomeRecord.tsx",
  "components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx",
  "components/d5o/closeout-final-billing/CloseoutFinalBillingWorkflowClient.tsx",
  "components/d5o/end-user/ActionCockpit.tsx",
  "components/d5o/end-user/FocusedTaskPanel.tsx",
  "components/layout/PrimaryNav.tsx",
  "app/layout.tsx",
  "lib/d5o/end-user/task-outcome-contract.ts"
]) {
  const visibleText = readFile(file)
    .split("\n")
    .filter((line) => !/^\s*import\b/.test(line))
    .filter((line) => !/from\s+["']/.test(line))
    .join("\n");
  for (const term of [
    "local adapter",
    "registry",
    "QA proof",
    "workflow engine",
    "persisted store",
    "Storage status",
    "Store:",
    "Process rail",
    "process rail",
    "Readiness context",
    "readiness context",
    "Demo data mode",
    "Pilot Mode",
    "DEMO ROLE",
    "Demo role",
    "Powered by D5O",
    "state locally",
    "Production pay app submission",
    "external GC submission",
    "operating workflow tracking"
  ]) {
    assert(!visibleText.includes(term), `${file} should not show internal architecture language: ${term}.`);
  }
}

assert(before("app/billing/page.tsx", "BillingV2GuidedWorkflow", "CollapsedDetails"), "Billing workflow must appear before supporting details.");
assert(before("app/field-execution/page.tsx", "FieldIssueEscalationWorkflowClient", "CollapsedDetails"), "Field Issue workflow must appear before supporting details.");
assert(before("app/closeout/page.tsx", "CloseoutFinalBillingWorkflowClient", "CollapsedDetails"), "Closeout workflow must appear before supporting details.");
assert(before("app/rfis-submittals/page.tsx", "downstream-rfi-record", "CollapsedDetails"), "RFI downstream record must appear before supporting details.");
assert(before("app/changes/page.tsx", "downstream-change-record", "CollapsedDetails"), "Change downstream record must appear before supporting details.");

if (failures.length > 0) {
  console.error("Product quality recovery verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Product quality recovery checks passed.");
console.log(JSON.stringify({
  targetPages: targetPages.map((page) => page.route),
  primaryActionRegions: "single above-fold region per target page",
  railsAboveFold: "removed from Billing V2 workflow",
  downstreamRecords: "RFIs/Submittals and Changes promoted above supporting details",
  humanReviewStillRequired: true
}, null, 2));

function readFile(filePath) {
  return readFileSync(join(root, filePath), "utf8");
}

function assertFile(filePath) {
  assert(existsSync(join(root, filePath)), `${filePath} must exist.`);
}

function before(filePath, first, second) {
  const content = readFile(filePath);
  const bodyStart = content.indexOf("return (");
  const body = bodyStart >= 0 ? content.slice(bodyStart) : content;
  const firstIndex = body.indexOf(first);
  const secondIndex = body.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
