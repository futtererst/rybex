import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const commandCenter = read("app/command-center/page.tsx");
const rendered = bodyOf(commandCenter);
const css = read("app/globals.css");
const packageJson = JSON.parse(read("package.json"));

assert(commandCenter.includes("data-qa=\"command-center-c-plus-action-queue\""), "Command Center must expose the C+ action queue surface.");
assert(commandCenter.includes("data-qa=\"command-center-executive-framing\""), "Command Center must include an executive framing statement.");
assert(commandCenter.includes("data-qa=\"command-center-rank-1-action\""), "Command Center must include exactly one rank-1 action structure.");
assert(commandCenter.includes("data-qa=\"command-center-supporting-action\""), "Command Center must include subordinate action rows.");
assert(commandCenter.includes("Rank"), "Ranked queue must label rank.");
assert(commandCenter.includes("Blocker"), "Ranked queue must label blocker.");
assert(commandCenter.includes("Impact"), "Ranked queue must label impact.");
assert(commandCenter.includes("Next step"), "Ranked queue must label next step.");
assert(commandCenter.includes("Owner / role"), "Ranked queue must label owner / role.");
assert(commandCenter.includes("Action"), "Ranked queue must label action.");

assert(commandCenter.includes("operating blockers require action today"), "Executive framing must explain that blockers require action today.");
assert(commandCenter.includes("to protect cash, schedule, and closeout"), "Executive framing must explain why the queue matters.");
assert(commandCenter.includes("Start with the highest-impact action"), "Executive framing must tell the user how to use the queue.");
assert(commandCenter.includes("supportingBlockers = unresolvedTriageItems.filter((_, index) => index > 0 && index < 3)"), "Command Center must limit supporting blockers above the fold to two.");
assert(commandCenter.includes("const topPriority = unresolvedTriageItems[0]"), "Rank 1 must be derived from unresolved blocker order.");
assert(commandCenter.includes("resolvedTriageItems = triageItems.filter((item) => item.isResolved)"), "Resolved outcomes must be derived separately.");

for (const expected of [
  "Recover blocked billing",
  "Escalate field issue",
  "Release final billing",
  "Billing Lead",
  "Project Manager",
  "Closeout Lead"
]) {
  assert(commandCenter.includes(expected), `Command Center queue must include ${expected}.`);
}

assert(commandCenter.includes("href: \"/billing\""), "Billing action must route directly to /billing.");
assert(commandCenter.includes("href: \"/field-execution\""), "Field issue action must route directly to /field-execution.");
assert(commandCenter.includes("href: \"/closeout\""), "Closeout action must route directly to /closeout.");

assert(before(rendered, "command-center-executive-framing", "command-center-rank-1-action"), "Executive framing must appear before rank 1.");
assert(before(rendered, "command-center-rank-1-action", "command-center-supporting-actions"), "Rank 1 must appear before supporting actions.");
assert(before(rendered, "command-center-supporting-actions", "CollapsedDetails"), "Supporting actions must appear before collapsed supporting context.");
assert(before(rendered, "command-center-supporting-actions", "Supporting context"), "Supporting context must remain below the ranked queue.");
assert(commandCenter.includes("Reference only. Recently resolved items, watch-list items, and background health signals. The ranked actions above are the current priorities."), "Supporting context must use the approved helper copy.");
assert(!before(rendered, "metrics-grid", "command-center-rank-1-action"), "Metric grids must not appear before the rank-1 action.");
assert(!before(rendered, "NotificationSummaryStrip", "command-center-rank-1-action"), "Notifications must not appear before the rank-1 action.");
assert(!before(rendered, "command-center-resolved-outcomes", "CollapsedDetails"), "Resolved outcomes must not compete above the fold.");
assert(!commandCenter.includes("Supporting operating details"), "Command Center must not use the old supporting details label.");
assert(!commandCenter.includes("role-context-band"), "Command Center support must not render the old role-context band.");

for (const className of [
  ".command-c-plus",
  ".command-c-plus-hero",
  ".command-action-queue",
  ".command-action-primary",
  ".command-action-supporting-row",
  ".command-action-primary-cta"
]) {
  assert(css.includes(className), `CSS must include ${className}.`);
}

assert(css.includes("grid-template-columns: 64px minmax(0, 1.1fr) minmax(280px, 0.9fr) minmax(190px, auto)"), "Rank 1 must use a visually dominant structure.");
assert(css.includes(".command-action-rank-subordinate"), "Supporting rows must have subordinate rank styling.");
assert(css.includes(".command-action-row-cta"), "Supporting rows must have action CTA styling.");

assert(!commandCenter.includes("358"), "Command Center must not expose the old supporting-detail count.");
assert(!commandCenter.includes("count={overdueOperationalItems"), "Command Center must not expose raw supporting counts.");

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

assert(commandCenter.includes("billingPackage.state === \"billing_blocker_cleared\""), "Billing resolved behavior must remain state-derived.");
assert(commandCenter.includes("fieldIssue.state === \"resolved\""), "Field issue resolved behavior must remain state-derived.");
assert(commandCenter.includes("closeoutBlocker.state === \"resolved\""), "Closeout resolved behavior must remain state-derived.");
assert(packageJson.scripts?.["command-center:c-plus-verify"], "package.json must expose command-center:c-plus-verify.");

if (failures.length > 0) {
  console.error("Command Center C+ action queue verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Command Center C+ action queue checks passed.");
console.log(JSON.stringify({
  page: "/command-center",
  model: "executive framing + ranked action queue + collapsed supporting context",
  directRoutes: ["/billing", "/field-execution", "/closeout"],
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
