import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const failures = [];

const slices = [
  {
    id: "billing-v2-backup-cash-recovery",
    descriptorPath: "lib/d5o/billing-v2/operating-slice.ts",
    persistedStorePath: "lib/d5o/billing-v2/persisted-store.ts",
    domainServicePath: "lib/d5o/billing-v2/billing-v2-service.ts",
    serverActionPath: "app/actions/billing-v2.ts",
    appStatePath: "lib/d5o/billing-v2/app-state.ts",
    resetHelper: "resetBillingV2PersistedStoreForTesting",
    schemaVersion: "schemaVersion: 1",
    serverActions: [
      "startBillingBackupPackageAction",
      "saveBillingBackupPackageDetailsAction",
      "attachBillingBackupEvidenceAction",
      "validateBillingBackupPackageAction",
      "sendBillingBackupToCommercialReviewAction",
      "recordBillingCommercialReviewDecisionAction",
      "clearBillingBlockerAction"
    ],
    domainCommands: [
      "startBackupPackage",
      "saveBackupSummary",
      "saveEvidenceReference",
      "validatePackageReadiness",
      "sendPackageToCommercialReview",
      "clearBillingBlocker"
    ],
    appStateOverlay: "applyBillingV2CompletionToWorkspaceSummary",
    seedOverlay: "applyBillingV2PackageToSeedData",
    verifierScript: "billing-v2:verify-persisted-slice",
    browserQaScript: "billing-v2:qa"
  },
  {
    id: "field-issue-escalation",
    descriptorPath: "lib/d5o/field-issue-escalation/operating-slice.ts",
    persistedStorePath: "lib/d5o/field-issue-escalation/persisted-store.ts",
    domainServicePath: "lib/d5o/field-issue-escalation/field-issue-service.ts",
    serverActionPath: "app/actions/field-issue-escalation.ts",
    appStatePath: "lib/d5o/field-issue-escalation/app-state.ts",
    resetHelper: "resetFieldIssueEscalationStoreForTesting",
    schemaVersion: "schemaVersion: 1",
    serverActions: [
      "startFieldIssueEscalationAction",
      "saveFieldIssueAssessmentAction",
      "addFieldIssueEvidenceReferenceAction",
      "selectFieldIssueEscalationPathAction",
      "createRfiFromFieldIssueAction",
      "createChangeEventFromFieldIssueAction",
      "resolveFieldIssueEscalationAction"
    ],
    domainCommands: [
      "startFieldIssueEscalation",
      "saveFieldIssueAssessment",
      "addFieldIssueEvidenceReference",
      "selectFieldIssueEscalationPath",
      "createRfiFromFieldIssue",
      "createChangeEventFromFieldIssue",
      "resolveFieldIssueEscalation"
    ],
    appStateOverlay: "applyFieldIssueEscalationToWorkspaceSummary",
    seedOverlay: "applyFieldIssueToSeedData",
    verifierScript: "field-issue:verify-persisted-slice",
    browserQaScript: "field-issue:qa"
  },
  {
    id: "closeout-final-billing-release",
    descriptorPath: "lib/d5o/closeout-final-billing/operating-slice.ts",
    persistedStorePath: "lib/d5o/closeout-final-billing/persisted-store.ts",
    domainServicePath: "lib/d5o/closeout-final-billing/closeout-final-billing-service.ts",
    serverActionPath: "app/actions/closeout-final-billing.ts",
    appStatePath: "lib/d5o/closeout-final-billing/app-state.ts",
    resetHelper: "resetCloseoutFinalBillingStoreForTesting",
    schemaVersion: "schemaVersion: 1",
    serverActions: [
      "startCloseoutFinalBillingReleaseAction",
      "saveCloseoutRequirementAssessmentAction",
      "addCloseoutEvidenceReferenceAction",
      "validateCloseoutReleaseReadinessAction",
      "submitCloseoutReleaseForReviewAction",
      "recordCloseoutReleaseDecisionAction",
      "clearCloseoutFinalBillingBlockerAction"
    ],
    domainCommands: [
      "startCloseoutFinalBillingRelease",
      "saveCloseoutRequirementAssessment",
      "addCloseoutEvidenceReference",
      "validateCloseoutReleaseReadiness",
      "submitCloseoutReleaseForReview",
      "recordCloseoutReleaseDecision",
      "clearCloseoutFinalBillingBlocker"
    ],
    appStateOverlay: "applyCloseoutFinalBillingToWorkspaceSummary",
    seedOverlay: "applyCloseoutFinalBillingToSeedData",
    verifierScript: "closeout-final-billing:verify-persisted-slice",
    browserQaScript: "closeout-final-billing:qa"
  }
];

const packageJson = JSON.parse(readFile("package.json"));
const registry = readFile("lib/d5o/operating-slices/registry.ts");
const commandCenterPage = readFile("app/command-center/page.tsx");

assertFile("lib/d5o/operating-slices/types.ts");
assertFile("lib/d5o/operating-slices/local-file-store.ts");
assertIncludes(readFile("lib/d5o/operating-slices/local-file-store.ts"), "readLocalOperatingSliceStore", "local file store must expose read helper");
assertIncludes(readFile("lib/d5o/operating-slices/local-file-store.ts"), "writeLocalOperatingSliceStore", "local file store must expose write helper");
assertIncludes(readFile("lib/d5o/operating-slices/local-file-store.ts"), "resetLocalOperatingSliceStore", "local file store must expose reset helper");

assertIncludes(readFile(".gitignore"), ".rybexos-local/", ".rybexos-local/ must be gitignored");
assertIncludes(registry, "billingV2OperatingSlice", "Billing V2 slice must be registered");
assertIncludes(registry, "fieldIssueOperatingSlice", "Field Issue slice must be registered");
assertIncludes(registry, "closeoutFinalBillingOperatingSlice", "Closeout Final Billing slice must be registered");

for (const slice of slices) {
  assertFile(slice.descriptorPath);
  assertFile(slice.persistedStorePath);
  assertFile(slice.domainServicePath);
  assertFile(slice.serverActionPath);
  assertFile(slice.appStatePath);

  const descriptor = readFile(slice.descriptorPath);
  const store = readFile(slice.persistedStorePath);
  const domainService = readFile(slice.domainServicePath);
  const serverAction = readFile(slice.serverActionPath);
  const appState = readFile(slice.appStatePath);

  assertIncludes(descriptor, slice.id, `${slice.id} descriptor must include slice ID`);
  assertIncludes(descriptor, slice.schemaVersion, `${slice.id} descriptor must include schema version`);
  assertIncludes(descriptor, slice.resetHelper, `${slice.id} descriptor must name reset helper`);
  assertIncludes(store, "operating-slices/local-file-store", `${slice.id} store must use shared local file store`);
  assertNotIncludes(store, "node:fs", `${slice.id} store should not import fs directly after extraction`);
  assertNotIncludes(store, "node:path", `${slice.id} store should not import path directly after extraction`);
  assertIncludes(store, slice.resetHelper, `${slice.id} store must expose deterministic reset helper`);
  assertIncludes(store, slice.seedOverlay, `${slice.id} store must expose seed overlay`);
  assertIncludes(appState, slice.appStateOverlay, `${slice.id} app-state overlay must exist`);

  for (const action of slice.serverActions) {
    assertIncludes(descriptor, action, `${slice.id} descriptor must list server action ${action}`);
    assertIncludes(serverAction, action, `${slice.id} server action ${action} must exist`);
  }

  for (const command of slice.domainCommands) {
    assertIncludes(descriptor, command, `${slice.id} descriptor must list domain command ${command}`);
    assertIncludes(domainService, command, `${slice.id} domain command ${command} must exist`);
  }

  assert(packageJson.scripts?.[slice.verifierScript], `${slice.id} verifier command must exist in package.json`);
  assert(packageJson.scripts?.[slice.browserQaScript], `${slice.id} browser QA command must exist in package.json`);
  assertIncludes(commandCenterPage, slice.appStateOverlay, `${slice.id} must participate in Command Center app-state overlay`);
}

assert(packageJson.scripts?.["operating-slices:verify"], "operating-slices:verify script must exist");
assertIncludes(commandCenterPage, "deriveOperatingWorkflows", "Command Center must derive workflows canonically");
assertIncludes(commandCenterPage, "getBillingV2SeedDataOverlay", "Command Center must load Billing V2 overlay");
assertIncludes(commandCenterPage, "getFieldIssueSeedDataOverlay", "Command Center must load Field Issue overlay");
assertIncludes(commandCenterPage, "getCloseoutFinalBillingActionState", "Command Center must load Closeout Final Billing state");

for (const filePath of sourceFiles(["app", "components"])) {
  const content = readFile(filePath);
  if (!/["']use client["']/.test(content)) continue;

  assert(!/from\s+["']node:(fs|path)/.test(content), `${filePath} client component must not import node:fs/node:path`);
  assert(!/from\s+["'](?:fs|path|fs\/promises)["']/.test(content), `${filePath} client component must not import fs/path`);
  assert(!/from\s+["'][^"']*operating-slices\/local-file-store/.test(content), `${filePath} client component must not import local file store utilities`);
}

if (failures.length > 0) {
  console.error("Operating slice conformance failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Operating slice conformance verified.");
console.log(JSON.stringify({
  registeredSlices: slices.map((slice) => slice.id),
  sharedLocalFileStore: true,
  browserQaCommandsRegistered: slices.map((slice) => slice.browserQaScript),
  adversarialVerifierCommandsRegistered: slices.map((slice) => slice.verifierScript),
  clientFileStoreImportCheck: "passed"
}, null, 2));

function readFile(filePath) {
  return readFileSync(join(root, filePath), "utf8");
}

function assertFile(filePath) {
  assert(existsSync(join(root, filePath)), `${filePath} must exist`);
}

function assertIncludes(content, needle, message) {
  assert(content.includes(needle), message);
}

function assertNotIncludes(content, needle, message) {
  assert(!content.includes(needle), message);
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function sourceFiles(directories) {
  const files = [];
  for (const directory of directories) collect(join(root, directory), files);
  return files.map((file) => relative(root, file).replaceAll("\\", "/"));
}

function collect(directory, files) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (["node_modules", ".next"].includes(entry)) continue;
      collect(fullPath, files);
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry)) files.push(fullPath);
  }
}
