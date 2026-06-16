import { workflowTypeConfig } from "@/lib/d5o/workflow/config";
import type { OperatingWorkflowType } from "@/lib/d5o/workflow/types";
import { getRoleContext } from "./RoleContextBand";
import { WorkflowStepper } from "./WorkflowStepper";

type WorkflowOutcomePanelProps = {
  workflowType: OperatingWorkflowType;
  signal: string;
  decision: string;
  action: string;
  evidence: string[];
  gateMovement: string;
  consequence: string;
};

export function WorkflowOutcomePanel({
  workflowType,
  signal,
  decision,
  action,
  evidence,
  gateMovement,
  consequence
}: WorkflowOutcomePanelProps) {
  const config = workflowTypeConfig[workflowType];
  const roleContext = getRoleContext(workflowType);

  return (
    <section className="panel workflow-outcome-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Workflow Outcome</p>
          <h2>{config.label}</h2>
        </div>
        <span className="muted">Signal → Decision → Action → Evidence → Gate Movement</span>
      </div>
      <div className="workflow-outcome-role">
        <span>For</span>
        <strong>{roleContext.audience}</strong>
        <span>Produces</span>
        <strong>{roleContext.action}</strong>
      </div>
      <WorkflowStepper activeStage="gate_movement" />
      <div className="workflow-card-grid">
        <div>
          <span className="workflow-label">Signal addressed</span>
          <strong>{signal}</strong>
        </div>
        <div>
          <span className="workflow-label">Decision made</span>
          <strong>{decision}</strong>
        </div>
        <div>
          <span className="workflow-label">Action created</span>
          <strong>{action}</strong>
        </div>
        <div>
          <span className="workflow-label">Evidence still needed</span>
          <ul className="plain-list">
            {evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <span className="workflow-label">Gate/status movement</span>
          <strong>{gateMovement}</strong>
        </div>
        <div>
          <span className="workflow-label">Consequence if missed</span>
          <strong>{consequence}</strong>
        </div>
      </div>
    </section>
  );
}
