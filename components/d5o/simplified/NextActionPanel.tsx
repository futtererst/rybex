import Link from "next/link";
import type { SimplifiedNextAction } from "@/lib/d5o/simplification/derive-next-actions";

type NextActionPanelProps = {
  actions: SimplifiedNextAction[];
};

const severityTone = {
  critical: "critical",
  high: "warning",
  watch: "info",
  info: "info",
  resolved: "success"
} as const;

export function NextActionPanel({ actions }: NextActionPanelProps) {
  return (
    <section className="simplified-panel">
      <div className="simplified-panel-heading">
        <p className="eyebrow">Required next</p>
        <h3>Next actions</h3>
      </div>
      <div className="next-action-list">
        {actions.slice(0, 3).map((action) => (
          <article className="next-action-card" key={action.id}>
            <div>
              <span className={`chip chip-${severityTone[action.severity]}`}>{action.severity}</span>
              <h4>{action.title}</h4>
            </div>
            <dl>
              <div>
                <dt>Owner</dt>
                <dd>{action.owner}</dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>{action.dueDate}</dd>
              </div>
            </dl>
            <p>{action.whyItMatters}</p>
            <Link className="button button-secondary" href={action.href}>{action.ctaLabel}</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
