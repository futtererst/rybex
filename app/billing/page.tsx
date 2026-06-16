import Link from "next/link";
import { BillingDashboard } from "@/components/d5o/billing/BillingDashboard";
import { ActionWorkspaceLayout, CollapsedDetails } from "@/components/d5o/end-user";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { evaluateBillingControl } from "@/lib/d5o/billing-control";
import { getEndUserWorkspaceSummary } from "@/lib/d5o/end-user/page-focus-config";
import { compactCurrency } from "@/lib/d5o/presentation";
import {
  billingBackupItems,
  changeEvents,
  closeoutPackages,
  commercialExposureItems,
  lienWaivers,
  payApplications,
  punchItems,
  projects,
  qualityDeficiencies,
  scheduleOfValues
} from "@/lib/d5o/seed-data";

const summary = evaluateBillingControl({
  payApplications,
  backupItems: billingBackupItems,
  lienWaivers,
  commercialExposure: commercialExposureItems,
  changeEvents
});
const currentContractValue = projects.reduce((total, project) => total + project.contractValue, 0);
const approvedChangeValue = changeEvents.reduce((total, event) => total + event.approvedAmount, 0);
const payAppsDue = payApplications.filter((payApp) =>
  ["draft", "ready_for_review"].includes(payApp.status)
);
const submittedAging = payApplications.filter((payApp) =>
  ["submitted", "aging", "partially_paid", "disputed"].includes(payApp.status)
);
const evidenceRisks = [
  ...qualityDeficiencies.filter((item) => item.billingImpact && !["closed", "verified"].includes(item.status)),
  ...punchItems.filter((item) => item.acceptanceImpact && !["closed", "verified"].includes(item.status))
];
const closeoutCommercialRisks = closeoutPackages.filter((item) =>
  ["blocked", "pending_final_billing", "pending_waiver", "disputed"].includes(item.retainageReleaseStatus) ||
  ["draft", "aging", "disputed", "rejected", "partially_paid"].includes(item.finalBillingStatus)
);

export const metadata = {
  title: "Billing | RybexOS"
};

export default function BillingPage() {
  return (
    <div className="command-grid">
      <PageHeader
        context={`Billing readiness score: ${summary.billingReadinessScore}%`}
        eyebrow="Commercial Recovery"
        primaryAction={{ href: "/billing/pay-application/new", label: "New Pay Application", tone: "primary" }}
        secondaryActions={[
          { href: "#commercial-exposure", label: "Review Commercial Exposure" },
          { href: "/command-center", label: "Command Center" }
        ]}
        subtitle="Turn completed work, approved changes, and project documentation into clean pay application readiness."
        tags={["Cash at risk"]}
        title="Billing"
      />

      <ActionWorkspaceLayout summary={getEndUserWorkspaceSummary("billing")} />

      <CollapsedDetails
        title="Billing records"
        summary="Pay apps, backup, retainage, SOV, and commercial exposure details."
      >
        <section className="pipeline-guardrail">
          <strong>Billing discipline:</strong>
          <span>Completed work, daily reports, approved changes, retainage, lien waivers, and backup documentation must align before pay application submission.</span>
        </section>

        <WorkflowModuleContext
          queueTitle="Billing and cash-control workflow actions"
          workflowType="billing_cash_control"
        />

        <section className="metrics-grid detail-metrics-grid" aria-label="Billing summary">
          <PipelineSummaryMetric detail="Active project contract value" label="Contract Value" value={compactCurrency.format(currentContractValue)} />
          <PipelineSummaryMetric detail="Approved change value" label="Approved Changes" tone="success" value={compactCurrency.format(approvedChangeValue)} />
          <PipelineSummaryMetric detail="Pending change exposure" label="Pending Exposure" tone={summary.pendingChangeExposure > 0 ? "warning" : "success"} value={compactCurrency.format(summary.pendingChangeExposure)} />
          <PipelineSummaryMetric detail="Approved changes not billed" label="Unbilled Approved" tone={summary.unbilledApprovedChangeValue > 0 ? "critical" : "success"} value={compactCurrency.format(summary.unbilledApprovedChangeValue)} />
          <PipelineSummaryMetric detail="Draft or ready for review" label="Pay Apps Due" tone={payAppsDue.length > 0 ? "warning" : "success"} value={payAppsDue.length} />
          <PipelineSummaryMetric detail="Submitted, aging, partial, or disputed" label="Submitted / Aging" tone={submittedAging.length > 0 ? "critical" : "success"} value={submittedAging.length} />
          <PipelineSummaryMetric detail="Retainage currently held" label="Retainage Held" tone="warning" value={compactCurrency.format(summary.retainageHeld)} />
          <PipelineSummaryMetric detail="Required backup gaps" label="Missing Backup" tone={summary.missingBackupItems.length > 0 ? "critical" : "success"} value={summary.missingBackupItems.length} />
          <PipelineSummaryMetric detail="Commercial cash exposure" label="Cash at Risk" tone={summary.cashAtRisk > 0 ? "critical" : "success"} value={compactCurrency.format(summary.cashAtRisk)} />
        </section>

        <div id="commercial-exposure" className="detail-contained">
          <BillingDashboard
            payApplications={payApplications}
            scheduleOfValues={scheduleOfValues}
            backupItems={billingBackupItems}
            lienWaivers={lienWaivers}
            commercialExposure={commercialExposureItems}
            changeEvents={changeEvents}
          />
        </div>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Safety / Quality Billing Evidence</p>
              <h2>Acceptance evidence that can affect payment readiness</h2>
            </div>
            <Link className="button button-secondary" href="/quality">Quality</Link>
          </div>
          <div className="operating-columns">
            {evidenceRisks.slice(0, 6).map((item) => (
              <section className="control-list" key={item.id}>
                <h3>{item.title}</h3>
                <p>{item.projectName}</p>
                <p className="missing-callout">{item.nextAction}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">D5 Final Recovery</p>
              <h2>Closeout packages affecting final billing and retainage</h2>
            </div>
            <Link className="button button-secondary" href="/closeout">Closeout</Link>
          </div>
          <div className="operating-columns">
            {closeoutCommercialRisks.map((item) => (
              <section className="control-list" key={item.id}>
                <h3>{item.projectName}</h3>
                <p>{item.packageNumber} | final billing {item.finalBillingStatus.replaceAll("_", " ")} | retainage {item.retainageReleaseStatus.replaceAll("_", " ")}</p>
                <p className="missing-callout">{item.nextAction}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="pipeline-guardrail">
          <strong>O billing intelligence:</strong>
          <span>
            Pay app aging, approved-not-billed changes, retainage delays, and disputed exposure should feed <Link href="/reports">Optimize</Link> performance scorecards.
          </span>
        </section>
      </CollapsedDetails>
    </div>
  );
}
