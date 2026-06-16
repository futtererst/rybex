import type { PageReadinessStatus } from "@/lib/d5o/simplification/derive-page-readiness";

type ModuleStageHeaderProps = {
  stageLabel: string;
  purpose: string;
  status: PageReadinessStatus;
  d5oPhase: string;
  ownerRole: string;
  roleFocus: string;
};

const statusLabel: Record<PageReadinessStatus, string> = {
  ready: "Ready",
  blocked: "Blocked",
  at_risk: "At risk",
  complete: "Complete"
};

const statusTone: Record<PageReadinessStatus, string> = {
  ready: "success",
  blocked: "critical",
  at_risk: "warning",
  complete: "info"
};

export function ModuleStageHeader({
  stageLabel,
  purpose,
  status,
  d5oPhase,
  ownerRole,
  roleFocus
}: ModuleStageHeaderProps) {
  return (
    <section className={`module-stage-header module-stage-${status}`}>
      <div>
        <p className="eyebrow">{d5oPhase}</p>
        <h2>{stageLabel}</h2>
        <p>{purpose}</p>
      </div>
      <div className="module-stage-meta">
        <span className={`chip chip-${statusTone[status]}`}>{statusLabel[status]}</span>
        <span><strong>Owner:</strong> {ownerRole}</span>
        <span>{roleFocus}</span>
      </div>
    </section>
  );
}
