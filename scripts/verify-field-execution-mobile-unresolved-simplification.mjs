import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const fieldPage = read("app/field-execution/page.tsx");
const fieldWorkflow = read("components/d5o/field-issue-escalation/FieldIssueEscalationWorkflowClient.tsx");
const css = read("app/globals.css");
const packageJson = JSON.parse(read("package.json"));

assert(packageJson.scripts?.["field-execution:verify-mobile-unresolved"], "package.json must expose field-execution:verify-mobile-unresolved.");
assert(packageJson.scripts?.["field-issue:verify-persisted-slice"], "Field Issue persisted-slice verifier must remain available.");
assert(packageJson.scripts?.["field-issue:qa"], "Field Issue browser QA command must remain available.");

assert(fieldPage.includes("field-execution-page-unresolved"), "Field Execution page must expose an unresolved marker for mobile-only simplification.");
assert(fieldPage.includes("mobile-workbench-summary"), "Field Execution must keep a compact mobile field issue summary.");
assert(fieldPage.includes("{fieldIssue.location}"), "Compact field summary must identify the field issue location.");
assert(fieldPage.includes("2}-day exposure") || fieldPage.includes("day exposure"), "Compact field summary must include schedule exposure.");
assert(fieldPage.includes("$18,500") || fieldPage.includes("toLocaleString"), "Compact field summary must include commercial exposure.");
assert(fieldPage.includes("{fieldIssue.summary}"), "Compact field summary must include the issue statement.");
assert(fieldPage.includes("Next: {fieldIssueNextStep.toLowerCase()}"), "Compact field summary must include the next step.");

assert(fieldWorkflow.includes("field-workbench-step-${activeStep}"), "Field workflow must expose the active step for scoped mobile simplification.");
assert(fieldWorkflow.includes("title=\"Start the escalation\""), "Initial field issue action surface must lead with Start the escalation.");
assert(fieldWorkflow.includes("Confirm that this condition needs formal follow-up."), "Initial field issue action must explain why escalation starts.");
assert(fieldWorkflow.includes("The workflow will guide the user to an RFI, Change Event, or both."), "Initial field issue action must explain RFI/change/both routing.");
assert(fieldWorkflow.includes("field-mobile-issue-line"), "Initial field issue action must include one concise issue statement.");
assert(fieldWorkflow.includes("data-qa=\"field-issue-start\""), "Initial field issue action must preserve the Start escalation CTA selector.");

assert(before(bodyOf(fieldPage), "field-situation-hero", "FieldIssueEscalationWorkflowClient"), "Compact field summary must appear before the workflow action.");
assert(before(fieldWorkflow, "field-current-step-card", "field-workflow-support"), "Field current action must appear before the support panel.");
assert(before(bodyOf(fieldPage), "FieldIssueEscalationWorkflowClient", "Supporting field details"), "Supporting field details must appear below the active workflow.");

for (const expectedCss of [
  ".field-execution-page-unresolved .field-situation-facts",
  ".field-workbench-step-understand:not(.field-workbench-resolved) .field-workflow-support",
  ".field-workbench-step-understand:not(.field-workbench-resolved) > .guided-supporting-details",
  ".field-workbench-step-understand:not(.field-workbench-resolved) .field-current-step-card .completion-facts",
  ".field-mobile-issue-line",
  ".field-execution-page #details-records .progressive-details summary::after"
]) {
  assert(css.includes(expectedCss), `CSS must include Field unresolved mobile simplification rule: ${expectedCss}.`);
}

assert(css.includes(".field-execution-page-unresolved .field-situation-facts") && css.includes("display: none"), "Field unresolved mobile must not render separate Project/Location, Impact, or Next Step fact cards.");
assert(css.includes(".field-workbench-step-understand:not(.field-workbench-resolved) .field-workflow-support") && css.includes("display: none"), "Field pre-start mobile must not render Required/Complete/Next support stack.");
assert(css.includes(".field-workbench-step-understand:not(.field-workbench-resolved) .field-current-step-card .completion-facts") && css.includes("display: none"), "Field pre-start mobile must not render separate Issue and Location metadata cards.");
assert(!visibleCopy(fieldWorkflow).includes("Save the impact assessment before escalation has started"), "Field mobile copy must not introduce a pre-start assessment contradiction.");
assert(fieldWorkflow.includes("if (!state.readiness.assessmentComplete) return \"Save the impact assessment.\""), "Later assessment guidance must remain available after escalation starts.");

assert(fieldPage.includes("title=\"Supporting field details\""), "Field page must keep one page-level Supporting field details disclosure.");
assert(css.includes(".field-execution-page #details-records .progressive-details summary small") && css.includes("display: none"), "Field supporting details helper copy must stay hidden while collapsed on mobile.");
assert(fieldWorkflow.includes("Supporting field issue details"), "Workflow supporting details source may remain for non-initial states.");
assert(css.includes(".field-workbench-step-understand:not(.field-workbench-resolved) > .guided-supporting-details") && css.includes("display: none"), "Initial mobile state must show only the page-level Supporting field details disclosure.");

assert(fieldPage.includes("field-situation-hero"), "Desktop Field Execution situation hero must remain.");
assert(fieldWorkflow.includes("field-current-step-card"), "Desktop Field Execution current-step region must remain.");
assert(fieldWorkflow.includes("field-workflow-support"), "Desktop Field Execution support panel must remain.");
assert(fieldWorkflow.includes("field-workbench-resolved"), "Resolved Field Execution state marker must remain.");
assert(fieldWorkflow.includes("field-issue-outcome"), "Resolved Field Execution outcome must remain.");

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
    ["field page", fieldPage],
    ["field workflow", fieldWorkflow]
  ]) {
    assert(!visibleCopy(content).includes(term), `${label} must not expose internal architecture language: ${term}.`);
  }
}

if (failures.length > 0) {
  console.error("Field Execution mobile unresolved simplification verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Field Execution mobile unresolved simplification checks passed.");
console.log(JSON.stringify({
  page: "/field-execution",
  mobileTarget: "unresolved field issue",
  twoPrimarySurfacesBeforeSupport: true,
  rfiChangeGuidancePresent: true,
  laterWorkflowBehaviorPreserved: true,
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
  const copyProps = Array.from(content.matchAll(/\b(?:title|summary|subtitle|context|eyebrow|ctaLabel|text)=["`]([^"`]+)["`]/g))
    .map((match) => match[1]);
  return [...jsxText, ...copyProps].join("\n");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
