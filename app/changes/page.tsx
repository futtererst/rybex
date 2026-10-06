import Link from "next/link";
import { ChangeControlDashboard } from "@/components/d5o/change-control/ChangeControlDashboard";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { CollapsedDetails } from "@/components/d5o/end-user";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import {
  backupStatusLabels,
  backupStatusTone,
  billingStatusLabels,
  changeStatusLabels,
  pricingStatusLabels,
} from "@/lib/d5o/change-control-config";
import { evaluateChangeControl } from "@/lib/d5o/change-control";
import { getFieldIssueSeedDataOverlay } from "@/lib/d5o/field-issue-escalation/store";
import { rfiStatusLabels } from "@/lib/d5o/rfi-submittal-config";
import { chipClass, compactCurrency, currency, dateLabel } from "@/lib/d5o/presentation";
import type { ChangeEvent, RFI } from "@/lib/d5o/types";

export const metadata = {
  title: "Change Control | RybexOS"
};

export const dynamic = "force-dynamic";

export default async function ChangesPage() {
  const fieldIssueOverlay = await getFieldIssueSeedDataOverlay();
  const changeEvents = fieldIssueOverlay.changeEvents;
  const dailyReports = fieldIssueOverlay.dailyReports;
  const rfis = fieldIssueOverlay.rfis;
  const summary = evaluateChangeControl({ changeEvents, dailyReports });
  const openEvents = changeEvents.filter((event) => !["billed", "closed"].includes(event.status));
  const pendingPricing = changeEvents.filter((event) =>
    ["backup_needed", "pricing_in_progress", "not_started"].includes(event.pricingStatus)
  );
  const submitted = changeEvents.filter((event) => ["pricing_submitted", "under_review"].includes(event.status));
  const approvedValue = changeEvents.reduce((total, event) => total + event.approvedAmount, 0);
  const rejectedDisputedValue = changeEvents.reduce((total, event) => total + event.rejectedAmount + event.disputedAmount, 0);
  const fieldIssueRfi = rfis.find((rfi) => rfi.id === "rfi-field-issue-lake-001");
  const fieldIssueChange = changeEvents.find((event) => event.id === "chg-field-issue-lake-001");
  const linkedFieldIssueRfi = fieldIssueChange && fieldIssueRfi && fieldIssueChange.linkedRfiIds.includes(fieldIssueRfi.id)
    ? fieldIssueRfi
    : undefined;
  const openExposure = changeEvents.reduce((total, event) => total + event.costImpactEstimate, 0);

  return (
    <div className="command-grid changes-page downstream-record-page">
      <PageHeader
        context={`Open exposure: ${currency.format(openExposure)}`}
        eyebrow="Commercial Recovery"
        subtitle="Track field-driven commercial recovery and keep notice, backup, pricing, and billing clear."
        tags={["Notice discipline"]}
        title="Change Control"
      />

      <section className="change-entitlement-journey" data-qa="changes-downstream-journey">
        <section className="change-entitlement-hero" data-qa="change-entitlement-hero">
          <div>
            <p className="eyebrow">Field issue change path</p>
            <h2 className="change-desktop-created-title">{fieldIssueChange ? "Change exposure created" : "Protect change entitlement"}</h2>
            <h2 className="change-mobile-created-title">{fieldIssueChange ? `${fieldIssueChange.changeNumber} created` : "Protect change entitlement"}</h2>
            <p>
              {fieldIssueChange
                ? "This Change Event carries the field impact into the commercial path so notice, backup, schedule entitlement, and margin are protected."
                : "This page carries field and RFI impacts into the commercial change path so scope, schedule, and margin are protected."}
            </p>
            {fieldIssueChange ? (
              <p className="change-mobile-created-summary">
                <strong>{changeStatusLabels[fieldIssueChange.status]}</strong> · {changeSourcePathLabel(fieldIssueChange, linkedFieldIssueRfi)} · {fieldIssueChange.projectName} · {changeLocationSummary(linkedFieldIssueRfi)} · {currency.format(fieldIssueChange.valueEstimate)}
              </p>
            ) : null}
          </div>
          <dl className="change-entitlement-facts">
            <div>
              <dt>Featured exposure</dt>
              <dd>{fieldIssueChange?.changeNumber ?? (fieldIssueRfi ? "Change exposure review" : "No field-driven change yet")}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{fieldIssueChange ? changeSourcePathLabel(fieldIssueChange, linkedFieldIssueRfi) : fieldIssueRfi ? `Field issue / ${fieldIssueRfi.rfiNumber}` : "Field issue escalation"}</dd>
            </div>
            <div>
              <dt>Project / location</dt>
              <dd>{fieldIssueLocationLabel(fieldIssueChange, fieldIssueRfi)}</dd>
            </div>
            <div>
              <dt>Estimated exposure</dt>
              <dd>{fieldIssueChange ? currency.format(fieldIssueChange.valueEstimate) : fieldIssueRfi ? "Commercial review needed" : "Not established"}</dd>
            </div>
            <div>
              <dt>Notice / backup</dt>
              <dd>{fieldIssueChange ? noticeBackupLabel(fieldIssueChange) : "Not started"}</dd>
            </div>
            <div>
              <dt>Next step</dt>
              <dd>{fieldIssueChange?.requiredAction ?? fieldIssueNextStep(fieldIssueRfi)}</dd>
            </div>
          </dl>
        </section>

        {fieldIssueChange ? (
          <>
            <article className="featured-change-card" data-qa="downstream-change-record" id="chg-field-issue-lake-001">
              <div className="featured-change-card-main">
                <p className="eyebrow">Featured downstream exposure</p>
                <h3 className="change-desktop-record-title">{fieldIssueChange.changeNumber}: {fieldIssueChange.title}</h3>
                <h3 className="change-mobile-action-title">Protect the change entitlement</h3>
                <p>{fieldIssueChange.businessImpact}</p>
                <p className="downstream-mobile-summary">
                  Utility locates and traffic-control release remain unconfirmed.
                </p>
                <p className="change-mobile-consequence">
                  The field condition may create compensable standby, reroute, schedule, or additional-cost exposure.
                </p>
                <p className="change-mobile-next-owner">
                  <span>Owner action</span>
                  Confirm the exposure, preserve the notice deadline, and begin the supporting change backup.
                </p>
                <dl className="featured-change-details">
                  <div>
                    <dt>Source field issue</dt>
                    <dd>{sourceIssueLabel(fieldIssueRfi)}</dd>
                  </div>
                  <div>
                    <dt>Linked RFI</dt>
                    <dd>{linkedRfiLabel(fieldIssueChange, linkedFieldIssueRfi)}</dd>
                  </div>
                  <div>
                    <dt>Project / location</dt>
                    <dd>{fieldIssueLocationLabel(fieldIssueChange, fieldIssueRfi)}</dd>
                  </div>
                  <div>
                    <dt>Estimated impact</dt>
                    <dd>{changeImpactLabel(fieldIssueChange)}</dd>
                  </div>
                  <div>
                    <dt>Notice</dt>
                    <dd>{changeNoticeLabel(fieldIssueChange)}</dd>
                  </div>
                  <div>
                    <dt>Backup</dt>
                    <dd>
                      <span className={chipClass(backupStatusTone[fieldIssueChange.backupStatus])}>
                        {backupStatusLabels[fieldIssueChange.backupStatus]}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
              <aside className="featured-change-next">
                <span>Next owner action</span>
                <strong>{fieldIssueChange.requiredAction}</strong>
                <p>{commercialStatusLabel(fieldIssueChange)}</p>
                <div className="button-row">
                  <Link className="button button-primary" href="/changes#chg-field-issue-lake-001">
                    Review change exposure
                  </Link>
                  <Link className="button button-secondary change-backup-link" href="/changes#supporting-change-records">
                    Build change backup
                  </Link>
                  <Link className="button button-secondary change-mobile-secondary-link" href="/field-execution?focus=field-issue-lake-001#field-issue-escalation">
                    View source field issue
                  </Link>
                  {linkedFieldIssueRfi ? (
                    <Link className="button button-secondary change-mobile-secondary-link" href="/rfis-submittals#rfi-field-issue-lake-001">
                      View linked RFI
                    </Link>
                  ) : null}
                </div>
              </aside>
            </article>

            <section className="source-record-trace" data-qa="change-source-entitlement-trace">
              <p className="source-record-trace-compact">
                {changeCompactTraceLabel(fieldIssueChange, linkedFieldIssueRfi)}
              </p>
              <span>Field issue</span>
              <strong>{linkedFieldIssueRfi?.rfiNumber ?? linkedRfiLabel(fieldIssueChange, linkedFieldIssueRfi)}</strong>
              <span>{fieldIssueChange.changeNumber}</span>
              <small>{changeTraceLabel(fieldIssueChange, linkedFieldIssueRfi)}</small>
            </section>
          </>
        ) : (
          <>
            <section className="featured-change-card featured-change-empty" data-qa="change-empty-state">
              <div>
                <p className="eyebrow">No downstream change event yet</p>
                <h3>No field-driven change event has been created yet.</h3>
                <p>
                  {fieldIssueRfi
                    ? `${fieldIssueRfi.rfiNumber} exists. Review the linked RFI to determine whether commercial exposure should become a change event.`
                    : "Review the field issue first. If the field condition creates scope, schedule, or cost exposure, the downstream change record will appear here."}
                </p>
              </div>
              <div className="button-row">
                <Link className="button button-primary" href="/field-execution?focus=field-issue-lake-001#field-issue-escalation">
                  View source field issue
                </Link>
                {fieldIssueRfi ? (
                  <Link className="button button-secondary" href="/rfis-submittals#rfi-field-issue-lake-001">
                    View linked RFI
                  </Link>
                ) : null}
              </div>
            </section>

            <section className="source-record-trace" data-qa="change-source-entitlement-trace">
              <span>Field issue</span>
              <strong>{fieldIssueRfi?.rfiNumber ?? "RFI not created"}</strong>
              <span>Change exposure review</span>
              <small>{fieldIssueRfi ? "RFI created; check whether notice, backup, or pricing action is required." : "Escalate the field issue before a change exposure can be protected."}</small>
            </section>
          </>
        )}
      </section>

      <CollapsedDetails
        title="Supporting change records"
        summary="Change log, notice controls, backup status, pricing, and billing handoff."
      >
      <section className="pipeline-guardrail" id="supporting-change-records">
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
                <p className="muted">Billing status: {billingStatusLabels[event.billingStatus]}</p>
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

function fieldIssueLocationLabel(changeEvent?: ChangeEvent, rfi?: RFI) {
  if (rfi) return `${rfi.projectName} · ${rfi.location}`;
  if (changeEvent) return `${changeEvent.projectName} · Lake Norman bore path`;
  return "Lake Norman bore path";
}

function sourceIssueLabel(rfi?: RFI) {
  return rfi?.question ?? "Utility locates and traffic-control release not confirmed.";
}

function linkedRfiLabel(changeEvent: ChangeEvent, rfi?: RFI) {
  if (rfi) return rfi.rfiNumber;
  return changeEvent.linkedRfiIds.length > 0 ? changeEvent.linkedRfiIds.join(", ") : "Direct change path";
}

function changeSourcePathLabel(changeEvent: ChangeEvent, linkedRfi?: RFI) {
  if (linkedRfi) return `Linked to ${linkedRfi.rfiNumber}`;
  return changeEvent.linkedRfiIds.length > 0 ? `Linked to ${changeEvent.linkedRfiIds.join(", ")}` : "Created from Field Issue Escalation";
}

function changeLocationSummary(linkedRfi?: RFI) {
  return linkedRfi?.location ?? "Hospital access road and conduit crossing";
}

function changeCompactTraceLabel(changeEvent: ChangeEvent, linkedRfi?: RFI) {
  if (linkedRfi) return `Field issue → ${linkedRfi.rfiNumber} → ${changeEvent.changeNumber}`;
  return `Field issue → Direct change path → ${changeEvent.changeNumber}`;
}

function fieldIssueNextStep(rfi?: RFI) {
  if (rfi) return "Check whether the RFI creates compensable standby or reroute exposure.";
  return "Escalate the field issue first.";
}

function changeImpactLabel(changeEvent: ChangeEvent) {
  const impacts = [
    changeEvent.scheduleImpact ? "schedule" : "",
    changeEvent.valueEstimate > 0 ? currency.format(changeEvent.valueEstimate) : ""
  ].filter(Boolean);

  return impacts.length > 0 ? impacts.join(" and ") : "Impact not estimated";
}

function changeNoticeLabel(changeEvent: ChangeEvent) {
  const deadline = changeEvent.noticeDueDate ?? changeEvent.noticeDeadline;
  const due = deadline ? ` due ${dateLabel(deadline)}` : "";
  return `${changeEvent.noticeRequired ? "Required" : "Not required"} · ${changeEvent.noticeStatus.replaceAll("_", " ")}${due}`;
}

function noticeBackupLabel(changeEvent: ChangeEvent) {
  return `${changeEvent.noticeStatus.replaceAll("_", " ")} / ${backupStatusLabels[changeEvent.backupStatus]}`;
}

function commercialStatusLabel(changeEvent: ChangeEvent) {
  return [
    `Status: ${changeStatusLabels[changeEvent.status]}`,
    `pricing: ${pricingStatusLabels[changeEvent.pricingStatus]}`,
    `billing: ${billingStatusLabels[changeEvent.billingStatus]}`
  ].join(" · ");
}

function changeTraceLabel(changeEvent: ChangeEvent, rfi?: RFI) {
  const rfiLabel = rfi
    ? `${rfi.rfiNumber} is ${rfiStatusLabels[rfi.status].toLowerCase()}`
    : changeEvent.linkedRfiIds.length > 0
      ? `Linked RFI ${changeEvent.linkedRfiIds.join(", ")}`
      : "Change event created directly from the field issue";
  return `${rfiLabel}; ${changeStatusLabels[changeEvent.status].toLowerCase()} with ${backupStatusLabels[changeEvent.backupStatus].toLowerCase()} backup.`;
}
