import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const requiredFiles = [
  "components/d5o/pilot/PilotProgressSummary.tsx",
  "lib/d5o/pilot/pilot-slice.ts",
  "scripts/qa-pilot-progress-hydration.mjs",
  "docs/runtime-stability-fix.md",
  "docs/pilot-mode-guided-operating-slice.md",
  "docs/workflow-editable-field-contract.md",
  "docs/developer-notes.md",
  "docs/demo-readiness.md"
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`Missing required file: ${file}`);
  }
}

const progressPath = join(root, "components/d5o/pilot/PilotProgressSummary.tsx");
const progressSource = read(progressPath);
if (!progressSource.includes("formatPilotProgressTitle(progress)")) {
  failures.push("PilotProgressSummary must render progress title through formatPilotProgressTitle(progress).");
}
if (!progressSource.includes("useWorkflowCompletion")) {
  failures.push("PilotProgressSummary must consume WorkflowCompletionProvider state.");
}
if (!progressSource.includes('data-qa="pilot-progress-title"')) {
  failures.push("PilotProgressSummary must expose data-qa=\"pilot-progress-title\".");
}
if (!progressSource.includes('data-qa="pilot-progress-summary"')) {
  failures.push("PilotProgressSummary must expose data-qa=\"pilot-progress-summary\".");
}

const initialStateLines = progressSource
  .split("\n")
  .filter((line) => /useState|useMemo|const progress|formatPilotProgressTitle/.test(line))
  .join("\n");
if (/window\.|localStorage|readLocalCompletionState\(\)/.test(initialStateLines)) {
  failures.push("PilotProgressSummary appears to read browser/local completion state during initial render state.");
}
if (/readLocalCompletionState|useLocalCompletionStore|localStorage/.test(progressSource)) {
  failures.push("PilotProgressSummary must not read localStorage or the legacy local store directly.");
}

const pilotSlice = read(join(root, "lib/d5o/pilot/pilot-slice.ts"));
if (!pilotSlice.includes("formatPilotProgressTitle")) {
  failures.push("Pilot progress title formatter is missing from pilot-slice.");
}
if (!pilotSlice.includes("`${progress.completed} of ${progress.total} workflows complete`")) {
  failures.push("Pilot progress title formatter must return the full stable title string.");
}

const runtimeQa = read(join(root, "scripts/qa-runtime-stability.mjs"));
for (const expected of ["/pilot", "PilotProgressSummary", "hydration failed", "duplicate key", "encountered a script tag", "getSnapshot should be cached"]) {
  if (!runtimeQa.toLowerCase().includes(expected.toLowerCase())) {
    failures.push(`runtime:qa is missing expected Pilot progress guardrail: ${expected}`);
  }
}

const qa = read(join(root, "scripts/qa-pilot-progress-hydration.mjs"));
for (const expected of [
  "0 of 3 workflows complete",
  "1 of 3 workflows complete",
  "Add missing billing backup",
  "Resolve billing blocker",
  "PilotProgressSummary"
]) {
  if (!qa.includes(expected)) {
    failures.push(`pilot-progress:qa is missing expected regression coverage: ${expected}`);
  }
}

const packageJson = read(join(root, "package.json"));
for (const script of ["pilot-progress:qa", "pilot-progress:verify"]) {
  if (!packageJson.includes(`"${script}"`)) {
    failures.push(`package.json is missing npm script: ${script}`);
  }
}

const docs = [
  "docs/runtime-stability-fix.md",
  "docs/pilot-mode-guided-operating-slice.md",
  "docs/workflow-editable-field-contract.md",
  "docs/developer-notes.md",
  "docs/demo-readiness.md"
].map((file) => read(join(root, file))).join("\n");

if (!docs.includes("Manual runtime failure: Pilot progress hydration mismatch")) {
  failures.push("Docs must include the manual Pilot progress hydration mismatch section.");
}

if (failures.length > 0) {
  console.error("Pilot progress hydration verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Pilot progress hydration verification passed.");

function read(path) {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}
