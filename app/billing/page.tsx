import Link from "next/link";
import { BillingDashboard } from "@/components/d5o/billing/BillingDashboard";
import { BillingV2GuidedWorkflow } from "@/components/d5o/billing-v2/BillingV2GuidedWorkflow";
import { CollapsedDetails } from "@/components/d5o/end-user";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import {
  getBillingV2ActionState,
  getBillingV2SeedDataOverlay
} from "@/lib/d5o/billing-v2/store";
import { evaluateBillingControl } from "@/lib/d5o/billing-control";
import {
  applyCloseoutFinalBillingToSeedData,
  getCloseoutFinalBillingActionState
} from "@/lib/d5o/closeout-final-billing/store";
import { compactCurrency } from "@/lib/d5o/presentation";
import {
  changeEvents,
  closeoutPackages,
  lienWaivers,
  punchItems,
  projects,
  qualityDeficiencies,
  scheduleOfValues
} from "@/lib/d5o/seed-data";

const currentContractValue = projects.reduce((total, project) => total + project.contractValue, 0);
const approvedChangeValue = changeEvents.reduce((total, event) => total + event.approvedAmount, 0);
const evidenceRisks = [
  ...qualityDeficiencies.filter((item) => item.billingImpact && !["closed", "verified"].includes(item.status)),
  ...punchItems.filter((item) => item.acceptanceImpact && !["closed", "verified"].includes(item.status))
];
const closeoutCommercialRisks = closeoutPackages.filter((item) =>
  ["blocked", "pending_final_billing", "pending_waiver", "disputed"].includes(item.retainageReleaseStatus) ||
  ["draft", "aging", "disputed", "rejected", "partially_paid"].includes(item.finalBillingStatus)
);
const billingCurrency = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency"
});

export const metadata = {
  title: "Billing | RybexOS"
};

export const dynamic = "force-dynamic";

type BillingPageProps = {
  searchParams?: Promise<{
    focus?: string;
    pilot?: string;
  }>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams;
  const billingV2State = await getBillingV2ActionState();
  const billingOverlay = await getBillingV2SeedDataOverlay();
  const closeoutFinalBillingState = await getCloseoutFinalBillingActionState();
  const closeoutBillingOverlay = applyCloseoutFinalBillingToSeedData(closeoutFinalBillingState.blocker, {
    payApplications: billingOverlay.payApplications,
    lienWaivers,
    commercialExposureItems: billingOverlay.commercialExposureItems,
    closeoutPackages
  });
  const summary = evaluateBillingControl({
    payApplications: closeoutBillingOverlay.payApplications,
    backupItems: billingOverlay.billingBackupItems,
    lienWaivers: closeoutBillingOverlay.lienWaivers,
    commercialExposure: closeoutBillingOverlay.commercialExposureItems,
    changeEvents
  });
  const payApplications = closeoutBillingOverlay.payApplications;
  const billingBackupItems = billingOverlay.billingBackupItems;
  const commercialExposureItems = closeoutBillingOverlay.commercialExposureItems;
  const pageLienWaivers = closeoutBillingOverlay.lienWaivers;
  const pageCloseoutPackages = closeoutBillingOverlay.closeoutPackages;
  const payAppsDue = payApplications.filter((payApp) =>
    ["draft", "ready_for_review"].includes(payApp.status)
  );
  const submittedAging = payApplications.filter((payApp) =>
    ["submitted", "aging", "partially_paid", "disputed"].includes(payApp.status)
  );
  const cameFromPilot = params?.pilot === "1";
  const closeoutCommercialRisks = pageCloseoutPackages.filter((item) =>
    ["blocked", "pending_final_billing", "pending_waiver", "disputed"].includes(item.retainageReleaseStatus) ||
    ["draft", "aging", "disputed", "rejected", "partially_paid"].includes(item.finalBillingStatus) ||
    item.id === "cop-bluegrass-001"
  );
  const activeBillingPackage = billingV2State.package;
  const billingResolved = Boolean(activeBillingPackage.blockerResolution);
  const requiredBillingEvidence = activeBillingPackage.evidenceRequirements.filter((item) => item.required);
  const completedBillingEvidenceCount = requiredBillingEvidence.filter((item) => ["referenced", "attached", "verified", "waived"].includes(item.status)).length;
  const billingNextStep = getBillingPageNextStep(activeBillingPackage.state);
  const closeoutFinalBillingReleased = closeoutFinalBillingState.blocker.state === "resolved";
  const closeoutProjectionView = {
    linkedItem: closeoutFinalBillingState.blocker.linkedPayApplicationId,
    finalBillingStatus: "Ready for processing",
    retainageStatus: "Release approved",
    paymentStatus: "Not recorded",
    closeoutRestriction: "Cleared",
    remainingBlocker: billingResolved ? "No PA-001 backup blocker open" : `${activeBillingPackage.payApplicationLabel} backup package`,
    footer: "final billing unblocked | retainage release approved"
  };

  return (
    <div className={`command-grid billing-page active-workbench-page ${billingResolved ? "billing-page-resolved" : "billing-page-unresolved"}`}>
      <PageHeader
        context={billingResolved
          ? "The missing-backup blocker is cleared. Continue commercial review before payment is recorded."
          : "Use the active recovery workbench to clear the blocker before returning to supporting billing records."}
        eyebrow="Commercial Recovery"
        subtitle={billingResolved
          ? "PA-001 backup is approved and the pay application can continue through review."
          : "Recover blocked cash by completing backup, evidence, review, and clearance."}
        tags={billingResolved ? ["Ready for commercial review"] : ["Cash at risk"]}
        title="Billing"
      />

      <section
        className="workbench-situation-hero billing-situation-hero"
        data-billing-resolved-primary-surface={billingResolved ? "summary" : undefined}
        data-qa="billing-situation-hero"
      >
        <div className="workbench-situation-copy billing-situation-copy">
          <p className="eyebrow">Billing workbench</p>
          <h2>{billingResolved ? "Billing blocker cleared" : "Recover blocked billing"}</h2>
          <p>
            {billingResolved
              ? `${activeBillingPackage.payApplicationLabel} backup is approved. The pay application is ready for commercial review, but payment has not yet been recorded.`
              : `${activeBillingPackage.payApplicationLabel} cannot move until backup, evidence, review, and clearance are complete. Finish this workflow to remove the billing blocker and protect the cash recovery path.`}
          </p>
          <p className="mobile-workbench-summary">
            {billingResolved
              ? `${compactCurrency.format(activeBillingPackage.blockedAmount)} unblocked for commercial review. ${activeBillingPackage.payApplicationLabel} backup approved. ${completedBillingEvidenceCount} of ${requiredBillingEvidence.length} proof items complete. Command Center updated. Ready for commercial review. Payment has not yet been recorded.`
              : `${billingCurrency.format(activeBillingPackage.blockedAmount)} blocked. Missing backup is holding ${activeBillingPackage.payApplicationLabel}. Next: ${billingNextStep.toLowerCase()}`}
          </p>
        </div>
        <dl className="workbench-situation-facts billing-situation-facts">
          {billingResolved ? (
            <>
              <div>
                <dt>Result</dt>
                <dd>{billingCurrency.format(activeBillingPackage.blockedAmount)} unblocked for commercial review</dd>
              </div>
              <div>
                <dt>Approval</dt>
                <dd>{activeBillingPackage.payApplicationLabel} backup approved</dd>
              </div>
              <div>
                <dt>Proof complete</dt>
                <dd>{completedBillingEvidenceCount} of {requiredBillingEvidence.length} proof items complete</dd>
              </div>
              <div>
                <dt>Current status</dt>
                <dd>Ready for commercial review</dd>
              </div>
              <div>
                <dt>Command Center</dt>
                <dd>Updated</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Cash at risk</dt>
                <dd>{billingCurrency.format(activeBillingPackage.blockedAmount)}</dd>
              </div>
              <div>
                <dt>Why it is blocked</dt>
                <dd>{activeBillingPackage.blockerReason}</dd>
              </div>
              <div>
                <dt>Current status</dt>
                <dd>{activeBillingPackage.state.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>Next step</dt>
                <dd>{billingNextStep}</dd>
              </div>
            </>
          )}
        </dl>
      </section>

      <section className="active-workflow-mode" aria-label="Billing active workflow mode">
          <BillingV2GuidedWorkflow
            cameFromPilot={cameFromPilot}
            initialPackage={billingV2State.package}
            storageLabel={billingV2State.storageLabel}
          />
      </section>

      {closeoutFinalBillingReleased ? (
        <section className="billing-final-release-summary" data-qa="billing-final-release-projection">
          <div>
            <p className="eyebrow">Closeout billing release</p>
            <h2>Closeout release approved</h2>
            <p>
              The closeout-linked final billing and retainage item is unblocked for processing. Payment has not yet been recorded. Other Billing blockers may still require action.
            </p>
          </div>
          <dl className="billing-final-release-facts">
            <div>
              <dt>Linked item</dt>
              <dd>{closeoutProjectionView.linkedItem}</dd>
            </div>
            <div>
              <dt>Remaining blocker</dt>
              <dd>{closeoutProjectionView.remainingBlocker}</dd>
            </div>
            <div>
              <dt>Final billing</dt>
              <dd>{closeoutProjectionView.finalBillingStatus}</dd>
            </div>
            <div>
              <dt>Retainage</dt>
              <dd>{closeoutProjectionView.retainageStatus}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{closeoutProjectionView.paymentStatus}</dd>
            </div>
            <div>
              <dt>Closeout restriction</dt>
              <dd>{closeoutProjectionView.closeoutRestriction}</dd>
            </div>
          </dl>
          <p className="ready-callout">{closeoutProjectionView.footer}</p>
        </section>
      ) : null}

      <CollapsedDetails
        title={billingResolved ? "Supporting billing records" : "Supporting billing details"}
        summary={billingResolved ? "Evidence, approval history, pay application records, retainage, SOV, and commercial exposure records." : "Pay apps, backup, retainage, SOV, and commercial exposure records."}
      >
        {billingResolved ? (
          <section className="pipeline-guardrail">
            <strong>Resolved billing package:</strong>
            <span>
              {activeBillingPackage.payApplicationLabel} backup approved; {completedBillingEvidenceCount} of {requiredBillingEvidence.length} proof items complete. Payment has not yet been recorded.
            </span>
          </section>
        ) : null}

        {billingResolved ? (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Approval and history</p>
                <h2>Backup package record</h2>
              </div>
            </div>
            <ul className="plain-list">
              <li>Approval note: {activeBillingPackage.reviewDecision?.decisionNote ?? "No approval note recorded"}</li>
              <li>Resolution note: {activeBillingPackage.resolutionNote ?? "No resolution note recorded"}</li>
              <li>Review task: {activeBillingPackage.reviewTask?.id ?? "Not created"}</li>
              <li>Updates recorded: {activeBillingPackage.historicalRecord?.stateTransitions.length ?? activeBillingPackage.events.length}</li>
            </ul>
          </section>
        ) : null}

        <section className="pipeline-guardrail">
          <strong>Billing discipline:</strong>
          <span>Completed work, daily reports, approved changes, retainage, lien waivers, and backup documentation must align before pay application submission.</span>
        </section>

        <WorkflowModuleContext
          queueTitle="Billing and cash-control workflow actions"
          workflowType="billing_cash_control"
        />

        <section className="metrics-grid detail-metrics-grid" aria-label="Billing summary">
          <PipelineSummaryMetric detail="Active project contract value" label="Contract Value" value={compactCurrency.format(currentContractValue)} />
          <PipelineSummaryMetric detail="Approved change value" label="Approved Changes" tone="success" value={compactCurrency.format(approvedChangeValue)} />
          <PipelineSummaryMetric detail="Pending change exposure" label="Pending Exposure" tone={summary.pendingChangeExposure > 0 ? "warning" : "success"} value={compactCurrency.format(summary.pendingChangeExposure)} />
          <PipelineSummaryMetric detail="Approved changes not billed" label="Unbilled Approved" tone={summary.unbilledApprovedChangeValue > 0 ? "critical" : "success"} value={compactCurrency.format(summary.unbilledApprovedChangeValue)} />
          <PipelineSummaryMetric detail="Draft or ready for review" label="Pay Apps Due" tone={payAppsDue.length > 0 ? "warning" : "success"} value={payAppsDue.length} />
          <PipelineSummaryMetric detail="Submitted, aging, partial, or disputed" label="Submitted / Aging" tone={submittedAging.length > 0 ? "critical" : "success"} value={submittedAging.length} />
          <PipelineSummaryMetric detail="Retainage currently held" label="Retainage Held" tone="warning" value={compactCurrency.format(summary.retainageHeld)} />
          <PipelineSummaryMetric detail="Required backup gaps" label="Missing Backup" tone={summary.missingBackupItems.length > 0 ? "critical" : "success"} value={summary.missingBackupItems.length} />
          <PipelineSummaryMetric detail="Commercial cash exposure" label="Cash at Risk" tone={summary.cashAtRisk > 0 ? "critical" : "success"} value={compactCurrency.format(summary.cashAtRisk)} />
        </section>

        <div id="commercial-exposure" className="detail-contained">
          <BillingDashboard
            payApplications={payApplications}
            scheduleOfValues={scheduleOfValues}
            backupItems={billingBackupItems}
            lienWaivers={pageLienWaivers}
            commercialExposure={commercialExposureItems}
            changeEvents={changeEvents}
          />
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Safety / Quality Billing Evidence</p>
              <h2>Acceptance evidence that can affect payment readiness</h2>
            </div>
            <Link className="button button-secondary" href="/quality">Quality</Link>
          </div>
          <div className="operating-columns">
            {evidenceRisks.slice(0, 6).map((item) => (
              <section className="control-list" key={item.id}>
                <h3>{item.title}</h3>
                <p>{item.projectName}</p>
                <p className="missing-callout">{item.nextAction}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">D5 Final Recovery</p>
              <h2>Closeout packages affecting final billing and retainage</h2>
            </div>
            <Link className="button button-secondary" href="/closeout">Closeout</Link>
          </div>
          <div className="operating-columns">
            {closeoutCommercialRisks.map((item) => (
              <section className="control-list" key={item.id}>
                <h3>{item.projectName}</h3>
                <p>{item.packageNumber} | final billing {item.finalBillingStatus.replaceAll("_", " ")} | retainage {item.retainageReleaseStatus.replaceAll("_", " ")}</p>
                <p className={item.retainageReleaseStatus === "released" ? "ready-callout" : "missing-callout"}>{item.nextAction}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="pipeline-guardrail">
          <strong>O billing intelligence:</strong>
          <span>
            Pay app aging, approved-not-billed changes, retainage delays, and disputed exposure should feed <Link href="/reports">Optimize</Link> performance scorecards.
          </span>
        </section>
      </CollapsedDetails>
    </div>
  );
}

function getBillingPageNextStep(state: string) {
  if (state === "blocked") return "Start the backup package.";
  if (state === "backup_package_not_started") return "Start the backup package.";
  if (state === "backup_package_in_progress") return "Save the backup summary and affected amount.";
  if (state === "evidence_required") return "Add the missing proof references.";
  if (state === "package_ready_for_review") return "Send the package for commercial review.";
  if (state === "commercial_review_pending") return "Record the review decision.";
  if (state === "commercial_review_approved") return "Clear the cash blocker with a resolution note.";
  if (state === "billing_blocker_cleared") return "Cash blocker cleared.";
  return "Complete the next billing recovery step.";
}
