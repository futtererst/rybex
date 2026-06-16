import { evaluateD2Gate } from "@/lib/d5o/d2-gate";
import { launchDecisionLabels, launchDecisionTone } from "@/lib/d5o/project-config";
import { chipClass } from "@/lib/d5o/presentation";
import type { RybexProject } from "@/lib/d5o/types";

type D2GateReadinessCardProps = {
  project: RybexProject;
  compact?: boolean;
};

export function D2GateReadinessCard({ project, compact = false }: D2GateReadinessCardProps) {
  const readiness = evaluateD2Gate(project);

  return (
    <article className="gate-card">
      <div className="gate-heading">
        <div>
          <p className="eyebrow">D2 Define Gate</p>
          <h3>{readiness.readinessPercent}% ready</h3>
        </div>
        <span className={chipClass(launchDecisionTone[readiness.recommendedDecision])}>
          {launchDecisionLabels[readiness.recommendedDecision]}
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${readiness.readinessPercent}%` }} />
      </div>
      {!compact && (
        <div className="score-detail-grid">
          <GateList title="Blockers" items={readiness.blockers} empty="No D2 blockers." />
          <GateList title="Missing Artifacts" items={readiness.missingRequiredArtifacts} empty="No required artifacts missing." />
          <GateList title="Warnings" items={readiness.warnings} empty="No warnings." />
          <GateList title="Next Actions" items={readiness.nextActions} empty="No next action required." />
        </div>
      )}
    </article>
  );
}

function GateList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul className="plain-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}
