import Link from "next/link";
import type { OperatingWorkflow } from "@/lib/d5o/workflow";

export function WorkflowDecisionPanel({ workflow }: { workflow: OperatingWorkflow }) {
  return (
    <section className="control-list workflow-decision-panel">
      <p className="eyebrow">Decision Required</p>
      <h3>{workflow.requiredDecision.question}</h3>
      {workflow.requiredDecision.options?.length ? (
        <ul className="compact-list">
          {workflow.requiredDecision.options.map((option) => (
            <li key={option}>{option}</li>
          ))}
        </ul>
      ) : null}
      <p>{workflow.requiredAction.title}</p>
      <Link className="button button-secondary" href={workflow.targetHref}>Go Resolve</Link>
    </section>
  );
}
