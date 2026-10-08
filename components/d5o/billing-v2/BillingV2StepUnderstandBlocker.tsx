import type { BillingBackupPackage } from "@/lib/d5o/billing-v2";

type BillingV2StepUnderstandBlockerProps = {
  billingPackage: BillingBackupPackage;
  completedEvidenceCount: number;
  feedback: string | null;
  onStart: () => void;
  totalEvidenceCount: number;
};

export function BillingV2StepUnderstandBlocker({
  billingPackage,
  completedEvidenceCount,
  feedback,
  onStart,
  totalEvidenceCount
}: BillingV2StepUnderstandBlockerProps) {
  return (
    <div data-qa="billing-v2-step-understand">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Understand blocker</p>
          <h2>Start the backup package</h2>
          <p>You are building the billing backup package required for commercial review.</p>
        </div>
        <span className="chip chip-critical">Cash blocked</span>
      </div>
      <p className="billing-mobile-action-summary">
        Missing backup is holding {billingPackage.payApplicationLabel}. Start the package so proof can be added and sent for review.
      </p>
      <p className="billing-mobile-progress-line">
        {completedEvidenceCount} of {totalEvidenceCount} proof items complete
      </p>
      <dl className="focused-task-grid">
        <div>
          <dt>Backup package</dt>
          <dd>{billingPackage.title}</dd>
        </div>
        <div>
          <dt>Review owner</dt>
          <dd>{billingPackage.reviewerRole}</dd>
        </div>
      </dl>
      <div className="focused-task-next billing-step-why">
        <span>Why this step matters</span>
        <strong>The cash recovery path cannot move until the backup package is documented, evidenced, reviewed, and approved.</strong>
      </div>
      <p className="completion-mode-note">
        Complete the backup package here, then use the approved package to move the pay application forward.
      </p>
      {feedback ? <p className="missing-callout">{feedback}</p> : null}
      <button className="button button-primary" data-qa="billing-v2-start-package" onClick={onStart} type="button">
        Start backup package
      </button>
    </div>
  );
}
