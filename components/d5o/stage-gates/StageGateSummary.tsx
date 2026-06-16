import Link from "next/link";
import { StatusChip } from "@/components/d5o/StatusChip";
import { dateLabel } from "@/lib/d5o/presentation";
import type { D5OPhaseId } from "@/lib/d5o/types";

type StageGateSummaryProps = {
  phase: D5OPhaseId;
  gateName: string;
  status: string;
  readinessPercent: number;
  primaryBlocker?: string;
  requiredDecision: string;
  requiredAction: string;
  owner: string;
  dueDate?: string;
  evidenceNeeded: string[];
  nextMovement: string;
  primaryCta?: {
    label: string;
    href: string;
  };
};

const phaseLabels: Record<D5OPhaseId, string> = {
  discover: "D1 Discover",
  define: "D2 Define",
  prepare: "D3 Prepare",
  deliver: "D4 Deliver",
  close: "D5 Close",
  optimize: "O Optimize"
};

export function StageGateSummary({
  phase,
  gateName,
  status,
  readinessPercent,
  primaryBlocker,
  requiredDecision,
  requiredAction,
  owner,
  dueDate,
  evidenceNeeded,
  nextMovement,
  primaryCta
}: StageGateSummaryProps) {
  const tone = primaryBlocker
    ? "blocked"
    : readinessPercent >= 80
      ? "success"
      : readinessPercent >= 60
        ? "warning"
        : "critical";

  return (
    <section className={`stage-gate-summary stage-gate-${tone}`}>
      <div className="stage-gate-main">
        <p className="eyebrow">{phaseLabels[phase]}</p>
        <div className="stage-gate-title-row">
          <h2>{gateName}</h2>
          <StatusChip label={status} tone={tone} />
        </div>
        <div className="stage-gate-progress" aria-label={`Readiness ${readinessPercent}%`}>
          <span style={{ width: `${Math.max(0, Math.min(100, readinessPercent))}%` }} />
        </div>
      </div>

      <div className="stage-gate-quick-grid">
        <StageGateFact label="Blocker" value={primaryBlocker ?? "None blocking"} />
        <StageGateFact label="Decision" value={requiredDecision} />
        <StageGateFact label="Action" value={requiredAction} />
        <StageGateFact label="Owner" value={owner} />
        <StageGateFact label="Due" value={dueDate ? dateLabel(dueDate) : "No date"} />
        <StageGateFact label="Evidence" value={`${evidenceNeeded.length} required`} />
        <StageGateFact label="Next" value={nextMovement} />
      </div>

      <div className="stage-gate-evidence">
        <span>Evidence</span>
        <ul>
          {evidenceNeeded.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {primaryCta ? (
        <Link className="button button-primary" href={primaryCta.href}>
          {primaryCta.label}
        </Link>
      ) : null}
    </section>
  );
}

function StageGateFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
