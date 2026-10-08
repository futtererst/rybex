import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const requiredDocs = [
  "docs/billing-v2-ui-failure-review.md",
  "docs/billing-v2-guided-workflow-interaction-design.md",
  "docs/billing-v2-step-by-step-storyboard.md",
  "docs/billing-v2-replacement-ui-implementation-plan.md"
];

for (const file of requiredDocs) {
  if (!existsSync(join(root, file))) {
    failures.push(`Missing required reset document: ${file}`);
  }
}

const failureReview = read("docs/billing-v2-ui-failure-review.md");
for (const phrase of [
  "failed manual review",
  "forms and buttons",
  "visually cluttered",
  "hard to understand",
  "No clear workflow guide",
  "failed Billing v2 Phase 1B UI attempt as accepted UI"
]) {
  requirePhrase(failureReview, phrase, "UI failure review");
}

const interactionDesign = read("docs/billing-v2-guided-workflow-interaction-design.md");
for (const phrase of [
  "guided business workflow",
  "not a form dashboard",
  "Process Rail",
  "Active Step Workspace",
  "Readiness / Context Panel",
  "0/5 complete",
  "review task created",
  "The outcome must not be only a banner"
]) {
  requirePhrase(interactionDesign, phrase, "guided interaction design");
}

const storyboard = read("docs/billing-v2-step-by-step-storyboard.md");
for (const step of [
  "Step 1 — Understand Blocker",
  "Step 2 — Build Backup Package",
  "Step 3 — Add Required Proof",
  "Step 4 — Submit For Commercial Review",
  "Step 5 — Record Review Decision",
  "Step 6 — Clear Billing Blocker",
  "Step 7 — View Outcome Record"
]) {
  requirePhrase(storyboard, step, "storyboard");
}

for (const phrase of [
  "Start backup package",
  "Save package details and continue",
  "Validate package readiness",
  "Send package to commercial review",
  "Approve package",
  "Clear billing blocker",
  "Return to Pilot Mode",
  "Open billing records"
]) {
  requirePhrase(storyboard, phrase, "storyboard");
}

const implementationPlan = read("docs/billing-v2-replacement-ui-implementation-plan.md");
for (const phrase of [
  "Preserve the accepted Phase 1A domain layer",
  "Discard/rework the failed Phase 1B section-dashboard approach",
  "ProcessRail",
  "ActiveStepWorkspace",
  "ReadinessContextPanel",
  "Do not refactor Field or Closeout",
  "No replacement UI implementation occurred"
]) {
  requirePhrase(implementationPlan, phrase, "replacement implementation plan");
}

const allResetDocs = requiredDocs.map(read).join("\n");
for (const phrase of [
  "No replacement UI implementation occurred",
  "failed UI should not be committed as accepted UI"
]) {
  requirePhrase(allResetDocs, phrase, "reset docs");
}

const developerNotes = read("docs/developer-notes.md");
for (const phrase of [
  "Billing v2 Interaction Design Reset",
  "Billing v2 Phase 1B UI attempt failed manual review",
  "guided interaction redesign package",
  "No replacement UI implementation occurred",
  "Billing v2 domain layer remains the accepted foundation"
]) {
  requirePhrase(developerNotes, phrase, "developer notes");
}

const packageJson = read("package.json");
if (!packageJson.includes('"billing-v2:verify-interaction-design"')) {
  failures.push("package.json missing billing-v2:verify-interaction-design script.");
}

if (failures.length > 0) {
  console.error("Billing v2 interaction design reset verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Billing v2 interaction design reset verification passed.");

function read(file) {
  const filePath = join(root, file);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function requirePhrase(contents, phrase, label) {
  if (!contents.toLowerCase().includes(phrase.toLowerCase())) {
    failures.push(`${label} missing required phrase: ${phrase}`);
  }
}
