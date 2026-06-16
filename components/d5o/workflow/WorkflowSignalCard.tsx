import { StatusChip } from "@/components/d5o/StatusChip";
import { workflowTypeConfig } from "@/lib/d5o/workflow";
import type { OperatingWorkflow } from "@/lib/d5o/workflow";

export function WorkflowSignalCard({ workflow }: { workflow: OperatingWorkflow }) {
  const config = workflowTypeConfig[workflow.workflowType];

  return (
    <section className="control-list workflow-signal-card">
      <div className="workflow-card-header">
        <div>
          <p className="eyebrow">{config.shortLabel} Signal</p>
          <h3>{workflow.signal.title}</h3>
        </div>
        <StatusChip label={workflow.severity} tone={config.toneBySeverity[workflow.severity]} />
      </div>
      <p>{workflow.signal.detail}</p>
      <p className="missing-callout">{workflow.consequenceIfMissed}</p>
    </section>
  );
}
