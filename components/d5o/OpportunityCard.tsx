import Link from "next/link";
import { calculateGoNoGo } from "@/lib/d5o/go-no-go";
import {
  opportunityStatusMap,
  recommendationLabels,
  recommendationTone,
  riskLevelLabels,
  riskLevelTone,
  serviceLineLabels
} from "@/lib/d5o/opportunity-config";
import { chipClass, compactCurrency, dateLabel } from "@/lib/d5o/presentation";
import type { Opportunity } from "@/lib/d5o/types";

type OpportunityCardProps = {
  opportunity: Opportunity;
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const score = calculateGoNoGo(opportunity);
  const status = opportunityStatusMap[opportunity.status];
  const canStartProjectSetup =
    opportunity.status === "approved_to_bid" ||
    opportunity.status === "estimating" ||
    opportunity.status === "won" ||
    opportunity.decision === "approve_to_bid";

  return (
    <article className="opportunity-card">
      <div className="opportunity-card-top">
        <div>
          <h3>{opportunity.name}</h3>
          <p className="muted">{opportunity.gcClient}</p>
        </div>
        <span className={chipClass(status.tone)}>{status.label}</span>
      </div>

      <div className="detail-grid">
        <div className="detail">
          <span>Location</span>
          <strong>{opportunity.projectLocation}</strong>
        </div>
        <div className="detail">
          <span>Value</span>
          <strong>{compactCurrency.format(opportunity.estimatedValue)}</strong>
        </div>
        <div className="detail">
          <span>Bid Due</span>
          <strong>{dateLabel(opportunity.bidDueDate)}</strong>
        </div>
        <div className="detail">
          <span>Owner</span>
          <strong>{opportunity.pursuitOwner}</strong>
        </div>
      </div>

      <p className="muted">
        {opportunity.serviceLines.map((line) => serviceLineLabels[line]).join(", ")}
      </p>

      <div className="opportunity-score-row">
        <span className={chipClass(recommendationTone[score.recommendation])}>
          {recommendationLabels[score.recommendation]}
        </span>
        <span className={chipClass(riskLevelTone[score.riskLevel])}>
          {riskLevelLabels[score.riskLevel]} Risk
        </span>
        <strong>{score.totalScore}/100</strong>
      </div>

      <div className="card-row">
        <span className="muted">{opportunity.nextAction}</span>
        <span className="inline-actions">
          {canStartProjectSetup && (
            <Link className="button button-primary" href="/projects/new">
              Setup Project
            </Link>
          )}
          <Link className="button button-secondary" href={`/pipeline#${opportunity.id}`}>
            Review
          </Link>
        </span>
      </div>
    </article>
  );
}
