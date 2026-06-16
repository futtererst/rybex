import Link from "next/link";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { SafetyDashboard } from "@/components/d5o/safety/SafetyDashboard";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import { evaluateSafetyControl } from "@/lib/d5o/safety-control";
import {
  correctiveActions,
  jhaRecords,
  safetyIncidents,
  safetyObservations,
  safetyPlans,
  toolboxTalks
} from "@/lib/d5o/seed-data";

const safetyActions = correctiveActions.filter((action) =>
  action.sourceType === "safety_observation" || action.sourceType === "safety_incident"
);
const summary = evaluateSafetyControl({
  safetyPlans,
  jhaRecords,
  toolboxTalks,
  observations: safetyObservations,
  incidents: safetyIncidents,
  correctiveActions: safetyActions
});
const openObservations = safetyObservations.filter((item) => !["closed", "verified"].includes(item.status));
const overdueActions = safetyActions.filter((item) => item.status === "overdue");
const jhasDue = jhaRecords.filter((item) => item.requiredBeforeWork && (!item.crewAcknowledged || ["draft", "scheduled", "blocked", "overdue"].includes(item.status)));
const blockedProjects = new Set(summary.blockers.map((item) => item.split(":")[0]));
const closeoutSafety = [...safetyObservations.filter((item) => item.closeoutImpact), ...safetyIncidents.filter((item) => item.status !== "closed")];

export const metadata = {
  title: "Safety | RybexOS"
};

export default function SafetyPage() {
  return (
    <div className="command-grid">
      <PageHeader
        context={`Safety control score: ${summary.safetyControlScore}%`}
        eyebrow="D3 / D4 Safety Control"
        primaryAction={{ href: "/safety/record/new", label: "New Safety Record", tone: "primary" }}
        secondaryActions={[
          { href: "/safety/jha/new", label: "New JHA / Toolbox Talk" },
          { href: "/command-center", label: "Command Center" }
        ]}
        subtitle="Control site safety readiness, observations, incidents, and corrective actions."
        tags={["Stop-work visibility"]}
        title="Safety"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("safety")} />

      <CollapsedDetails
        title="Safety records"
        summary="Safety plans, JHAs, observations, incidents, corrective actions, and evidence handoff."
      >
      <section className="pipeline-guardrail">
        <strong>Safety operating discipline:</strong>
        <span>Crews should not start work until safety plans, JHAs, competent-person requirements, and corrective actions are controlled.</span>
      </section>

      <WorkflowModuleContext
        queueTitle="Safety-control workflow actions"
        workflowType="safety_control"
      />

      <section className="metrics-grid" aria-label="Safety summary">
        <PipelineSummaryMetric detail="Required D3/D4 plans" label="Active Safety Plans" value={safetyPlans.length} />
        <PipelineSummaryMetric detail="Due or missing acknowledgement" label="JHAs / Talks Due" tone={jhasDue.length > 0 ? "critical" : "success"} value={jhasDue.length} />
        <PipelineSummaryMetric detail="Open field safety signals" label="Observations" tone={openObservations.length > 0 ? "warning" : "success"} value={openObservations.length} />
        <PipelineSummaryMetric detail="Open corrective action queue" label="Corrective Actions" tone={safetyActions.length > 0 ? "warning" : "success"} value={safetyActions.filter((item) => !["closed", "verified"].includes(item.status)).length} />
        <PipelineSummaryMetric detail="Incident or near-miss records" label="Near Miss / Incidents" tone={safetyIncidents.some((item) => item.status !== "closed") ? "critical" : "success"} value={safetyIncidents.length} />
        <PipelineSummaryMetric detail="Corrective actions past due" label="Overdue Actions" tone={overdueActions.length > 0 ? "critical" : "success"} value={overdueActions.length} />
        <PipelineSummaryMetric detail="Projects with safety blockers" label="Projects Blocked" tone={blockedProjects.size > 0 ? "critical" : "success"} value={blockedProjects.size} />
        <PipelineSummaryMetric detail="Safety records affecting D5 evidence" label="Closeout Impact" tone={closeoutSafety.length > 0 ? "warning" : "success"} value={closeoutSafety.length} />
      </section>

      <SafetyDashboard
        safetyPlans={safetyPlans}
        jhaRecords={jhaRecords}
        toolboxTalks={toolboxTalks}
        observations={safetyObservations}
        incidents={safetyIncidents}
        correctiveActions={safetyActions}
      />

      <section className="pipeline-guardrail">
        <strong>D5 safety evidence handoff:</strong>
        <span>
          Safety corrective actions with closeout impact must be closed before the <Link href="/closeout">Closeout</Link> package can be accepted or archived.
        </span>
      </section>
      </CollapsedDetails>
    </div>
  );
}
