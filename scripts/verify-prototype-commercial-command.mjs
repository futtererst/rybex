import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const cache = new Map();
function source(relative, dependencies = {}) {
  if (cache.has(relative)) return cache.get(relative);
  const compiled = ts.transpileModule(readFileSync(relative, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (key) => {
    if (!(key in dependencies)) throw new Error(`Unexpected test dependency: ${key}`);
    return dependencies[key];
  }, structuredClone, crypto, console }, { filename: relative });
  cache.set(relative, exports);
  return exports;
}

const phase = source("components/d5o/platform/phase-configuration.ts");
const published = source("components/d5o/platform/published-phase-configuration.ts", { "./phase-configuration": phase });
const authority = source("components/d5o/platform/commercial-authority.ts");
const errors = source("lib/d5o/prototype-work/store-error.ts");
const { applyCommercialCommand, assertSnapshotCommercialIntegrity } = source("lib/d5o/prototype-work/commercial-command.ts", {
  "@/components/d5o/platform/published-phase-configuration": published,
  "@/components/d5o/platform/commercial-authority": authority,
  "./store-error": errors,
});

const pinned = "00000000-0000-4000-8000-000000000001";
const actor = { id: "synthetic-actor", name: "Synthetic reviewer", membershipId: "synthetic-membership", role: "project_manager" };
const inventory = { status: "ready", versions: [{ id: pinned, status: "published", config_manifest_json: { d5oPresentation: { phaseContract: { schemaVersion: 1, workTypes: structuredClone(phase.stageAlignedPhaseConfigurationCatalog.rybex) } } } }] };
const work = {
  id: "synthetic-controlled", workspace: "rybex", type: "Technical delivery", phaseConfigurationVersionId: pinned,
  title: "Synthetic command guard", customer: "Synthetic", site: "Local", owner: "Originator", nextAction: "Prepare price", status: "moving", history: [],
  definition: { status: "Approved", revision: 1, configurationVersion: pinned, configurationWorkTypeKey: "technical-delivery" },
  discovery: { phase: "Estimate", pursuitControl: { revision: 1, status: "qualified" }, estimate: {
    revision: 1, labor: 75, materials: 25, subcontract: 0, travel: 0, contingency: 0, targetMargin: 25, sellPrice: 133,
    status: "Draft", assumption: "Synthetic", definitionSource: { revision: 1, configurationVersionId: pinned, workTypeKey: "technical-delivery", capturedAt: "2026-10-06T00:00:00Z" }, pricingHistory: [],
  }, proposal: { status: "Not started", dueDate: "", method: "Customer portal", recipient: "", response: "" } },
};
const copy = (value) => JSON.parse(JSON.stringify(value));
const rejects = (fn, code) => assert.throws(fn, (error) => error.code === code, code);

const routed = applyCommercialCommand(work, { workId: work.id, packageRevision: 1, action: "submit-pricing", dueDate: "2026-10-22" }, actor, inventory);
assert.equal(routed.discovery.estimate.status, "Pricing review");
rejects(() => applyCommercialCommand(routed, { workId: work.id, packageRevision: 2, action: "approve-pricing", note: "Accepted" }, actor, inventory), "stale_package");
rejects(() => applyCommercialCommand(routed, { workId: work.id, packageRevision: 1, action: "approve-pricing" }, actor, inventory), "decision_note_required");
const priced = applyCommercialCommand(routed, { workId: work.id, packageRevision: 1, action: "approve-pricing", note: "Synthetic price basis accepted" }, actor, inventory);
assert.equal(priced.discovery.estimate.review.actorId, actor.id);
assert.equal(priced.discovery.estimate.status, "Approved");
rejects(() => assertSnapshotCommercialIntegrity([routed], [priced]), "protected_estimate_changed");

const forgedPrice = copy(priced);
forgedPrice.discovery.estimate.sellPrice = 999999;
rejects(() => assertSnapshotCommercialIntegrity([priced], [forgedPrice]), "protected_estimate_changed");
const forgedControl = copy(priced);
delete forgedControl.discovery.pursuitControl;
rejects(() => assertSnapshotCommercialIntegrity([priced], [forgedControl]), "protected_control_removed");
rejects(() => assertSnapshotCommercialIntegrity([priced], []), "protected_work_removed");

const draft = copy(priced);
draft.discovery.proposal.status = "Draft";
draft.discovery.proposal.package = { revision: 1, estimateRevision: 1, scope: "Synthetic scope", assumptions: "Synthetic", exclusions: "None", commercialTerms: "Synthetic terms", sellPrice: 133, preparedAt: "2026-10-06T00:00:00Z", definitionSource: copy(priced.discovery.estimate.definitionSource) };
draft.discovery.proposal.packageHistory = [copy(draft.discovery.proposal.package)];
assertSnapshotCommercialIntegrity([priced], [draft]);
const routedOffer = applyCommercialCommand(draft, { workId: work.id, packageRevision: 1, action: "submit-proposal", dueDate: "2026-10-22" }, actor, inventory);
assert.equal(routedOffer.discovery.proposal.status, "Internal review");
assert.ok(routedOffer.discovery.proposal.review.authorityProfileId.startsWith("demo-"));
const forgedApproval = copy(routedOffer);
forgedApproval.discovery.proposal.status = "Approved";
rejects(() => assertSnapshotCommercialIntegrity([routedOffer], [forgedApproval]), "protected_decision_changed");
const forgedOffer = copy(routedOffer);
forgedOffer.discovery.proposal.package.sellPrice = 999999;
rejects(() => assertSnapshotCommercialIntegrity([routedOffer], [forgedOffer]), "protected_offer_changed");
const approvedOffer = applyCommercialCommand(routedOffer, { workId: work.id, packageRevision: 1, action: "approve-proposal", note: "Synthetic offer accepted" }, actor, inventory);
assert.equal(approvedOffer.discovery.proposal.status, "Approved");
assert.equal(approvedOffer.discovery.proposal.review.actorId, actor.id);
const staleScope = copy(routedOffer);
staleScope.definition.revision = 2;
rejects(() => applyCommercialCommand(staleScope, { workId: work.id, packageRevision: 1, action: "approve-proposal", note: "Accepted" }, actor, inventory), "definition_source_unavailable");

rejects(() => applyCommercialCommand(routedOffer, { workId: work.id, packageRevision: 1, action: "record-customer-submission", recipient: "Synthetic customer", method: "Email", dueDate: "2026-10-22" }, actor, inventory), "offer_not_approved");
rejects(() => applyCommercialCommand(approvedOffer, { workId: work.id, packageRevision: 1, action: "record-customer-submission", recipient: "", method: "Email", dueDate: "2026-10-22" }, actor, inventory), "invalid_customer_submission");
const submitted = applyCommercialCommand(approvedOffer, { workId: work.id, packageRevision: 1, action: "record-customer-submission", recipient: "Synthetic customer", method: "Email", dueDate: "2026-10-22" }, actor, inventory);
assert.equal(submitted.discovery.proposal.status, "Submitted");
assert.equal(submitted.discovery.proposal.submission.packageSnapshot.sellPrice, approvedOffer.discovery.proposal.package.sellPrice);
assert.equal(submitted.discovery.proposal.submission.recordedByActorId, actor.id);
rejects(() => applyCommercialCommand(submitted, { workId: work.id, packageRevision: 1, action: "record-customer-submission", recipient: "Synthetic customer", method: "Email", dueDate: "2026-10-22" }, actor, inventory), "offer_not_approved");
const forgedSubmission = copy(approvedOffer);
forgedSubmission.discovery.proposal.status = "Submitted";
forgedSubmission.discovery.proposal.submission = copy(submitted.discovery.proposal.submission);
rejects(() => assertSnapshotCommercialIntegrity([approvedOffer], [forgedSubmission]), "protected_decision_changed");
const forgedResponse = copy(submitted);
forgedResponse.discovery.proposal.responseEvents = [{ revision: 1, status: "Awarded", receivedAt: "2026-10-06", details: "Forged" }];
rejects(() => assertSnapshotCommercialIntegrity([submitted], [forgedResponse]), "protected_customer_decision_changed");
const forgedAward = copy(submitted);
forgedAward.discovery.outcome = "Won";
rejects(() => assertSnapshotCommercialIntegrity([submitted], [forgedAward]), "protected_customer_decision_changed");
const forgedPhase = copy(submitted);
forgedPhase.discovery.phase = "Outcome";
rejects(() => assertSnapshotCommercialIntegrity([submitted], [forgedPhase]), "protected_customer_decision_changed");
const forgedResponseText = copy(submitted);
forgedResponseText.discovery.proposal.response = "Awarded";
rejects(() => assertSnapshotCommercialIntegrity([submitted], [forgedResponseText]), "protected_customer_decision_changed");
rejects(() => applyCommercialCommand(submitted, { workId: work.id, packageRevision: 1, action: "record-customer-response", responseStatus: "Commercial negotiation", receivedAt: "2026-10-06", note: "Revise terms" }, actor, inventory), "follow_up_required");
rejects(() => applyCommercialCommand(submitted, { workId: work.id, packageRevision: 2, action: "record-customer-response", responseStatus: "Awarded", receivedAt: "2026-10-06", note: "Accepted" }, actor, inventory), "stale_package");
const negotiating = applyCommercialCommand(submitted, { workId: work.id, packageRevision: 1, action: "record-customer-response", responseStatus: "Commercial negotiation", receivedAt: "2026-10-06", note: "Revise terms", nextAction: "Prepare revised offer", followUpDue: "2026-10-20" }, actor, inventory);
assert.equal(negotiating.discovery.outcome, undefined);
assert.equal(negotiating.discovery.proposal.responseEvents.at(-1).recordedByMembershipId, actor.membershipId);
rejects(() => assertSnapshotCommercialIntegrity([submitted], [negotiating]), "protected_customer_decision_changed");
const reopened = applyCommercialCommand(negotiating, { workId: work.id, packageRevision: 1, action: "start-negotiated-revision" }, actor, inventory);
assert.equal(reopened.discovery.proposal.status, "Draft");
assert.equal(reopened.discovery.proposal.submission.packageSnapshot.sellPrice, 133);
rejects(() => assertSnapshotCommercialIntegrity([negotiating], [reopened]), "protected_decision_changed");
const awarded = applyCommercialCommand(submitted, { workId: work.id, packageRevision: 1, action: "record-customer-response", responseStatus: "Awarded", receivedAt: "2026-10-06", note: "Customer award received" }, actor, inventory);
assert.equal(awarded.id, submitted.id);
assert.equal(awarded.discovery.outcome, "Won");
assert.match(awarded.nextAction, /Design receiver and accept award handoff/);
assert.equal(awarded.owner, "Design receiver · unassigned");
rejects(() => applyCommercialCommand(awarded, { workId: work.id, packageRevision: 1, action: "record-customer-response", responseStatus: "Not awarded", receivedAt: "2026-10-07", note: "Reversed" }, actor, inventory), "submitted_offer_unavailable");
rejects(() => applyCommercialCommand(submitted, { workId: work.id, packageRevision: 1, action: "submit-design-handoff", dueDate: "2026-10-23" }, actor, inventory), "award_unavailable");
const awardReady = copy(awarded);
Object.assign(awardReady.definition, { outcome: "Synthetic customer outcome", acceptance: "Documented acceptance", excludedScope: "Excluded remedial work", deliveryApproach: "Controlled package plan", dependencies: "Customer access", risks: "Access risk" });
const handoff = applyCommercialCommand(awardReady, { workId: work.id, packageRevision: 1, action: "submit-design-handoff", dueDate: "2026-10-23" }, actor, inventory);
assert.equal(handoff.discovery.designHandoff.status, "submitted");
assert.equal(handoff.discovery.designHandoff.brief.offerRevision, 1);
assert.equal(handoff.discovery.designHandoff.brief.definitionRevision, 1);
assert.equal(handoff.owner, "Design receiver queue · workspace role");
const prematurePackage = copy(handoff);
prematurePackage.packages = [{ id: "wp-premature", name: "Not received", status: "planned" }];
rejects(() => assertSnapshotCommercialIntegrity([handoff], [prematurePackage]), "design_handoff_required");
const prematureDesignRegister = copy(handoff);
prematureDesignRegister.phaseRegisters = { design: [{ package: "Not received" }] };
rejects(() => assertSnapshotCommercialIntegrity([handoff], [prematureDesignRegister]), "design_handoff_required");
const forgedHandoff = copy(awardReady);
forgedHandoff.discovery.designHandoff = copy(handoff.discovery.designHandoff);
rejects(() => assertSnapshotCommercialIntegrity([awardReady], [forgedHandoff]), "protected_design_handoff_changed");
rejects(() => applyCommercialCommand(handoff, { workId: work.id, packageRevision: 1, handoffRevision: 1, action: "accept-design-handoff", note: "I accept this complete design brief" }, actor, inventory), "handoff_separation_required");
const receiver = { id: "synthetic-receiver", name: "Synthetic Design receiver", membershipId: "receiver-membership", role: "project_manager" };
rejects(() => applyCommercialCommand(handoff, { workId: work.id, packageRevision: 1, handoffRevision: 2, action: "accept-design-handoff", note: "I accept this complete design brief" }, receiver, inventory), "stale_handoff");
const returnedHandoff = applyCommercialCommand(handoff, { workId: work.id, packageRevision: 1, handoffRevision: 1, action: "return-design-handoff", note: "Clarify the site access dependency before planning" }, receiver, inventory);
assert.equal(returnedHandoff.discovery.designHandoff.status, "returned");
const revisedHandoff = applyCommercialCommand(returnedHandoff, { workId: work.id, packageRevision: 1, action: "submit-design-handoff", dueDate: "2026-10-24" }, actor, inventory);
assert.equal(revisedHandoff.discovery.designHandoff.revision, 2);
const acceptedHandoff = applyCommercialCommand(revisedHandoff, { workId: work.id, packageRevision: 1, handoffRevision: 2, action: "accept-design-handoff", note: "I accept this scope and will plan controlled packages" }, receiver, inventory);
assert.equal(acceptedHandoff.discovery.designHandoff.status, "accepted");
assert.equal(acceptedHandoff.owner, receiver.name);
assert.equal(acceptedHandoff.id, awarded.id);
assert.equal(acceptedHandoff.stage, awarded.stage);
assert.equal(acceptedHandoff.discovery.designHandoffHistory.length, 4);
const receivedPackage = copy(acceptedHandoff);
receivedPackage.packages = [{ id: "wp-received", name: "Received scope", status: "planned" }];
assertSnapshotCommercialIntegrity([acceptedHandoff], [receivedPackage]);

console.log("Controlled D3 pricing, offer, customer response, Design handoff and snapshot bypass checks: PASS");
