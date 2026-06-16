import Link from "next/link";
import {
  backupStatusLabels,
  backupStatusTone,
  billingStatusLabels,
  billingStatusTone,
  changeStatusLabels,
  changeStatusTone,
  pricingStatusLabels,
  pricingStatusTone,
  sourceLabels
} from "@/lib/d5o/change-control-config";
import { chipClass, currency, dateLabel } from "@/lib/d5o/presentation";
import type { ChangeEvent } from "@/lib/d5o/types";

export function ChangeEventCard({ event }: { event: ChangeEvent }) {
  return (
    <article className="opportunity-card" id={event.id}>
      <div className="opportunity-card-top">
        <div>
          <h3>{event.changeNumber}: {event.title}</h3>
          <p className="muted">{event.projectName} | {sourceLabels[event.source]} | notice {dateLabel(event.noticeDeadline)}</p>
        </div>
        <span className={chipClass(changeStatusTone[event.status])}>{changeStatusLabels[event.status]}</span>
      </div>
      <p className="muted">{event.description}</p>
      <div className="detail-grid">
        <div className="detail"><span>Estimate</span><strong>{currency.format(event.costImpactEstimate)}</strong></div>
        <div className="detail"><span>Submitted</span><strong>{currency.format(event.submittedAmount)}</strong></div>
        <div className="detail"><span>Approved</span><strong>{currency.format(event.approvedAmount)}</strong></div>
        <div className="detail"><span>Owner</span><strong>{event.owner}</strong></div>
      </div>
      <div className="opportunity-score-row">
        <span className={chipClass(backupStatusTone[event.backupStatus])}>{backupStatusLabels[event.backupStatus]}</span>
        <span className={chipClass(pricingStatusTone[event.pricingStatus])}>{pricingStatusLabels[event.pricingStatus]}</span>
        <span className={chipClass(billingStatusTone[event.billingStatus])}>{billingStatusLabels[event.billingStatus]}</span>
      </div>
      <div className="card-row">
        <span className="muted">{event.requiredAction}</span>
        <Link className="button button-secondary" href="/changes/new">New Change</Link>
      </div>
    </article>
  );
}
