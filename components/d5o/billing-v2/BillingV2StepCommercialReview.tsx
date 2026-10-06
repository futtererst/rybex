import type { BillingBackupPackage, BillingPackageReadiness } from "@/lib/d5o/billing-v2";

type BillingV2StepCommercialReviewProps = {
  billingPackage: BillingBackupPackage;
  feedback: string | null;
  readiness: BillingPackageReadiness;
  onSendToReview: () => void;
};

export function BillingV2StepCommercialReview({
  billingPackage,
  feedback,
  readiness,
  onSendToReview
}: BillingV2StepCommercialReviewProps) {
  return (
    <div data-qa="billing-v2-step-review">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Submit for commercial review</p>
          <h2>Hand off the ready package</h2>
          <p>Commercial Review receives the package summary, source record, affected amount, and evidence references.</p>
        </div>
        <span className={`chip chip-${readiness.isReady ? "success" : "warning"}`}>
          {readiness.isReady ? "Ready" : "Blocked"}
        </span>
      </div>
      <dl className="completion-facts">
        <div>
          <dt>Assigned role</dt>
          <dd>Commercial Review</dd>
        </div>
        <div>
          <dt>Package contents</dt>
          <dd>{billingPackage.backupSummary}</dd>
        </div>
        <div>
          <dt>Source record</dt>
          <dd>{billingPackage.relatedSourceRecord?.label ?? "Missing"}</dd>
        </div>
        <div>
          <dt>Evidence included</dt>
          <dd>{billingPackage.evidenceRequirements.filter((item) => item.required && item.status !== "missing").length} proof item(s)</dd>
        </div>
      </dl>
      {billingPackage.reviewTask ? (
        <section className="focused-task-next" data-qa="billing-v2-review-task">
          <span>Commercial Review Task Created</span>
          <strong>{billingPackage.reviewTask.id} · {billingPackage.reviewTask.status.replaceAll("_", " ")}</strong>
        </section>
      ) : null}
      {!readiness.isReady ? (
        <p className="missing-callout">Complete the missing evidence before sending this package for review.</p>
      ) : null}
      {feedback ? <p className="missing-callout">{feedback}</p> : null}
      <button className="button button-primary" data-qa="billing-v2-send-review" disabled={!readiness.isReady} onClick={onSendToReview} type="button">
        Send package to commercial review
      </button>
    </div>
  );
}
