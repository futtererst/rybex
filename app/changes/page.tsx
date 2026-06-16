import Link from "next/link";
import { ChangeControlDashboard } from "@/components/d5o/change-control/ChangeControlDashboard";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { evaluateChangeControl } from "@/lib/d5o/change-control";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import { compactCurrency, currency } from "@/lib/d5o/presentation";
import { changeEvents, dailyReports } from "@/lib/d5o/seed-data";

const summary = evaluateChangeControl({ changeEvents, dailyReports });
const openEvents = changeEvents.filter((event) => !["billed", "closed"].includes(event.status));
const pendingPricing = changeEvents.filter((event) =>
  ["backup_needed", "pricing_in_progress", "not_started"].includes(event.pricingStatus)
);
const submitted = changeEvents.filter((event) => ["pricing_submitted", "under_review"].includes(event.status));
const approvedValue = changeEvents.reduce((total, event) => total + event.approvedAmount, 0);
const rejectedDisputedValue = changeEvents.reduce((total, event) => total + event.rejectedAmount + event.disputedAmount, 0);

export const metadata = {
  title: "Change Control | RybexOS"
};

export default function ChangesPage() {
  return (
    <div className="command-grid">
      <PageHeader
        context={`Open exposure: ${currency.format(changeEvents.reduce((total, event) => total + event.costImpactEstimate, 0))}`}
        eyebrow="Commercial Recovery"
        primaryAction={{ href: "/changes/new", label: "New Change Event", tone: "primary" }}
        secondaryActions={[{ href: "/command-center", label: "Command Center" }]}
        subtitle="Convert changed conditions, extra work, and GC direction into controlled commercial recovery."
        tags={["Notice discipline"]}
        title="Change Control"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("changes")} />

      <CollapsedDetails
        title="Change records"
        summary="Change log, notice controls, backup status, pricing, and billing handoff."
      >
      <section className="pipeline-guardrail">
        <strong>Change control rule:</strong>
        <span>Do not wait for final pricing to create a change event. Capture the event early so notice, backup, and entitlement are protected.</span>
      </section>

      <WorkflowModuleContext
        queueTitle="Change-recovery workflow actions"
        workflowType="change_recovery"
      />

      <section className="metrics-grid" aria-label="Change control summary">
        <PipelineSummaryMetric detail="Not billed or closed" label="Open Changes" value={openEvents.length} />
        <PipelineSummaryMetric detail="Notice due in 3 days or less" label="Notice Risk" tone={summary.noticeDeadlineRisks.length > 0 ? "critical" : "success"} value={summary.noticeDeadlineRisks.length} />
        <PipelineSummaryMetric detail="Missing or partial support" label="Backup Gaps" tone={summary.missingBackupItems.length > 0 ? "critical" : "success"} value={summary.missingBackupItems.length} />
        <PipelineSummaryMetric detail="Pricing not complete" label="Pending Pricing" tone={pendingPricing.length > 0 ? "warning" : "success"} value={pendingPricing.length} />
        <PipelineSummaryMetric detail="Submitted or under review" label="Submitted" value={submitted.length} />
        <PipelineSummaryMetric detail="Approved change value" label="Approved Value" tone="success" value={compactCurrency.format(approvedValue)} />
        <PipelineSummaryMetric detail="Rejected or disputed exposure" label="Disputed Value" tone={rejectedDisputedValue > 0 ? "critical" : "success"} value={compactCurrency.format(rejectedDisputedValue)} />
        <PipelineSummaryMetric detail="Approved but not billed" label="Unbilled Approved" tone={summary.unbilledApprovedValue > 0 ? "critical" : "success"} value={compactCurrency.format(summary.unbilledApprovedValue)} />
      </section>

      <ChangeControlDashboard events={changeEvents} dailyReports={dailyReports} />

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Billing Handoff</p>
            <h2>Commercial recovery that needs pay application action</h2>
          </div>
          <Link className="button button-secondary" href="/billing">Billing</Link>
        </div>
        <div className="operating-columns">
          {changeEvents
            .filter((event) => ["approved_not_billed", "disputed"].includes(event.billingStatus))
            .map((event, index) => (
              <section className="control-list" key={`billing-handoff-${event.id}-${event.changeNumber}-${index}`}>
                <h3>{event.changeNumber}: {event.title}</h3>
                <p>{event.requiredAction}</p>
                <p className="muted">Billing status: {event.billingStatus}</p>
              </section>
            ))}
        </div>
      </section>

      <section className="pipeline-guardrail">
        <strong>D5 commercial handoff:</strong>
        <span>
          Approved, disputed, or unresolved change events should be closed or documented before final acceptance in <Link href="/closeout">Closeout</Link>.
        </span>
      </section>
      </CollapsedDetails>
    </div>
  );
}
