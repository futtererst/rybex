import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const commandCenter = read("app/command-center/page.tsx");
const rendered = bodyOf(commandCenter);
const css = read("app/globals.css");
const packageJson = JSON.parse(read("package.json"));

const helperCopy = "Reference only. Recently resolved items, watch-list items, and background health signals. The ranked actions above are the current priorities.";

assert(commandCenter.includes('title="Supporting context"'), "Command Center must use the approved Supporting context label.");
assert(commandCenter.includes(`summary="${helperCopy}"`), "Command Center must use the approved Supporting context helper copy.");
assert(before(rendered, "command-center-c-plus-action-queue", "Supporting context"), "Supporting context must appear below the ranked action queue.");
assert(before(rendered, "command-center-rank-1-action", "Supporting context"), "Rank 1 must remain visually primary before supporting context.");
assert(commandCenter.includes("supportSections.length > 0"), "Supporting context should be hidden when no approved sections exist.");
assert(commandCenter.includes("buildCommandCenterSupportingContext"), "Command Center must derive a summarized support model.");
assert(commandCenter.includes("appendSupportSection"), "Command Center must hide empty support sections.");

for (const section of ["Recently resolved", "Watch list", "Lower-priority alerts", "Health signals"]) {
  assert(commandCenter.includes(section), `Supporting context must include the approved ${section} section model.`);
}

assert(!commandCenter.includes("Supporting operating details"), "Old Supporting operating details label must be removed.");
assert(!commandCenter.includes("Additional resolved outcomes, alerts, phase health, watch lists, and lower-priority operating context"), "Old broad helper copy must be removed.");
assert(!commandCenter.includes("count={"), "Supporting context must not expose large raw counts.");
assert(!commandCenter.includes("358"), "Supporting context must not expose the old 358 count.");

for (const prohibited of [
  "WorkflowActionCard",
  "WorkflowTransactionPanel",
  "WorkflowCompletionPanel",
  "WorkflowPhaseMap",
  "NextBestAction",
  "DecisionQueue",
  "NotificationSummaryStrip",
  "NotificationPanel",
  "EscalationQueue",
  "EvidenceChecklistPanel",
  "EvidenceNeededNow",
  "CriticalBlockers",
  "SecondaryActionList",
  "ControlList",
  "metrics-grid",
  "phase-lane-grid",
  "role-context-band",
  "pipeline-guardrail",
  "Detailed controls",
  "Stage/gate health map",
  "Active projects by phase",
  "Leadership watch list",
  "Operating actions"
]) {
  assert(!commandCenter.includes(prohibited), `Command Center support must not render prohibited dashboard content: ${prohibited}.`);
}

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
  assert(!visibleText(commandCenter).includes(term), `Command Center should not show internal architecture language: ${term}.`);
}

assert(commandCenter.includes(".slice(0, 3)"), "Supporting context rows must be capped at three items per section.");
assert(commandCenter.includes("const visibleItems = items.filter(Boolean).slice(0, 3)"), "Support sections must enforce a maximum of three visible items.");
assert(css.includes(".command-supporting-context"), "CSS must style the quiet supporting context container.");
assert(css.includes(".command-supporting-context-row"), "CSS must style compact supporting context rows.");
assert(packageJson.scripts?.["command-center:supporting-context-verify"], "package.json must expose command-center:supporting-context-verify.");
assert(packageJson.scripts?.["command-center:c-plus-verify"], "C+ Command Center verification must remain available.");

if (failures.length > 0) {
  console.error("Command Center supporting context verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Command Center supporting context checks passed.");
console.log(JSON.stringify({
  label: "Supporting context",
  sections: ["Recently resolved", "Watch list", "Lower-priority alerts", "Health signals"],
  maxItemsPerSection: 3,
  rankedQueueRemainsPrimary: true,
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

function visibleText(content) {
  return content
    .split("\n")
    .filter((line) => !/^\s*import\b/.test(line))
    .filter((line) => !/from\s+["']/.test(line))
    .filter((line) => !/className=/.test(line))
    .filter((line) => !/data-qa=/.test(line))
    .filter((line) => !/\.slice\(/.test(line))
    .join("\n");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
