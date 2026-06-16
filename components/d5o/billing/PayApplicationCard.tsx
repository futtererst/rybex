import Link from "next/link";
import {
  billingBackupStatusLabels,
  billingBackupStatusTone,
  lienWaiverStatusLabels,
  lienWaiverStatusTone,
  payApplicationStatusLabels,
  payApplicationStatusTone
} from "@/lib/d5o/billing-config";
import { chipClass, currency, dateLabel } from "@/lib/d5o/presentation";
import type { PayApplication } from "@/lib/d5o/types";

export function PayApplicationCard({ payApplication }: { payApplication: PayApplication }) {
  return (
    <article className="opportunity-card" id={payApplication.id}>
      <div className="opportunity-card-top">
        <div>
          <h3>{payApplication.payApplicationNumber}: {payApplication.projectName}</h3>
          <p className="muted">
            {dateLabel(payApplication.billingPeriodStart)} to {dateLabel(payApplication.billingPeriodEnd)}
          </p>
        </div>
        <span className={chipClass(payApplicationStatusTone[payApplication.status])}>
          {payApplicationStatusLabels[payApplication.status]}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail"><span>Requested</span><strong>{currency.format(payApplication.amountRequestedThisPeriod)}</strong></div>
        <div className="detail"><span>Approved</span><strong>{currency.format(payApplication.amountApprovedThisPeriod)}</strong></div>
        <div className="detail"><span>Paid</span><strong>{currency.format(payApplication.amountPaidThisPeriod)}</strong></div>
        <div className="detail"><span>Retainage held</span><strong>{currency.format(payApplication.totalRetainageHeld)}</strong></div>
      </div>
      <div className="opportunity-score-row">
        <span className={chipClass(billingBackupStatusTone[payApplication.backupStatus])}>
          {billingBackupStatusLabels[payApplication.backupStatus]}
        </span>
        <span className={chipClass(lienWaiverStatusTone[payApplication.lienWaiverStatus])}>
          {lienWaiverStatusLabels[payApplication.lienWaiverStatus]}
        </span>
      </div>
      {payApplication.excludedApprovedChangeEventIds.length > 0 && (
        <p className="missing-callout">
          {payApplication.excludedApprovedChangeEventIds.length} approved change(s) excluded from this pay app.
        </p>
      )}
      <div className="card-row">
        <span className="muted">{payApplication.nextAction}</span>
        <Link className="button button-secondary" href="/billing/pay-application/new">New Pay App</Link>
      </div>
    </article>
  );
}
