import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const files = {
  types: source("lib/d5o/evidence/types.ts"),
  config: source("lib/d5o/evidence/config.ts"),
  derive: source("lib/d5o/evidence/derive-evidence.ts"),
  evidenceStore: source("lib/d5o/evidence/evidence-store.ts"),
  localStore: source("lib/d5o/evidence/local-evidence-store.ts"),
  uploadAction: source("app/actions/evidence-uploads.ts"),
  uploadVerifier: source("scripts/verify-evidence-upload-pilot.mjs"),
  storageScaffold: source("supabase/storage/rybexos-evidence-bucket.sql"),
  components: [
    "components/d5o/evidence/EvidenceRequirementCard.tsx",
    "components/d5o/evidence/EvidenceChecklistPanel.tsx",
    "components/d5o/evidence/EvidenceStatusChip.tsx",
    "components/d5o/evidence/EvidenceUploadStub.tsx",
    "components/d5o/evidence/EvidenceVerificationPanel.tsx",
    "components/d5o/evidence/EvidenceSummaryCard.tsx",
    "components/d5o/evidence/EvidenceBlockingList.tsx"
  ].map(source)
};

const categories = [
  "photo",
  "daily_report",
  "jha",
  "safety_plan",
  "utility_locate",
  "rfi_attachment",
  "submittal_package",
  "change_backup",
  "tm_ticket",
  "pay_app_backup",
  "lien_waiver",
  "inspection_record",
  "test_result",
  "otdr_result",
  "punch_verification",
  "as_built",
  "warranty",
  "om_document",
  "closeout_package",
  "approval_record",
  "other"
];

const statuses = [
  "missing",
  "pending",
  "uploaded",
  "under_review",
  "verified",
  "rejected",
  "waived",
  "not_required"
];

const highValueModules = [
  "field_execution",
  "changes",
  "billing",
  "safety",
  "quality",
  "closeout",
  "mobilization"
];

const failures = [];

for (const category of categories) {
  assertIncludes(files.types, `"${category}"`, `Evidence category missing from types: ${category}`);
  assertIncludes(files.config, `${category}: category`, `Evidence category missing from config: ${category}`);
}

for (const status of statuses) {
  assertIncludes(files.types, `"${status}"`, `Evidence status missing from types: ${status}`);
  assertIncludes(files.config, `${status}:`, `Evidence status missing from labels/tones: ${status}`);
}

for (const moduleName of highValueModules) {
  assertIncludes(files.config, `"${moduleName}"`, `No evidence category maps to source module: ${moduleName}`);
}

for (const token of [
  "missingEvidence",
  "evidenceBlockingGate",
  "evidenceBlockingBilling",
  "evidenceBlockingCloseout",
  "evidenceReadyForReview",
  "statusFromGeneric",
  "statusFromCloseout"
]) {
  assertIncludes(files.derive, token, `Evidence derivation does not expose ${token}.`);
}

for (const token of ["markEvidence", "uploaded", "verified", "waived", "resetEvidenceState"]) {
  assertIncludes(files.localStore, token, `Local evidence state does not support ${token}.`);
}

for (const token of ["RYBEXOS_EVIDENCE_STORE", 'return "local"', "isDatabaseEvidenceStore"]) {
  assertIncludes(files.evidenceStore, token, `Evidence store mode does not support ${token}.`);
}

for (const token of ["uploadEvidenceAttachment", "rybexos-evidence", "attachments", "entity_attachments", "workflow_evidence_requirements"]) {
  assertIncludes(files.uploadAction, token, `Evidence upload action missing ${token}.`);
}

for (const token of ["RYBEXOS_ALLOW_EVIDENCE_UPLOAD_TEST", "dry-run", "rybexos-evidence"]) {
  assertIncludes(files.uploadVerifier, token, `Evidence upload verifier missing ${token}.`);
}

for (const token of ["public", "false", "storage.buckets", "rybexos-evidence"]) {
  assertIncludes(files.storageScaffold, token, `Evidence storage scaffold missing ${token}.`);
}

if (failures.length > 0) {
  console.error("Evidence model verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Evidence model verification passed: categories, statuses, derivation, local demo actions, and UI components are present.");

function source(relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function assertIncludes(text, token, message) {
  if (!text.includes(token)) {
    failures.push(message);
  }
}
