import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveBidSubmissionDecisionAuthority } from "../lib/d5o/opportunities/package-revision-authority.ts";

const root = resolve(process.cwd());
const failures = [];
const baseOpportunity = {
  bidSubmissionStatus: "submission_approved_ready_to_send",
  bidPackageVersion: "PACKAGE-REF-ALPHA",
  version: 9,
  bidSubmissionApprovalConfigurationVersionId: "configuration-alpha",
  bidSubmissionApprovalGateKey: "submission-approval",
  bidSubmissionApprovalOutcomeKey: "approve-for-submission",
};
const baseEvent = {
  bidAction: "approve_submission",
  packageVersion: 9,
  createdAt: "2026-08-12T22:00:00.000Z",
  configurationVersionId: "configuration-alpha",
  configurationGateKey: "submission-approval",
  configurationOutcomeKey: "approve-for-submission",
  auditAuthorityReconciled: true,
  metadata: { configuredOutcomeKey: "approve-for-submission", bidSubmissionRecorded: false },
};

check("package reference and revision are distinct typed fields", () => {
  const value = resolveBidSubmissionDecisionAuthority(baseOpportunity, [baseEvent]);
  return value?.packageReference === "PACKAGE-REF-ALPHA" && value.revision === 9 && value.auditAuthorityReconciled;
});
check("held decision preserves pinned authority", () => resolveBidSubmissionDecisionAuthority({ ...baseOpportunity, bidSubmissionStatus: "submission_approval_held", bidSubmissionApprovalOutcomeKey: "hold-submission-approval" }, [{ ...baseEvent, bidAction: "hold_submission_approval", configurationOutcomeKey: "hold-submission-approval", metadata: { configuredOutcomeKey: "hold-submission-approval", bidSubmissionRecorded: false } }])?.revision === 9);
negative("package A/revision B mismatch fails closed", { opportunity: { version: 10 } });
negative("latest revision cannot replace pinned revision", { event: { packageVersion: 8 } });
negative("another opportunity package cannot be displayed", { opportunity: { bidPackageVersion: "" } });
negative("another workspace authority cannot bypass audit reconciliation", { event: { auditAuthorityReconciled: false } });
check("browser-supplied package authority cannot replace persisted authority", () => resolveBidSubmissionDecisionAuthority(baseOpportunity, [{ ...baseEvent, packageReference: "FORGED" }])?.packageReference === "PACKAGE-REF-ALPHA");
negative("missing package authority fails closed", { opportunity: { bidPackageVersion: null } });
negative("missing revision authority fails closed", { event: { packageVersion: null } });
negative("configuration mismatch fails closed", { event: { configurationVersionId: "configuration-other" } });
negative("outcome mismatch fails closed", { event: { metadata: { configuredOutcomeKey: "forged", bidSubmissionRecorded: false } } });

const page = readFileSync(resolve(root, "app/pipeline/[opportunityId]/page.tsx"), "utf8");
check("UI explicitly separates bid package reference and revision", () => page.includes('label="Bid package reference"') && page.includes('label="Revision"') && page.includes('label="Decision applies to"'));
check("old contradictory completed-state label is absent", () => !/data-bid-approval-readonly[\s\S]{0,1200}label="Package revision"/.test(page));
check("approval remains ready-to-send and not submitted", () => page.includes("No bid submission has been recorded"));
check("raw package and revision identities are not rendered", () => !page.includes("decisionAuthority.id") && !page.includes("decisionAuthority.commandId"));

if (failures.length) {
  console.error(`CFG-RUNTIME-03 revision-authority verification failed: ${failures.length}`);
  process.exit(1);
}
console.log("CFG-RUNTIME-03 revision-authority verification passed.");

function negative(name, overrides) {
  check(name, () => {
    const opportunity = { ...baseOpportunity, ...(overrides.opportunity ?? {}) };
    const event = { ...baseEvent, ...(overrides.event ?? {}) };
    return resolveBidSubmissionDecisionAuthority(opportunity, [event]) === null;
  });
}

function check(name, test) {
  try {
    const passed = Boolean(test());
    console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
    if (!passed) failures.push(name);
  } catch (error) {
    console.log(`FAIL: ${name} - ${error instanceof Error ? error.message : String(error)}`);
    failures.push(name);
  }
}
