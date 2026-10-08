import Link from "next/link";
import { formatBillingCurrency, type BillingBackupPackage } from "@/lib/d5o/billing-v2";

type BillingV2StepOutcomeRecordProps = {
  billingPackage: BillingBackupPackage;
  cameFromPilot: boolean;
};

export function BillingV2StepOutcomeRecord({
  billingPackage,
  cameFromPilot
}: BillingV2StepOutcomeRecordProps) {
  const requiredEvidence = billingPackage.evidenceRequirements.filter((item) => item.required);
  const completedEvidenceCount = requiredEvidence.filter((item) => ["referenced", "attached", "verified", "waived"].includes(item.status)).length;
  const unblockedAmount = formatBillingCurrency(billingPackage.blockedAmount, billingPackage.currency);

  return (
    <div className="billing-outcome-summary" data-qa="billing-v2-step-outcome">
      <div className="section-heading billing-outcome-heading">
        <div>
          <p className="eyebrow">Billing blocker cleared</p>
          <h2>{unblockedAmount} unblocked for commercial review</h2>
          <p data-qa="billing-v2-outcome-record">
            {billingPackage.payApplicationLabel} backup is approved and the missing-backup blocker is cleared. Payment has not yet been recorded.
          </p>
        </div>
        <span className="chip chip-success">Ready for commercial review</span>
      </div>
      <dl className="completion-facts billing-outcome-facts">
        <div>
          <dt>Billing blocker</dt>
          <dd>Cleared for {billingPackage.payApplicationLabel}</dd>
        </div>
        <div>
          <dt>Amount unblocked</dt>
          <dd>{unblockedAmount} for commercial review.</dd>
        </div>
        <div>
          <dt>Approval recorded</dt>
          <dd>{billingPackage.reviewDecision?.decisionNote ?? "No decision recorded"}</dd>
        </div>
        <div>
          <dt>Evidence package</dt>
          <dd>{completedEvidenceCount} of {requiredEvidence.length} proof items complete.</dd>
        </div>
        <div>
          <dt>Command Center</dt>
          <dd>Updated; this blocker is no longer shown as unresolved.</dd>
        </div>
        <div>
          <dt>Payment status</dt>
          <dd>Payment has not yet been recorded.</dd>
        </div>
      </dl>
      <section
        className="billing-outcome-next-action"
        data-billing-resolved-primary-surface="next-action"
        data-qa="billing-v2-next-business-step"
      >
        <div>
          <p className="eyebrow">Next action</p>
          <h3>Continue pay application review</h3>
          <p>
            Use the approved backup package to complete review and submission readiness. Payment has not yet been recorded.
          </p>
        </div>
        <div className="completion-action-row">
          <Link className="button button-primary" data-qa="billing-v2-pay-application-review" href="/billing#details-records">
            Open pay application review
          </Link>
        </div>
      </section>
      <div className="completion-action-row completion-return-row">
        {cameFromPilot ? (
          <Link className="button button-primary" data-qa="return-to-pilot-mode" href="/pilot?refresh=completion">
            Return to workflow list
          </Link>
        ) : null}
      </div>
    </div>
  );
}
