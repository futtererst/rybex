import Link from "next/link";
import { StatusChip } from "@/components/d5o/StatusChip";
import { dateLabel } from "@/lib/d5o/presentation";
import { workflowTypeConfig } from "@/lib/d5o/workflow/config";
import type { OperatingWorkflow, WorkflowResolutionState } from "@/lib/d5o/workflow/types";

type DecisionQueueProps = {
  workflows: OperatingWorkflow[];
  title?: string;
  limit?: number;
};

const groups: Array<{ state: WorkflowResolutionState; label: string }> = [
  { state: "needs_decision", label: "Needs decision" },
  { state: "blocked", label: "Blocked" },
  { state: "overdue", label: "Overdue" },
  { state: "ready_for_review", label: "Ready for review" }
];

export function DecisionQueue({ workflows, title = "Top actions", limit = 5 }: DecisionQueueProps) {
  const topWorkflows = groups
    .flatMap((group) =>
      workflows
        .filter((workflow) => workflow.resolutionState === group.state)
        .map((workflow) => ({ ...workflow, groupLabel: group.label }))
    )
    .slice(0, limit);

  return (
    <section className="panel decision-queue">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Decision Queue</p>
          <h2>{title}</h2>
        </div>
        <span className="muted">Only the next moves.</span>
      </div>

      {topWorkflows.length > 0 ? (
        <div className="decision-queue-list">
          {topWorkflows.map((workflow) => {
            const config = workflowTypeConfig[workflow.workflowType];
            return (
              <article className={`decision-row decision-${workflow.severity}`} key={workflow.id}>
                <div>
                  <StatusChip label={workflow.groupLabel} tone={config.toneBySeverity[workflow.severity]} />
                </div>
                <div>
                  <strong>{workflow.title}</strong>
                  <small>{config.shortLabel}</small>
                </div>
                <div>
                  <span>Owner</span>
                  <p>{workflow.owner}</p>
                </div>
                <div>
                  <span>Due</span>
                  <p>{dateLabel(workflow.dueDate)}</p>
                </div>
                <div>
                  <span>Decision needed</span>
                  <p>{workflow.requiredDecision.question}</p>
                </div>
                <div>
                  <span>Required action</span>
                  <p>{workflow.requiredAction.title}</p>
                </div>
                <Link className="button button-secondary" href={workflow.targetHref}>
                  Open
                </Link>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="muted">No decision, blocker, overdue, or review actions are active.</p>
      )}
    </section>
  );
}
