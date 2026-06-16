import { evaluateChangeControl } from "@/lib/d5o/change-control";
import { currency } from "@/lib/d5o/presentation";
import type { ChangeEvent, DailyReport } from "@/lib/d5o/types";

export function ChangeControlScoreCard({
  events,
  dailyReports = []
}: {
  events: ChangeEvent[];
  dailyReports?: DailyReport[];
}) {
  const summary = evaluateChangeControl({ changeEvents: events, dailyReports });

  return (
    <article className="score-card">
      <div className="score-card-header">
        <div>
          <p className="eyebrow">Commercial Control</p>
          <h3>Change recovery score</h3>
        </div>
        <strong>{summary.commercialControlScore}%</strong>
      </div>
      <div className="progress-track" aria-label={`Commercial control score ${summary.commercialControlScore}%`}>
        <div className="progress-bar" style={{ width: `${summary.commercialControlScore}%` }} />
      </div>
      <div className="detail-grid">
        <div className="detail"><span>Notice risks</span><strong>{summary.noticeDeadlineRisks.length}</strong></div>
        <div className="detail"><span>Backup gaps</span><strong>{summary.missingBackupItems.length}</strong></div>
        <div className="detail"><span>Pricing needed</span><strong>{summary.pricingRequiredItems.length}</strong></div>
        <div className="detail"><span>Approved not billed</span><strong>{currency.format(summary.unbilledApprovedValue)}</strong></div>
      </div>
      {summary.requiredActions.length > 0 ? (
        <ul className="plain-list">
          {summary.requiredActions.slice(0, 4).map((action) => <li key={action}>{action}</li>)}
        </ul>
      ) : (
        <p className="muted">Change control is current.</p>
      )}
    </article>
  );
}
