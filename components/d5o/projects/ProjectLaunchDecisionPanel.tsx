import {
  launchDecisionLabels,
  launchDecisionTone
} from "@/lib/d5o/project-config";
import { chipClass } from "@/lib/d5o/presentation";
import type { ProjectLaunchDecision } from "@/lib/d5o/types";

export function ProjectLaunchDecisionPanel({
  decision,
  nextAction
}: {
  decision: ProjectLaunchDecision;
  nextAction: string;
}) {
  return (
    <article className="decision-panel">
      <p className="eyebrow">Launch Decision</p>
      <h3>
        <span className={chipClass(launchDecisionTone[decision])}>
          {launchDecisionLabels[decision]}
        </span>
      </h3>
      <p>{nextAction}</p>
    </article>
  );
}
