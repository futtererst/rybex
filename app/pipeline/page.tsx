import Link from "next/link";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { OpportunityCard } from "@/components/d5o/OpportunityCard";
import { OpportunityRiskPanel } from "@/components/d5o/OpportunityRiskPanel";
import { OpportunityTable } from "@/components/d5o/OpportunityTable";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import { calculateGoNoGo } from "@/lib/d5o/go-no-go";
import {
  activePipelineStatuses,
  decisionLabels,
  opportunityStatusMap,
  pipelineBoardStatuses,
  recommendationLabels,
  recommendationTone,
  riskLevelLabels,
  riskLevelTone
} from "@/lib/d5o/opportunity-config";
import { gcPerformanceProfiles, opportunities, riskLibraryItems } from "@/lib/d5o/seed-data";
import { chipClass, compactCurrency, currency, dateLabel } from "@/lib/d5o/presentation";
import type { Opportunity } from "@/lib/d5o/types";

const operatingDate = "2026-06-10";

const activeOpportunities = opportunities.filter((opportunity) =>
  activePipelineStatuses.includes(opportunity.status)
);
const pipelineValue = activeOpportunities.reduce(
  (total, opportunity) => total + opportunity.estimatedValue,
  0
);
const dueSoon = activeOpportunities.filter((opportunity) => daysUntil(opportunity.bidDueDate) <= 7);
const awaitingDecision = activeOpportunities.filter(
  (opportunity) => opportunity.status === "awaiting_go_no_go"
);
const highRisk = activeOpportunities.filter((opportunity) =>
  ["high", "severe"].includes(calculateGoNoGo(opportunity).riskLevel)
);
const approvedPursuits = activeOpportunities.filter(
  (opportunity) =>
    opportunity.status === "approved_to_bid" ||
    opportunity.status === "estimating" ||
    opportunity.decision === "approve_to_bid"
);
const upcomingDeadlines = [...activeOpportunities]
  .sort((a, b) => a.bidDueDate.localeCompare(b.bidDueDate))
  .slice(0, 6);
const recentIntake = [...opportunities]
  .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate))
  .slice(0, 5);

export const metadata = {
  title: "Pipeline | RybexOS"
};

export default function PipelinePage() {
  return (
    <div className="command-grid pipeline-page">
      <PageHeader
        context={`Reporting context: ${dateLabel(operatingDate)}`}
        eyebrow="D1 Discover"
        primaryAction={{ href: "/pipeline/new", label: "New Opportunity", tone: "primary" }}
        secondaryActions={[{ href: "/command-center", label: "Command Center" }]}
        subtitle="Qualify subcontractor opportunities before estimating resources are committed."
        tags={["Go / no-go discipline"]}
        title="Pipeline"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("pipeline")} />

      <CollapsedDetails
        title="Pipeline details"
        summary="Opportunity board, go/no-go scoring, bid calendar, and pursuit intelligence."
      >
      <section className="pipeline-guardrail">
        <strong>D1 pursuit discipline:</strong>
        <span>
          Estimating resources should not be committed until the D1 pursuit gate is approved.
          Holds, exclusions, and no-bid decisions protect margin before takeoff starts.
        </span>
      </section>

      <section className="pipeline-guardrail">
        <strong>Optimize intelligence:</strong>
        <span>
          GC performance history and risk-library updates should influence pursuit posture. Review <Link href="/reports">Optimize</Link> before approving high-risk pursuits.
        </span>
      </section>

      <WorkflowModuleContext
        queueTitle="Pursuit workflow actions"
        workflowType="pursuit_control"
      />

      <section className="metrics-grid" aria-label="Pipeline summary">
        <PipelineSummaryMetric
          detail="Open D1/D2 pursuits"
          label="Open Opportunities"
          value={activeOpportunities.length}
        />
        <PipelineSummaryMetric
          detail="Estimated opportunity value"
          label="Bid Value"
          value={compactCurrency.format(pipelineValue)}
        />
        <PipelineSummaryMetric
          detail="Bids due in next 7 days"
          label="Deadline Pressure"
          tone={dueSoon.length > 0 ? "warning" : "success"}
          value={dueSoon.length}
        />
        <PipelineSummaryMetric
          detail="Need D1 pursuit gate decision"
          label="Awaiting Go/No-Go"
          tone="warning"
          value={awaitingDecision.length}
        />
        <PipelineSummaryMetric
          detail="High or severe pursuit exposure"
          label="High Risk"
          tone={highRisk.length > 0 ? "critical" : "success"}
          value={highRisk.length}
        />
        <PipelineSummaryMetric
          detail="Approved for estimating or bid"
          label="Approved Pursuits"
          tone="success"
          value={approvedPursuits.length}
        />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">D1 Intelligence Inputs</p>
            <h2>GC posture and risk updates that should shape go/no-go scoring</h2>
          </div>
          <Link className="button button-secondary" href="/reports">Optimize</Link>
        </div>
        <div className="operating-columns">
          {gcPerformanceProfiles
            .filter((profile) => ["caution", "avoid", "pursue_with_controls"].includes(profile.recommendedPursuitPosture))
            .slice(0, 3)
            .map((profile) => (
              <section className="control-list" key={profile.id}>
                <h3>{profile.gcClient}</h3>
                <p>{profile.notes}</p>
                <p className="missing-callout">Pursuit posture: {profile.recommendedPursuitPosture.replaceAll("_", " ")}</p>
              </section>
            ))}
          {riskLibraryItems
            .filter((risk) => risk.shouldUpdateGoNoGoScoring)
            .slice(0, 3)
            .map((risk) => (
              <section className="control-list" key={risk.id}>
                <h3>{risk.title}</h3>
                <p>{risk.recommendedMitigation}</p>
                <p className="missing-callout">Update D1 scoring before similar pursuits.</p>
              </section>
            ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Opportunity Board</p>
            <h2>Governed pursuit status</h2>
          </div>
          <span className="muted">Grouped by D1/D2 control status</span>
        </div>
        <div className="pipeline-board">
          {pipelineBoardStatuses.map((statusId) => {
            const status = opportunityStatusMap[statusId];
            const statusOpportunities = activeOpportunities.filter(
              (opportunity) => opportunity.status === statusId
            );

            return (
              <section className="pipeline-lane" key={statusId}>
                <div className="phase-lane-header">
                  <div>
                    <strong>{status.label}</strong>
                    <p className="muted">{status.description}</p>
                  </div>
                  <span className={chipClass(status.tone)}>{statusOpportunities.length}</span>
                </div>
                <div className="project-stack">
                  {statusOpportunities.length > 0 ? (
                    statusOpportunities.map((opportunity) => (
                      <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                    ))
                  ) : (
                    <p className="muted">No opportunities in this status.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <div className="content-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Go/No-Go Queue</p>
              <h2>Decisions needed before estimating starts</h2>
            </div>
            <span className="muted">{awaitingDecision.length} awaiting decision</span>
          </div>
          <div className="project-stack">
            {awaitingDecision.map((opportunity) => (
              <DecisionQueueItem key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        </section>

        <aside className="panel">
          <p className="eyebrow">Bid Calendar</p>
          <h2>Upcoming deadlines</h2>
          <ul className="deadline-list">
            {upcomingDeadlines.map((opportunity) => (
              <li key={opportunity.id}>
                <div>
                  <strong>{opportunity.name}</strong>
                  <small className="muted">
                    {opportunity.gcClient} | due {dateLabel(opportunity.bidDueDate)}
                  </small>
                </div>
                <span className={daysUntil(opportunity.bidDueDate) <= 7 ? "chip chip-warning" : "chip chip-neutral"}>
                  {daysUntil(opportunity.bidDueDate)} days
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="content-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">High-Risk Pursuits</p>
              <h2>Mitigation required before approval</h2>
            </div>
            <span className="muted">{highRisk.length} high-risk opportunities</span>
          </div>
          <div className="project-stack">
            {highRisk.map((opportunity) => {
              const score = calculateGoNoGo(opportunity);

              return (
                <article className="opportunity-detail-panel" key={opportunity.id}>
                  <div className="status-row">
                    <div>
                      <h3>{opportunity.name}</h3>
                      <p className="muted">{opportunity.scopeSummary}</p>
                    </div>
                    <span className={chipClass(riskLevelTone[score.riskLevel])}>
                      {riskLevelLabels[score.riskLevel]} Risk
                    </span>
                  </div>
                  <OpportunityRiskPanel risks={opportunity.riskFactors} />
                </article>
              );
            })}
          </div>
        </section>

        <aside className="panel">
          <p className="eyebrow">Recent Intake</p>
          <h2>Next actions</h2>
          <ul className="compact-list">
            {recentIntake.map((opportunity) => (
              <li key={opportunity.id}>
                <span className="artifact-state artifact-pending" />
                <span>
                  <strong>{opportunity.name}</strong>
                  <small className="muted">
                    Received {dateLabel(opportunity.receivedDate)} | owner{" "}
                    {opportunity.nextActionOwner}
                  </small>
                  <p>{opportunity.nextAction}</p>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pipeline Control Table</p>
            <h2>All opportunity qualification records</h2>
          </div>
          <span className="muted">Score, risk, decision, and next action in one view</span>
        </div>
        <OpportunityTable opportunities={opportunities} />
      </section>
      </CollapsedDetails>
    </div>
  );
}

function DecisionQueueItem({ opportunity }: { opportunity: Opportunity }) {
  const score = calculateGoNoGo(opportunity);

  return (
    <article className="decision-item">
      <div className="status-row">
        <div>
          <h3>{opportunity.name}</h3>
          <p className="muted">
            {opportunity.gcClient} | {currency.format(opportunity.estimatedValue)} | bid due{" "}
            {dateLabel(opportunity.bidDueDate)}
          </p>
        </div>
        <span className={chipClass(recommendationTone[score.recommendation])}>
          {recommendationLabels[score.recommendation]}
        </span>
      </div>
      <p>{opportunity.nextAction}</p>
      <div className="detail-grid">
        <div className="detail">
          <span>Decision</span>
          <strong>{decisionLabels[opportunity.decision]}</strong>
        </div>
        <div className="detail">
          <span>Owner</span>
          <strong>{opportunity.nextActionOwner}</strong>
        </div>
      </div>
    </article>
  );
}

function daysUntil(date: string) {
  const now = new Date(`${operatingDate}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);

  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
}
