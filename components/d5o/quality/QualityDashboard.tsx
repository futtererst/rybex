import { DeficiencyTracker } from "./DeficiencyTracker";
import { InspectionRegister } from "./InspectionRegister";
import { PunchItemTracker } from "./PunchItemTracker";
import { QualityCloseoutRiskPanel } from "./QualityCloseoutRiskPanel";
import { QualityControlScoreCard } from "./QualityControlScoreCard";
import { TestEvidenceTracker } from "./TestEvidenceTracker";
import type { CorrectiveAction, PunchItem, QualityDeficiency, QualityInspection, TestRecord } from "@/lib/d5o/types";

export function QualityDashboard({
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
  return (
    <>
      <div className="content-grid">
        <QualityControlScoreCard
          inspections={inspections}
          deficiencies={deficiencies}
          tests={tests}
          punchItems={punchItems}
          correctiveActions={correctiveActions}
        />
        <QualityCloseoutRiskPanel deficiencies={deficiencies} tests={tests} punchItems={punchItems} />
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inspection Register</p>
            <h2>Inspections, pass/fail status, and evidence capture</h2>
          </div>
          <span className="muted">{inspections.length} inspections</span>
        </div>
        <InspectionRegister inspections={inspections} />
      </section>

      <div className="operating-columns">
        <DeficiencyTracker deficiencies={deficiencies} />
        <TestEvidenceTracker tests={tests} />
        <PunchItemTracker punchItems={punchItems} />
      </div>
    </>
  );
}
