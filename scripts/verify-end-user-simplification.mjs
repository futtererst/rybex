import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "components/d5o/end-user/ActionWorkspaceLayout.tsx",
  "components/d5o/end-user/PrimaryActionCard.tsx",
  "components/d5o/end-user/SecondaryActionList.tsx",
  "components/d5o/end-user/CriticalBlockers.tsx",
  "components/d5o/end-user/EvidenceNeededNow.tsx",
  "components/d5o/end-user/CollapsedDetails.tsx",
  "lib/d5o/end-user/derive-primary-action.ts",
  "lib/d5o/end-user/derive-critical-blockers.ts",
  "lib/d5o/end-user/derive-evidence-needed-now.ts",
  "lib/d5o/end-user/page-focus-config.ts",
  "docs/end-user-simplification-pass.md"
];

const majorPages = [
  "command-center",
  "pipeline",
  "projects",
  "mobilization",
  "field-execution",
  "rfis-submittals",
  "changes",
  "billing",
  "safety",
  "quality",
  "closeout",
  "reports"
];

const denseSignals = [
  "Dashboard",
  "WorkflowModuleContext",
  "metrics-grid",
  "ProjectListTable",
  "OpportunityTable",
  "MobilizationTable",
  "RfiSubmittalDashboard",
  "ChangeControlDashboard",
  "SafetyDashboard",
  "QualityDashboard",
  "CloseoutDashboard",
  "OptimizeDashboard",
  "FieldExecutionDashboard"
];

const failures = [];

function requireFile(file) {
  if (!existsSync(path.join(root, file))) {
    failures.push(`Missing required file: ${file}`);
  }
}

for (const file of requiredFiles) {
  requireFile(file);
}

for (const page of majorPages) {
  const file = `app/${page}/page.tsx`;
  const pagePath = path.join(root, file);
  if (!existsSync(pagePath)) {
    failures.push(`Missing major page: ${file}`);
    continue;
  }

  const content = readFileSync(pagePath, "utf8");
  if (!content.includes("ActionWorkspaceLayout")) {
    failures.push(`${file} does not use ActionWorkspaceLayout.`);
  }
  if (!content.includes("CollapsedDetails")) {
    failures.push(`${file} does not provide collapsed details.`);
  }
  if (!content.includes("getEndUserWorkspaceSummary")) {
    failures.push(`${file} does not use end-user page focus derivation.`);
  }

  const workspaceIndex = content.indexOf("<ActionWorkspaceLayout");
  const detailsIndex = content.indexOf("<CollapsedDetails");
  if (workspaceIndex === -1 || detailsIndex === -1 || detailsIndex < workspaceIndex) {
    failures.push(`${file} must render collapsed details after the action workspace.`);
  }

  const visibleTop = workspaceIndex > -1 && detailsIndex > -1
    ? content.slice(workspaceIndex, detailsIndex)
    : content;
  for (const signal of denseSignals) {
    if (visibleTop.includes(signal)) {
      failures.push(`${file} exposes dense ${signal} before collapsed details.`);
    }
  }
}

const focusConfig = readFileSync(path.join(root, "lib/d5o/end-user/page-focus-config.ts"), "utf8");
for (const page of majorPages) {
  if (!focusConfig.includes(`${page}`)) {
    failures.push(`page-focus-config is missing ${page}.`);
  }
}

const docs = [
  "docs/page-simplification-system.md",
  "docs/page-comprehension-qa-review.md",
  "docs/page-remediation-backlog.md",
  "docs/demo-readiness.md",
  "docs/controlled-pilot-launch-plan.md",
  "docs/developer-notes.md"
];

for (const doc of docs) {
  requireFile(doc);
  if (existsSync(path.join(root, doc))) {
    const content = readFileSync(path.join(root, doc), "utf8");
    if (!/end-user|action workspace|default view/i.test(content)) {
      failures.push(`${doc} does not mention the end-user simplification/action workspace pass.`);
    }
  }
}

if (failures.length > 0) {
  console.error("End-user simplification verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("End-user simplification verification passed.");
