import Link from "next/link";
import type { EndUserAction } from "@/lib/d5o/end-user/derive-primary-action";

type PrimaryActionCardProps = {
  action: EndUserAction;
};

const toneClass = {
  critical: "critical",
  high: "warning",
  watch: "info",
  info: "info",
  resolved: "success"
} as const;

export function PrimaryActionCard({ action }: PrimaryActionCardProps) {
  return (
    <article className={`end-user-primary-action end-user-${toneClass[action.severity]}`}>
      <div className="end-user-card-kicker">
        <span>Do next</span>
        <span className={`chip chip-${toneClass[action.severity]}`}>{action.severity}</span>
      </div>
      <h2>{action.title}</h2>
      <p>{action.whyItMatters}</p>
      <dl className="end-user-action-meta">
        <div>
          <dt>Owner</dt>
          <dd>{action.owner}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{action.dueDate}</dd>
        </div>
      </dl>
      <Link className="button button-primary" href={action.href}>
        {action.ctaLabel}
      </Link>
    </article>
  );
}
