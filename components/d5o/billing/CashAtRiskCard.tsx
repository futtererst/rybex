import { evaluateBillingControl } from "@/lib/d5o/billing-control";
import { currency } from "@/lib/d5o/presentation";
import type {
  BillingBackupItem,
  ChangeEvent,
  CommercialExposureItem,
  LienWaiver,
  PayApplication
} from "@/lib/d5o/types";

export function CashAtRiskCard({
  payApplications,
  backupItems,
  lienWaivers,
  commercialExposure,
  changeEvents
}: {
  payApplications: PayApplication[];
  backupItems: BillingBackupItem[];
  lienWaivers: LienWaiver[];
  commercialExposure: CommercialExposureItem[];
  changeEvents: ChangeEvent[];
}) {
  const summary = evaluateBillingControl({
    payApplications,
    backupItems,
    lienWaivers,
    commercialExposure,
    changeEvents
  });

  return (
    <article className="score-card">
      <div className="score-card-header">
        <div>
          <p className="eyebrow">Cash at Risk</p>
          <h3>{currency.format(summary.cashAtRisk)}</h3>
        </div>
        <strong>{summary.billingReadinessScore}%</strong>
      </div>
      <div className="progress-track" aria-label={`Billing readiness ${summary.billingReadinessScore}%`}>
        <div className="progress-bar" style={{ width: `${summary.billingReadinessScore}%` }} />
      </div>
      <div className="detail-grid">
        <div className="detail"><span>Unbilled approved</span><strong>{currency.format(summary.unbilledApprovedChangeValue)}</strong></div>
        <div className="detail"><span>Pending exposure</span><strong>{currency.format(summary.pendingChangeExposure)}</strong></div>
        <div className="detail"><span>Disputed changes</span><strong>{currency.format(summary.disputedChangeValue)}</strong></div>
        <div className="detail"><span>Retainage held</span><strong>{currency.format(summary.retainageHeld)}</strong></div>
      </div>
      {summary.requiredActions.length > 0 ? (
        <ul className="plain-list">
          {summary.requiredActions.slice(0, 5).map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No immediate billing control actions.</p>
      )}
    </article>
  );
}
