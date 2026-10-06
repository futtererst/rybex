import type { BillingBackupPackage, BillingPackageReadiness } from "@/lib/d5o/billing-v2";

type BillingV2StepClearBlockerProps = {
  billingPackage: BillingBackupPackage;
  feedback: string | null;
  readiness: BillingPackageReadiness;
  resolutionNote: string;
  onClearBlocker: () => void;
  onResolutionNoteChange: (value: string) => void;
};

export function BillingV2StepClearBlocker({
  billingPackage,
  feedback,
  readiness,
  resolutionNote,
  onClearBlocker,
  onResolutionNoteChange
}: BillingV2StepClearBlockerProps) {
  return (
    <div data-qa="billing-v2-step-clear-blocker">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Clear billing blocker</p>
          <h2>Record why the blocker can move</h2>
          <p>Clearance requires an approved review, valid readiness, and a resolution note.</p>
        </div>
        <span className={`chip chip-${billingPackage.reviewDecision?.decision === "approved" ? "success" : "warning"}`}>
          {billingPackage.reviewDecision?.decision === "approved" ? "Review approved" : "Review not approved"}
        </span>
      </div>
      <dl className="completion-facts">
        <div>
          <dt>Approved review</dt>
          <dd>{billingPackage.reviewDecision?.decisionNote ?? "Missing approval"}</dd>
        </div>
        <div>
          <dt>Evidence package</dt>
          <dd>{readiness.isReady ? "Complete" : readiness.missingItems.join(", ")}</dd>
        </div>
        <div>
          <dt>Clearance impact</dt>
          <dd>{billingPackage.payApplicationLabel} backup is no longer the blocker to commercial review.</dd>
        </div>
      </dl>
      <label className="form-field-wide">
        <span>Resolution note</span>
        <textarea
          data-qa="billing-v2-resolution-note-input"
          onChange={(event) => onResolutionNoteChange(event.target.value)}
          placeholder={`Commercial review approved the backup package. ${billingPackage.payApplicationLabel} can move to pay application review.`}
          value={resolutionNote}
        />
      </label>
      {feedback ? <p className="missing-callout">{feedback}</p> : null}
      <button className="button button-primary" data-qa="billing-v2-clear-blocker" onClick={onClearBlocker} type="button">
        Clear billing blocker
      </button>
    </div>
  );
}
