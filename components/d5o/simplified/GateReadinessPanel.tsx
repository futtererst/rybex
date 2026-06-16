import type { PageReadinessItem } from "@/lib/d5o/simplification/derive-page-readiness";

type GateReadinessPanelProps = {
  items: PageReadinessItem[];
};

const readinessTone = {
  ready: "success",
  blocking: "critical",
  pending: "warning"
} as const;

export function GateReadinessPanel({ items }: GateReadinessPanelProps) {
  return (
    <section className="simplified-panel">
      <div className="simplified-panel-heading">
        <p className="eyebrow">Ready when</p>
        <h3>Gate readiness</h3>
      </div>
      <ul className="readiness-checklist">
        {items.map((item) => (
          <li key={item.id}>
            <span className={`artifact-state artifact-${item.status === "ready" ? "complete" : item.status === "blocking" ? "missing" : "pending"}`} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
            <span className={`chip chip-${readinessTone[item.status]}`}>{item.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
