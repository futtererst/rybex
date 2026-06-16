import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];

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

function readRequired(file) {
  const absolute = resolve(root, file);
  if (!existsSync(absolute)) {
    failures.push(`Missing required file: ${file}`);
    return "";
  }
  return readFileSync(absolute, "utf8");
}

const cockpit = readRequired("components/d5o/end-user/ActionCockpit.tsx");
for (const phrase of ["Blocked by", "Evidence needed", "Also do", "Open details"]) {
  if (!cockpit.includes(phrase)) {
    failures.push(`ActionCockpit missing required cockpit phrase: ${phrase}`);
  }
}

const workspace = readRequired("components/d5o/end-user/ActionWorkspaceLayout.tsx");
if (!workspace.includes("ActionCockpit")) {
  failures.push("ActionWorkspaceLayout must render ActionCockpit.");
}
for (const oldPanel of ["PrimaryActionCard", "SecondaryActionList", "CriticalBlockers", "EvidenceNeededNow"]) {
  if (workspace.includes(oldPanel)) {
    failures.push(`ActionWorkspaceLayout still renders separate ${oldPanel}.`);
  }
}

const exportsFile = readRequired("components/d5o/end-user/index.ts");
if (!exportsFile.includes("ActionCockpit")) {
  failures.push("End-user component barrel must export ActionCockpit.");
}

for (const page of majorPages) {
  const file = `app/${page}/page.tsx`;
  const source = readRequired(file);
  if (!source.includes("ActionWorkspaceLayout")) {
    failures.push(`${file} must use ActionWorkspaceLayout.`);
  }
  if (!source.includes("CollapsedDetails")) {
    failures.push(`${file} must keep collapsed details available.`);
  }
  for (const directPanel of ["PrimaryActionCard", "SecondaryActionList", "CriticalBlockers", "EvidenceNeededNow"]) {
    if (source.includes(directPanel)) {
      failures.push(`${file} directly renders separate ${directPanel}.`);
    }
  }
}

const pageHeader = readRequired("components/d5o/PageHeader.tsx");
if (!pageHeader.includes(".slice(0, 2)")) {
  failures.push("PageHeader must cap utility actions at two.");
}

const css = readRequired("app/globals.css");
for (const selector of [".action-cockpit", ".single-action-workspace", ".action-cockpit-cta"]) {
  if (!css.includes(selector)) {
    failures.push(`Missing cockpit CSS selector: ${selector}`);
  }
}

const docs = [
  "docs/end-user-visual-acceptance-review.md",
  "docs/end-user-subtraction-backlog.md",
  "docs/end-user-simplification-pass.md",
  "docs/page-simplification-system.md",
  "docs/developer-notes.md"
];

for (const doc of docs) {
  const content = readRequired(doc);
  if (content && !/single action cockpit|action cockpit/i.test(content)) {
    failures.push(`${doc} must mention the single action cockpit refinement.`);
  }
}

if (failures.length > 0) {
  console.error("Single action cockpit verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Single action cockpit verification passed.");
