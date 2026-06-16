import { evaluateSafetyControl } from "@/lib/d5o/safety-control";
import type { CorrectiveAction, JhaRecord, SafetyIncident, SafetyObservation, SafetyPlan, ToolboxTalk } from "@/lib/d5o/types";

export function SafetyControlScoreCard({
  safetyPlans,
  jhaRecords,
  toolboxTalks,
  observations,
  incidents,
  correctiveActions
}: {
  safetyPlans: SafetyPlan[];
  jhaRecords: JhaRecord[];
  toolboxTalks: ToolboxTalk[];
  observations: SafetyObservation[];
  incidents: SafetyIncident[];
  correctiveActions: CorrectiveAction[];
}) {
  const summary = evaluateSafetyControl({ safetyPlans, jhaRecords, toolboxTalks, observations, incidents, correctiveActions });

  return (
    <section className="score-card">
      <span className="metric-label">Safety Control Score</span>
      <strong>{summary.safetyControlScore}%</strong>
      <p>Readiness, observations, incidents, and corrective action control.</p>
      <ul className="plain-list">
        <li>{summary.blockers.length} blocker(s)</li>
        <li>{summary.overdueActions.length} overdue corrective action(s)</li>
        <li>{summary.incidentFollowUps.length} incident or near-miss follow-up(s)</li>
      </ul>
    </section>
  );
}
