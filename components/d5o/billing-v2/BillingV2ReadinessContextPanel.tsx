import {
  formatBillingCurrency,
  getBillingV2StateDisplayLabel,
  type BillingBackupPackage,
  type BillingPackageReadiness
} from "@/lib/d5o/billing-v2";

type BillingV2ReadinessContextPanelProps = {
  billingPackage: BillingBackupPackage;
  readiness: BillingPackageReadiness;
  nextUnlock: string;
};

export function BillingV2ReadinessContextPanel({
  billingPackage,
  readiness,
  nextUnlock
}: BillingV2ReadinessContextPanelProps) {
  const requiredEvidence = billingPackage.evidenceRequirements.filter((item) => item.required);
  const completedEvidence = requiredEvidence.filter((item) =>
    readiness.satisfiedEvidenceIds.includes(item.id)
  );

  return (
    <aside className="panel" aria-label="Billing readiness context" data-qa="billing-v2-context-panel">
      <p className="eyebrow">Readiness context</p>
      <h3>{billingPackage.payApplicationLabel}</h3>
      <p className="missing-callout">
        {formatBillingCurrency(billingPackage.blockedAmount, billingPackage.currency)} blocked by missing backup.
      </p>
      <dl className="focused-task-grid">
        <div>
          <dt>Current state</dt>
          <dd>{getBillingV2StateDisplayLabel(billingPackage.state)}</dd>
        </div>
        <div>
          <dt>Package readiness</dt>
          <dd>{readiness.isReady ? "Ready for commercial review" : "Blocked by missing package items"}</dd>
        </div>
        <div>
          <dt>Evidence progress</dt>
          <dd data-qa="billing-v2-evidence-complete-count">
            {completedEvidence.length} of {requiredEvidence.length} complete
          </dd>
        </div>
        <div>
          <dt>Review status</dt>
          <dd>{billingPackage.reviewTask?.status.replaceAll("_", " ") ?? "Not sent"}</dd>
        </div>
        <div>
          <dt>Clearance status</dt>
          <dd>{billingPackage.blockerResolution ? "Cleared" : "Blocked until approval and resolution note"}</dd>
        </div>
      </dl>
      <div className="focused-task-next">
        <span>Next unlock</span>
        <strong>{nextUnlock}</strong>
      </div>
      {readiness.missingItems.length > 0 ? (
        <section>
          <p className="eyebrow">Still missing</p>
          <ul className="plain-list">
            {readiness.missingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="completion-mode-note">All required package items are satisfied.</p>
      )}
    </aside>
  );
}
