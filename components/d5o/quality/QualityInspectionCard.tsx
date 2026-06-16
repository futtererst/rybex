import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { inspectionTypeLabels, passFailLabels, qualityStatusLabels, qualityStatusTone } from "@/lib/d5o/quality-config";
import type { QualityInspection } from "@/lib/d5o/types";

export function QualityInspectionCard({ inspection }: { inspection: QualityInspection }) {
  return (
    <article className="project-card">
      <div className="card-title-row">
        <div>
          <h3>{inspection.title}</h3>
          <p>{inspection.projectName}</p>
        </div>
        <span className={chipClass(qualityStatusTone[inspection.status])}>{qualityStatusLabels[inspection.status]}</span>
      </div>
      <dl className="card-meta">
        <div><dt>Type</dt><dd>{inspectionTypeLabels[inspection.inspectionType]}</dd></div>
        <div><dt>Date</dt><dd>{dateLabel(inspection.date)}</dd></div>
        <div><dt>Inspector</dt><dd>{inspection.inspector}</dd></div>
        <div><dt>Result</dt><dd>{passFailLabels[inspection.passFailResult]}</dd></div>
      </dl>
      <p>{inspection.nextAction}</p>
      {(!inspection.photosComplete || !inspection.testsComplete) && (
        <p className="missing-callout">Evidence gap: photos/tests are not complete.</p>
      )}
    </article>
  );
}
