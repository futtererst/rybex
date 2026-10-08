import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const repoRoot = process.cwd();
const tempRoot = mkdtempSync(join(tmpdir(), "rybexos-field-issue-"));
const outDir = join(tempRoot, "dist");
const storePath = join(tempRoot, "field-issue-store.json");
const tempTsconfig = join(tempRoot, "tsconfig.field-issue-verify.json");

process.env.RYBEXOS_FIELD_ISSUE_STORE_PATH = storePath;

writeFileSync(tempTsconfig, JSON.stringify({
  extends: join(repoRoot, "tsconfig.json"),
  compilerOptions: {
    noEmit: false,
    outDir,
    rootDir: repoRoot,
    module: "CommonJS",
    moduleResolution: "Node",
    ignoreDeprecations: "6.0",
    declaration: false,
    sourceMap: false,
    incremental: false,
    tsBuildInfoFile: join(tempRoot, "tsconfig.tsbuildinfo")
  },
  files: [
    join(repoRoot, "lib", "d5o", "field-issue-escalation", "app-state.ts"),
    join(repoRoot, "lib", "d5o", "field-issue-escalation", "persisted-store.ts"),
    join(repoRoot, "lib", "d5o", "workflow", "derive-workflows.ts")
  ]
}, null, 2));

try {
  execFileSync(process.execPath, [
    join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
    "--project",
    tempTsconfig
  ], {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe"
  });
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout.toString());
  if (error.stderr) process.stderr.write(error.stderr.toString());
  throw error;
}

const store = await import(pathToFileURL(join(outDir, "lib", "d5o", "field-issue-escalation", "persisted-store.js")).href);
const appState = await import(pathToFileURL(join(outDir, "lib", "d5o", "field-issue-escalation", "app-state.js")).href);
const workflow = await import(pathToFileURL(join(outDir, "lib", "d5o", "workflow", "derive-workflows.js")).href);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSuccess(result, message) {
  assert(result.success, `${message}: ${result.message ?? result.error ?? "unknown failure"}`);
}

function unresolvedFieldWorkflows(overlay) {
  return workflow.deriveOperatingWorkflows(overlay).allOperatingWorkflows.filter((item) =>
    item.sourceRecordId === "dr-lake-bore-0610" &&
    item.workflowType === "field_execution" &&
    item.resolutionState !== "resolved"
  );
}

const initial = await store.getFieldIssueEscalation();
assert(initial.state === "unresolved", "Fresh persisted field issue should start unresolved.");

writeFileSync(storePath, "{ corrupt json", "utf8");
const recovered = await store.getFieldIssueEscalation();
assert(recovered.state === "unresolved", "Corrupt JSON should recover to deterministic unresolved state.");

await store.resetFieldIssueEscalationStoreForTesting();
assert((await store.listOpenFieldIssues()).length === 1, "Reset should restore one canonical open field issue.");
const resetOverlay = await store.getFieldIssueSeedDataOverlay();
assert(unresolvedFieldWorkflows(resetOverlay).length > 0, "Reset command-center derivation should include the unresolved field issue.");

const clearBeforeStart = await store.resolveFieldIssueEscalation({
  actorId: "Verification user",
  resolutionNote: "Trying too early."
});
assert(!clearBeforeStart.success, "Resolving before package start should fail.");

const started = await store.startFieldIssueEscalation({ actorId: "Verification user" });
assertSuccess(started, "Starting field issue escalation should succeed");
assert(started.issue.state === "in_progress", "Start should persist in-progress state.");
assert((await store.getFieldIssueEscalation()).state === "in_progress", "Started state should survive repository reload.");

const clearBeforeAssessment = await store.resolveFieldIssueEscalation({
  actorId: "Verification user",
  resolutionNote: "Trying before assessment."
});
assert(!clearBeforeAssessment.success, "Resolving before assessment should fail.");

const assessed = await store.saveFieldIssueAssessment({
  actorId: "Verification user",
  issueType: "utility_conflict",
  impactSummary: "Locate and traffic-control release gap holds the bore crew and creates standby exposure.",
  scheduleImpact: true,
  scheduleDays: 2,
  costExposure: 18500,
  safetyImpact: true,
  qualityImpact: false
});
assertSuccess(assessed, "Saving field issue assessment should succeed");
assert(assessed.issue.state === "assessed", "Assessment should persist assessed state.");
const reloadedAssessment = await store.getFieldIssueEscalation();
assert(reloadedAssessment.assessment?.impactSummary.includes("standby exposure"), "Assessment should survive reload.");

const clearBeforeEvidence = await store.resolveFieldIssueEscalation({
  actorId: "Verification user",
  resolutionNote: "Trying before evidence."
});
assert(!clearBeforeEvidence.success, "Resolving before evidence should fail.");

const selectPathBeforeEvidence = await store.selectFieldIssueEscalationPath({
  actorId: "Verification user",
  path: "rfi"
});
assert(!selectPathBeforeEvidence.success, "Escalation path should require evidence.");

const evidence = await store.addFieldIssueEvidenceReference({
  actorId: "Verification user",
  requirementId: "field-daily-report-reference",
  referenceText: "DR dr-lake-bore-0610 plus locate sketch and standby note",
  referenceType: "daily_report"
});
assertSuccess(evidence, "Adding evidence should succeed");
assert(evidence.readiness.evidenceComplete === true, "Adding evidence should change readiness.");

const clearBeforePath = await store.resolveFieldIssueEscalation({
  actorId: "Verification user",
  resolutionNote: "Trying before path."
});
assert(!clearBeforePath.success, "Resolving before escalation path should fail.");

const selected = await store.selectFieldIssueEscalationPath({
  actorId: "Verification user",
  path: "rfi"
});
assertSuccess(selected, "Selecting RFI path should succeed");

const clearBeforeDownstream = await store.resolveFieldIssueEscalation({
  actorId: "Verification user",
  resolutionNote: "Trying before downstream record."
});
assert(!clearBeforeDownstream.success, "Resolving before downstream record should fail.");

const rfiCreated = await store.createRfiFromFieldIssue({ actorId: "Verification user" });
assertSuccess(rfiCreated, "Creating RFI from field issue should succeed");
assert(rfiCreated.issue.linkedDownstreamRecordIds.includes("rfi-field-issue-lake-001"), "RFI creation should persist linked downstream ID.");
let overlay = await store.getFieldIssueSeedDataOverlay();
assert(overlay.rfis.some((rfi) => rfi.id === "rfi-field-issue-lake-001"), "RFI overlay should expose the downstream RFI.");

const clearWithoutNote = await store.resolveFieldIssueEscalation({
  actorId: "Verification user",
  resolutionNote: ""
});
assert(!clearWithoutNote.success, "Resolving should require a resolution note.");

const resolved = await store.resolveFieldIssueEscalation({
  actorId: "Verification user",
  resolutionNote: "RFI-FI-001 created and field blocker cleared for follow-up."
});
assertSuccess(resolved, "Resolving field issue should succeed after downstream record");
assert(resolved.issue.state === "resolved", "Resolving should persist terminal state.");
const terminalHistoryCount = resolved.issue.history.length;
const terminalDownstreamCount = resolved.issue.downstreamRecords.length;

const duplicateResolve = await store.resolveFieldIssueEscalation({
  actorId: "Verification user",
  resolutionNote: "Second resolve attempt."
});
assert(!duplicateResolve.success, "Duplicate resolution should fail.");
const reloadedTerminal = await store.getFieldIssueEscalation();
assert(reloadedTerminal.state === "resolved", "Terminal state should survive reload.");
assert(reloadedTerminal.history.length === terminalHistoryCount, "Duplicate resolution should not duplicate terminal history.");
assert(reloadedTerminal.downstreamRecords.length === terminalDownstreamCount, "Duplicate resolution should not duplicate downstream records.");
assert((await store.listOpenFieldIssues()).length === 0, "Canonical open issue list should be empty after resolution.");

overlay = await store.getFieldIssueSeedDataOverlay();
assert(unresolvedFieldWorkflows(overlay).length === 0, "Command-center derivation should remove unresolved field workflow after canonical resolution.");
const resolvedReport = overlay.dailyReports.find((report) => report.id === "dr-lake-bore-0610");
assert(resolvedReport?.blockers.every((blocker) => blocker.id !== "field-issue-lake-001"), "Field Execution overlay should clear the canonical blocker.");
assert(resolvedReport?.reportStatus === "approved", "Field Execution overlay should show resolved report state after reload.");

const commandCenterSummary = appState.applyFieldIssueEscalationToWorkspaceSummary({
  pageId: "command-center",
  stageLabel: "Command Center",
  purpose: "Priorities",
  status: "blocked",
  statusReason: "Field issue unresolved",
  d5oPhase: "O",
  primaryUserIntent: "Focus",
  primaryAction: {
    id: "field-issue-lake-001",
    title: "Escalate Lake Norman field issue",
    owner: "Jon Reeves",
    dueDate: "2026-06-11",
    whyItMatters: "Field issue unresolved.",
    ctaLabel: "Escalate field issue",
    href: "/field-execution?focus=field-issue-lake-001#field-issue-escalation",
    severity: "critical",
    taskOutcome: {
      focusId: "field-issue-lake-001",
      sourceModule: "field-execution",
      targetRoute: "/field-execution",
      targetHref: "/field-execution?focus=field-issue-lake-001#field-issue-escalation",
      concreteCtaLabel: "Escalate field issue",
      expectedOutcome: "Resolve field issue.",
      targetSection: "Field issue",
      targetObjectTitle: "Lake Norman field issue",
      nextStepInstruction: "Assess issue.",
      reason: "Field issue is unresolved."
    }
  },
  secondaryActions: [],
  criticalBlockers: [{
    id: "field-issue-lake-001",
    title: "Utility locates not confirmed",
    action: "Escalate",
    owner: "Jon Reeves",
    dueDate: "2026-06-11",
    href: "/field-execution"
  }],
  evidenceNeededNow: [],
  detailLabel: "Details"
}, reloadedTerminal);
assert(commandCenterSummary.primaryAction.id !== "field-issue-lake-001", "Command Center should not show the same unresolved field issue primary action after resolution.");

await store.resetFieldIssueEscalationStoreForTesting();
await store.startFieldIssueEscalation({ actorId: "Verification user" });
await store.saveFieldIssueAssessment({
  actorId: "Verification user",
  issueType: "utility_conflict",
  impactSummary: "Change event branch assessment.",
  scheduleImpact: true,
  scheduleDays: 1,
  costExposure: 9000,
  safetyImpact: true,
  qualityImpact: false
});
await store.addFieldIssueEvidenceReference({
  actorId: "Verification user",
  requirementId: "field-daily-report-reference",
  referenceText: "Change branch field note",
  referenceType: "field_note"
});
await store.selectFieldIssueEscalationPath({ actorId: "Verification user", path: "change_event" });
const changeCreated = await store.createChangeEventFromFieldIssue({ actorId: "Verification user" });
assertSuccess(changeCreated, "Creating Change Event from field issue should succeed");
const changeOverlay = await store.getFieldIssueSeedDataOverlay();
assert(changeOverlay.changeEvents.some((event) => event.id === "chg-field-issue-lake-001"), "Change Event overlay should expose downstream change record.");

const finalReset = await store.resetFieldIssueEscalationStoreForTesting();
assert(finalReset.state === "unresolved", "Final reset should restore unresolved field issue for repeatable testing.");
assert((await store.listOpenFieldIssues()).length === 1, "Final reset should restore canonical open issue list.");

console.log("Field issue persisted vertical slice verified.");
console.log(JSON.stringify({
  storePath,
  terminalState: reloadedTerminal.state,
  openIssueCountAfterResolution: 0,
  rfiOverlay: true,
  changeEventOverlay: true
}, null, 2));
