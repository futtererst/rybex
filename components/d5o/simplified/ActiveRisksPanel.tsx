import Link from "next/link";
import type { OperatingNotification } from "@/lib/d5o/notifications/types";

type ActiveRisksPanelProps = {
  risks: OperatingNotification[];
};

const severityTone = {
  critical: "critical",
  high: "warning",
  watch: "info",
  info: "info",
  resolved: "success"
} as const;

export function ActiveRisksPanel({ risks }: ActiveRisksPanelProps) {
  return (
    <section className="simplified-panel">
      <div className="simplified-panel-heading">
        <p className="eyebrow">Blocked by</p>
        <h3>Active risks</h3>
      </div>
      {risks.length > 0 ? (
        <ul className="risk-mini-list">
          {risks.slice(0, 4).map((risk) => (
            <li key={risk.id}>
              <span className={`chip chip-${severityTone[risk.severity]}`}>{risk.severity}</span>
              <span>
                <strong>{risk.title}</strong>
                <small>{risk.requiredAction}</small>
              </span>
              <Link className="quiet-link" href={risk.targetHref}>Resolve</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No active critical or high escalation surfaced.</p>
      )}
    </section>
  );
}
