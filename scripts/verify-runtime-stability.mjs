import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "scripts/qa-runtime-stability.mjs",
  "docs/runtime-stability-fix.md"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`Missing runtime stability file: ${file}`);
  }
}

const packageJson = read("package.json");
for (const script of ["runtime:qa", "runtime:verify"]) {
  if (!packageJson.includes(`"${script}"`)) {
    failures.push(`package.json missing ${script}.`);
  }
}

const appAndComponentFiles = listFiles(["app", "components"], [".tsx", ".ts"]);
const scriptRenderOffenders = appAndComponentFiles.filter((file) => {
  const content = read(file);
  return /<script\b/i.test(content) || /dangerouslySetInnerHTML/i.test(content);
});

for (const file of scriptRenderOffenders) {
  failures.push(`React-rendered script markup remains in ${file}.`);
}

const layout = read("app/layout.tsx");
for (const phrase of ["next/script", "<Script", "workflow-completion-dom-bridge.js"]) {
  if (layout.includes(phrase)) {
    failures.push(`app/layout.tsx must not contain workflow script bridge usage: ${phrase}`);
  }
}

if (fs.existsSync(path.join(root, "public/workflow-completion-dom-bridge.js"))) {
  failures.push("Obsolete public workflow completion script bridge must not exist.");
}

if (read("app/layout.tsx").includes("WorkflowCompletionClientRuntime")) {
  failures.push("app/layout.tsx must use WorkflowCompletionProvider, not WorkflowCompletionClientRuntime.");
}

const completionPanel = read("components/d5o/workflow-completion/WorkflowCompletionPanel.tsx");
if (completionPanel.includes("buildCompletionRuntimeScript") || completionPanel.includes("runtimeDriven")) {
  failures.push("WorkflowCompletionPanel still references the script runtime path.");
}
if (!completionPanel.includes('data-ready="true"')) {
  failures.push("WorkflowCompletionPanel should render a deterministic data-ready=true marker.");
}

const focusedTaskPanel = read("components/d5o/end-user/FocusedTaskPanel.tsx");
if (/useState(?:<[^>]+>)?\(\(\) => getUrlFocus\(\)\)/.test(focusedTaskPanel)) {
  failures.push("FocusedTaskPanel still reads URL focus during initial render.");
}
if (/useState\(\(\) => getPilotModeFlag\(\)\)/.test(focusedTaskPanel)) {
  failures.push("FocusedTaskPanel still reads pilot mode during initial render.");
}

const provider = read("components/d5o/workflow-completion/WorkflowCompletionProvider.tsx");
if (!provider.includes("useReducer") || !provider.includes("localDemoCompletionAdapter.load()")) {
  failures.push("WorkflowCompletionProvider must own reducer state and hydrate from the local/demo adapter.");
}

const completionLocalStore = read("lib/d5o/workflow-completion/local-completion-store.ts");
if (completionLocalStore.includes("useSyncExternalStore")) {
  failures.push("Workflow completion local store must not use useSyncExternalStore in the UI state path.");
}

const duplicateKeyChecks = [
  {
    file: "components/d5o/change-control/ChangeEventTable.tsx",
    disallowed: "key={event.id}"
  },
  {
    file: "components/d5o/change-control/ChangeControlDashboard.tsx",
    disallowed: "key={event.id}"
  },
  {
    file: "components/d5o/change-control/ChangeBackupPanel.tsx",
    disallowed: "key={event.id}"
  },
  {
    file: "components/d5o/change-control/NoticeDeadlineQueue.tsx",
    disallowed: "key={event.id}"
  },
  {
    file: "components/d5o/billing/ApprovedNotBilledQueue.tsx",
    disallowed: "key={event.id}"
  },
  {
    file: "app/command-center/page.tsx",
    disallowed: "key={item.id}"
  }
];

for (const check of duplicateKeyChecks) {
  if (read(check.file).includes(check.disallowed)) {
    failures.push(`${check.file} still uses a known non-unique key: ${check.disallowed}`);
  }
}

const runtimeQa = read("scripts/qa-runtime-stability.mjs");
for (const phrase of [
  "/command-center",
  "/pilot",
  "/billing?focus=billing-billing-backup-cash-recovery&pilot=1#focused-task",
  "/field-execution?focus=field-issue-escalation&pilot=1#focused-task",
  "/closeout?focus=closeout-requirement-final-billing-release&pilot=1#focused-task",
  "duplicate key",
  "encountered a script tag",
  "hydration",
  "getSnapshot should be cached"
]) {
  if (!runtimeQa.toLowerCase().includes(phrase.toLowerCase())) {
    failures.push(`Runtime QA missing coverage phrase: ${phrase}`);
  }
}

const docs = [
  "docs/developer-notes.md",
  "docs/demo-readiness.md",
  "docs/workflow-editable-field-contract.md",
  "docs/pilot-mode-guided-operating-slice.md",
  "docs/runtime-stability-fix.md"
].map(read).join("\n");
if (!/runtime stability/i.test(docs) || !/hydration/i.test(docs)) {
  failures.push("Runtime stability documentation updates are missing.");
}

if (failures.length > 0) {
  console.error("Runtime stability verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Runtime stability verification passed: hydration guardrails, script cleanup, and duplicate key protections are present.");

function read(file) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function listFiles(dirs, extensions) {
  const files = [];
  for (const dir of dirs) {
    walk(path.join(root, dir));
  }
  return files.map((file) => path.relative(root, file).replaceAll("\\", "/"));

  function walk(current) {
    if (!fs.existsSync(current)) return;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        walk(path.join(current, entry));
      }
      return;
    }

    if (extensions.includes(path.extname(current))) {
      files.push(current);
    }
  }
}
