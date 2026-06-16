import { CorrectiveActionTracker } from "./CorrectiveActionTracker";
import { IncidentRegister } from "./IncidentRegister";
import { JhaToolboxRegister } from "./JhaToolboxRegister";
import { SafetyControlScoreCard } from "./SafetyControlScoreCard";
import { SafetyObservationTable } from "./SafetyObservationTable";
import { SafetyReadinessPanel } from "./SafetyReadinessPanel";
import type { CorrectiveAction, JhaRecord, SafetyIncident, SafetyObservation, SafetyPlan, ToolboxTalk } from "@/lib/d5o/types";

export function SafetyDashboard({
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
  return (
    <>
      <div className="content-grid">
        <SafetyControlScoreCard
          safetyPlans={safetyPlans}
          jhaRecords={jhaRecords}
          toolboxTalks={toolboxTalks}
          observations={observations}
          incidents={incidents}
          correctiveActions={correctiveActions}
        />
        <SafetyReadinessPanel safetyPlans={safetyPlans} />
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">JHA / Toolbox Control</p>
            <h2>Required safety planning before work starts</h2>
          </div>
          <span className="muted">{jhaRecords.length} records</span>
        </div>
        <JhaToolboxRegister records={jhaRecords} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Safety Observations</p>
            <h2>Open conditions, behaviors, and stop-work signals</h2>
          </div>
        </div>
        <SafetyObservationTable observations={observations.filter((observation) => observation.status !== "closed")} />
      </section>

      <div className="operating-columns">
        <IncidentRegister incidents={incidents} />
        <CorrectiveActionTracker actions={correctiveActions} />
      </div>
    </>
  );
}
