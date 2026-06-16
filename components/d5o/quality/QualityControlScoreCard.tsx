import { evaluateQualityControl } from "@/lib/d5o/quality-control";
import type { CorrectiveAction, PunchItem, QualityDeficiency, QualityInspection, TestRecord } from "@/lib/d5o/types";

export function QualityControlScoreCard({
  inspections,
  deficiencies,
  tests,
  punchItems,
  correctiveActions
}: {
  inspections: QualityInspection[];
  deficiencies: QualityDeficiency[];
  tests: TestRecord[];
  punchItems: PunchItem[];
  correctiveActions: CorrectiveAction[];
}) {
  const summary = evaluateQualityControl({ inspections, deficiencies, tests, punchItems, correctiveActions });

  return (
    <section className="score-card">
      <span className="metric-label">Quality Control Score</span>
      <strong>{summary.qualityControlScore}%</strong>
      <p>Inspection, deficiency, test, punch, and closeout evidence control.</p>
      <ul className="plain-list">
        <li>{summary.blockers.length} blocker(s)</li>
        <li>{summary.missingEvidence.length} evidence gap(s)</li>
        <li>{summary.punchCloseoutRisks.length} punch closeout risk(s)</li>
      </ul>
    </section>
  );
}
