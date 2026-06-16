import { chipClass, compactCurrency } from "@/lib/d5o/presentation";
import { scoreTone } from "@/lib/d5o/optimize-config";
import type { ProjectPerformanceScorecard as Scorecard } from "@/lib/d5o/types";

export function ProjectPerformanceScorecard({ scorecard }: { scorecard: Scorecard }) {
  return (
    <article className="project-card">
      <div className="card-title-row">
        <div>
          <h3>{scorecard.projectName}</h3>
          <p>{scorecard.gcClient} | {scorecard.location}</p>
        </div>
        <span className={chipClass(scoreTone(scorecard.overallProjectScore))}>{scorecard.overallProjectScore}</span>
      </div>
      <dl className="card-meta">
        <div><dt>Final Value</dt><dd>{compactCurrency.format(scorecard.finalContractValue)}</dd></div>
        <div><dt>Margin Var.</dt><dd>{scorecard.marginVariance} pts</dd></div>
        <div><dt>Schedule Var.</dt><dd>{scorecard.scheduleVarianceDays} days</dd></div>
        <div><dt>Change Recovery</dt><dd>{scorecard.changeRecoveryRate}%</dd></div>
      </dl>
      <p><strong>Win:</strong> {scorecard.keyWins[0]}</p>
      <p className={scorecard.marginVariance < 0 ? "missing-callout" : "ready-callout"}>{scorecard.recommendedActions[0]}</p>
    </article>
  );
}
