import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const commandCenter = read("app/command-center/page.tsx");
const rendered = bodyOf(commandCenter);
const css = read("app/globals.css");
const packageJson = JSON.parse(read("package.json"));

assert(commandCenter.includes("data-qa=\"command-center-c-plus-action-queue\""), "Command Center must use the C+ ranked action queue surface.");
assert(commandCenter.includes("data-qa=\"command-center-executive-framing\""), "Command Center must include executive framing.");
assert(commandCenter.includes("data-qa=\"command-center-rank-1-action\""), "Command Center must include one dominant rank-1 action.");
assert(commandCenter.includes("data-qa=\"command-center-supporting-actions\""), "Command Center must include subordinate supporting actions.");
assert(commandCenter.includes("operating blockers require action today"), "Command Center must explain the operating situation in plain English.");
assert(commandCenter.includes("to protect cash, schedule, and closeout"), "Command Center must explain why the queue matters.");
assert(commandCenter.includes("Start with the highest-impact action"), "Command Center must explain how to use the ranked queue.");
assert(commandCenter.includes("Active blockers"), "Command Center must show active blocker count.");
assert(commandCenter.includes("Exposure in view"), "Command Center must show exposure in view.");
assert(commandCenter.includes("Top priority"), "Command Center must name the current top priority.");
assert(!commandCenter.includes("count={overdueOperationalItems"), "Command Center must not expose a raw supporting-detail count.");
assert(!commandCenter.includes("358"), "Command Center source must not hardcode or expose the old 358 supporting-detail count.");

assert(commandCenter.includes("Recover blocked billing"), "Billing CTA must use action language.");
assert(commandCenter.includes("Escalate field issue"), "Field issue CTA must use action language.");
assert(commandCenter.includes("Release final billing"), "Closeout CTA must use action language.");
assert(commandCenter.includes("href: \"/billing\""), "Billing blocker must route to the Billing workbench.");
assert(commandCenter.includes("href: \"/field-execution\""), "Field issue blocker must route to the Field Execution workbench.");
assert(commandCenter.includes("href: \"/closeout\""), "Closeout blocker must route to the Closeout workbench.");

assert(!rendered.includes("ActionWorkspaceLayout"), "Command Center must not render the old cockpit above the action queue.");
assert(!before(rendered, "metrics-grid", "command-center-rank-1-action"), "Broad metric grids must not appear before the rank-1 action.");
assert(before(rendered, "command-center-executive-framing", "command-center-rank-1-action"), "Executive framing must appear before rank 1.");
assert(before(rendered, "command-center-rank-1-action", "command-center-supporting-actions"), "Rank 1 must appear before supporting actions.");
assert(before(rendered, "command-center-supporting-actions", "CollapsedDetails"), "Supporting actions must appear before broad supporting details.");
assert(before(rendered, "command-center-rank-1-action", "CollapsedDetails"), "Rank 1 must appear before broad supporting details.");
assert(!before(rendered, "command-center-resolved-outcomes", "CollapsedDetails"), "Resolved outcomes must be demoted into supporting operating details.");

assert(commandCenter.includes("supportingBlockers = unresolvedTriageItems.filter((_, index) => index > 0 && index < 3)"), "Command Center must limit above-fold supporting blockers to two.");
assert(commandCenter.includes("resolvedTriageItems = triageItems.filter((item) => item.isResolved)"), "Resolved outcomes must be derived below unresolved blockers.");

for (const className of [
  ".command-c-plus-hero",
  ".command-action-queue",
  ".command-action-primary",
  ".command-action-supporting-row",
  ".command-action-rank-subordinate"
]) {
  assert(css.includes(className), `CSS must include ${className}.`);
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

assert(packageJson.scripts?.["command-center:verify"], "package.json must expose command-center:verify.");
assert(packageJson.scripts?.["command-center:c-plus-verify"], "package.json must expose command-center:c-plus-verify.");
assert(packageJson.scripts?.["core-workbench:verify"], "Core workbench verification command must remain available.");
assert(packageJson.scripts?.["page-layout:verify"], "Page layout verification command must remain available.");

if (failures.length > 0) {
  console.error("Command Center C+ visual triage verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Command Center C+ visual triage checks passed.");
console.log(JSON.stringify({
  page: "/command-center",
  topSurface: "executive framing + ranked action queue",
  workbenchRoutes: ["/billing", "/field-execution", "/closeout"],
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
