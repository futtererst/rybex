import Link from "next/link";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { RfiSubmittalDashboard } from "@/components/d5o/rfis-submittals/RfiSubmittalDashboard";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { evaluateRfiSubmittalControl } from "@/lib/d5o/rfi-submittal-control";
import { changeEvents, rfis, submittals } from "@/lib/d5o/seed-data";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";

const control = evaluateRfiSubmittalControl({ rfis, submittals });
const openRfis = rfis.filter((rfi) => !["closed", "void"].includes(rfi.status));
const overdueRfis = rfis.filter((rfi) => rfi.status === "overdue");
const scheduleCriticalRfis = rfis.filter((rfi) => rfi.scheduleImpact || rfi.priority === "critical");
const openSubmittals = submittals.filter((submittal) =>
  !["approved", "approved_as_noted", "closed"].includes(submittal.status)
);
const dueThisWeek = submittals.filter((submittal) =>
  !["approved", "approved_as_noted", "closed"].includes(submittal.status) &&
  submittal.requiredDate <= "2026-06-17"
);
const rejectedSubmittals = submittals.filter((submittal) =>
  ["revise_and_resubmit", "rejected"].includes(submittal.status)
);
const rfisLinkedToChanges = rfis.filter((rfi) => rfi.linkedChangeEventIds.length > 0);

export const metadata = {
  title: "RFIs & Submittals | RybexOS"
};

export default function RfisSubmittalsPage() {
  return (
    <div className="command-grid">
      <PageHeader
        context={`Information control score: ${control.controlScore}%`}
        eyebrow="D4 Information Control"
        primaryAction={{ href: "/rfis-submittals/rfi/new", label: "New RFI", tone: "primary" }}
        secondaryActions={[
          { href: "/rfis-submittals/submittal/new", label: "New Submittal" },
          { href: "/command-center", label: "Command Center" }
        ]}
        subtitle="Control project clarification, submittal approvals, and schedule-critical information flow."
        tags={["Formal clarification"]}
        title="RFIs & Submittals"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("rfis-submittals")} />

      <CollapsedDetails
        title="RFI and submittal details"
        summary="Registers, linked change records, and information-control context."
      >
      <section className="pipeline-guardrail">
        <strong>Information control rule:</strong>
        <span>Field uncertainty, rejected submittals, and schedule-critical questions should be formalized before crews lose time or change recovery is missed.</span>
      </section>

      <WorkflowModuleContext
        queueTitle="RFI/submittal workflow actions"
        workflowType="information_control"
      />

      <section className="metrics-grid" aria-label="RFI and submittal summary">
        <PipelineSummaryMetric detail="Not closed or void" label="Open RFIs" value={openRfis.length} />
        <PipelineSummaryMetric detail="Past due or marked overdue" label="Overdue RFIs" tone={overdueRfis.length > 0 ? "critical" : "success"} value={overdueRfis.length} />
        <PipelineSummaryMetric detail="Schedule-critical questions" label="Schedule Critical" tone={scheduleCriticalRfis.length > 0 ? "warning" : "success"} value={scheduleCriticalRfis.length} />
        <PipelineSummaryMetric detail="Active approval packages" label="Open Submittals" value={openSubmittals.length} />
        <PipelineSummaryMetric detail="Required in next 7 days" label="Due This Week" tone={dueThisWeek.length > 0 ? "warning" : "success"} value={dueThisWeek.length} />
        <PipelineSummaryMetric detail="Rejected or revise/resubmit" label="Rejected / Revise" tone={rejectedSubmittals.length > 0 ? "critical" : "success"} value={rejectedSubmittals.length} />
        <PipelineSummaryMetric detail="Formal change linkage" label="Linked to Changes" tone="info" value={rfisLinkedToChanges.length} />
      </section>

      <RfiSubmittalDashboard rfis={rfis} submittals={submittals} />

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Linked Commercial Records</p>
            <h2>RFIs already tied to change events</h2>
          </div>
          <Link className="button button-secondary" href="/changes">Change Control</Link>
        </div>
        <div className="operating-columns">
          {changeEvents.filter((event) => event.linkedRfiIds.length > 0).map((event) => (
            <section className="control-list" key={event.id}>
              <h3>{event.changeNumber}: {event.title}</h3>
              <p>{event.businessImpact}</p>
              <p className="muted">{event.linkedRfiIds.length} linked RFI(s)</p>
            </section>
          ))}
        </div>
      </section>

      <section className="pipeline-guardrail">
        <strong>D5 information handoff:</strong>
        <span>
          RFIs and submittals that affect final acceptance should be closed or documented in the <Link href="/closeout">Closeout</Link> package.
        </span>
      </section>
      </CollapsedDetails>
    </div>
  );
}
