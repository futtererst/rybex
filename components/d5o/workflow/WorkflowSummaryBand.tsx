import Link from "next/link";
import { workflowTypeConfig } from "@/lib/d5o/workflow";
import type { OperatingWorkflow, OperatingWorkflowType } from "@/lib/d5o/workflow";

type WorkflowSummaryBandProps = {
  workflowType?: OperatingWorkflowType;
  workflows: OperatingWorkflow[];
  title?: string;
  description?: string;
};

export function WorkflowSummaryBand({ workflowType, workflows, title, description }: WorkflowSummaryBandProps) {
  const config = workflowType ? workflowTypeConfig[workflowType] : undefined;
  const critical = workflows.filter((workflow) => workflow.severity === "critical").length;
  const blocked = workflows.filter((workflow) => workflow.resolutionState === "blocked").length;
  const overdue = workflows.filter((workflow) => workflow.resolutionState === "overdue").length;
  const decisions = workflows.filter((workflow) => workflow.resolutionState === "needs_decision").length;
  const valueAtRisk = workflows.reduce((total, workflow) => total + (workflow.valueAtRisk ?? 0), 0);

  return (
    <section className="workflow-summary-band">
      <div>
        <p className="eyebrow">{config?.shortLabel ?? "Workflow Operating Layer"}</p>
        <h2>{title ?? config?.label ?? "Operating workflows"}</h2>
        <p>{description ?? config?.purpose ?? "Signal, decision, action, evidence, and gate movement are tracked as the operating spine."}</p>
      </div>
      <div className="workflow-summary-metrics">
        <span><strong>{workflows.length}</strong>open workflows</span>
        <span><strong>{critical}</strong>critical</span>
        <span><strong>{blocked}</strong>blocked</span>
        <span><strong>{overdue}</strong>overdue</span>
        <span><strong>{decisions}</strong>decisions</span>
        {valueAtRisk > 0 ? <span><strong>{valueAtRisk.toLocaleString("en-US", { currency: "USD", maximumFractionDigits: 0, notation: "compact", style: "currency" })}</strong>at risk</span> : null}
      </div>
      {config ? (
        <Link className="button button-secondary" href={config.targetHref}>
          {config.targetModule}
        </Link>
      ) : null}
    </section>
  );
}
