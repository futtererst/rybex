import { evaluateBillingControl } from "@/lib/d5o/billing-control";
import type {
  BillingBackupItem,
  ChangeEvent,
  CommercialExposureItem,
  LienWaiver,
  PayApplication
} from "@/lib/d5o/types";

export function BillingReadinessCard({
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
          <p className="eyebrow">Billing Readiness</p>
          <h3>Pay application control score</h3>
        </div>
        <strong>{summary.billingReadinessScore}%</strong>
      </div>
      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${summary.billingReadinessScore}%` }} />
      </div>
      <div className="score-detail-grid">
        <div>
          <h4>Missing backup</h4>
          {summary.missingBackupItems.length > 0 ? (
            <ul className="plain-list">
              {summary.missingBackupItems.slice(0, 5).map((item) => <li key={item.id}>{item.title}</li>)}
            </ul>
          ) : <p className="muted">Billing backup is complete.</p>}
        </div>
        <div>
          <h4>Lien waiver issues</h4>
          {summary.lienWaiverIssues.length > 0 ? (
            <ul className="plain-list">
              {summary.lienWaiverIssues.slice(0, 5).map((item) => <li key={item.id}>{item.waiverType} | {item.status}</li>)}
            </ul>
          ) : <p className="muted">Lien waiver status is controlled.</p>}
        </div>
      </div>
    </article>
  );
}
