import Link from "next/link";
import { dateLabel, severityTone } from "@/lib/d5o/presentation";
import type { OperatingActionItem as OperatingActionItemType } from "@/lib/d5o/types";
import { StatusChip } from "./StatusChip";

type OperatingActionCardProps = {
  action: OperatingActionItemType;
  projectName?: string;
  entityName?: string;
};

export function OperatingActionCard({ action, projectName, entityName }: OperatingActionCardProps) {
  const severityLabel = action.severity.charAt(0).toUpperCase() + action.severity.slice(1);
  const target = projectName ?? entityName ?? "Operating record";

  return (
    <article className={`action-item action-${action.severity}`}>
      <div className="action-heading">
        <div>
          <p className="eyebrow">{action.category}</p>
          <h3>{target}</h3>
        </div>
        <StatusChip label={severityLabel} tone={severityTone[action.severity]} />
      </div>
      <p>{action.businessImpact}</p>
      <div className="detail-grid">
        <div className="detail">
          <span>Owner</span>
          <strong>{action.owner}</strong>
        </div>
        <div className="detail">
          <span>Due</span>
          <strong>{dateLabel(action.dueDate)}</strong>
        </div>
      </div>
      <div className="card-row">
        <strong className="muted">{action.requiredAction}</strong>
        <Link className="button button-primary" href={action.href}>
          Open
        </Link>
      </div>
    </article>
  );
}
