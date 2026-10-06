import type { BillingBackupPackage } from "@/lib/d5o/billing-v2";

type BillingV2StepReviewDecisionProps = {
  billingPackage: BillingBackupPackage;
  decisionNote: string;
  feedback: string | null;
  onApprove: () => void;
  onDecisionNoteChange: (value: string) => void;
  onReject: () => void;
  onRequestChanges: () => void;
};

export function BillingV2StepReviewDecision({
  billingPackage,
  decisionNote,
  feedback,
  onApprove,
  onDecisionNoteChange,
  onReject,
  onRequestChanges
}: BillingV2StepReviewDecisionProps) {
  return (
    <div data-qa="billing-v2-step-review-decision">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Record review decision</p>
          <h2>Commercial review decision</h2>
          <p>The reviewer must approve, request changes, or reject the package before the billing blocker can move.</p>
        </div>
        <span className="chip chip-warning">{billingPackage.reviewTask?.status.replaceAll("_", " ") ?? "pending"}</span>
      </div>
      <dl className="completion-facts">
        <div>
          <dt>Assigned role</dt>
          <dd>{billingPackage.reviewTask?.assignedRole ?? "Commercial Review"}</dd>
        </div>
        <div>
          <dt>Review task</dt>
          <dd>{billingPackage.reviewTask?.id ?? "Not created"}</dd>
        </div>
        <div>
          <dt>Decision required</dt>
          <dd>Approval is required before blocker clearance.</dd>
        </div>
      </dl>
      <label className="form-field-wide">
        <span>Decision note</span>
        <textarea
          data-qa="billing-v2-review-note-input"
          onChange={(event) => onDecisionNoteChange(event.target.value)}
          placeholder={`Package evidence supports ${billingPackage.payApplicationLabel} commercial review.`}
          value={decisionNote}
        />
      </label>
      <div className="completion-action-row">
        <button className="button button-primary" data-qa="billing-v2-approve-review" onClick={onApprove} type="button">
          Approve package
        </button>
        <button className="button button-secondary" data-qa="billing-v2-request-changes" onClick={onRequestChanges} type="button">
          Request changes
        </button>
        <button className="button button-secondary" data-qa="billing-v2-reject-review" onClick={onReject} type="button">
          Reject package
        </button>
      </div>
      {feedback ? <p className="missing-callout">{feedback}</p> : null}
    </div>
  );
}
