import Link from "next/link";
import {
  disciplineLabels,
  priorityLabels,
  priorityTone,
  rfiStatusLabels,
  rfiStatusTone
} from "@/lib/d5o/rfi-submittal-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { RFI } from "@/lib/d5o/types";

export function RfiCard({ rfi }: { rfi: RFI }) {
  return (
    <article className="opportunity-card" id={rfi.id}>
      <div className="opportunity-card-top">
        <div>
          <h3>{rfi.rfiNumber}: {rfi.title}</h3>
          <p className="muted">{rfi.projectName} | {disciplineLabels[rfi.discipline]} | due {dateLabel(rfi.dueDate)}</p>
        </div>
        <span className={chipClass(rfiStatusTone[rfi.status])}>{rfiStatusLabels[rfi.status]}</span>
      </div>
      <p className="muted">{rfi.question}</p>
      <div className="detail-grid">
        <div className="detail"><span>Assigned to</span><strong>{rfi.assignedTo || "Unassigned"}</strong></div>
        <div className="detail"><span>Priority</span><strong className={chipClass(priorityTone[rfi.priority])}>{priorityLabels[rfi.priority]}</strong></div>
        <div className="detail"><span>Schedule impact</span><strong>{rfi.scheduleImpact ? "Yes" : "No"}</strong></div>
        <div className="detail"><span>Cost impact</span><strong>{rfi.costImpact ? "Yes" : "No"}</strong></div>
      </div>
      {rfi.linkedChangeEventIds.length === 0 && (rfi.costImpact || rfi.scheduleImpact) ? (
        <p className="missing-callout">Impact exists but no change event is linked.</p>
      ) : (
        <p className="ready-callout">{rfi.linkedChangeEventIds.length} linked change event(s).</p>
      )}
      <div className="card-row">
        <span className="muted">{rfi.nextAction}</span>
        <Link className="button button-secondary" href="/rfis-submittals/rfi/new">Create RFI</Link>
      </div>
    </article>
  );
}
