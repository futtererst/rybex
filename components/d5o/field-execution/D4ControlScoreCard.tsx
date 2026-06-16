import { evaluateD4Gate } from "@/lib/d5o/d4-gate";
import {
  fieldDecisionLabels,
  fieldDecisionTone,
  productionStatusLabels,
  productionStatusTone
} from "@/lib/d5o/field-execution-config";
import { chipClass } from "@/lib/d5o/presentation";
import type { DailyReport, MobilizationPlan, RybexProject, WorkPackage } from "@/lib/d5o/types";

type D4ControlScoreCardProps = {
  reports: DailyReport[];
  workPackages: WorkPackage[];
  mobilizationPlan?: MobilizationPlan;
  project?: RybexProject;
  compact?: boolean;
};

export function D4ControlScoreCard({
  reports,
  workPackages,
  mobilizationPlan,
  project,
  compact = false
}: D4ControlScoreCardProps) {
  const readiness = evaluateD4Gate({ reports, workPackages, mobilizationPlan, project });

  return (
    <article className="score-card">
      <div className="score-card-header">
        <div>
          <p className="eyebrow">D4 Control Score</p>
          <h3>{project?.name ?? reports[0]?.projectName ?? "Field execution control"}</h3>
        </div>
        <span className={chipClass(fieldDecisionTone[readiness.recommendedDecision])}>
          {fieldDecisionLabels[readiness.recommendedDecision]}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail">
          <span>Control score</span>
          <strong>{readiness.controlScore}%</strong>
        </div>
        <div className="detail">
          <span>Production</span>
          <strong className={chipClass(productionStatusTone[readiness.productionHealth])}>
            {productionStatusLabels[readiness.productionHealth]}
          </strong>
        </div>
        <div className="detail">
          <span>Documentation</span>
          <strong>{readiness.documentationHealth.replace("_", " ")}</strong>
        </div>
        <div className="detail">
          <span>Closeout review</span>
          <strong>{readiness.readyForCloseoutReviewBoolean ? "Ready" : "Not ready"}</strong>
        </div>
      </div>
      <div className="progress-track" aria-label={`D4 control score ${readiness.controlScore}%`}>
        <div className="progress-bar" style={{ width: `${readiness.controlScore}%` }} />
      </div>
      {!compact && (
        <div className="score-detail-grid">
          <div>
            <h4>Missing records</h4>
            {readiness.missingRequiredRecords.length > 0 ? (
              <ul className="plain-list">
                {readiness.missingRequiredRecords.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Required D4 records are in place.</p>
            )}
          </div>
          <div>
            <h4>Required actions</h4>
            {readiness.requiredActions.length > 0 ? (
              <ul className="plain-list">
                {readiness.requiredActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No immediate D4 action required.</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
