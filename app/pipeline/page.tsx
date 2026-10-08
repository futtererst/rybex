import Link from "next/link";
import { listOpportunityActions } from "@/lib/d5o/opportunities/supabase-repository";
import type { OpportunityAction } from "@/lib/d5o/opportunities/types";

export const metadata = {
  title: "Pipeline | RybexOS"
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PipelinePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const query = searchParams ? await searchParams : {};
  const state = readParam(query.state);
  if (state === "queue-unavailable") return <QueueUnavailable />;
  if (state === "loading-preview") return <QueueLoading />;
  if (state === "empty-assignment") return <EstimatorEmptyAssignments />;
  const result = await listOpportunityActions();
  if (!result.success) return <QueueUnavailable />;
  const opportunities = rankOpportunities(result.items);

  return (
    <main className="pipeline-experience" data-pipeline-screen="opportunity-queue">
      <header className="pipeline-topbar">
        <div>
          <p className="pipeline-kicker">Pipeline</p>
          <h1>Opportunity queue</h1>
          <p>{queueSummary(opportunities.length)}</p>
        </div>
        <div className="pipeline-toolbar" aria-label="Opportunity queue controls">
          <label className="pipeline-search">
            <span className="sr-only">Search opportunities</span>
            <input name="search" placeholder="Search opportunities" />
          </label>
          <details className="pipeline-filter">
            <summary>Filters</summary>
            <div>
              <p>Focus the queue by status, owner, or due date.</p>
            </div>
          </details>
          <Link className="button button-primary" href="/pipeline/new">
            New opportunity
          </Link>
        </div>
      </header>

      <section className="pipeline-queue-panel" aria-labelledby="opportunity-queue-title">
        <div className="pipeline-table-head">
          <span>Rank</span>
          <span id="opportunity-queue-title">Opportunity</span>
          <span>Why it is here</span>
          <span>Value</span>
          <span>Due</span>
          <span aria-hidden="true" />
        </div>

        {opportunities.length > 0 ? (
          <>
            <div className="pipeline-ranked-list">
              {opportunities.map((opportunity, index) => (
                <OpportunityRow
                  key={opportunity.id}
                  opportunity={opportunity}
                  rank={index + 1}
                  highlighted={index === 0}
                />
              ))}
            </div>
            {opportunities.length > 5 ? (
              <button className="pipeline-show-more" type="button">
                Show {opportunities.length - 5} more opportunities
              </button>
            ) : null}
          </>
        ) : (
          <div className="pipeline-state-card">
            <p className="pipeline-kicker">No opportunity work needs attention</p>
            <h2>Start with the next intake when a real pursuit is ready.</h2>
            <p>
              New opportunities appear here after intake begins. Qualification, evidence, and decision handoff work stay ranked by business consequence.
            </p>
            <Link className="button button-primary" href="/pipeline/new">
              Create opportunity intake
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function QueueUnavailable() {
  return (
    <main className="pipeline-experience" data-pipeline-screen="queue-unavailable">
      <header className="pipeline-topbar">
        <div>
          <p className="pipeline-kicker">Pipeline</p>
          <h1>Opportunity queue temporarily unavailable</h1>
          <p>No opportunity work changed. Return to Command Center or try the queue again.</p>
        </div>
        <Link className="button button-secondary" href="/command-center">Go to Command Center</Link>
      </header>
      <section className="pipeline-state-card">
        <h2>The queue cannot be refreshed right now.</h2>
        <p>Your saved opportunity records remain authoritative. Retry is safe and will not create duplicate submissions.</p>
        <Link className="button button-primary" href="/pipeline">Retry queue</Link>
      </section>
    </main>
  );
}

function QueueLoading() {
  return (
    <main className="pipeline-experience" data-pipeline-screen="queue-loading">
      <header className="pipeline-topbar">
        <div>
          <p className="pipeline-kicker">Pipeline</p>
          <h1>Opportunity queue</h1>
          <p>Loading the ranked work list.</p>
        </div>
      </header>
      <section className="pipeline-queue-panel" aria-label="Loading opportunity queue">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="pipeline-row pipeline-row-skeleton" key={index}>
            <div className="pipeline-rank">{index + 1}</div>
            <div className="pipeline-row-main"><h2>Preparing opportunity row</h2><p>Checking current responsibility and due date.</p></div>
            <div className="pipeline-row-reason"><strong>Loading rank reason</strong><span>Saved work is not changing.</span></div>
          </div>
        ))}
      </section>
    </main>
  );
}

function EstimatorEmptyAssignments() {
  return (
    <main className="pipeline-experience" data-pipeline-screen="estimator-empty">
      <header className="pipeline-topbar">
        <div>
          <p className="pipeline-kicker">Estimator assignment</p>
          <h1>No estimating assignments need action</h1>
          <p>Assigned estimating contributions will appear here with due date, return owner, and scoped evidence.</p>
        </div>
        <Link className="button button-primary" href="/command-center">Return to permitted work</Link>
      </header>
    </main>
  );
}

function OpportunityRow({
  opportunity,
  rank,
  highlighted
}: {
  opportunity: OpportunityAction & { priorityReason: PriorityReason };
  rank: number;
  highlighted: boolean;
}) {
  return (
    <article className={`pipeline-row ${highlighted ? "pipeline-row-primary" : ""}`}>
      <div className="pipeline-rank" aria-label={`Rank ${rank}`}>
        {rank}
      </div>
      <div className="pipeline-row-main">
        <h2>{opportunity.name}</h2>
        <p>
          {opportunity.customerGc} · {opportunity.location}
        </p>
      </div>
      <div className="pipeline-row-reason">
        <strong>{opportunity.priorityReason.title}</strong>
        <span>{opportunity.priorityReason.detail}</span>
      </div>
      <div className="pipeline-row-value">
        <span>Est. value</span>
        <strong>{formatMoney(opportunity.estimatedValue)}</strong>
      </div>
      <div className="pipeline-row-due">
        <span>Material due</span>
        <strong>{formatDate(opportunity.bidDueDate)}</strong>
      </div>
      <Link aria-label={`Open ${opportunity.name}`} className="pipeline-row-action" href={`/pipeline/${opportunity.id}`}>
        Open
      </Link>
    </article>
  );
}

type PriorityReason = {
  weight: number;
  title: string;
  detail: string;
};

function rankOpportunities(opportunities: OpportunityAction[]) {
  return opportunities
    .map((opportunity) => ({
      ...opportunity,
      priorityReason: getPriorityReason(opportunity)
    }))
    .sort((a, b) => {
      if (a.priorityReason.weight !== b.priorityReason.weight) return b.priorityReason.weight - a.priorityReason.weight;
      return dueTime(a.bidDueDate) - dueTime(b.bidDueDate);
    });
}

function getPriorityReason(opportunity: OpportunityAction): PriorityReason {
  const days = daysUntil(opportunity.bidDueDate);
  if (opportunity.lifecycleStatus === "decision_required") {
    if (opportunity.decisionReadinessStatus === "decision_approved") {
      return {
        weight: 980 - Math.max(days, 0),
        title: "Pursuit Authorization gate",
        detail: "Qualified in P1-01A; decide whether Rybex should pursue"
      };
    }
    return {
      weight: 900 - Math.max(days, 0),
      title: days <= 1 ? "Decision due now" : `Decision due ${formatRelativeDays(days)}`,
      detail: "Package is ready for assigned decision review"
    };
  }
  if (!opportunity.qualificationComplete && opportunity.lifecycleStatus === "qualifying") {
    return {
      weight: 700 - Math.max(days, 0),
      title: days <= 0 ? "Qualification blocker overdue" : `Bid due ${formatRelativeDays(days)}`,
      detail: "Qualification blocker needs action"
    };
  }
  if (!opportunity.ownerUserId) {
    return {
      weight: 650 - Math.max(days, 0),
      title: "Owner needed",
      detail: "Accountable owner must be confirmed"
    };
  }
  if (opportunity.estimatedValue && opportunity.estimatedValue >= 1_000_000) {
    return {
      weight: 500 + Math.min(opportunity.estimatedValue / 100_000, 120),
      title: `${formatMoney(opportunity.estimatedValue)} opportunity`,
      detail: "Commercial viability is next"
    };
  }
  return {
    weight: 300 - Math.max(days, 0),
    title: days <= 14 ? `Bid due ${formatRelativeDays(days)}` : "Intake ready",
    detail: opportunity.lifecycleStatus === "draft" ? "Opportunity fit has not started" : "Next qualification section is ready"
  };
}

function queueSummary(count: number) {
  if (count === 0) return "No opportunities require attention right now.";
  return `${count} opportunities require attention · ranked by deadline, blockers, and business value`;
}

function daysUntil(value: string | null) {
  if (!value) return 99;
  const due = new Date(`${value}T12:00:00`).getTime();
  const now = Date.now();
  return Math.ceil((due - now) / 86_400_000);
}

function dueTime(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
}

function formatRelativeDays(days: number) {
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function formatMoney(value: number | null) {
  return value === null
    ? "Not set"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
        notation: value >= 1_000_000 ? "compact" : "standard"
      }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
