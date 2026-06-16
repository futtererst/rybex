import {
  mobilizationDecisionLabels,
  mobilizationDecisionTone
} from "@/lib/d5o/mobilization-config";
import { chipClass } from "@/lib/d5o/presentation";
import type { MobilizationDecision } from "@/lib/d5o/types";

export function MobilizationDecisionPanel({
  decision,
  nextAction
}: {
  decision: MobilizationDecision;
  nextAction: string;
}) {
  return (
    <article className="decision-panel">
      <p className="eyebrow">Field-Start Decision</p>
      <h3>
        <span className={chipClass(mobilizationDecisionTone[decision])}>
          {mobilizationDecisionLabels[decision]}
        </span>
      </h3>
      <p>{nextAction}</p>
    </article>
  );
}
