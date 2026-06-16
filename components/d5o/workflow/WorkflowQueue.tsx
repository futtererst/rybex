import type { OperatingWorkflow, WorkflowResolutionState } from "@/lib/d5o/workflow";
import { WorkflowActionCard } from "./WorkflowActionCard";

const queueGroups: Array<{ state: WorkflowResolutionState; label: string }> = [
  { state: "needs_decision", label: "Needs Decision" },
  { state: "blocked", label: "Blocked" },
  { state: "overdue", label: "Overdue" },
  { state: "ready_for_review", label: "Ready for Review" },
  { state: "in_progress", label: "In Progress" },
  { state: "needs_action", label: "Needs Action" }
];

type WorkflowQueueProps = {
  workflows: OperatingWorkflow[];
  title?: string;
  description?: string;
  limitPerGroup?: number;
  compact?: boolean;
};

export function WorkflowQueue({
  workflows,
  title = "Workflow queue",
  description = "Grouped by what must happen next.",
  limitPerGroup = 3,
  compact = false
}: WorkflowQueueProps) {
  const visibleGroups = queueGroups
    .map((group) => ({
      ...group,
      workflows: workflows.filter((workflow) => workflow.resolutionState === group.state).slice(0, limitPerGroup)
    }))
    .filter((group) => group.workflows.length > 0);

  return (
    <section className="panel workflow-queue">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Workflow Queue</p>
          <h2>{title}</h2>
        </div>
        <span className="muted">{description}</span>
      </div>

      {visibleGroups.length > 0 ? (
        <div className="workflow-queue-grid">
          {visibleGroups.map((group) => (
            <section className="workflow-queue-group" key={group.state}>
              <div className="workflow-queue-heading">
                <h3>{group.label}</h3>
                <span className="chip chip-neutral">{group.workflows.length}</span>
              </div>
              <div className="workflow-card-stack">
                {group.workflows.map((workflow) => (
                  <WorkflowActionCard compact={compact} key={workflow.id} workflow={workflow} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="muted">No active workflows require this queue right now.</p>
      )}
    </section>
  );
}
