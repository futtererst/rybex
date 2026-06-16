import { closeoutDecisionLabels } from "@/lib/d5o/closeout-config";
import { evaluateD5Gate } from "@/lib/d5o/d5-gate";
import type {
  AcceptanceRecord,
  ChangeEvent,
  CloseoutPackage,
  CloseoutRequirement,
  CorrectiveAction,
  DailyReport,
  LienWaiver,
  PayApplication,
  PunchItem,
  QualityDeficiency,
  RFI,
  RybexProject,
  Submittal,
  TestRecord
} from "@/lib/d5o/types";

export function D5ReadinessCard(props: {
  closeoutPackage: CloseoutPackage;
  project?: RybexProject;
  requirements: CloseoutRequirement[];
  acceptanceRecords: AcceptanceRecord[];
  dailyReports: DailyReport[];
  punchItems: PunchItem[];
  testRecords: TestRecord[];
  qualityDeficiencies: QualityDeficiency[];
  correctiveActions: CorrectiveAction[];
  rfis: RFI[];
  submittals: Submittal[];
  changeEvents: ChangeEvent[];
  payApplications: PayApplication[];
  lienWaivers: LienWaiver[];
}) {
  const readiness = evaluateD5Gate(props);

  return (
    <section className="score-card">
      <span className="metric-label">D5 Closeout Readiness</span>
      <strong>{readiness.closeoutReadinessScore}%</strong>
      <p>{closeoutDecisionLabels[readiness.recommendedDecision]}</p>
      <ul className="plain-list">
        <li>{readiness.missingRequiredDocuments.length} missing document/evidence item(s)</li>
        <li>{readiness.unresolvedPunchItems.length} unresolved punch item(s)</li>
        <li>{readiness.finalBillingBlockers.length} final billing blocker(s)</li>
        <li>{readiness.retainageReleaseBlockers.length} retainage blocker(s)</li>
      </ul>
    </section>
  );
}
