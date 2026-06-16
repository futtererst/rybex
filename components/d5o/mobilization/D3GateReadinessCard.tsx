import { evaluateD3Gate } from "@/lib/d5o/d3-gate";
import {
  mobilizationDecisionLabels,
  mobilizationDecisionTone
} from "@/lib/d5o/mobilization-config";
import { chipClass } from "@/lib/d5o/presentation";
import type { MobilizationPlan, RybexProject } from "@/lib/d5o/types";

export function D3GateReadinessCard({
  plan,
  project,
  compact = false
}: {
  plan: MobilizationPlan;
  project?: RybexProject;
  compact?: boolean;
}) {
  const readiness = evaluateD3Gate(plan, project);

  return (
    <article className="gate-card">
      <div className="gate-heading">
        <div>
          <p className="eyebrow">D3 Readiness Gate</p>
          <h3>{readiness.readinessPercent}% ready</h3>
        </div>
        <span className={chipClass(mobilizationDecisionTone[readiness.recommendedDecision])}>
          {mobilizationDecisionLabels[readiness.recommendedDecision]}
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${readiness.readinessPercent}%` }} />
      </div>
      {!compact && (
        <div className="score-detail-grid">
          <ReadinessList title="Blockers" items={readiness.blockers} empty="No D3 blockers." />
          <ReadinessList title="Missing Items" items={readiness.missingRequiredItems} empty="No required items missing." />
          <ReadinessList title="Warnings" items={readiness.warnings} empty="No warnings." />
          <ReadinessList title="Next Actions" items={readiness.nextActions} empty="Approve field start." />
        </div>
      )}
    </article>
  );
}

function ReadinessList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
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
