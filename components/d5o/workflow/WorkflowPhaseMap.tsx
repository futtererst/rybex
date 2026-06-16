import { d5oPhases } from "@/lib/d5o/config";
import type { DerivedWorkflowSummary } from "@/lib/d5o/workflow";

export function WorkflowPhaseMap({ summary }: { summary: DerivedWorkflowSummary }) {
  return (
    <section className="panel workflow-phase-map">
      <div className="section-heading">
        <div>
          <p className="eyebrow">D5O Workflow Map</p>
          <h2>Where work is trying to move next</h2>
        </div>
        <span className="muted">Signal → Decision → Action → Evidence → Gate Movement</span>
      </div>
      <div className="phase-lane-grid">
        {d5oPhases.map((phase) => {
          const workflows = summary.workflowsByD5OPhase[phase.id] ?? [];
          const blocked = workflows.filter((workflow) => workflow.resolutionState === "blocked").length;
          const overdue = workflows.filter((workflow) => workflow.resolutionState === "overdue").length;
          const decisions = workflows.filter((workflow) => workflow.resolutionState === "needs_decision").length;

          return (
            <section className="workflow-phase-card" key={phase.id}>
              <div className="phase-lane-header">
                <div>
                  <strong>{phase.shortLabel}</strong>
                  <p className="muted">{phase.primaryQuestion}</p>
                </div>
                <span className={blocked > 0 || overdue > 0 ? "chip chip-critical" : workflows.length > 0 ? "chip chip-warning" : "chip chip-success"}>
                  {workflows.length}
                </span>
              </div>
              <ul className="compact-list">
                <li><span className="artifact-state artifact-missing" />{blocked} blocked</li>
                <li><span className="artifact-state artifact-pending" />{overdue} overdue</li>
                <li><span className="artifact-state artifact-complete" />{decisions} decisions</li>
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
