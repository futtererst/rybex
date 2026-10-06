import Link from "next/link";
import {
  assignOpportunityPursuitAuthorityAction,
  assignOpportunitySubmissionApproverAction,
  attachOpportunityBidApprovalEvidenceAction,
  attachOpportunityDecisionSupportEvidenceAction,
  completeOpportunityPursuitContributionAction,
  recordOpportunityBidSubmissionAction,
  recordConfiguredBidSubmissionApprovalAction,
  recordOpportunityDecisionAction,
  recordOpportunityPursuitAuthorizationSelectedAction,
  saveOpportunityIntakeAction,
  saveOpportunityQualificationAction,
  setOpportunityDecisionAccountabilityAction,
  submitOpportunityForDecisionAction
} from "@/app/actions/opportunities";
import { PursuitOutcomeSelectionClient } from "./PursuitOutcomeSelectionClient";
import { BidApprovalOutcomeSelectionClient } from "./BidApprovalOutcomeSelectionClient";
import { BidEvidenceUploadClient } from "./BidEvidenceUploadClient";
import { CollapsedDetails } from "@/components/d5o/end-user";
import { getOpportunityResult, getDecisionOwnerOptionsResult } from "@/lib/d5o/opportunities/supabase-repository";
import { qualificationCriteria } from "@/lib/d5o/opportunities/qualification";
import type { BidSubmissionAction, BidSubmissionApprovalReadiness, DecisionOwnerOption, OpportunityDetail, OpportunityQualification } from "@/lib/d5o/opportunities/types";

export const metadata = {
  title: "Opportunity | RybexOS"
};

type SearchParams = Record<string, string | string[] | undefined>;

type PursuitEvidenceStatus = "Complete" | "Blocking" | "Risky" | "Incomplete" | "Unavailable" | "Empty" | "Loading";

type BidSubmissionModelAction = {
  label: string;
  action: BidSubmissionAction | null;
  defaultReason: string;
  defaultConfirmation: string;
  danger?: boolean;
};

type BidSubmissionModel = {
  eyebrow: string;
  roleLabel: string;
  title: string;
  lead: string;
  recommendationDetail: string;
  businessQuestion: string;
  businessContext: string;
  nextState: string;
  nextStateDetail: string;
  stateLabel: string;
  tone: "neutral" | "hold" | "success" | "danger";
  packageVersion: string;
  estimateVersion: string;
  estimatorInput: string;
  actionTitle: string;
  actionCopy: string;
  alertTitle: string;
  alertCopy: string;
  secondaryActionLabel: string;
  canMutate: boolean;
  actions: BidSubmissionModelAction[];
  metrics: { label: string; value: string }[];
  evidence: { title: string; detail: string; status: PursuitEvidenceStatus }[];
  risks: { title: string; detail: string }[];
};

export default async function OpportunityDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ opportunityId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { opportunityId } = await params;
  const query = await searchParams;
  const pursuitStateOverride = readParam(query.pursuitState);
  const bidStateOverride = readParam(query.bidState);

  if (process.env.NODE_ENV !== "production" && opportunityId === "p1-01b-2-review") {
    return <BidSubmissionSurface detail={buildBidSubmissionReviewDetail(bidStateOverride)} stateOverride={bidStateOverride} error={readParam(query.error)} ownerOptions={[]} />;
  }

  if (process.env.NODE_ENV !== "production" && opportunityId === "p1-01b-1-review") {
    if (pursuitStateOverride === "loading") return <PursuitAuthorizationLoading />;
    if (pursuitStateOverride === "empty") return <PursuitAuthorizationEmpty />;
    return <PursuitAuthorizationSurface detail={buildPursuitReviewDetail(pursuitStateOverride)} stateOverride={pursuitStateOverride} error={readParam(query.error)} ownerOptions={[]} />;
  }

  if (pursuitStateOverride === "loading") return <PursuitAuthorizationLoading />;
  if (pursuitStateOverride === "empty") return <PursuitAuthorizationEmpty />;

  const result = await getOpportunityResult(opportunityId);

  if (!result.success) {
    if (result.error === "forbidden") return <PermissionDenied />;
    return <RecordUnavailable />;
  }

  const detail = result.detail;
  const ownerResult = await getDecisionOwnerOptionsResult();
  if (!ownerResult.success) return <OwnerDirectoryUnavailable />;
  const ownerOptions = ownerResult.items;
  const context = detail.effectiveWorkContext;

  if (shouldPrioritizePursuitReviewState(pursuitStateOverride) && shouldRenderPursuitAuthorization(detail, pursuitStateOverride)) {
    return <PursuitAuthorizationSurface detail={detail} stateOverride="" error={readParam(query.error)} ownerOptions={ownerOptions} />;
  }

  if (shouldRenderBidSubmission(detail, bidStateOverride)) {
    return <BidSubmissionSurface detail={detail} stateOverride={bidStateOverride} error={readParam(query.error)} ownerOptions={ownerOptions} />;
  }

  if (shouldRenderPursuitAuthorization(detail, pursuitStateOverride)) {
    return <PursuitAuthorizationSurface detail={detail} stateOverride="" error={readParam(query.error)} ownerOptions={ownerOptions} />;
  }

  if (context === "auditor" || detail.accessMode === "read_only") {
    return <AuditorReview detail={detail} />;
  }

  if (context === "estimator") {
    return <EstimatorAssignment detail={detail} />;
  }

  if (context === "decision_owner") {
    return <DecisionPackage detail={detail} mode="decision-owner" />;
  }

  return (
    <main className="pipeline-workbench" data-pipeline-screen="opportunity-workbench">
      <OpportunityHeader detail={detail} contextLabel="Business Development Lead" />
      <ErrorNotice error={readParam(query.error)} />

      {detail.opportunity.lifecycleStatus === "draft" || !detail.opportunity.intakeComplete ? (
        <IntakeCompletion detail={detail} />
      ) : detail.opportunity.lifecycleStatus === "decision_required" ? (
        <DecisionPackage detail={detail} mode="bd-preview" showHeader={false} />
      ) : (
        <QualificationWorkspace detail={detail} ownerOptions={ownerOptions} />
      )}

      <SupportingDetails detail={detail} />
    </main>
  );
}

function OpportunityHeader({ detail, contextLabel }: { detail: OpportunityDetail; contextLabel: string }) {
  const { opportunity } = detail;
  return (
    <header className="pipeline-record-header">
      <div>
        <p className="pipeline-kicker">Opportunity qualification</p>
        <h1>{opportunity.name}</h1>
        <p>
          {opportunity.customerGc} · {opportunity.location} · {formatMoney(opportunity.estimatedValue)} estimated value · Bid due {formatDate(opportunity.bidDueDate)}
        </p>
        <p>Owner {detail.bdOwner?.name ?? "Business Development Lead"}</p>
      </div>
      <div className="pipeline-context-pill">{contextLabel}</div>
    </header>
  );
}

function IntakeCompletion({ detail }: { detail: OpportunityDetail }) {
  const { opportunity } = detail;
  const intakeAction = saveOpportunityIntakeAction.bind(null, opportunity.id, opportunity.version);
  return (
    <section className="pipeline-work-surface">
      <div className="pipeline-current-state">
        <p className="pipeline-kicker">Current responsibility</p>
        <h2>Complete intake before qualification starts</h2>
        <p>Required intake facts are still missing. Save the record once the scope, customer, location, value, and due date are ready.</p>
      </div>
      <form action={intakeAction} className="pipeline-form-grid">
        <TextField label="Opportunity name" name="name" defaultValue={opportunity.name} required />
        <TextField label="Customer / GC" name="customerGc" defaultValue={opportunity.customerGc} required />
        <TextField label="Project type" name="projectType" defaultValue={opportunity.projectType} required />
        <TextField label="Location" name="location" defaultValue={opportunity.location} required />
        <label className="pipeline-wide-field">
          Scope summary
          <textarea name="scopeSummary" required rows={3} defaultValue={opportunity.scopeSummary} />
        </label>
        <TextField label="Estimated value" name="estimatedValue" defaultValue={opportunity.estimatedValue ?? ""} />
        <TextField label="Anticipated start" name="anticipatedStart" type="date" defaultValue={opportunity.anticipatedStart ?? ""} />
        <TextField label="Bid due date" name="bidDueDate" type="date" defaultValue={opportunity.bidDueDate ?? ""} />
        <div className="pipeline-sticky-actions">
          <span>Changes are saved only after confirmation.</span>
          <button className="button button-primary" type="submit">Complete intake</button>
        </div>
      </form>
    </section>
  );
}

function QualificationWorkspace({
  detail,
  ownerOptions
}: {
  detail: OpportunityDetail;
  ownerOptions: DecisionOwnerOption[];
}) {
  const { opportunity, qualification } = detail;
  const saveAction = saveOpportunityQualificationAction.bind(null, opportunity.id, opportunity.version);
  const evidenceAction = attachOpportunityDecisionSupportEvidenceAction.bind(null, opportunity.id, opportunity.version);
  const accountabilityAction = setOpportunityDecisionAccountabilityAction.bind(null, opportunity.id, opportunity.version);
  const submitAction = submitOpportunityForDecisionAction.bind(null, opportunity.id, opportunity.version);
  const sections = getQualificationSections(detail);
  const configurationUnavailable = !detail.pricingReviewReadiness.available;
  const qualificationComplete = qualification.completenessResult === "complete" || qualification.status === "complete";
  const missingConfiguredEvidence = qualificationComplete && detail.pricingReviewReadiness.deficiencies.includes("missing_configured_evidence");
  const accountabilityInvalid = qualificationComplete && detail.pricingReviewReadiness.deficiencies.includes("invalid_decision_owner_accountability");
  const currentOwnerOption = ownerOptions.find((owner) => owner.userId === detail.decisionOwner?.userId);
  const operationsLeaderOptions = ownerOptions.filter((owner) => /operations/i.test(owner.role) || /operations leader/i.test(owner.name));
  const active = configurationUnavailable
    ? null
    : accountabilityInvalid
      ? sections.find((section) => section.title === "Recommendation") ?? sections[0]
      : sections.find((section) => section.status !== "complete") ?? sections[0];
  const readyForHandoff = detail.pricingReviewReadiness.available && detail.pricingReviewReadiness.ready && detail.capabilities.canSubmitForDecision;
  const responsibilityTitle = accountabilityInvalid ? "Assign an Operations Leader" : active?.actionTitle;
  const responsibilityCopy = accountabilityInvalid
    ? `${detail.decisionOwner?.name ?? "The current owner"} cannot authorize Pricing Review. Assign an Operations Leader before submitting the package.`
    : active?.consequence;

  if (readyForHandoff) {
    return (
      <section className="pipeline-work-surface">
        <div className="pipeline-current-state pipeline-current-state-ready">
          <p className="pipeline-kicker">Current responsibility</p>
          <h2>Ready for Pricing Review</h2>
          <p>Qualification requirements, decision support evidence, and Operations Leader accountability are complete.</p>
        </div>
        <div className="pipeline-layout-columns">
          <div className="pipeline-section-list">
            <PricingReviewReadinessDetails detail={detail} />
            {sections.map((section) => (
              <QualificationSectionView key={section.title} section={section} />
            ))}
          </div>

          <aside className="pipeline-side-panel pipeline-decision-column">
            <DecisionSummary detail={detail} compact />
            <form action={submitAction} className="pipeline-handoff-action">
              <span>Package revision {opportunity.version} · ready for {detail.decisionOwner?.name ?? "decision owner"}</span>
              <button className="button button-primary" type="submit">
                Submit to {detail.decisionOwner?.name ?? "decision owner"} for decision
              </button>
            </form>
            {detail.pricingReviewReadiness.provenanceLabel ? (
              <p className="pipeline-provenance-line">Governed by {detail.pricingReviewReadiness.provenanceLabel}</p>
            ) : null}
          </aside>
        </div>
      </section>
    );
  }

  if (configurationUnavailable) {
    return (
      <section className="pipeline-work-surface">
        <div className="pipeline-current-state pipeline-current-state-blocked">
          <p className="pipeline-kicker">Current responsibility</p>
          <h2>Pricing Review rules are unavailable</h2>
          <p>Pricing Review cannot be submitted until the workspace rules are restored. Contact your system administrator.</p>
        </div>
        <div className="pipeline-layout-columns">
          <div className="pipeline-section-list">
            <section className="pipeline-note-card">
              <h2>Setup unavailable</h2>
              <p>Your qualification work remains visible, but Pricing Review handoff is closed until the workspace rules are restored.</p>
            </section>
            {sections.map((section) => (
              <QualificationSectionView key={section.title} section={section} />
            ))}
          </div>

          <aside className="pipeline-side-panel pipeline-decision-column">
            <DecisionSummary detail={detail} compact />
            <PricingReviewReadinessDetails detail={detail} hideUnavailableMessage />
          </aside>
        </div>
      </section>
    );
  }

  if (missingConfiguredEvidence) {
    return (
      <section className="pipeline-work-surface">
        <div className="pipeline-current-state">
          <p className="pipeline-kicker">Current responsibility</p>
          <h2>Add decision support evidence</h2>
          <p>Attach the decision support evidence and save the supporting notes before submitting this package for Pricing Review.</p>
          <PricingReviewBlocker detail={detail} />
        </div>
        <div className="pipeline-layout-columns">
          <div className="pipeline-section-list">
            {sections.filter((section) => section.title !== "Evidence and assumptions").map((section) => (
              <QualificationSectionView key={section.title} section={section} />
            ))}
            <form action={evidenceAction} className="pipeline-section pipeline-evidence-focus-form">
              <div className="pipeline-section-heading">
                <div>
                  <h2>Decision support evidence</h2>
                  <p>Upload the configured decision support document and keep the qualification notes with this package.</p>
                </div>
                <span className="chip chip-warning">Missing</span>
              </div>
              <label>
                Decision support evidence
                <input name="decisionSupportDocument" type="file" required accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,text/plain,application/pdf,image/png,image/jpeg,image/webp" />
              </label>
              <label>
                Assumptions/notes
                <textarea name="assumptions" rows={4} defaultValue={qualification.assumptions ?? ""} />
              </label>
              <button className="button button-primary" type="submit">Save evidence and notes</button>
            </form>
          </div>

          <aside className="pipeline-side-panel pipeline-decision-column">
            <DecisionSummary detail={detail} compact />
            <EvidenceRequirementSummary detail={detail} />
            <DecisionAccountability detail={detail} ownerOptions={ownerOptions} action={accountabilityAction} />
          </aside>
        </div>
      </section>
    );
  }

  if (accountabilityInvalid) {
    return (
      <section className="pipeline-work-surface">
        <div className="pipeline-current-state">
          <p className="pipeline-kicker">Current responsibility</p>
          <h2>Assign an Operations Leader</h2>
          <p>{detail.decisionOwner?.name ?? "The current owner"} cannot authorize Pricing Review. Assign an Operations Leader before submitting the package.</p>
          <PricingReviewBlocker detail={detail} />
        </div>
        <div className="pipeline-layout-columns">
          <div className="pipeline-section-list">
            {sections.filter((section) => section.title !== "Recommendation").map((section) => (
              <QualificationSectionView key={section.title} section={section} />
            ))}
            <form action={accountabilityAction} className="pipeline-section pipeline-owner-focus-form">
              <div className="pipeline-section-heading">
                <div>
                  <h2>Decision Owner</h2>
                  <p>Select an eligible Operations Leader to own the Pricing Review decision.</p>
                </div>
                <span className="chip chip-warning">Needs assignment</span>
              </div>
              <ReadOnlyField label="Current assignment" value={`${detail.decisionOwner?.name ?? "Not assigned"}${currentOwnerOption?.role ? ` - ${formatRoleLabel(currentOwnerOption.role)}` : detail.decisionOwner?.name ? " - Project Manager" : ""}`} />
              <ReadOnlyField label="Required accountability" value="Operations Leader" />
              <label>
                Eligible owner
                <select name="decisionOwnerUserId" required defaultValue="">
                  <option value="">Choose Operations Leader</option>
                  {(operationsLeaderOptions.length > 0 ? operationsLeaderOptions : ownerOptions).map((owner) => (
                    <option key={owner.userId} value={owner.userId}>
                      {owner.name} - {formatRoleLabel(owner.role)}
                    </option>
                  ))}
                </select>
              </label>
              <input name="decisionDueAt" type="hidden" value={detail.decisionDueAt ?? detail.opportunity.bidDueDate ?? ""} />
              <button className="button button-primary" type="submit">Assign Decision Owner</button>
            </form>
          </div>

          <aside className="pipeline-side-panel pipeline-decision-column">
            <DecisionSummary detail={detail} compact />
            <EvidenceRequirementSummary detail={detail} />
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="pipeline-work-surface">
      <div className="pipeline-current-state">
        <p className="pipeline-kicker">Current responsibility</p>
        <h2>{responsibilityTitle}</h2>
        <p>{responsibilityCopy}</p>
        <PricingReviewBlocker detail={detail} />
      </div>
      <div className="pipeline-layout-columns">
        <form action={saveAction} className="pipeline-section-list">
          {sections.map((section) => (
            section.status === "complete" && section.title !== active?.title ? (
              <div key={section.title}>
                <QualificationSectionView section={section} />
                <QualificationSectionHiddenInputs section={section} qualification={qualification} />
              </div>
            ) : (
              <details className="pipeline-section" key={section.title} open={section.title === active?.title}>
                <summary>
                  <span>{section.title}</span>
                  <strong>{section.summary}</strong>
                </summary>
                <div className="pipeline-section-fields">
                  {section.criteria.map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <select name={key} defaultValue={qualification.criteria?.[key] ?? ""} required>
                        <option value="">Choose one</option>
                        <option value="strong">Strong</option>
                        <option value="acceptable">Acceptable</option>
                        <option value="risk">Risk</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </label>
                  ))}
                  {section.title === "Risk and governance" ? (
                    <label className="pipeline-wide-field">
                      Risk summary
                      <textarea name="riskSummary" rows={3} required defaultValue={qualification.riskSummary ?? ""} />
                    </label>
                  ) : null}
                  {section.title === "Evidence and assumptions" ? (
                    <label className="pipeline-wide-field">
                      Assumptions
                      <textarea name="assumptions" rows={3} defaultValue={qualification.assumptions ?? ""} />
                    </label>
                  ) : null}
                  {section.title === "Recommendation" ? (
                    <label>
                      Recommendation
                      <select name="recommendation" defaultValue={qualification.recommendation ?? "hold_for_clarification"} required>
                        <option value="pursue">Pursue</option>
                        <option value="pursue_with_mitigations">Pursue with mitigations</option>
                        <option value="hold_for_clarification">Hold for clarification</option>
                        <option value="decline">Decline</option>
                        <option value="no_bid">No bid</option>
                      </select>
                    </label>
                  ) : null}
                </div>
              </details>
            )
          ))}
          <div className="pipeline-sticky-actions">
            <span>Save state is confirmed after the server accepts the change.</span>
            <button className="button button-primary" type="submit">{active?.primaryAction}</button>
          </div>
        </form>

        <aside className="pipeline-side-panel pipeline-decision-column">
          <DecisionSummary detail={detail} compact />
          <EvidenceRequirement detail={detail} evidenceAction={evidenceAction} />
          <DecisionAccountability detail={detail} ownerOptions={ownerOptions} action={accountabilityAction} />
        </aside>
      </div>
    </section>
  );
}

function EstimatorAssignment({ detail }: { detail: OpportunityDetail }) {
  return (
    <main className="pipeline-workbench" data-pipeline-screen="estimator-assignment">
      <OpportunityHeader detail={detail} contextLabel="Estimator assignment" />
      <section className="pipeline-work-surface pipeline-two-column">
        <div>
          <div className="pipeline-current-state">
            <p className="pipeline-kicker">Estimating assignment</p>
            <h2>Commercial estimate and capacity confirmation</h2>
            <p>
              Confirm labor cost, material allowance, capacity, estimate confidence, and assumptions. Opportunity-wide qualification remains read-only.
            </p>
          </div>
          <div className="pipeline-estimate-grid">
            <ReadOnlyField label="Preliminary labor cost" value="$2,140,000" />
            <ReadOnlyField label="Material allowance" value="$6,380,000" />
            <ReadOnlyField label="Target gross margin" value="20% midpoint" />
            <ReadOnlyField label="Estimate confidence" value="Medium-high" />
          </div>
          <div className="pipeline-note-card">
            <strong>Material assumptions</strong>
            <p>Fiber reservation, traffic-control windows, and crew availability remain connected to this estimating contribution.</p>
          </div>
          <div className="pipeline-sticky-actions">
            <span>Draft saved only after confirmation.</span>
            <button className="button button-primary" type="button">Complete contribution and return to {detail.bdOwner?.name ?? "Business Development Lead"}</button>
          </div>
        </div>
        <aside className="pipeline-side-panel">
          <h2>Read-only opportunity context</h2>
          <ReadOnlyField label="Estimated value" value={formatMoney(detail.opportunity.estimatedValue)} />
          <ReadOnlyField label="Bid due" value={formatDate(detail.opportunity.bidDueDate)} />
          <ReadOnlyField label="Scope" value={detail.opportunity.scopeSummary} />
          <CollapsedDetails title="View BD-owned qualification" summary="">
            <QualificationOutcomeList detail={detail} />
          </CollapsedDetails>
        </aside>
      </section>
    </main>
  );
}

function AuditorReview({ detail }: { detail: OpportunityDetail }) {
  return (
    <main className="pipeline-workbench" data-pipeline-screen="auditor-review">
      <OpportunityHeader detail={detail} contextLabel="Auditor" />
      <section className="pipeline-work-surface pipeline-two-column">
        <div>
          <div className="pipeline-current-state">
            <p className="pipeline-kicker">Opportunity audit review</p>
            <h2>Read-only review</h2>
            <p>Verify decision summary, evidence completeness, authorship, timestamps, and latest material changes without editing the record.</p>
          </div>
          <DecisionSummary detail={detail} compact={false} />
          <QualificationOutcomeList detail={detail} />
        </div>
        <aside className="pipeline-side-panel">
          <h2>Evidence completeness</h2>
          <div className="pipeline-evidence-counts">
            <ReadOnlyField label="Verified" value={String(detail.evidenceReady ? Math.max(detail.evidence.length, 1) : 0)} />
            <ReadOnlyField label="Pending" value={detail.evidenceReady ? "0" : "1"} />
            <ReadOnlyField label="Missing" value={detail.evidenceReady ? "0" : "1"} />
          </div>
          <h3>Provenance and recent changes</h3>
          <p>Prepared by {detail.bdOwner?.name ?? "Business Development Lead"} · Package revision {detail.opportunity.version}</p>
          <CollapsedDetails title="Open evidence and change history" summary="">
            <EvidenceList detail={detail} />
          </CollapsedDetails>
        </aside>
      </section>
    </main>
  );
}

function BidSubmissionSurface({ detail, stateOverride, error, ownerOptions }: { detail: OpportunityDetail; stateOverride: string; error: string; ownerOptions: DecisionOwnerOption[] }) {
  const state = getBidSubmissionViewState(detail, stateOverride);
  if (shouldRenderConfiguredBidApproval(detail, state)) {
    return <ConfiguredBidSubmissionApprovalSurface detail={detail} state={state} error={error} ownerOptions={ownerOptions} />;
  }
  const model = getBidSubmissionModel(detail, state);
  const action = (bidAction: Parameters<typeof recordOpportunityBidSubmissionAction>[2]) =>
    recordOpportunityBidSubmissionAction.bind(null, detail.opportunity.id, detail.opportunity.version, bidAction);

  return (
    <main className={`bid-submission-workbench bid-tone-${model.tone}`} data-pipeline-screen="bid-submission-outcome" data-bid-state={state}>
      <header className="pursuit-auth-topbar">
        <div>
          <strong>RybexOS</strong>
          <span>Bid Submission / Pursuit Outcome</span>
        </div>
        <div className="pursuit-role-pill">{model.roleLabel}</div>
      </header>

      {state === "stale-conflict" || state === "action-failure" || error ? (
        <section className="pipeline-alert" role="status">
          <strong>{model.alertTitle}</strong>
          <span>{model.alertCopy}</span>
        </section>
      ) : null}

      <section className="pursuit-hero">
        <div>
          <p className="pipeline-kicker">{model.eyebrow}</p>
          <h1>{model.title}</h1>
          <p>{model.lead}</p>
          <div className="pursuit-badges">
            <span>Pursuit authorized upstream</span>
            <span>Package {detail.opportunity.bidPackageVersion ?? model.packageVersion}</span>
            <span>Estimate {detail.opportunity.approvedEstimateVersion ?? model.estimateVersion}</span>
          </div>
        </div>
        <aside className="pursuit-recommendation">
          <p className="pipeline-kicker">Current gate</p>
          <strong>{model.stateLabel}</strong>
          <span>{model.recommendationDetail}</span>
        </aside>
      </section>

      <section className="pursuit-question-card">
        <div>
          <p className="pipeline-kicker">Business questions</p>
          <h2>{model.businessQuestion}</h2>
          <p>{model.businessContext}</p>
        </div>
        <div className="pursuit-next-state">
          <span>Explicit resulting state</span>
          <strong>{model.nextState}</strong>
          <small>{model.nextStateDetail}</small>
        </div>
      </section>

      <section className="pursuit-metrics" aria-label="Bid commercial basis">
        {model.metrics.map((metric) => (
          <ReadOnlyField key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </section>

      <section className="pursuit-content-grid">
        <div className="pursuit-panel">
          <p className="pipeline-kicker">Claim-tied evidence</p>
          <h2>What proves this submission state</h2>
          {model.evidence.map((item) => (
            <PursuitEvidenceRow key={item.title} {...item} />
          ))}
        </div>
        <div className="pursuit-panel">
          <p className="pipeline-kicker">Commercial posture</p>
          <h2>Terms, risk, and role basis</h2>
          {model.risks.map((item) => (
            <div className="pursuit-risk-row" key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pursuit-facts">
        <ReadOnlyField label="Pursuit Owner" value={detail.bdOwner?.name ?? "Commercial Owner"} />
        <ReadOnlyField label="Estimator input" value={model.estimatorInput} />
        <ReadOnlyField label="Submission Approver" value={detail.pursuitAuthority?.name ?? detail.decisionOwner?.name ?? "Not assigned"} />
        <ReadOnlyField label="Recipient / channel" value={`${detail.opportunity.bidRecipient ?? "Northstar GC"} / ${detail.opportunity.bidSubmissionChannel ?? "Portal"}`} />
      </section>

      <section className="pursuit-action-panel">
        <div>
          <p className="pipeline-kicker">Allowed action</p>
          <h2>{model.actionTitle}</h2>
          <p>{model.actionCopy}</p>
        </div>
        <div className="pursuit-actions">
          {model.actions.map((item) => (
            item.action && model.canMutate ? (
              <details className="pursuit-action-disclosure" key={item.label}>
                <summary>{item.label}</summary>
                <form action={action(item.action)} className="pursuit-action-form">
                  <label>
                    Evidence / rationale
                    <textarea name="bidReason" rows={3} defaultValue={item.defaultReason} />
                  </label>
                  <label>
                    Recipient
                    <input name="bidRecipient" defaultValue={detail.opportunity.bidRecipient ?? "Northstar GC"} />
                  </label>
                  <label>
                    Channel
                    <input name="bidChannel" defaultValue={detail.opportunity.bidSubmissionChannel ?? "Customer portal"} />
                  </label>
                  <label>
                    Confirmation / notice
                    <input name="bidConfirmation" defaultValue={item.defaultConfirmation} />
                  </label>
                  <button className={`button ${item.danger ? "button-danger" : "button-primary"}`} type="submit">{item.label}</button>
                </form>
              </details>
            ) : (
              <button className="button button-secondary" disabled key={item.label}>{item.label}</button>
            )
          ))}
          <Link className="button button-secondary" href="/pipeline">{model.secondaryActionLabel}</Link>
        </div>
      </section>

      <section className="pursuit-panel">
        <p className="pipeline-kicker">Audit and history</p>
        <h2>Submission and outcome trail</h2>
        {detail.bidSubmissionEvents.length ? (
          <div className="pursuit-history-list">
            {detail.bidSubmissionEvents.map((event) => (
              <div className="pursuit-history-row" key={event.id}>
                <strong>{bidSubmissionActionLabel(event.bidAction)}</strong>
                <span>{event.fromStatus ?? "not started"} → {event.toStatus ?? "no state change"} · package {event.packageVersion ?? detail.opportunity.version}</span>
                <small>{event.reason ?? "No rationale recorded"} · {new Date(event.createdAt).toLocaleString("en-US")}</small>
              </div>
            ))}
          </div>
        ) : (
          <p>No submission or outcome events have been recorded yet.</p>
        )}
      </section>

      <section className="pursuit-boundary-note">
        <strong>Boundary:</strong> Selected / intent-to-award is a handoff-ready pursuit outcome only. Award validation has not started. No bid submission, award, project conversion, mobilization, field execution, billing, or closeout action starts here.
      </section>
    </main>
  );
}

function shouldRenderConfiguredBidApproval(detail: OpportunityDetail, state: string) {
  if (detail.opportunity.id === "p1-01b-2-review") return false;
  if (detail.bidSubmissionApprovalReadiness?.available) return true;
  if (detail.opportunity.bidSubmissionApprovalConfigurationVersionId) return true;
  return ["ready-for-submission-approval", "submission-approval-held", "submission-approved-ready-to-send", "submission-blocked", "unavailable"].includes(state);
}

function emptyBidSubmissionApprovalReadiness(): BidSubmissionApprovalReadiness {
  return {
    available: false,
    ready: false,
    reason: "configuration_unavailable",
    deficiencies: ["configuration_unavailable"],
    evidenceRequirements: [],
    missingEvidence: [],
    submissionApproverAccountability: null,
    permittedOutcomes: [],
    provenanceLabel: null
  };
}

function ConfiguredBidSubmissionApprovalSurface({
  detail,
  state,
  error,
  ownerOptions
}: {
  detail: OpportunityDetail;
  state: string;
  error: string;
  ownerOptions: DecisionOwnerOption[];
}) {
  const readiness = detail.bidSubmissionApprovalReadiness ?? emptyBidSubmissionApprovalReadiness();
  const unavailable = !readiness.available || state === "unavailable";
  const held = detail.opportunity.bidSubmissionStatus === "submission_approval_held";
  const approved = detail.opportunity.bidSubmissionStatus === "submission_approved_ready_to_send";
  const decisionAuthority = detail.bidSubmissionDecisionAuthority;
  const completedAuthorityUnavailable = (approved || held) && !decisionAuthority;
  const missingEvidence = readiness.deficiencies.includes("missing_bid_evidence") || state === "submission-blocked";
  const invalidApprover = readiness.deficiencies.includes("invalid_submission_approver") || !detail.submissionApprover;
  const approverOptions = ownerOptions.filter((owner) => owner.profileId && /operations|admin/i.test(owner.role));
  const configuredAction = recordConfiguredBidSubmissionApprovalAction.bind(null, detail.opportunity.id, detail.opportunity.version);
  const approverAction = assignOpportunitySubmissionApproverAction.bind(null, detail.opportunity.id, detail.opportunity.version);
  const evidenceAction = attachOpportunityBidApprovalEvidenceAction.bind(null, detail.opportunity.id, detail.opportunity.version);
  const title = unavailable
    ? "Bid Submission Approval rules are unavailable"
    : approved
      ? "Approved and Ready to Send"
      : held
        ? "Submission Approval Held"
        : missingEvidence
          ? "Add bid-package evidence"
          : invalidApprover
            ? "Assign a Submission Approver"
            : "Ready for submission approval";
  const responsibility = unavailable
    ? "Workspace rules must be restored before approval can be recorded."
    : approved
      ? "The package is ready to send. No bid submission has been recorded."
      : held
        ? "Review the hold rationale and correct the package before returning to approval readiness."
        : missingEvidence
          ? "Attach the configured bid-package evidence in the main workspace."
          : invalidApprover
            ? "Assign an eligible same-workspace Submission Approver."
            : "Submission Approver must choose approve or hold from the configured outcomes.";

  return (
    <main className="pipeline-opportunity-shell" data-pipeline-screen="cfg-runtime-03-bid-approval" data-bid-approval-state={state}>
      <header className="pipeline-opportunity-header">
        <div>
          <p className="pipeline-kicker">Bid Submission Approval Readiness</p>
          <h1>{detail.opportunity.name}</h1>
          <p>{detail.opportunity.location} · {formatMoney(detail.opportunity.estimatedValue)} · due {formatDate(detail.opportunity.bidDueDate)}</p>
        </div>
        <span className="pursuit-role-pill">{humanReadableRoleLabel(detail.workspaceAccessRole)}</span>
      </header>

      <section className="pipeline-alert" role="status" data-responsibility-banner>
        <strong>{title}</strong>
        <span>{responsibility}</span>
        {error ? <small>Action was not recorded: {error}</small> : null}
      </section>

      <div className="pipeline-decision-layout">
        <section className="pipeline-main-workflow" data-main-workflow>
          <CollapsedDetails title="Pricing Review" summary="Complete">
            <p>Complete</p>
          </CollapsedDetails>
          <CollapsedDetails title="Pursuit Authorization" summary="Complete">
            <p>Complete</p>
          </CollapsedDetails>
          <section className="pipeline-section">
            <div className="pipeline-section-heading">
              <div>
                <h2>{title}</h2>
                <p>{responsibility}</p>
              </div>
            </div>

            {unavailable ? (
              <div className="pipeline-unavailable-state">
                <strong>Bid Submission Approval rules are unavailable</strong>
                <p>A submission approval decision cannot be recorded until the workspace rules are restored. Contact your system administrator.</p>
              </div>
            ) : completedAuthorityUnavailable ? (
              <div className="pipeline-unavailable-state" data-bid-approval-authority-unavailable>
                <strong>Decision package authority is unavailable</strong>
                <p>The recorded decision cannot be displayed until its bid-package reference, revision, and audit provenance reconcile.</p>
              </div>
            ) : approved || held ? (
              <div className="pipeline-readonly-decision" data-bid-approval-readonly>
                <ReadOnlyField label="Decision outcome" value={approved ? "Approve for submission" : "Hold submission approval"} />
                <ReadOnlyField label="Submission Approver" value={humanReadablePersonName(detail.submissionApprover?.name ?? readiness.submissionApproverAccountability?.name)} />
                <ReadOnlyField label="Accountability" value={readiness.submissionApproverAccountability?.label ?? "Submission Approver"} />
                <ReadOnlyField label="Decision timestamp" value={formatDateTime(decisionAuthority!.decisionAt)} />
                <ReadOnlyField label="Bid package reference" value={decisionAuthority!.packageReference} />
                <ReadOnlyField label="Revision" value={String(decisionAuthority!.revision)} />
                <ReadOnlyField label="Decision applies to" value={`${decisionAuthority!.packageReference} · Revision ${decisionAuthority!.revision}`} />
                <ReadOnlyField label="Rationale" value={detail.bidSubmissionEvents[0]?.reason ?? (approved ? "Final bid package approved for submission." : "Hold rationale recorded.")} />
                <p className="pipeline-secondary-note">{approved ? "The package is approved and ready to send. No bid submission has been recorded." : "The package is held from submission until the recorded issue is resolved."}</p>
              </div>
            ) : missingEvidence ? (
              <BidEvidenceUploadClient requirements={readiness.missingEvidence} action={evidenceAction} />
            ) : invalidApprover ? (
              <form action={approverAction} className="pipeline-section" data-main-correction="submission-approver">
                <h3>Submission Approver</h3>
                <ReadOnlyField label="Current assignment" value={detail.submissionApprover?.name ?? readiness.submissionApproverAccountability?.name ?? "Unassigned"} />
                <ReadOnlyField label="Required accountability" value={readiness.submissionApproverAccountability?.label ?? "Submission Approver"} />
                <label className="pipeline-wide-field">
                  Eligible Submission Approver
                  <select name="submissionApproverProfileId" required>
                    <option value="">Choose an eligible approver</option>
                    {approverOptions.map((owner) => (
                      <option value={owner.profileId} key={owner.profileId ?? owner.userId}>{owner.name} - {owner.role.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </label>
                <button className="button button-primary" type="submit">Assign Submission Approver</button>
              </form>
            ) : (
              <>
                <ConfiguredEvidenceReadinessSummary detail={detail} readiness={readiness} />
                <BidApprovalOutcomeSelectionClient outcomes={readiness.permittedOutcomes} action={configuredAction} />
              </>
            )}
          </section>
        </section>

        <aside className="pipeline-decision-rail" data-decision-rail>
          <section className="pipeline-section">
            <h2>Decision package</h2>
            <ReadOnlyField label="Bid package reference" value={decisionAuthority?.packageReference ?? detail.opportunity.bidPackageVersion ?? "Not available"} />
            <ReadOnlyField label="Revision" value={String(decisionAuthority?.revision ?? detail.opportunity.version)} />
            <ReadOnlyField label="Approved estimate" value={detail.opportunity.approvedEstimateVersion ?? "Not available"} />
            <ReadOnlyField label="Submission Approver" value={detail.submissionApprover ? humanReadablePersonName(detail.submissionApprover.name) : "Unassigned"} />
            <ReadOnlyField label="Commercial basis" value={`${formatMoney(detail.opportunity.bidSubmissionPrice ?? detail.opportunity.estimatedValue)} · valid until ${formatDate(detail.opportunity.bidPricingValidity)}`} />
            <ReadOnlyField label="Governing rules" value={readiness.provenanceLabel ?? "Setup unavailable"} />
          </section>
        </aside>
      </div>
    </main>
  );
}

function ConfiguredEvidenceReadinessSummary({ readiness }: { detail: OpportunityDetail; readiness: BidSubmissionApprovalReadiness }) {
  return (
    <section className="pipeline-section pipeline-ready-evidence" data-ready-evidence-summary>
      <div className="pipeline-section-heading">
        <div>
          <h2>Configured evidence satisfied</h2>
          <p>These verified files satisfy the active bid-package requirements and support submission approval readiness.</p>
        </div>
      </div>
      {readiness.evidenceRequirements.map((requirement) => {
        return (
          <div className="pursuit-risk-row" key={requirement.requirementId} data-configured-evidence-requirement>
            <strong>{requirement.label}</strong>
            <span>{requirement.satisfied && requirement.evidence ? `Satisfied · ${requirement.evidence.fileName}` : "Missing"}</span>
          </div>
        );
      })}
    </section>
  );
}

function humanReadablePersonName(value: string | null | undefined) {
  const name = String(value ?? "").trim();
  if (!name) return "Unknown user";
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(name)) return "Unknown user";
  if (/^(?:ops|bd|pm|auditor|user|estimator|admin)-[a-z0-9]+$/i.test(name)) return "Unknown user";
  return name;
}

function humanReadableRoleLabel(value: string | null | undefined) {
  const label = String(value ?? "workspace member").replaceAll("_", " ").trim();
  return label.replace(/\b\w/g, (character) => character.toUpperCase());
}

function shouldRenderBidSubmission(detail: OpportunityDetail, stateOverride: string) {
  if (stateOverride) return true;
  return detail.opportunity.bidSubmissionStatus !== "not_started";
}

function buildBidSubmissionReviewDetail(state: string): OpportunityDetail {
  const base = buildPursuitReviewDetail("authorized-outcome");
  const status = bidStateToStatus(state);
  const readOnly = state === "auditor-read-only";
  const unavailable = state === "unavailable";
  return {
    ...base,
    opportunity: {
      ...base.opportunity,
      id: "p1-01b-2-review",
      bidSubmissionStatus: status,
      bidPackageVersion: state === "revision-bafo-required" ? "PROP-7.4-DRAFT" : state === "revised-submission-recorded" ? "PROP-7.4" : "PROP-7.3",
      approvedEstimateVersion: state === "revised-submission-recorded" ? "EST-7.4" : "EST-7.3",
      bidSubmissionPrice: state === "lost-not-selected" ? 4_180_000 : 4_960_000,
      bidPricingValidity: "2026-07-29",
      bidScheduleCommitment: "18 weeks",
      bidRecipient: "Northstar GC",
      bidSubmissionChannel: "Customer portal",
      bidSubmittedAt: ["submitted-pending-outcome", "clarification-requested", "revision-bafo-required", "revised-submission-recorded", "lost-not-selected", "selected-intent-to-award"].includes(state) ? "2026-06-29T16:15:00Z" : null,
      bidSubmissionConfirmation: ["submitted-pending-outcome", "clarification-requested", "revision-bafo-required", "revised-submission-recorded", "lost-not-selected", "selected-intent-to-award"].includes(state) ? "NS-44991" : null,
      bidOutcomeReason: state === "lost-not-selected" ? "Customer selected another bidder on price." : state === "withdrawn-no-submit" ? "Rybex withdrew before final submission because terms risk remained unresolved." : null,
      bidSelectedNotice: state === "selected-intent-to-award" ? "Customer email indicates intent to award pending contract and insurance review." : null
    },
    bidSubmissionState: state,
    bidEvidenceReady: !["submission-blocked", "loading-empty-action-failure"].includes(state),
    bidSubmissionReady: ["ready-for-submission-approval", "submission-approved-ready-to-send", "submitted-pending-outcome"].includes(state),
    bidOutcomeReady: ["lost-not-selected", "withdrawn-no-submit", "selected-intent-to-award"].includes(state),
    bidSubmissionEvents: buildBidReviewEvents(state),
    effectiveWorkContext: unavailable ? "operations_leader" : readOnly ? "auditor" : "pursuit_authority",
    accessMode: readOnly ? "read_only" : "editable",
    workspaceRole: readOnly ? "read_only_auditor" : "operations_leader",
    workspaceAccessRole: readOnly ? "read_only_auditor" : "operations_leader",
    capabilities: {
      ...base.capabilities,
      canPrepareBidSubmission: !readOnly && !unavailable,
      canMarkBidPackageReady: state === "submission-preparation" && !readOnly && !unavailable,
      canRequestBidEvidence: ["submission-preparation", "submission-blocked"].includes(state) && !readOnly && !unavailable,
      canApproveBidSubmission: state === "ready-for-submission-approval" && !readOnly && !unavailable,
      canHoldBidSubmission: state === "ready-for-submission-approval" && !readOnly && !unavailable,
      canRecordBidSubmission: ["submission-approved-ready-to-send", "revision-bafo-required"].includes(state) && !readOnly && !unavailable,
      canRecordBidOutcome: ["submitted-pending-outcome", "revised-submission-recorded"].includes(state) && !readOnly && !unavailable
    }
  };
}

function bidStateToStatus(state: string) {
  const map: Record<string, OpportunityDetail["opportunity"]["bidSubmissionStatus"]> = {
    "submission-preparation": "submission_preparation",
    "submission-blocked": "submission_blocked",
    "ready-for-submission-approval": "ready_for_submission_approval",
    "submission-approval-held": "submission_approval_held",
    "submission-approved-ready-to-send": "submission_approved_ready_to_send",
    "submitted-pending-outcome": "submitted_pending_outcome",
    "clarification-requested": "clarification_requested",
    "revision-bafo-required": "revision_bafo_required",
    "revised-submission-recorded": "revised_submission_recorded",
    "lost-not-selected": "lost_not_selected",
    "withdrawn-no-submit": "withdrawn_no_submit",
    "selected-intent-to-award": "selected_intent_to_award"
  };
  return map[state] ?? "submission_preparation";
}

function getBidSubmissionViewState(detail: OpportunityDetail, stateOverride: string) {
  if (stateOverride) return stateOverride;
  if (detail.accessMode === "read_only" || detail.effectiveWorkContext === "auditor") return "auditor-read-only";
  if (detail.effectiveWorkContext !== "pursuit_authority" && detail.workspaceRole !== "operations_leader") return "unavailable";
  return normalizeBidSubmissionState(detail.bidSubmissionState || detail.opportunity.bidSubmissionStatus);
}

function normalizeBidSubmissionState(state: string) {
  const states: Record<string, string> = {
    not_started: "submission-preparation",
    submission_preparation: "submission-preparation",
    submission_blocked: "submission-blocked",
    ready_for_submission_approval: "ready-for-submission-approval",
    submission_approval_held: "submission-approval-held",
    submission_approved_ready_to_send: "submission-approved-ready-to-send",
    submitted_pending_outcome: "submitted-pending-outcome",
    clarification_requested: "clarification-requested",
    revision_bafo_required: "revision-bafo-required",
    revised_submission_recorded: "revised-submission-recorded",
    lost_not_selected: "lost-not-selected",
    withdrawn_no_submit: "withdrawn-no-submit",
    selected_intent_to_award: "selected-intent-to-award"
  };
  return states[state] ?? (state || "submission-preparation");
}

function getBidSubmissionModel(detail: OpportunityDetail, state: string): BidSubmissionModel {
  const price = detail.opportunity.bidSubmissionPrice ?? 4_960_000;
  const validity = formatDate(detail.opportunity.bidPricingValidity ?? "2026-07-29");
  const base: BidSubmissionModel = {
    eyebrow: "Bid submission and pursuit outcome",
    roleLabel: detail.accessMode === "read_only" ? "Read-only Auditor" : detail.effectiveWorkContext === "pursuit_authority" ? "Assigned Commercial Owner" : "Admin, not assigned",
    title: "Build the bid package before approval.",
    lead: "The pursuit was authorized upstream. The current job is to prepare the exact package, evidence, terms, price, validity, schedule, and recipient before submission approval.",
    recommendationDetail: "Package truth is being assembled.",
    businessQuestion: "What exactly will be submitted, who approves it, and what evidence proves the submission or outcome?",
    businessContext: "This gate starts after pursuit authorization and ends as active, lost, withdrawn/no-submit, or selected handoff.",
    nextState: "Ready for submission approval or submission blocked",
    nextStateDetail: "Complete evidence moves the package to approval; missing claim-tied evidence blocks it.",
    stateLabel: "Submission preparation",
    tone: "neutral" as "neutral" | "hold" | "success" | "danger",
    packageVersion: "PROP-7.3",
    estimateVersion: "EST-7.3",
    estimatorInput: "EST-7.3 price, labor, validity, and assumptions",
    actionTitle: "Prepare package truth.",
    actionCopy: "Approval is unavailable until required evidence and commercial terms are complete.",
    alertTitle: "Review package status",
    alertCopy: "The latest package state is shown below.",
    secondaryActionLabel: "Return to pipeline",
    canMutate: true,
    actions: [
      { label: "Mark package ready", action: "mark_package_ready" as const, defaultReason: "All required package evidence is complete.", defaultConfirmation: "Package readiness confirmed" },
      { label: "Request missing evidence", action: "request_missing_evidence" as const, defaultReason: "Pricing validity and bid instructions must be attached.", defaultConfirmation: "Evidence request opened" }
    ],
    metrics: [
      { label: "Submitted price", value: formatMoney(price) },
      { label: "Package", value: detail.opportunity.bidPackageVersion ?? "PROP-7.3" },
      { label: "Valid until", value: validity },
      { label: "Schedule", value: detail.opportunity.bidScheduleCommitment ?? "18 weeks" },
      { label: "Status", value: "Preparing" }
    ],
    evidence: [
      { title: "Approved estimate version proves pricing basis", detail: detail.opportunity.approvedEstimateVersion ?? "EST-7.3", status: "Complete" as const },
      { title: "Proposal package proves submitted content", detail: detail.opportunity.bidPackageVersion ?? "PROP-7.3", status: "Complete" as const },
      { title: "Pricing validity proves how long price stands", detail: validity, status: "Complete" as const }
    ],
    risks: [
      { title: "Price", detail: `${formatMoney(price)} is explicit and tied to the package.` },
      { title: "Assumptions and exclusions", detail: "Traffic-control windows, owner-furnished fiber, and night cutover are included." },
      { title: "Resource assumptions", detail: "Two crews, one splicing team, and long-lead materials are included." }
    ]
  };

  const variants: Record<string, Partial<BidSubmissionModel>> = {
    "submission-blocked": {
      title: "Submission approval is blocked by missing proof.",
      lead: "The package cannot be approved or submitted until claim-tied evidence is complete.",
      recommendationDetail: "Do not approve yet.",
      nextState: "Submission blocked / missing evidence until blockers close",
      stateLabel: "Submission blocked / missing evidence",
      tone: "hold",
      actionTitle: "Resolve blocking evidence.",
      actions: [{ label: "Request missing evidence", action: "request_missing_evidence" as const, defaultReason: "Bid instructions and pricing validity are blocking approval.", defaultConfirmation: "Evidence request opened" }],
      evidence: [
        { title: "Pricing validity proves how long price can stand", detail: "Validity terms are missing.", status: "Blocking" as const },
        { title: "Customer bid instructions prove channel", detail: "Portal instructions are not attached.", status: "Blocking" as const },
        { title: "Proposal package proves submitted content", detail: "PROP-7.3 is complete.", status: "Complete" as const }
      ]
    },
    "ready-for-submission-approval": {
      title: "Approve the final proposal for submission.",
      recommendationDetail: "Approver can submit no receipt yet.",
      nextState: "Submission approved / ready to send or approval held",
      stateLabel: "Ready for submission approval",
      tone: "success",
      actionTitle: "Approve or hold submission approval.",
      actions: [
        { label: "Approve submission", action: "approve_submission" as const, defaultReason: "Final package, price, validity, terms, recipient, and instructions are complete.", defaultConfirmation: "Approval event recorded" },
        { label: "Hold submission approval", action: "hold_submission_approval" as const, defaultReason: "Margin exposure requires commercial review.", defaultConfirmation: "Approval hold recorded" }
      ]
    },
    "submission-approval-held": {
      title: "Hold submission approval until margin exposure is resolved.",
      recommendationDetail: "Package cannot be sent yet.",
      nextState: "Ready for submission approval after issue resolution",
      stateLabel: "Submission approval held / commercial review required",
      tone: "hold",
      actionTitle: "Commercial review required.",
      actions: [{ label: "Request missing evidence", action: "request_missing_evidence" as const, defaultReason: "Resolve margin exposure before approval.", defaultConfirmation: "Commercial review requested" }]
    },
    "submission-approved-ready-to-send": {
      title: "Package is approved. Record submission only after it is sent.",
      recommendationDetail: "Approval is not receipt.",
      nextState: "Submitted / pending outcome after receipt evidence",
      stateLabel: "Submission approved / ready to send",
      tone: "success",
      actionTitle: "Record actual submission.",
      actions: [{ label: "Record submission", action: "record_submission" as const, defaultReason: "Approved package was submitted to the customer.", defaultConfirmation: "Submission receipt NS-44991" }]
    },
    "submitted-pending-outcome": {
      title: "The bid was submitted and is awaiting customer outcome.",
      recommendationDetail: "Outcome is pending.",
      nextState: "Clarification, revision, lost, withdrawn/no-submit, or selected handoff only with evidence",
      stateLabel: "Submitted / pending outcome",
      tone: "success",
      actionTitle: "Record evidenced customer response.",
      actions: [
        { label: "Record clarification request", action: "record_clarification_request" as const, defaultReason: "Customer asked for fiber route clarification.", defaultConfirmation: "Clarification email received" },
        { label: "Record revision / BAFO request", action: "record_revision_bafo_request" as const, defaultReason: "Customer requested revised pricing.", defaultConfirmation: "BAFO request received" },
        { label: "Record lost / not selected", action: "record_lost_not_selected" as const, defaultReason: "Customer selected another bidder.", defaultConfirmation: "Customer outcome notice" },
        { label: "Record withdrawn / no-submit", action: "record_withdrawn_no_submit" as const, defaultReason: "Rybex withdrew due to unresolved terms risk.", defaultConfirmation: "Withdrawal rationale" },
        { label: "Record selected handoff", action: "record_selected_handoff" as const, defaultReason: "Customer issued intent to award pending separate review.", defaultConfirmation: "Intent-to-award notice" }
      ]
    },
    "clarification-requested": {
      title: "Customer needs clarification before outcome is known.",
      recommendationDetail: "Answer without overwriting package.",
      nextState: "Submitted / pending outcome or revision requested",
      stateLabel: "Clarification requested",
      tone: "hold",
      actionTitle: "Record clarification or revision need.",
      actions: [{ label: "Record revision / BAFO request", action: "record_revision_bafo_request" as const, defaultReason: "Clarification changes scope and requires revised package.", defaultConfirmation: "Revision request opened" }]
    },
    "revision-bafo-required": {
      title: "BAFO requested. Preserve original submission and prepare revised version.",
      recommendationDetail: "Version lineage is required.",
      nextState: "Revised submission recorded / BAFO submitted",
      stateLabel: "Revision requested / BAFO required",
      tone: "hold",
      actionTitle: "Record revised submission.",
      actions: [{ label: "Record revised submission", action: "record_revised_submission" as const, defaultReason: "Revised package PROP-7.4 submitted with receipt.", defaultConfirmation: "Revised receipt NS-44992" }]
    },
    "revised-submission-recorded": {
      title: "BAFO package was submitted with version lineage preserved.",
      recommendationDetail: "Revised receipt linked to original.",
      nextState: "Submitted / pending outcome for revised package",
      stateLabel: "Revised submission recorded / BAFO submitted",
      tone: "success",
      actionTitle: "Wait for revised outcome.",
      actions: [
        { label: "Record lost / not selected", action: "record_lost_not_selected" as const, defaultReason: "Customer rejected revised package.", defaultConfirmation: "Outcome notice" },
        { label: "Record selected handoff", action: "record_selected_handoff" as const, defaultReason: "Customer issued intent to award revised package.", defaultConfirmation: "Intent-to-award notice" }
      ]
    },
    "lost-not-selected": {
      title: "Customer selected another bidder. Close the pursuit as lost.",
      recommendationDetail: "Terminal customer outcome.",
      nextState: "Terminal Lost / not selected",
      stateLabel: "Lost / not selected",
      tone: "danger",
      actionTitle: "Terminal lost outcome.",
      canMutate: false,
      actions: [{ label: "Lost is terminal", action: null, defaultReason: "", defaultConfirmation: "", danger: true }]
    },
    "withdrawn-no-submit": {
      title: "Rybex withdrew before final submission.",
      recommendationDetail: "Terminal stop / no-submit outcome.",
      nextState: "Terminal Withdrawn / no-submit",
      stateLabel: "Withdrawn / no-submit",
      tone: "danger",
      actionTitle: "Terminal withdrawn outcome.",
      canMutate: false,
      actions: [{ label: "Withdrawn is terminal", action: null, defaultReason: "", defaultConfirmation: "", danger: true }]
    },
    "selected-intent-to-award": {
      title: "Selection notice received. Prepare a handoff candidate for the award-validation gate.",
      lead: "The customer indicates intent to award based on the submitted package. Award validation has not started.",
      recommendationDetail: "Separate future review required.",
      nextState: "Selected / intent-to-award pending award-validation gate",
      nextStateDetail: "Handoff candidate only. Award validation must be separately authorized.",
      stateLabel: "Selected / intent-to-award pending award-validation gate",
      tone: "success",
      actionTitle: "Handoff candidate recorded.",
      canMutate: false,
      actions: [{ label: "Award validation not started", action: null, defaultReason: "", defaultConfirmation: "" }]
    },
    "auditor-read-only": {
      title: "Inspect the submitted package and outcome history.",
      recommendationDetail: "Read-only access.",
      nextState: "No state change",
      stateLabel: "Auditor read-only",
      canMutate: false,
      actions: [{ label: "Review only", action: null, defaultReason: "", defaultConfirmation: "" }]
    },
    unavailable: {
      title: "You are not assigned to approve, submit, or record this outcome.",
      recommendationDetail: "Eligibility blocked.",
      nextState: "No state change",
      stateLabel: "Unavailable / ineligible",
      tone: "hold",
      canMutate: false,
      actions: [{ label: "Approve unavailable", action: null, defaultReason: "", defaultConfirmation: "" }]
    },
    "stale-conflict": {
      title: "This package changed before your action was recorded.",
      recommendationDetail: "Silent overwrite is blocked.",
      nextState: "Reload latest server-authoritative state",
      stateLabel: "Stale / conflict",
      tone: "hold",
      canMutate: false,
      alertTitle: "Action was not recorded",
      alertCopy: "The package version changed. Review latest package truth before retry.",
      actions: [{ label: "Review current package", action: null, defaultReason: "", defaultConfirmation: "" }]
    },
    "loading-empty-action-failure": {
      title: "Recover safely when package truth is unavailable.",
      recommendationDetail: "No false event.",
      nextState: "Explicit approved state or Empty",
      stateLabel: "Loading / empty / action failure recovery",
      tone: "hold",
      actionTitle: "Recover without hiding uncertainty.",
      actions: [{ label: "Retry after review", action: null, defaultReason: "", defaultConfirmation: "" }]
    },
    loading: {
      title: "Loading bid submission package.",
      recommendationDetail: "No actions while loading.",
      nextState: "Explicit approved state or Empty",
      stateLabel: "Loading / empty / action failure recovery",
      canMutate: false,
      actions: [{ label: "Loading", action: null, defaultReason: "", defaultConfirmation: "" }]
    },
    empty: {
      title: "No authorized pursuit is selected for bid submission.",
      recommendationDetail: "No package selected.",
      nextState: "Select an eligible pursuit-authorized opportunity",
      stateLabel: "Loading / empty / action failure recovery",
      canMutate: false,
      actions: [{ label: "Return to pipeline", action: null, defaultReason: "", defaultConfirmation: "" }]
    },
    "action-failure": {
      title: "Action failed. The prior package state remains authoritative.",
      recommendationDetail: "Retry only after review.",
      nextState: "Prior server-authoritative state",
      stateLabel: "Loading / empty / action failure recovery",
      tone: "hold",
      alertTitle: "Action was not recorded",
      alertCopy: "No state changed. Retry after confirming package truth.",
      actions: [{ label: "Retry unavailable until review", action: null, defaultReason: "", defaultConfirmation: "" }]
    }
  };

  return { ...base, ...(variants[state] ?? {}) };
}

function buildBidReviewEvents(state: string): OpportunityDetail["bidSubmissionEvents"] {
  if (["submission-preparation", "submission-blocked", "ready-for-submission-approval", "loading", "empty", "unavailable", "auditor-read-only"].includes(state)) return [];
  const toStatus = bidStateToStatus(state);
  return [{
    id: `bid-event-${state}`,
    eventType: "opportunity.bid_submission_recorded",
    bidAction: state === "submitted-pending-outcome" ? "record_submission" : state === "selected-intent-to-award" ? "record_selected_handoff" : state === "lost-not-selected" ? "record_lost_not_selected" : state === "withdrawn-no-submit" ? "record_withdrawn_no_submit" : "system_note",
    fromStatus: "submission_preparation",
    toStatus,
    reason: "Deterministic implementation review state.",
    actorUserId: "morgan-lee",
    createdAt: "2026-07-02T14:30:00Z",
    packageVersion: 9,
    metadata: {}
  }];
}

function bidSubmissionActionLabel(value: string) {
  const labels: Record<string, string> = {
    mark_package_ready: "Mark package ready",
    request_missing_evidence: "Request missing evidence",
    approve_submission: "Approve submission",
    hold_submission_approval: "Hold submission approval",
    record_submission: "Record submission",
    record_clarification_request: "Record clarification request",
    record_revision_bafo_request: "Record revision / BAFO request",
    record_revised_submission: "Record revised submission / BAFO submitted",
    record_lost_not_selected: "Record lost / not selected",
    record_withdrawn_no_submit: "Record withdrawn / no-submit",
    record_selected_handoff: "Record selected / intent-to-award handoff",
    system_note: "System note"
  };
  return labels[value] ?? "Bid submission event";
}

function PursuitAuthorizationSurface({
  detail,
  stateOverride,
  error,
  ownerOptions
}: {
  detail: OpportunityDetail;
  stateOverride: string;
  error: string;
  ownerOptions: DecisionOwnerOption[];
}) {
  const state = getPursuitAuthorizationViewState(detail, stateOverride);
  const model = getPursuitAuthorizationModel(detail, state);
  const readiness = detail.pursuitAuthorizationReadiness;
  const unavailable = !readiness.available;
  const configuredOutcomes = readiness.permittedOutcomes;
  const successful = ["authorized-outcome", "declined-outcome", "hold-outcome"].includes(state);
  const missingContribution = readiness.deficiencies.includes("missing_entity_contribution");
  const invalidOwner = readiness.deficiencies.includes("invalid_pursuit_decision_owner");
  const profitabilityAttention = !unavailable && !successful && !missingContribution && !invalidOwner && readiness.recommendation === "decline";
  const operationsLeaderOptions = ownerOptions.filter((owner) => /operations/i.test(owner.role) || /operations leader/i.test(owner.name));
  const selectedAction = recordOpportunityPursuitAuthorizationSelectedAction.bind(null, detail.opportunity.id, detail.opportunity.version);
  const contributionAction = completeOpportunityPursuitContributionAction.bind(null, detail.opportunity.id, detail.opportunity.version);
  const pursuitAuthorityTargetUserId = String((operationsLeaderOptions.length > 0 ? operationsLeaderOptions : ownerOptions)[0]?.userId ?? "");
  const pursuitAuthorityAction = assignOpportunityPursuitAuthorityAction.bind(null, detail.opportunity.id, detail.opportunity.version, pursuitAuthorityTargetUserId);
  const entityContributionOwner = ownerOptions.find((owner) => /operations/i.test(owner.role) || /operations leader/i.test(owner.name)) ?? ownerOptions[0];
  const title = unavailable
    ? "Pursuit Authorization rules are unavailable"
    : state === "authorized-outcome"
      ? "Pursuit Authorized"
      : state === "declined-outcome"
        ? "Pursuit Declined"
        : state === "hold-outcome"
          ? "Pursuit held pending evidence"
          : missingContribution
            ? "Complete the missing entity contribution"
            : invalidOwner
              ? "Assign an Operations Leader"
              : profitabilityAttention
                ? "Review profitability and mitigation"
                : "Ready for Pursuit Decision";
  const copy = unavailable
    ? "A pursuit decision cannot be recorded until the workspace rules are restored. Contact your system administrator."
    : successful
      ? "The pursuit decision has been recorded and remains visible after reload."
      : missingContribution
        ? "Record the required entity contribution before recording the Pursuit Authorization decision."
        : invalidOwner
          ? "The current Decision Owner does not satisfy the configured Operations Leader accountability."
          : profitabilityAttention
            ? "Expected Gross Margin % requires attention. Record the accepted mitigation or No-Pursue rationale before committing the decision."
            : "Review the submitted Pricing Review package and record the configured Pursuit Authorization outcome.";

  return (
    <main className="pipeline-workbench" data-pipeline-screen="pursuit-authorization" data-pursuit-state={state}>
      <OpportunityHeader detail={detail} contextLabel="Pursuit Authorization" />
      {state === "stale-conflict" || state === "action-failure" || error ? (
        <section className="pipeline-alert" role="status">
          <strong>{model.alertTitle}</strong>
          <span>{model.alertCopy}</span>
        </section>
      ) : null}

      <section className="pipeline-work-surface">
        <div className={`pipeline-current-state ${unavailable ? "pipeline-current-state-blocked" : successful ? "pipeline-current-state-ready" : ""}`}>
          <p className="pipeline-kicker">Current responsibility</p>
          <h2>{title}</h2>
          <p>{copy}</p>
        </div>

        <div className="pipeline-layout-columns">
          <div className="pipeline-section-list">
            {missingContribution && entityContributionOwner ? (
              <PursuitContributionAction
                contribution={readiness.contributionRequirements[0]}
                owner={entityContributionOwner}
                action={contributionAction}
              />
            ) : null}

            {invalidOwner ? (
              <PursuitOwnerAssignmentAction
                currentOwner={detail.pursuitAuthority?.name ?? detail.decisionOwner?.name ?? "Not assigned"}
                currentRole={detail.pursuitAuthority?.name === "Taylor Chen" ? "Project Manager" : "Current assignee"}
                options={operationsLeaderOptions.length > 0 ? operationsLeaderOptions : ownerOptions}
                action={pursuitAuthorityAction}
              />
            ) : null}

            {!successful && !unavailable && model.canMutate && !missingContribution && !invalidOwner ? (
              <PursuitOutcomeSelectionClient
                outcomes={configuredOutcomes}
                action={selectedAction}
                attention={profitabilityAttention}
                profitabilityLabel={readiness.profitability?.label ?? "Expected Gross Margin"}
                profitabilityValue={readiness.profitability?.displayValue ?? model.metrics[0]?.value ?? "Not available"}
                recommendation={model.recommendationTitle}
              />
            ) : null}

            {successful ? (
              <section className="pipeline-section pipeline-decision-record" data-decision-record>
                <div className="pipeline-section-heading">
                  <div>
                    <h2>{state === "authorized-outcome" ? "Pursuit Authorized" : state === "declined-outcome" ? "Pursuit Declined" : "Pursuit held"}</h2>
                    <p>{state === "authorized-outcome" ? "The opportunity is authorized to proceed to bid preparation. No bid has been submitted." : detail.opportunity.pursuitAuthorizationReason || "Decision recorded through the configured Pursuit Authorization gate."}</p>
                  </div>
                </div>
                <div className="pipeline-fact-row">
                  <ReadOnlyField label="Decision outcome" value={state === "authorized-outcome" ? "Pursue" : state === "declined-outcome" ? "No-Pursue" : "Hold pending evidence"} />
                  <ReadOnlyField label="Decision Owner" value={detail.pursuitAuthority?.name ?? detail.decisionOwner?.name ?? "Not assigned"} />
                  <ReadOnlyField label="Decision timestamp" value={formatDateTime(detail.opportunity.pursuitAuthorizedAt)} />
                </div>
                <div className="pipeline-fact-row">
                  <ReadOnlyField label="Expected Gross Margin %" value={readiness.profitability?.displayValue ?? model.metrics[0]?.value ?? "Not available"} />
                  <ReadOnlyField label="Justification" value={detail.opportunity.pursuitAuthorizationReason || (state === "authorized-outcome" ? "Approved from configured Pursuit Authorization package." : "Not recorded")} />
                </div>
              </section>
            ) : null}

            <section className="pipeline-section">
              <div className="pipeline-section-heading">
                <div>
                  <h2>Submitted Pricing Review package</h2>
                  <p>Qualification package, configured evidence, and Pricing Review handoff are preserved for this pursuit decision.</p>
                </div>
                <span className="chip chip-success">{detail.opportunity.submittedForDecisionAt ? "Submitted" : "Not submitted"}</span>
              </div>
              <div className="pipeline-fact-row">
                <ReadOnlyField label="Pricing Review owner" value={detail.decisionOwner?.name ?? "Not assigned"} />
                <ReadOnlyField label="Submitted" value={detail.opportunity.submittedForDecisionAt ? formatDateTime(detail.opportunity.submittedForDecisionAt) : "Not submitted"} />
                <ReadOnlyField label="Package revision" value={String(detail.opportunity.version)} />
              </div>
            </section>

            <section className="pipeline-section">
              <div className="pipeline-section-heading">
                <div>
                  <h2>Cross-entity readiness</h2>
                  <p>Configured contribution and evidence requirements before pursuit commitment.</p>
                </div>
              </div>
              {[...readiness.entryRequirements, ...readiness.contributionRequirements, ...readiness.evidenceRequirements].map((item) => (
                <PursuitRequirementRow key={`${item.label}-${"evidenceTypeKey" in item ? item.evidenceTypeKey : item.key}`} label={item.label} satisfied={item.satisfied} />
              ))}
            </section>

            <section className="pipeline-section">
              <div className="pipeline-section-heading">
                <div>
                  <h2>Commercial basis</h2>
                  <p>Expected Gross Margin % is the canonical profitability measure for this configured gate.</p>
                </div>
              </div>
              <div className="pipeline-fact-row">
                <ReadOnlyField label="Expected Gross Margin %" value={readiness.profitability?.displayValue ?? model.metrics[0]?.value ?? "Not available"} />
                <ReadOnlyField label="Recommendation" value={model.recommendationTitle} />
                <ReadOnlyField label="Pursuit authority" value={detail.pursuitAuthority?.name ?? detail.decisionOwner?.name ?? "Not assigned"} />
              </div>
            </section>

            <section className="pipeline-section">
              <div className="pipeline-section-heading">
                <div>
                  <h2>Audit and decision trail</h2>
                  <p>Recorded Pursuit Authorization history and restrained configuration provenance.</p>
                </div>
              </div>
              {detail.pursuitAuthorizationEvents.length > 0 ? (
                <div className="pipeline-section-list">
                  {detail.pursuitAuthorizationEvents.slice(0, 4).map((event) => (
                    <div className="pipeline-outcome-row" key={event.id}>
                      <strong>Event: {pursuitEventTitle(event.decisionAction)}</strong>
                      <span>Outcome: {pursuitOutcomeLabel(event.decisionAction)}</span>
                      <span>Package revision: {event.packageVersion ?? detail.opportunity.version}</span>
                      <span>Recorded by: {detail.pursuitAuthority?.name ?? detail.decisionOwner?.name ?? "Decision Owner"}</span>
                      <span>Recorded: {formatDateTime(event.createdAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No pursuit authorization decision has been recorded yet.</p>
              )}
            </section>
          </div>

          <aside className="pipeline-side-panel pipeline-decision-column">
            <h2>Pursuit decision package</h2>
            <div className="pipeline-fact-row">
              <ReadOnlyField label="Decision requested" value="Pursuit Authorization" />
              <ReadOnlyField label="Owner" value={detail.pursuitAuthority?.name ?? detail.decisionOwner?.name ?? "Not assigned"} />
              <ReadOnlyField label="Due" value={detail.opportunity.pursuitAuthorizationDueAt ? formatDate(detail.opportunity.pursuitAuthorizationDueAt) : detail.decisionDueAt ? formatDate(detail.decisionDueAt) : "Not set"} />
            </div>
            {unavailable ? (
              <section className="pipeline-note-card">
                <h3>Setup unavailable</h3>
                <p>Workspace rules must be restored before this decision package can be acted on.</p>
              </section>
            ) : (
              <>
                <p>{successful ? "This decision record is read-only." : "Choose an outcome after reviewing the configured requirements."}</p>
                {!successful ? (
                  <>
                    <h3>Configured outcomes</h3>
                    <div className="pipeline-section-list">
                      {configuredOutcomes.map((outcome) => (
                        <div className="pipeline-outcome-row pipeline-configured-outcome-row" key={outcome.outcomeKey}>
                          <strong className="pipeline-configured-outcome-title">{outcome.label}</strong>
                          <span className="pipeline-configured-outcome-copy">{outcomeRequirementCopy(outcome)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                {readiness.provenanceLabel ? (
                  <p className="pipeline-provenance-line">Governed by {readiness.provenanceLabel}</p>
                ) : null}
              </>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function PursuitRequirementRow({ label, satisfied }: { label: string; satisfied: boolean }) {
  return (
    <div className="pipeline-section-row">
      <strong>{label}</strong>
      <span>{satisfied ? "Satisfied" : "Missing"}</span>
    </div>
  );
}

function PursuitAuthorizationLoading() {
  return (
    <main className="pursuit-auth-workbench pursuit-tone-hold" data-pipeline-screen="pursuit-authorization" data-pursuit-state="loading">
      <header className="pursuit-auth-topbar">
        <div><strong>RybexOS</strong><span>Pursuit Authorization</span></div>
        <div className="pursuit-role-pill">Assigned Pursuit Authority</div>
      </header>
      <section className="pursuit-hero">
        <div>
          <p className="pipeline-kicker">Loading state</p>
          <h1>Loading pursuit authorization package.</h1>
          <p>RybexOS is loading qualification origin, entity attestations, evidence statuses, and commercial basis before showing decision actions.</p>
        </div>
        <aside className="pursuit-recommendation"><p className="pipeline-kicker">Recommendation</p><strong>No action yet</strong><span>Loading current package truth</span></aside>
      </section>
      <section className="pursuit-action-panel"><div><p className="pipeline-kicker">Action model</p><h2>No decision action is available yet</h2><p>Decision actions appear only after current package truth is loaded.</p></div></section>
    </main>
  );
}

function PursuitAuthorizationEmpty() {
  return (
    <main className="pursuit-auth-workbench" data-pipeline-screen="pursuit-authorization" data-pursuit-state="empty">
      <header className="pursuit-auth-topbar">
        <div><strong>RybexOS</strong><span>Pursuit Authorization</span></div>
        <div className="pursuit-role-pill">Assigned Pursuit Authority</div>
      </header>
      <section className="pursuit-hero">
        <div>
          <p className="pipeline-kicker">Empty state</p>
          <h1>No qualified opportunity is ready for Pursuit Authorization.</h1>
          <p>Pursuit Authorization begins only after a current qualification package is approved and assigned for pursuit action.</p>
        </div>
        <aside className="pursuit-recommendation"><p className="pipeline-kicker">Recommendation</p><strong>No decision available</strong><span>No qualified pursuit package selected</span></aside>
      </section>
      <section className="pursuit-action-panel">
        <div><p className="pipeline-kicker">Action model</p><h2>Stage-specific action only</h2><p>No package is created here. Return to eligible pursuit work.</p></div>
        <div className="pursuit-actions"><Link className="button button-primary" href="/pipeline">Return to pursuit queue</Link></div>
      </section>
    </main>
  );
}

function PursuitEvidenceRow({ title, detail, status }: { title: string; detail: string; status: "Complete" | "Blocking" | "Risky" | "Incomplete" | "Unavailable" | "Empty" | "Loading" }) {
  return (
    <div className={`pursuit-evidence-row pursuit-evidence-${status.toLowerCase()}`}>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <em>{status}</em>
    </div>
  );
}

function PursuitContributionAction({
  contribution,
  owner,
  action
}: {
  contribution: OpportunityDetail["pursuitAuthorizationReadiness"]["contributionRequirements"][number] | undefined;
  owner: NonNullable<DecisionOwnerOption>;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="pipeline-section pipeline-pursuit-correction-form" data-main-correction="contribution">
      <div className="pipeline-section-heading">
        <div>
          <h2>Entity contribution</h2>
          <p>Complete the configured cross-entity attestation before a pursuit decision can be recorded.</p>
        </div>
        <span className="chip chip-warning">Missing</span>
      </div>
      <div className="pipeline-fact-row">
        <ReadOnlyField label="Contribution" value={contribution?.label ?? "Entity contribution owner attestation"} />
        <ReadOnlyField label="Entity Contribution Owner" value={`${owner.name} - ${formatRoleLabel(owner.role)}`} />
        <ReadOnlyField label="Current status" value="Missing" />
      </div>
      <label>
        Eligible contributor
        <select name="contributorUserId" required defaultValue={owner.userId ?? ""}>
          <option value={owner.userId ?? ""}>{owner.name} - {formatRoleLabel(owner.role)}</option>
        </select>
      </label>
      <label className="pipeline-wide-field">
        Supporting note
        <textarea name="contributionNote" rows={3} defaultValue="Entity contribution attested for Pursuit Authorization." />
      </label>
      <button className="button button-primary" type="submit">Record entity contribution</button>
    </form>
  );
}

function PursuitOwnerAssignmentAction({
  currentOwner,
  currentRole,
  options,
  action
}: {
  currentOwner: string;
  currentRole: string;
  options: DecisionOwnerOption[];
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="pipeline-section pipeline-pursuit-correction-form" data-main-correction="owner">
      <div className="pipeline-section-heading">
        <div>
          <h2>Decision Owner</h2>
          <p>Select an eligible Operations Leader to own the Pursuit Authorization decision.</p>
        </div>
        <span className="chip chip-warning">Needs assignment</span>
      </div>
      <div className="pipeline-fact-row">
        <ReadOnlyField label="Current owner" value={`${currentOwner} - ${currentRole}`} />
        <ReadOnlyField label="Required accountability" value="Operations Leader" />
      </div>
      <label>
        Eligible owner
        <select name="pursuitAuthorityUserId" defaultValue={options[0]?.userId ?? ""}>
          <option value="">Choose Operations Leader</option>
          {options.map((owner) => (
            <option key={owner.userId} value={owner.userId}>
              {owner.name} - {formatRoleLabel(owner.role)}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-primary" type="submit">Assign Decision Owner</button>
    </form>
  );
}

function DecisionPackage({ detail, mode, showHeader = true }: { detail: OpportunityDetail; mode: "bd-preview" | "decision-owner"; showHeader?: boolean }) {
  const ownerMode = mode === "decision-owner";
  const decisionOpen = detail.opportunity.decisionReadinessStatus === "ready_for_decision";
  const approveAction = recordOpportunityDecisionAction.bind(null, detail.opportunity.id, detail.opportunity.version, "approved");
  const returnAction = recordOpportunityDecisionAction.bind(null, detail.opportunity.id, detail.opportunity.version, "returned_for_clarification");
  const declineAction = recordOpportunityDecisionAction.bind(null, detail.opportunity.id, detail.opportunity.version, "declined");
  return (
    <main className="pipeline-workbench" data-pipeline-screen="decision-package">
      {showHeader ? <OpportunityHeader detail={detail} contextLabel={ownerMode ? "Decision Owner" : "Business Development Lead"} /> : null}
      <section className="pipeline-work-surface pipeline-two-column">
        <div>
          <DecisionSummary detail={detail} compact={false} />
          <div className="pipeline-risk-heading-spacer" aria-hidden="true" />
          <h2 className="pipeline-risk-heading">Top risks and mitigations</h2>
          <div className="pipeline-risk-list">
            <RiskItem title="Long-lead material availability" detail="Reserve supplier allocation before final pricing." tone="Medium" />
            <RiskItem title="Permitting sequence" detail="Customer must confirm access milestones before submission." tone="Medium" />
            <RiskItem title="Peak field capacity" detail="Dedicated foreman and crew plan included in estimate." tone="Managed" />
          </div>
          <CollapsedDetails title="Material assumptions and customer commitments" summary="">
            <p>{detail.qualification.assumptions || "No unresolved assumptions are currently recorded."}</p>
          </CollapsedDetails>
          <CollapsedDetails title="Qualification outcomes and revision history" summary="">
            <QualificationOutcomeList detail={detail} />
          </CollapsedDetails>
        </div>
        <aside className="pipeline-side-panel">
          <h2>Decision accountability</h2>
          <ReadOnlyField label="Decision owner" value={detail.decisionOwner?.name ?? "Not assigned"} />
          <ReadOnlyField label="Decision due" value={formatDate(detail.decisionDueAt)} />
          <ReadOnlyField label="Bid due" value={formatDate(detail.opportunity.bidDueDate)} />
          {ownerMode && decisionOpen ? (
            <div className="pipeline-action-stack">
              <form action={approveAction} className="pipeline-decision-action-form">
                <p>Approve the package for pricing review using the recommendation, risks, evidence, and assumptions shown here.</p>
                <button className="button button-primary" type="submit">Approve pricing review</button>
              </form>
              <details className="pipeline-decision-disclosure">
                <summary>Return for clarification</summary>
                <form action={returnAction} className="pipeline-decision-action-form">
                  <label>
                    Return reason
                    <textarea name="decisionReason" rows={3} required placeholder="Name the clarification needed before this package can move forward." />
                  </label>
                  <button className="button button-secondary" type="submit">Return package</button>
                </form>
              </details>
              <details className="pipeline-decision-disclosure pipeline-decision-disclosure-danger">
                <summary>Decline opportunity</summary>
                <form action={declineAction} className="pipeline-decision-action-form">
                  <label>
                    Decline reason
                    <textarea name="decisionReason" rows={3} required placeholder="State the business reason this opportunity should not continue." />
                  </label>
                  <button className="button button-danger" type="submit">Record decline</button>
                </form>
              </details>
            </div>
          ) : ownerMode ? (
            <div className="pipeline-note-card">
              <strong>{decisionOutcomeTitle(detail.opportunity.decisionReadinessStatus)}</strong>
              <p>The decision outcome is recorded on the authoritative opportunity record. Review the package history before taking further action.</p>
            </div>
          ) : (
            <Link className="button button-secondary" href="/pipeline">
              Return to opportunity queue
            </Link>
          )}
          <div className="pipeline-note-card">
            <strong>Decision consequence</strong>
            <p>{ownerMode ? "Decision actions are available only to the assigned decision owner." : `${detail.decisionOwner?.name ?? "The decision owner"} owns the next Pricing Review action. The submitted package is preserved for their decision.`}</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

function DecisionSummary({ detail, compact }: { detail: OpportunityDetail; compact: boolean }) {
  const recommendation = recommendationLabel(detail.qualification.recommendation);
  const submitted = detail.opportunity.lifecycleStatus === "decision_required";
  const ownerName = detail.decisionOwner?.name ?? "Decision owner";
  return (
    <section className={`pipeline-decision-summary ${compact ? "pipeline-decision-summary-compact" : ""}`}>
      <p className="pipeline-kicker">{submitted ? "Pricing Review handoff" : "Decision package"}</p>
      {submitted ? (
        <p className="pipeline-status-line">Submitted for Pricing Review</p>
      ) : null}
      <h2>{submitted ? "Package submitted for decision" : recommendation}</h2>
      <p>
        {submitted
          ? `Submitted ${formatDateTime(detail.opportunity.submittedForDecisionAt)}. ${ownerName} now owns the Pricing Review decision and should approve, return, or decline the package.`
          : "Strategic fit is strong enough to continue, with material, access, and commercial risks handled before final pricing."}
      </p>
      <div className="pipeline-fact-row">
        <ReadOnlyField label={submitted ? "Submitted" : "Decision requested"} value={submitted ? formatDateTime(detail.opportunity.submittedForDecisionAt) : `Authorize pricing review up to ${formatMoney(detail.opportunity.estimatedValue)} with margin protected.`} />
        <ReadOnlyField label="Owner" value={detail.decisionOwner?.name ?? "Decision owner needed"} />
        <ReadOnlyField label="Due" value={formatDate(detail.decisionDueAt)} />
      </div>
      {!compact && detail.pricingReviewReadiness.provenanceLabel ? (
        <p className="pipeline-provenance-line">Governed by {detail.pricingReviewReadiness.provenanceLabel}</p>
      ) : null}
    </section>
  );
}

function PricingReviewReadinessDetails({ detail, hideUnavailableMessage = false }: { detail: OpportunityDetail; hideUnavailableMessage?: boolean }) {
  const readiness = detail.pricingReviewReadiness;
  return (
    <section className="pipeline-note-card">
      <h2>Pricing Review readiness</h2>
      {readiness.available ? (
        <>
          <ul className="pipeline-compact-list">
            {readiness.evidenceRequirements.map((requirement) => (
              <li key={requirement.evidenceTypeKey}>
                <span>{requirement.label}</span>
                <strong>{requirement.satisfied ? "Satisfied" : "Missing"}</strong>
              </li>
            ))}
          </ul>
          <p>
            Accountable role: {readiness.decisionOwnerAccountability?.label ?? "Decision owner"}.
            {readiness.decisionOwnerAccountability?.satisfied ? " Current owner satisfies it." : " Assign a matching owner before handoff."}
          </p>
        </>
      ) : hideUnavailableMessage ? (
        <span className="chip chip-warning">Setup unavailable</span>
      ) : (
        <p>Pricing Review cannot be submitted until the workspace rules are restored. Contact your system administrator.</p>
      )}
    </section>
  );
}

function EvidenceRequirementSummary({ detail }: { detail: OpportunityDetail }) {
  const readiness = detail.pricingReviewReadiness;
  return (
    <section className="pipeline-note-card">
      <h2>Evidence requirement</h2>
      <p>Decision support evidence must be attached before Pricing Review handoff.</p>
      <ul className="pipeline-compact-list">
        {readiness.evidenceRequirements.map((requirement) => (
          <li key={requirement.evidenceTypeKey}>
            <span>{requirement.label}</span>
            <strong>{requirement.satisfied ? "Satisfied" : "Missing"}</strong>
          </li>
        ))}
      </ul>
      {readiness.missingEvidence.length === 0 ? (
        <span className="chip chip-success">Satisfied</span>
      ) : (
        <span className="chip chip-warning">Missing</span>
      )}
    </section>
  );
}

function EvidenceRequirement({ detail, evidenceAction }: { detail: OpportunityDetail; evidenceAction: (formData: FormData) => void }) {
  const readiness = detail.pricingReviewReadiness;
  if (!readiness.available) {
    return (
      <section className="pipeline-note-card">
        <h2>Pricing Review rules are unavailable</h2>
        <p>Contact your system administrator to restore the workspace rules before submitting this package.</p>
        <span className="chip chip-warning">Setup unavailable</span>
      </section>
    );
  }

  return (
    <section className="pipeline-note-card">
      <h2>Decision support evidence</h2>
      <p>Attach the decision support evidence before the opportunity can advance to Pricing Review.</p>
      <ul className="pipeline-compact-list">
        {readiness.evidenceRequirements.map((requirement) => (
          <li key={requirement.evidenceTypeKey}>
            <span>{requirement.label}</span>
            <strong>{requirement.satisfied ? "Satisfied" : "Missing"}</strong>
          </li>
        ))}
      </ul>
      {readiness.missingEvidence.length === 0 ? (
        <span className="chip chip-success">Configured evidence satisfied</span>
      ) : (
        <form action={evidenceAction} className="pipeline-mini-form">
          <input name="decisionSupportDocument" type="file" required accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,text/plain,application/pdf,image/png,image/jpeg,image/webp" />
          <button className="button button-secondary" type="submit">Attach missing evidence</button>
        </form>
      )}
    </section>
  );
}

function DecisionAccountability({
  detail,
  ownerOptions,
  action
}: {
  detail: OpportunityDetail;
  ownerOptions: DecisionOwnerOption[];
  action: (formData: FormData) => void;
}) {
  const readiness = detail.pricingReviewReadiness;
  const accountability = readiness.decisionOwnerAccountability;
  return (
    <section className="pipeline-note-card">
      <h2>Decision handoff</h2>
      <p>
        {accountability
          ? `Accountable role: ${accountability.label}. ${accountability.satisfied ? "Current owner satisfies it." : `${detail.decisionOwner?.name ?? "The current owner"} cannot authorize Pricing Review. Assign an ${accountability.label}.`}`
          : "Assign the decision owner and due date before handoff."}
      </p>
      <form action={action} className="pipeline-mini-form">
        <label>
          Decision owner
          <select name="decisionOwnerUserId" required defaultValue={detail.decisionOwner?.userId ?? ""}>
            <option value="">Choose owner</option>
            {ownerOptions.map((owner) => (
              <option key={owner.userId} value={owner.userId}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Decision due
          <input name="decisionDueAt" type="date" required defaultValue={detail.decisionDueAt ?? detail.opportunity.bidDueDate ?? ""} />
        </label>
        <button className="button button-secondary" type="submit">Set decision handoff</button>
      </form>
    </section>
  );
}

function PricingReviewBlocker({ detail }: { detail: OpportunityDetail }) {
  const readiness = detail.pricingReviewReadiness;
  if (readiness.ready) return null;
  if (!readiness.available) {
    return (
      <div className="pipeline-alert" role="status">
        <strong>Pricing Review rules are unavailable</strong>
        <span>Pricing Review cannot be submitted until the workspace rules are restored. Contact your system administrator.</span>
      </div>
    );
  }
  const messages = readiness.deficiencies.map((deficiency) => pricingReviewDeficiencyLabel(deficiency));
  return (
    <div className="pipeline-alert" role="status">
      <strong>Pricing Review handoff blocked</strong>
      <span>{messages.join(" ")}</span>
    </div>
  );
}

function PermissionDenied() {
  return (
    <main className="pipeline-workbench" data-pipeline-screen="permission-denied">
      <section className="pipeline-state-card">
        <p className="pipeline-kicker">Access limited</p>
        <h1>You do not have access to this opportunity</h1>
        <p>Your current role or assignment does not include this record. Return to the work you are permitted to review.</p>
        <Link className="button button-primary" href="/pipeline">Back to Pipeline</Link>
      </section>
    </main>
  );
}

function OwnerDirectoryUnavailable() {
  return (
    <main className="pipeline-workbench" data-pipeline-screen="owner-directory-unavailable">
      <section className="pipeline-state-card">
        <p className="pipeline-kicker">Decision responsibility unavailable</p>
        <h1>Decision owners could not be loaded</h1>
        <p>No opportunity data was changed. Retry before assigning or submitting a decision package.</p>
        <div className="pipeline-action-row">
          <Link className="button button-primary" href="">Retry</Link>
          <Link className="button button-secondary" href="/pipeline">Return to Pipeline</Link>
        </div>
      </section>
    </main>
  );
}

function RecordUnavailable() {
  return (
    <main className="pipeline-workbench" data-pipeline-screen="record-unavailable">
      <section className="pipeline-state-card">
        <p className="pipeline-kicker">Pipeline temporarily unavailable</p>
        <h1>We could not open this opportunity</h1>
        <p>The record is temporarily unavailable. No opportunity data was changed.</p>
        <div className="pipeline-action-row">
          <Link className="button button-primary" href="">Retry</Link>
          <Link className="button button-secondary" href="/pipeline">Return to Pipeline</Link>
        </div>
      </section>
    </main>
  );
}

function ErrorNotice({ error }: { error: string }) {
  if (!error) return null;
  const messages: Record<string, { title: string; copy: string }> = {
    concurrency_conflict: {
      title: "This opportunity changed after you opened it",
      copy: "Review the latest version before saving or submitting."
    },
    persistence_failed: {
      title: "Your changes have not been saved",
      copy: "Your entries may still be on this page. Retry before leaving."
    },
    decision_accountability_required: {
      title: "Decision owner needed",
      copy: "Assign the decision owner and due date before sending the package."
    },
    evidence_missing: {
      title: "Decision support document needed",
      copy: "Attach one verified decision support document before handoff."
    },
    reason_required: {
      title: "Reason needed",
      copy: "Add the reason before returning or declining the package."
    },
    decision_owner_required: {
      title: "Assigned decision owner required",
      copy: "Only the named decision owner can record this decision."
    },
    invalid_state: {
      title: "Decision package changed",
      copy: "Review the latest package state before recording the decision."
    }
  };
  const message = messages[error] ?? { title: "We could not complete that action", copy: "Review the current opportunity and try again." };
  return (
    <section className="pipeline-alert" role="status">
      <strong>{message.title}</strong>
      <span>{message.copy}</span>
    </section>
  );
}

function SupportingDetails({ detail }: { detail: OpportunityDetail }) {
  return (
    <CollapsedDetails title="Supporting opportunity details" summary="">
      <section className="detail-grid">
        <ReadOnlyField label="Stable key" value={detail.opportunity.stableKey} />
        <ReadOnlyField label="Assignments" value={String(detail.assignments.length)} />
        <ReadOnlyField label="Evidence" value={detail.evidenceReady ? "Decision support linked" : "Decision support needed"} />
        <ReadOnlyField label="Package revision" value={String(detail.opportunity.version)} />
      </section>
    </CollapsedDetails>
  );
}

function QualificationOutcomeList({ detail }: { detail: OpportunityDetail }) {
  return (
    <div className="pipeline-section-list">
      {getQualificationSections(detail).slice(0, 5).map((section) => (
        <div className="pipeline-outcome-row" key={section.title}>
          <strong>{section.title}</strong>
          <span>{section.summary}</span>
        </div>
      ))}
    </div>
  );
}

function QualificationSectionView({ section }: { section: Section }) {
  return (
    <div className="pipeline-section pipeline-section-row">
      <strong>{section.title}</strong>
      <span>{section.summary}</span>
    </div>
  );
}

function QualificationSectionHiddenInputs({ section, qualification }: { section: Section; qualification: OpportunityQualification }) {
  return (
    <>
      {section.criteria.map(([key]) => (
        <input key={key} type="hidden" name={key} value={qualification.criteria?.[key] ?? ""} />
      ))}
      {section.title === "Risk and governance" ? (
        <input type="hidden" name="riskSummary" value={qualification.riskSummary ?? ""} />
      ) : null}
      {section.title === "Evidence and assumptions" ? (
        <input type="hidden" name="assumptions" value={qualification.assumptions ?? ""} />
      ) : null}
      {section.title === "Recommendation" ? (
        <input type="hidden" name="recommendation" value={qualification.recommendation ?? ""} />
      ) : null}
    </>
  );
}

function EvidenceList({ detail }: { detail: OpportunityDetail }) {
  if (detail.evidence.length === 0) return <p>No evidence files are currently linked.</p>;
  return (
    <ul>
      {detail.evidence.map((evidence) => (
        <li key={evidence.id}>{evidence.fileName} · {evidence.scanStatus}</li>
      ))}
    </ul>
  );
}

function RiskItem({ title, detail, tone }: { title: string; detail: string; tone: string }) {
  return (
    <div className="pipeline-risk-item">
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <span className="chip chip-warning">{tone}</span>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="pipeline-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatRoleLabel(role: string) {
  return role
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function TextField({ label, name, defaultValue, required, type = "text" }: { label: string; name: string; defaultValue: string | number | null; required?: boolean; type?: string }) {
  return (
    <label>
      {label}
      <input name={name} type={type} required={required} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

type Section = {
  title: string;
  summary: string;
  detail: string;
  status: "complete" | "incomplete";
  actionTitle: string;
  consequence: string;
  primaryAction: string;
  criteria: typeof qualificationCriteria[number][];
};

function getQualificationSections(detail: OpportunityDetail): Section[] {
  const criteria = detail.qualification.criteria ?? {};
  const groups: Array<Omit<Section, "status" | "summary">> = [
    {
      title: "Opportunity fit",
      detail: "Customer, geography, project type, and strategic alignment.",
      actionTitle: "Continue to delivery readiness",
      consequence: "Confirm the opportunity fits the pursuit profile before delivery risk is assessed.",
      primaryAction: "Continue to delivery readiness",
      criteria: qualificationCriteria.slice(0, 4)
    },
    {
      title: "Delivery readiness",
      detail: "Scope, design maturity, schedule, crews, material, and access.",
      actionTitle: "Resolve delivery readiness",
      consequence: "Delivery blockers must be visible before this can become a decision package.",
      primaryAction: "Resolve delivery readiness",
      criteria: qualificationCriteria.slice(4, 10)
    },
    {
      title: "Commercial viability",
      detail: "Commercial terms, cash flow, margin confidence, and contract risk.",
      actionTitle: "Confirm commercial viability",
      consequence: "The decision owner needs value and margin risk before accepting the package.",
      primaryAction: "Confirm commercial viability",
      criteria: qualificationCriteria.filter(([key]) => ["commercialTermsRisk", "cashFlowRisk", "marginConfidence", "contractualRisk"].includes(key))
    },
    {
      title: "Risk and governance",
      detail: "Safety, quality, subcontractor dependency, and mitigation summary.",
      actionTitle: "Resolve risk and governance",
      consequence: "Open risks need mitigation language before handoff.",
      primaryAction: "Resolve risk and governance",
      criteria: qualificationCriteria.filter(([key]) => ["permitsAccessRisk", "safetyQualityComplexity", "subcontractorDependency"].includes(key))
    },
    {
      title: "Evidence and assumptions",
      detail: "Support, assumptions, and provenance for decision review.",
      actionTitle: "Add decision support evidence",
      consequence: "The decision support document must be linked and verified before handoff.",
      primaryAction: "Save evidence and notes",
      criteria: []
    },
    {
      title: "Recommendation",
      detail: "Rationale, recommendation, decision owner, and due date.",
      actionTitle: "Prepare decision handoff",
      consequence: "A recommendation without accountable owner and due date cannot be sent.",
      primaryAction: "Prepare decision handoff",
      criteria: []
    }
  ];

  return groups.map((group) => {
    const completeCriteria = group.criteria.length === 0 || group.criteria.every(([key]) => Boolean(criteria[key]));
    const complete =
      group.title === "Evidence and assumptions"
        ? detail.pricingReviewReadiness.available && detail.pricingReviewReadiness.missingEvidence.length === 0
        : group.title === "Recommendation"
          ? Boolean(detail.qualification.recommendation && detail.decisionOwner && detail.decisionDueAt && detail.pricingReviewReadiness.decisionOwnerAccountability?.satisfied)
          : completeCriteria;
    return {
      ...group,
      status: complete ? "complete" : "incomplete",
      summary: complete ? "Complete" : "Needs action"
    };
  });
}

function recommendationLabel(value: string | undefined) {
  const labels: Record<string, string> = {
    pursue: "Proceed to pricing review",
    pursue_with_mitigations: "Proceed to pricing review",
    hold_for_clarification: "Hold for clarification",
    decline: "Decline opportunity",
    no_bid: "Do not bid"
  };
  return labels[value ?? ""] ?? "Recommendation needed";
}

function decisionOutcomeTitle(value: string | undefined) {
  const labels: Record<string, string> = {
    decision_approved: "Pricing review approved",
    returned_for_clarification: "Returned for clarification",
    decision_declined: "Opportunity declined"
  };
  return labels[value ?? ""] ?? "Decision recorded";
}

function pricingReviewDeficiencyLabel(value: string) {
  const labels: Record<string, string> = {
    configuration_unavailable: "Pricing Review rules are unavailable.",
    qualification_incomplete: "Qualification is not complete.",
    missing_configured_evidence: "Decision support evidence is missing.",
    decision_accountability_required: "Decision owner and due date are required.",
    invalid_decision_owner_accountability: "The current owner cannot authorize Pricing Review."
  };
  return labels[value] ?? "Pricing Review requirements are incomplete.";
}

function shouldRenderPursuitAuthorization(detail: OpportunityDetail, stateOverride: string) {
  if (["stale-conflict", "unavailable", "action-failure", "authorized-outcome", "hold-outcome", "declined-outcome"].includes(stateOverride)) return true;
  return detail.opportunity.decisionReadinessStatus === "decision_approved";
}

function shouldPrioritizePursuitReviewState(stateOverride: string) {
  return ["authorized-outcome", "hold-outcome", "declined-outcome"].includes(stateOverride);
}

function buildPursuitReviewDetail(state: string): OpportunityDetail {
  const status = state === "authorized-outcome"
    ? "approved"
    : state === "hold-outcome"
      ? "hold_pending_evidence"
      : state === "declined-outcome"
        ? "declined"
        : "ready_for_authorization";
  const recommendation = state === "hold-pending-evidence" || state === "hold-outcome"
    ? "hold"
    : state === "decline-recommended" || state === "declined-outcome"
      ? "decline"
      : "approve";
  const readOnly = state === "auditor-read-only";
  const unavailable = state === "unavailable";

  return {
    opportunity: {
      id: "p1-01b-1-review",
      stableKey: "CLT-DC3",
      name: "CLT-DC3 East Campus Fiber Backbone",
      customerGc: "Carolina Data Centers",
      projectType: "Construction",
      location: "Charlotte, NC",
      scopeSummary: "East campus fiber backbone, access windows, and service tie-in coordination.",
      estimatedValue: 4_800_000,
      anticipatedStart: "2026-08-10",
      bidDueDate: "2026-07-10",
      ownerUserId: "bd-review",
      lifecycleStatus: "decision_required",
      intakeComplete: true,
      qualificationComplete: true,
      decisionReadinessStatus: "decision_approved",
      pursuitAuthorizationStatus: status,
      bidSubmissionStatus: "not_started",
      version: state === "stale-conflict" ? 8 : 7,
      submittedForDecisionAt: "2026-06-26T14:00:00Z",
      decisionOwnerUserId: "morgan-lee",
      decisionDueAt: "2026-07-02",
      pursuitAuthorityUserId: "morgan-lee",
      pursuitAuthorizationDueAt: "2026-07-02",
      pursuitAuthorizedAt: status === "approved" || status === "declined" || status === "hold_pending_evidence" ? "2026-06-28T16:45:00Z" : null,
      pursuitAuthorizedBy: status === "ready_for_authorization" ? null : "morgan-lee",
      pursuitAuthorizationReason: status === "hold_pending_evidence" ? "Engineering route survey required." : status === "declined" ? "Margin below threshold." : null
    },
    assignments: [],
    qualification: {
      status: "complete",
      completenessResult: "complete",
      recommendation: recommendation === "decline" ? "decline" : recommendation === "hold" ? "hold_for_clarification" : "pursue",
      riskSummary: "Access window, margin, and capacity reviewed.",
      assumptions: "Route survey and commercial basis are tied to the decision package.",
      criteria: {
        strategicFit: "strong",
        customerRelationship: "strong",
        geographyFit: "strong",
        projectTypeFit: "strong",
        scopeClarity: recommendation === "hold" ? "risk" : "acceptable",
        designMaturity: "acceptable",
        commercialTermsRisk: recommendation === "decline" ? "risk" : "acceptable",
        scheduleFeasibility: "acceptable",
        crewCapacityFit: "acceptable",
        materialLeadTimeRisk: "acceptable",
        permitsAccessRisk: recommendation === "decline" ? "risk" : "acceptable",
        safetyQualityComplexity: "acceptable",
        subcontractorDependency: "acceptable",
        cashFlowRisk: "acceptable",
        marginConfidence: recommendation === "decline" ? "risk" : "strong",
        contractualRisk: "acceptable"
      }
    },
    evidence: [],
    evidenceReady: recommendation !== "hold",
    pursuitAuthorizationReady: true,
    pursuitAuthorizationRecommendation: recommendation,
    pursuitAuthorizationState: state,
    pursuitAuthorizationEvents: status === "approved" || status === "declined" || status === "hold_pending_evidence"
      ? [{
          id: `event-${state}`,
          eventType: "opportunity.pursuit_authorization_recorded",
          decisionAction: status === "approved" ? "approve_pursuit" : status === "declined" ? "decline_pursuit" : "hold_pending_evidence",
          fromStatus: "ready_for_authorization",
          toStatus: status,
          reason: status === "approved" ? null : "Recorded human review reason.",
          actorUserId: "morgan-lee",
          createdAt: "2026-06-28T16:45:00Z",
          packageVersion: 7
        }]
      : [],
    bidSubmissionState: "",
    bidSubmissionEvents: [],
    bidEvidenceReady: false,
    bidSubmissionReady: false,
    bidOutcomeReady: false,
    workspaceRole: readOnly ? "read_only_auditor" : "operations_leader",
    workspaceAccessRole: readOnly ? "read_only_auditor" : "operations_leader",
    opportunityResponsibility: unavailable ? "operations_leader" : readOnly ? "auditor" : "pursuit_authority",
    effectiveWorkContext: unavailable ? "operations_leader" : readOnly ? "auditor" : "pursuit_authority",
    accessMode: readOnly ? "read_only" : "editable",
    bdOwner: { userId: "bd-review", name: "Riley Hart", initials: "RH" },
    decisionOwner: { userId: "morgan-lee", name: "Morgan Lee", initials: "ML" },
    pursuitAuthority: { userId: "morgan-lee", name: "Morgan Lee", initials: "ML" },
    decisionDueAt: "2026-07-02",
    capabilities: {
      canSubmitForDecision: false,
      canCompleteEstimatorContribution: false,
      canApproveDecision: false,
      canReturnDecision: false,
      canDeclineDecision: false,
      canAttachOpportunityEvidence: false,
      canEditQualification: false,
      canEditEstimatorContribution: false,
      canApprovePursuit: recommendation === "approve" && !readOnly && !unavailable && !["authorized-outcome", "hold-outcome", "declined-outcome"].includes(state),
      canHoldPursuit: !readOnly && !unavailable && !["authorized-outcome", "hold-outcome", "declined-outcome"].includes(state),
      canDeclinePursuit: !readOnly && !unavailable && !["authorized-outcome", "hold-outcome", "declined-outcome"].includes(state),
      canPrepareBidSubmission: false,
      canMarkBidPackageReady: false,
      canRequestBidEvidence: false,
      canApproveBidSubmission: false,
      canHoldBidSubmission: false,
      canRecordBidSubmission: false,
      canRecordBidOutcome: false
    },
    pricingReviewReadiness: {
      available: false,
      ready: false,
      reason: "configuration_unavailable",
      deficiencies: ["configuration_unavailable"],
      evidenceRequirements: [],
      missingEvidence: [],
      decisionOwnerAccountability: null,
      provenanceLabel: null
    },
    pursuitAuthorizationReadiness: {
      available: !unavailable,
      ready: !unavailable && !readOnly && !["hold-pending-evidence"].includes(state),
      reason: unavailable ? "configuration_unavailable" : null,
      deficiencies: unavailable ? ["configuration_unavailable"] : state === "hold-pending-evidence" ? ["missing_entity_contribution"] : [],
      entryRequirements: [{ key: "pricing-review-submitted", label: "Pricing Review package submitted", satisfied: true }],
      evidenceRequirements: [
        { evidenceTypeKey: "qualification_decision_support", relationshipType: "qualification_decision_support", label: "Decision support evidence", required: true, blocking: true, satisfied: true },
        { evidenceTypeKey: "pursuit_authorization_basis", relationshipType: "pursuit_authorization_basis", label: "Pursuit authorization basis", required: true, blocking: true, satisfied: state !== "hold-pending-evidence" }
      ],
      missingEvidence: state === "hold-pending-evidence"
        ? [{ evidenceTypeKey: "pursuit_authorization_basis", relationshipType: "pursuit_authorization_basis", label: "Pursuit authorization basis", required: true, blocking: true, satisfied: false }]
        : [],
      contributionRequirements: [{ key: "entity-contribution-owner-attestation", label: "Entity contribution owner attestation", roleLabel: "Entity Contribution Owner", satisfied: state !== "hold-pending-evidence" }],
      profitability: { metricKey: "expected_gross_margin_percent", label: "Expected Gross Margin %", displayValue: recommendation === "decline" ? "11.8%" : "24.6%", satisfied: true },
      decisionOwnerAccountability: { roleKey: "operations_leader", label: "Operations Leader", satisfied: !unavailable && !readOnly },
      permittedOutcomes: [
        { outcomeKey: "pursue", label: "Pursue", outcomeType: "approve", mapsToAction: "approve_pursuit", requiresJustification: false, requiresMitigation: false },
        { outcomeKey: "hold-pending-evidence", label: "Hold pending evidence", outcomeType: "hold", mapsToAction: "hold_pending_evidence", requiresJustification: true, requiresMitigation: true },
        { outcomeKey: "no-pursue", label: "No-Pursue", outcomeType: "stop", mapsToAction: "decline_pursuit", requiresJustification: true, requiresMitigation: false }
      ],
      recommendation,
      provenanceLabel: unavailable ? null : "D5O Pipeline Qualification 1.1.0"
    },
    submissionApprover: null,
    bidSubmissionApprovalReadiness: emptyBidSubmissionApprovalReadiness(),
    denialReason: readOnly ? "read_only" : unavailable ? "pursuit_authority_required" : null
  };
}

function getPursuitAuthorizationViewState(detail: OpportunityDetail, stateOverride: string) {
  if (["stale-conflict", "unavailable", "action-failure", "authorized-outcome", "hold-outcome", "declined-outcome"].includes(stateOverride)) return stateOverride;
  if (!detail.pursuitAuthorizationReadiness.available) return "unavailable";
  const serverState = normalizePursuitAuthorizationState(detail.pursuitAuthorizationState);
  if (serverState) return serverState;
  if (detail.accessMode === "read_only" || detail.effectiveWorkContext === "auditor") return "auditor-read-only";
  if (detail.opportunity.pursuitAuthorizationStatus === "approved") return "authorized-outcome";
  if (detail.opportunity.pursuitAuthorizationStatus === "hold_pending_evidence") return "hold-outcome";
  if (detail.opportunity.pursuitAuthorizationStatus === "declined") return "declined-outcome";
  if (detail.pursuitAuthorizationReadiness.deficiencies.includes("missing_entity_contribution")) return "hold-pending-evidence";
  if (detail.pursuitAuthorizationReadiness.deficiencies.includes("invalid_pursuit_decision_owner")) return "unavailable";
  if (detail.effectiveWorkContext !== "pursuit_authority") return "unavailable";
  if (detail.pursuitAuthorizationRecommendation === "hold") return "hold-pending-evidence";
  if (detail.pursuitAuthorizationRecommendation === "decline") return "decline-recommended";
  return "decision-ready";
}

function normalizePursuitAuthorizationState(state: string) {
  const states: Record<string, string> = {
    auditor_read_only: "auditor-read-only",
    authorized_outcome: "authorized-outcome",
    hold_outcome: "hold-outcome",
    declined_outcome: "declined-outcome",
    hold_pending_evidence: "hold-pending-evidence",
    decline_recommended: "decline-recommended",
    decision_ready: "decision-ready",
    unavailable: "unavailable",
    not_eligible: "unavailable",
    empty: "empty"
  };
  return states[state] ?? "";
}

function getPursuitAuthorizationModel(detail: OpportunityDetail, state: string) {
  const value = detail.opportunity.estimatedValue ?? 4_800_000;
  const profitabilityDisplayValue = detail.pursuitAuthorizationReadiness.profitability?.displayValue ?? "Not available";
  const gmPercent = parsePercent(detail.pursuitAuthorizationReadiness.profitability?.displayValue) ?? 0;
  const gm = gmPercent / 100;
  const directCost = value * (1 - gm);
  const grossProfit = value * gm;
  const canMutate = ["decision-ready", "hold-pending-evidence", "decline-recommended", "action-failure"].includes(state)
    && (detail.capabilities.canApprovePursuit || detail.capabilities.canHoldPursuit || detail.capabilities.canDeclinePursuit);
  const base = {
    eyebrow: "Pursuit authorization decision",
    roleLabel: detail.accessMode === "read_only" ? "Read-only Auditor" : detail.effectiveWorkContext === "pursuit_authority" ? "Assigned Pursuit Authority" : "Operations Leader, not assigned",
    title: `Approve pursuit for ${detail.opportunity.name}.`,
    lead: "Rybex has a qualified opportunity, complete decision evidence, and a commercial basis that must be authorized before pursuit resources are committed.",
    recommendationTitle: "Approve pursuit recommended",
    recommendationDetail: "Qualified and ready for pursuit decision",
    businessQuestion: "Should Rybex pursue this qualified opportunity now?",
    businessContext: "Came from an approved qualification package for pricing review.",
    nextState: "Pursuit approved outcome",
    nextStateDetail: "If approved, the record moves to pursuit approved. No bid is submitted by this action.",
    actionTitle: "Stage-specific action only",
    primaryActionLabel: "Return to pursuit queue",
    secondaryActionLabel: "Return to pursuit queue",
    secondaryActionHref: "/pipeline",
    stateLabel: "Decision-ready",
    tone: "approve" as "approve" | "hold" | "decline",
    canMutate,
    alertTitle: "Review package status",
    alertCopy: "The latest package state is shown below.",
    metrics: [
      { label: "Expected GM", value: profitabilityDisplayValue },
      { label: "External revenue", value: formatMoney(value) },
      { label: "Direct cost", value: formatMoney(directCost) },
      { label: "Gross profit", value: formatMoney(grossProfit) }
    ],
    evidence: [
      { title: "Verified qualification package", detail: "Decision-support package is current and linked to the pursuit claim.", status: "Complete" as const },
      { title: "Entity attestations", detail: "Construction, Engineering, and Professional Services are attested.", status: "Complete" as const },
      { title: "Route-survey basis", detail: "Engineering survey note supports the direct-cost basis.", status: detail.evidenceReady ? "Complete" as const : "Blocking" as const }
    ],
    risks: [
      { title: "Strategic fit", detail: "Strong data-center backbone fit with existing customer relationship." },
      { title: "Scope confidence", detail: "Route survey and access-window assumptions are reconciled." },
      { title: "Capacity fit", detail: "Available estimating and commercial review capacity this week." }
    ]
  };

  if (state === "hold-pending-evidence" || state === "hold-outcome") {
    return {
      ...base,
      title: state === "hold-outcome" ? "Hold recorded. Evidence owner must resolve the blocker before pursuit approval." : "Hold pursuit until Engineering evidence is verified.",
      lead: "The opportunity is qualified, but Engineering route-survey evidence is missing. Rybex should not commit pursuit resources until the blocker is resolved.",
      recommendationTitle: state === "hold-outcome" ? "Hold recorded" : "Hold pending evidence recommended",
      recommendationDetail: "Qualified but not ready for authorization",
      businessQuestion: state === "hold-outcome" ? "What happens after a hold?" : "What evidence blocks the pursuit decision?",
      businessContext: "Qualification is preserved; pursuit evidence is incomplete.",
      nextState: "Hold recorded outcome",
      nextStateDetail: "Hold routes the package to the evidence owner and preserves the qualified history.",
      stateLabel: state === "hold-outcome" ? "Hold outcome" : "Hold pending evidence",
      tone: "hold" as const,
      evidence: [
        { title: "Verified qualification package", detail: "Decision-support package is current.", status: "Complete" as const },
        { title: "Engineering route survey", detail: "Required basis for direct cost is missing.", status: "Blocking" as const },
        { title: "Customer deadline note", detail: "Bid deadline and authorization due date are documented.", status: "Complete" as const }
      ],
      risks: [
        { title: "Strategic fit", detail: "Good fit, but action is blocked by evidence." },
        { title: "Scope confidence", detail: "Cost basis cannot be trusted until survey is attached." },
        { title: "Capacity fit", detail: "Estimator capacity is available after evidence closure." }
      ]
    };
  }

  if (state === "decline-recommended" || state === "declined-outcome") {
    return {
      ...base,
      title: state === "declined-outcome" ? "Pursuit declined. Rybex stops this commercial pursuit here." : "Review Expected Gross Margin % and unresolved access risk.",
      lead: "The qualification was valid, but direct-cost reconciliation and access risk require a No-Pursue rationale before the pursuit decision is recorded.",
      recommendationTitle: state === "declined-outcome" ? "Pursuit declined" : "Decline pursuit recommended",
      recommendationDetail: "Qualified but commercially unattractive",
      businessQuestion: "Should Rybex stop this pursuit despite qualification?",
      businessContext: "Pursuit commercial review changed the recommendation.",
      nextState: "Pursuit declined outcome",
      nextStateDetail: "Decline creates a terminal commercial decision for this pursuit package. It is not a bid loss or award outcome.",
      stateLabel: state === "declined-outcome" ? "Declined outcome" : "Decline recommended",
      tone: "decline" as const,
      evidence: [
        { title: "Verified qualification package", detail: "Qualification remains preserved.", status: "Complete" as const },
        { title: "Commercial reconciliation", detail: "Risk-adjusted cost reduces margin below gate.", status: "Risky" as const },
        { title: "Access-window commitment", detail: "Customer window remains unresolved.", status: "Blocking" as const }
      ],
      risks: [
        { title: "Strategic fit", detail: "Fit is real, but commercial downside is material." },
        { title: "Scope confidence", detail: "Low after access-window adjustment." },
        { title: "Capacity fit", detail: "Pursuit would displace higher-margin work." }
      ]
    };
  }

  if (state === "authorized-outcome") {
    return {
      ...base,
      title: "Pursuit approved. The package may proceed to bid preparation.",
      recommendationTitle: "Pursuit approved",
      recommendationDetail: "Pursuit approval recorded",
      businessQuestion: "What happened after approval?",
      nextState: "Pursuit approved record",
      nextStateDetail: "Next permitted activity is bid-preparation readiness in a later authorized slice. No bid is submitted here.",
      stateLabel: "Authorized outcome",
      canMutate: false
    };
  }

  if (state === "auditor-read-only") {
    return {
      ...base,
      eyebrow: "Read-only review",
      title: "Read-only pursuit authorization review.",
      recommendationTitle: "No action available",
      recommendationDetail: "Read-only access",
      businessQuestion: "Can an auditor verify the decision without changing it?",
      nextState: "No state change",
      nextStateDetail: "Review only. No authorization, hold, decline, edit, or retry action is available.",
      stateLabel: "Auditor read-only",
      roleLabel: "Read-only Auditor",
      canMutate: false,
      secondaryActionLabel: "Return to audit queue"
    };
  }

  if (state === "stale-conflict") {
    return {
      ...base,
      eyebrow: "Conflict recovery",
      title: "This package changed before your decision was recorded.",
      lead: "Your decision was not applied. The record now has updated commercial or evidence data. No duplicate decision was created.",
      recommendationTitle: "Refresh before deciding",
      recommendationDetail: "Decision not recorded",
      businessQuestion: "What changed and is my work preserved?",
      nextState: "Updated pursuit decision surface",
      nextStateDetail: "Review the updated package, then choose a fresh decision.",
      stateLabel: "Stale/conflict",
      tone: "hold" as const,
      canMutate: false,
      alertTitle: "Decision was not recorded",
      alertCopy: "The package version changed. Review the latest package before deciding.",
      primaryActionLabel: "Review updated package"
    };
  }

  if (state === "unavailable") {
    return {
      ...base,
      eyebrow: "Access and eligibility",
      title: "You are not eligible to decide this pursuit.",
      lead: "You can inspect this pursuit gate, but you are not assigned as the Decision Owner or Pursuit Authority for this authorization decision.",
      recommendationTitle: "Pursuit authorization unavailable",
      recommendationDetail: "Eligibility blocked - assignment required",
      businessQuestion: "Why can I not act?",
      nextState: "No state change",
      nextStateDetail: "Ask an authorized owner to assign decision authority or complete the review. The package is not changed.",
      stateLabel: "Unavailable",
      tone: "hold" as const,
      canMutate: false,
      roleLabel: "Not assigned to decide",
      primaryActionLabel: "Return to assigned work"
    };
  }

  if (state === "action-failure") {
    return {
      ...base,
      eyebrow: "Action recovery",
      title: "Decision was not recorded. Your review notes are preserved.",
      lead: "The pursuit package did not change. Your decision reason remains available on this page. Retry is safe and will not create duplicate decisions.",
      recommendationTitle: "Recover safely",
      recommendationDetail: "Action failed - no state change",
      businessQuestion: "Did the decision save, and what should I do?",
      nextState: "Same decision surface or confirmed outcome",
      nextStateDetail: "Retry recording after reviewing the preserved reason, or return to the queue without changing the package.",
      stateLabel: "Action failure / recovery",
      tone: "hold" as const,
      alertTitle: "Decision was not recorded",
      alertCopy: "No state changed. Retry is duplicate-safe after reviewing the package.",
      evidence: [
        { title: "Decision command", detail: "No persisted decision exists.", status: "Incomplete" as const },
        { title: "Draft reason", detail: "Retained on this page.", status: "Complete" as const },
        { title: "Audit event", detail: "Failure logged without outcome transition.", status: "Complete" as const }
      ],
      risks: [
        { title: "Trust", detail: "No false success message." },
        { title: "Recovery", detail: "User knows what is preserved." },
        { title: "Safety", detail: "Retry does not duplicate." }
      ]
    };
  }

  return base;
}

function pursuitActionLabel(value: string) {
  const labels: Record<string, string> = {
    approve_pursuit: "Approve pursuit",
    hold_pending_evidence: "Hold pending evidence",
    decline_pursuit: "Decline pursuit",
    system_note: "System note"
  };
  return labels[value] ?? "Pursuit authorization event";
}

function pursuitEventTitle(value: string) {
  const labels: Record<string, string> = {
    approve_pursuit: "Pursuit Authorized",
    hold_pending_evidence: "Pursuit Held",
    decline_pursuit: "Pursuit Declined",
    system_note: "System note"
  };
  return labels[value] ?? "Pursuit authorization event";
}

function pursuitOutcomeLabel(value: string) {
  const labels: Record<string, string> = {
    approve_pursuit: "Pursue",
    hold_pending_evidence: "Hold pending evidence",
    decline_pursuit: "No-Pursue",
    system_note: "System note"
  };
  return labels[value] ?? "Not changed";
}

function parsePercent(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function outcomeRequirementCopy(outcome: OpportunityDetail["pursuitAuthorizationReadiness"]["permittedOutcomes"][number]) {
  if (outcome.requiresJustification && outcome.requiresMitigation) return "Justification and mitigation required";
  if (outcome.requiresJustification) return "Justification required";
  if (outcome.requiresMitigation) return "Mitigation required";
  return "No additional justification required";
}

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatMoney(value: number | null) {
  return value === null ? "Not set" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: value >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: value >= 1_000_000 ? 1 : 0 }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
