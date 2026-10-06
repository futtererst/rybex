import Link from "next/link";
import { PageHeader } from "@/components/d5o/PageHeader";
import { PipelineSummaryMetric } from "@/components/d5o/PipelineSummaryMetric";
import { RfiSubmittalDashboard } from "@/components/d5o/rfis-submittals/RfiSubmittalDashboard";
import { CollapsedDetails } from "@/components/d5o/end-user";
import { WorkflowModuleContext } from "@/components/d5o/workflow/WorkflowModuleContext";
import { getFieldIssueSeedDataOverlay } from "@/lib/d5o/field-issue-escalation/store";
import {
  priorityLabels,
  priorityTone,
  rfiStatusLabels,
  rfiStatusTone
} from "@/lib/d5o/rfi-submittal-config";
import { evaluateRfiSubmittalControl } from "@/lib/d5o/rfi-submittal-control";
import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { submittals } from "@/lib/d5o/seed-data";
import type { ChangeEvent, RFI } from "@/lib/d5o/types";

export const metadata = {
  title: "RFIs & Submittals | RybexOS"
};

export const dynamic = "force-dynamic";

export default async function RfisSubmittalsPage() {
  const fieldIssueOverlay = await getFieldIssueSeedDataOverlay();
  const rfis = fieldIssueOverlay.rfis;
  const changeEvents = fieldIssueOverlay.changeEvents;
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
  const fieldIssueRfi = rfis.find((rfi) => rfi.id === "rfi-field-issue-lake-001");
  const linkedChangeEvent = fieldIssueRfi
    ? changeEvents.find((event) => event.linkedRfiIds.includes(fieldIssueRfi.id))
    : undefined;
  const hasChangeExposure = Boolean(fieldIssueRfi && (fieldIssueRfi.costImpact || fieldIssueRfi.scheduleImpact || linkedChangeEvent));

  return (
    <div className="command-grid rfis-submittals-page downstream-record-page">
      <PageHeader
        context={`Information control score: ${control.controlScore}%`}
        eyebrow="Answer Control"
        subtitle="Track formal answers and approvals created from field issues or work blockers."
        tags={["Formal clarification"]}
        title="RFIs & Submittals"
      />

      <section className="rfi-downstream-journey" data-qa="rfis-downstream-journey">
        <section className="rfi-situation-hero" data-qa="rfi-situation-hero">
          <div>
            <p className="eyebrow">Field-driven RFI</p>
            <h2>{fieldIssueRfi ? `${fieldIssueRfi.rfiNumber} created` : "Manage field-driven RFI"}</h2>
            <p>
              {fieldIssueRfi
                ? "This RFI carries the field issue into the formal answer path so scope, schedule, and commercial impact are protected."
                : "No field-driven RFI has been created yet. Escalate the field issue first so the formal response path is available here."}
            </p>
            {fieldIssueRfi ? (
              <p className="rfi-mobile-created-summary">
                <strong>{rfiStatusLabels[fieldIssueRfi.status]}</strong> · {fieldIssueRfi.projectName} · {fieldIssueRfi.location} · Created from Field Issue Escalation
              </p>
            ) : null}
          </div>
          <dl className="rfi-situation-facts">
            <div>
              <dt>Featured record</dt>
              <dd>{fieldIssueRfi?.rfiNumber ?? "No RFI yet"}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>Field Issue Escalation</dd>
            </div>
            <div>
              <dt>Project / location</dt>
              <dd>{fieldIssueRfi ? `${fieldIssueRfi.projectName} · ${fieldIssueRfi.location}` : "Lake Norman bore path"}</dd>
            </div>
            <div>
              <dt>Current status</dt>
              <dd>{fieldIssueRfi ? rfiStatusLabels[fieldIssueRfi.status] : "Waiting for field escalation"}</dd>
            </div>
            <div>
              <dt>Next step</dt>
              <dd>{fieldIssueRfi?.nextAction ?? "Escalate the field issue first."}</dd>
            </div>
          </dl>
        </section>

        {fieldIssueRfi ? (
          <>
            <article className="featured-rfi-card" data-qa="downstream-rfi-record" id="rfi-field-issue-lake-001">
              <div className="featured-rfi-card-main">
                <p className="eyebrow">Featured downstream record</p>
                <h3 className="rfi-desktop-record-title">{fieldIssueRfi.rfiNumber}: {fieldIssueRfi.title}</h3>
                <h3 className="rfi-mobile-action-title">Track the RFI response</h3>
                <p>{fieldIssueRfi.question}</p>
                <p className="downstream-mobile-summary">
                  Utility locates and traffic-control release remain unconfirmed.
                </p>
                <p className="rfi-mobile-consequence">
                  Written direction is needed before Rybex proceeds, stands by, or reroutes.
                </p>
                <p className="rfi-mobile-next-owner">
                  <span>Owner action</span>
                  Obtain written direction and confirm whether standby or reroute impacts are compensable.
                </p>
                <dl className="featured-rfi-details">
                  <div>
                    <dt>Source field issue</dt>
                    <dd>Utility locates and traffic-control release not confirmed.</dd>
                  </div>
                  <div>
                    <dt>Project / location</dt>
                    <dd>{fieldIssueRfi.projectName} · {fieldIssueRfi.location}</dd>
                  </div>
                  <div>
                    <dt>Impact</dt>
                    <dd>{rfiImpactLabel(fieldIssueRfi)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span className={chipClass(rfiStatusTone[fieldIssueRfi.status])}>{rfiStatusLabels[fieldIssueRfi.status]}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Priority</dt>
                    <dd>
                      <span className={chipClass(priorityTone[fieldIssueRfi.priority])}>{priorityLabels[fieldIssueRfi.priority]}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Due</dt>
                    <dd>{dateLabel(fieldIssueRfi.dueDate)}</dd>
                  </div>
                </dl>
              </div>
              <aside className="featured-rfi-next">
                <span>Next owner action</span>
                <strong>{fieldIssueRfi.nextAction}</strong>
                <p>{fieldIssueRfi.requiredDecision}</p>
                <div className="button-row">
                  <Link className="button button-primary" href="/rfis-submittals#rfi-field-issue-lake-001">
                    Review RFI status
                  </Link>
                  <Link className="button button-secondary" href="/field-execution?focus=field-issue-lake-001#field-issue-escalation">
                    View source field issue
                  </Link>
                  {hasChangeExposure ? (
                    <Link className="button button-secondary" href="/changes">
                      Check change exposure
                    </Link>
                  ) : null}
                </div>
              </aside>
            </article>

            <section className="source-record-trace" data-qa="rfi-source-record-trace">
              <p className="source-record-trace-compact">
                Field issue → {fieldIssueRfi.rfiNumber} → {linkedChangeEvent ? linkedChangeEvent.changeNumber : "Change exposure review"}
              </p>
              <span>Field issue</span>
              <strong>{fieldIssueRfi.rfiNumber}</strong>
              <span>{linkedChangeEvent ? linkedChangeEvent.changeNumber : "Change exposure review"}</span>
              <small>{rfiTraceLabel(fieldIssueRfi, linkedChangeEvent)}</small>
            </section>
          </>
        ) : (
          <section className="featured-rfi-card featured-rfi-empty" data-qa="rfi-empty-state">
            <div>
              <p className="eyebrow">No downstream RFI yet</p>
              <h3>No field-driven RFI has been created yet.</h3>
              <p>Escalate the field issue first. When the RFI is created, it will appear here with source, impact, response, and change-exposure context.</p>
            </div>
            <Link className="button button-primary" href="/field-execution">
              Escalate field issue
            </Link>
          </section>
        )}
      </section>

      <CollapsedDetails
        title="Supporting RFI and submittal details"
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

function rfiImpactLabel(rfi: RFI) {
  const impacts = [
    rfi.scheduleImpact ? "schedule" : "",
    rfi.costImpact ? "commercial" : ""
  ].filter(Boolean);

  return impacts.length > 0 ? `${impacts.join(" and ")} impact protected` : "No direct impact flagged";
}

function rfiTraceLabel(rfi: RFI, linkedChangeEvent?: ChangeEvent) {
  if (linkedChangeEvent) return `${linkedChangeEvent.changeNumber} is linked for commercial recovery.`;
  if (rfi.costImpact || rfi.scheduleImpact) return "Response pending; check whether change exposure should be created or linked.";
  return "Response pending; no change exposure is currently flagged.";
}
