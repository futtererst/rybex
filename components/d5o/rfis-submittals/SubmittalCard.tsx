import Link from "next/link";
import {
  disciplineLabels,
  priorityLabels,
  priorityTone,
  submittalStatusLabels,
  submittalStatusTone
} from "@/lib/d5o/rfi-submittal-config";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { Submittal } from "@/lib/d5o/types";

export function SubmittalCard({ submittal }: { submittal: Submittal }) {
  const blocksWork = submittal.linkedWorkPackageIds.length > 0 &&
    !["approved", "approved_as_noted", "closed"].includes(submittal.status);

  return (
    <article className="opportunity-card" id={submittal.id}>
      <div className="opportunity-card-top">
        <div>
          <h3>{submittal.submittalNumber}: {submittal.title}</h3>
          <p className="muted">{submittal.projectName} | {disciplineLabels[submittal.discipline]}</p>
        </div>
        <span className={chipClass(submittalStatusTone[submittal.status])}>
          {submittalStatusLabels[submittal.status]}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail"><span>Package</span><strong>{submittal.packageName}</strong></div>
        <div className="detail"><span>Reviewer</span><strong>{submittal.reviewer}</strong></div>
        <div className="detail"><span>Required</span><strong>{dateLabel(submittal.requiredDate)}</strong></div>
        <div className="detail"><span>Priority</span><strong className={chipClass(priorityTone[submittal.priority])}>{priorityLabels[submittal.priority]}</strong></div>
      </div>
      {blocksWork ? (
        <p className="missing-callout">Blocking {submittal.linkedWorkPackageIds.length} work package(s).</p>
      ) : (
        <p className="ready-callout">No active work-package block.</p>
      )}
      <div className="card-row">
        <span className="muted">{submittal.nextAction}</span>
        <Link className="button button-secondary" href="/rfis-submittals/submittal/new">New Submittal</Link>
      </div>
    </article>
  );
}
