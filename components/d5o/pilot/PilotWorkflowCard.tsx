import type { PilotWorkflowStatus } from "@/lib/d5o/pilot/pilot-slice";
import type { WorkflowOutcomeRecord } from "@/lib/d5o/workflow-completion/business-outcome-types";

type PilotWorkflowCardProps = {
  businessValue: string;
  completionItemId: string;
  completionModeLabel: string;
  currentState: string;
  dueDate: string;
  owner: string;
  outcomeRecord?: WorkflowOutcomeRecord | null;
  status: PilotWorkflowStatus;
  targetRoute: string;
  title: string;
  traceHref: string;
};

export function PilotWorkflowCard({
  businessValue,
  completionItemId,
  completionModeLabel,
  currentState,
  dueDate,
  owner,
  outcomeRecord,
  status,
  targetRoute,
  title,
  traceHref
}: PilotWorkflowCardProps) {
  return (
    <article
      className={`panel pilot-workflow-card pilot-workflow-${status}`}
      data-completion-item-id={completionItemId}
      data-current-state={currentState}
      data-qa="pilot-workflow-card"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow" data-qa="pilot-workflow-status-label">{statusLabel(status)}</p>
          <h2>{title}</h2>
          <p>{businessValue}</p>
        </div>
        <span
          className={`chip chip-${statusTone(status)}`}
          data-qa="pilot-workflow-status-chip"
        >
          {statusLabel(status)}
        </span>
        <span data-qa="pilot-workflow-status" hidden>
          {statusLabel(status)}
        </span>
      </div>

      <dl className="focused-task-grid">
        <div>
          <dt>State</dt>
          <dd data-qa="pilot-workflow-state">{currentState.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{owner}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{dueDate}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{completionModeLabel}</dd>
        </div>
      </dl>

      {outcomeRecord ? (
        <section className="pilot-outcome-summary" data-qa="pilot-workflow-outcome-summary">
          <p className="eyebrow">Outcome</p>
          <strong>{outcomeRecord.businessObjectLabel}</strong>
          <span>{outcomeRecord.businessOutcome}</span>
          <span data-qa="pilot-workflow-next-business-step">Next: {outcomeRecord.nextBusinessStep.label}</span>
          <span data-qa="pilot-workflow-historical-record">Record: {outcomeRecord.historicalReferenceLabel}</span>
          <span>{outcomeRecord.databaseBacked ? "database pilot" : "local/demo"}</span>
        </section>
      ) : null}

      <div className="completion-action-row">
        <a className="button button-primary" data-qa="pilot-workflow-primary-cta" href={targetRoute}>
          {status === "complete" ? "Review completed workflow" : title}
        </a>
        <a className="button button-secondary" href={traceHref}>
          View trace
        </a>
      </div>
    </article>
  );
}

function statusLabel(status: PilotWorkflowStatus) {
  if (status === "complete") return "Complete";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

function statusTone(status: PilotWorkflowStatus) {
  if (status === "complete") return "success";
  if (status === "in_progress") return "warning";
  return "info";
}
