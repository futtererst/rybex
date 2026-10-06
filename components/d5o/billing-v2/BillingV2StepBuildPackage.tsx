type BillingV2StepBuildPackageProps = {
  amountAffected: string;
  backupSummary: string;
  feedback: string | null;
  relatedSourceRecord: string;
  savedAmountAffected?: number;
  savedBackupSummary?: string;
  savedRelatedSourceRecord?: string;
  onAmountAffectedChange: (value: string) => void;
  onBackupSummaryChange: (value: string) => void;
  onRelatedSourceRecordChange: (value: string) => void;
  onSaveAndContinue: () => void;
};

export function BillingV2StepBuildPackage({
  amountAffected,
  backupSummary,
  feedback,
  relatedSourceRecord,
  savedAmountAffected,
  savedBackupSummary,
  savedRelatedSourceRecord,
  onAmountAffectedChange,
  onBackupSummaryChange,
  onRelatedSourceRecordChange,
  onSaveAndContinue
}: BillingV2StepBuildPackageProps) {
  return (
    <div data-qa="billing-v2-step-build-package">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Build backup package</p>
          <h2>Document the package details</h2>
          <p>Capture the business explanation, source record, and amount affected before proof is assembled.</p>
        </div>
      </div>
      <div className="form-grid">
        <label className="form-field-wide">
          <span>Backup summary</span>
          <textarea
            data-qa="billing-v2-backup-summary-input"
            onChange={(event) => onBackupSummaryChange(event.target.value)}
            placeholder="Stored material support and product approval backup are required before PA-001 review."
            value={backupSummary}
          />
        </label>
        <label>
          <span>Related source record</span>
          <input
            data-qa="billing-v2-related-source-input"
            onChange={(event) => onRelatedSourceRecordChange(event.target.value)}
            placeholder="bb-lake-001 / vault and handhole product approval"
            value={relatedSourceRecord}
          />
        </label>
        <label>
          <span>Amount affected</span>
          <input
            data-qa="billing-v2-amount-input"
            inputMode="decimal"
            onChange={(event) => onAmountAffectedChange(event.target.value)}
            placeholder="38500"
            value={amountAffected}
          />
        </label>
      </div>
      <div className="focused-task-next">
        <span>What unlocks next</span>
        <strong>Saving valid package details unlocks the required proof package.</strong>
      </div>
      {savedBackupSummary || savedRelatedSourceRecord || savedAmountAffected ? (
        <dl className="completion-facts">
          {savedBackupSummary ? (
            <div>
              <dt>Saved summary</dt>
              <dd>{savedBackupSummary}</dd>
            </div>
          ) : null}
          {savedRelatedSourceRecord ? (
            <div>
              <dt>Saved source</dt>
              <dd>{savedRelatedSourceRecord}</dd>
            </div>
          ) : null}
          {savedAmountAffected ? (
            <div>
              <dt>Saved amount</dt>
              <dd>${savedAmountAffected.toLocaleString("en-US", { maximumFractionDigits: 0 })}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {feedback ? <p className="missing-callout">{feedback}</p> : null}
      <button className="button button-primary" data-qa="billing-v2-save-package" onClick={onSaveAndContinue} type="button">
        Save package details and continue
      </button>
    </div>
  );
}
