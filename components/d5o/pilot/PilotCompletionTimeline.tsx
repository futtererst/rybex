import type { PilotWorkflow } from "@/lib/d5o/pilot/pilot-slice";

type PilotCompletionTimelineProps = {
  workflows: PilotWorkflow[];
};

export function PilotCompletionTimeline({ workflows }: PilotCompletionTimelineProps) {
  return (
    <section className="panel" data-qa="pilot-completion-timeline" id="pilot-docs">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Operating path</p>
          <h2>Complete the slice</h2>
          <p>Cash recovery, field control, then closeout release.</p>
        </div>
      </div>
      <ol className="timeline-list">
        {workflows.map((workflow, index) => (
          <li key={workflow.workflowId}>
            <strong>{index + 1}. {workflow.label}</strong>
            <span>{workflow.businessValue}</span>
          </li>
        ))}
      </ol>
      <div className="pipeline-guardrail">
        <strong>Trace docs:</strong>
        <span>`docs/workflow-completion-engine.md`, `docs/field-issue-escalation-workflow-trace.md`, and `docs/closeout-requirement-completion-workflow-trace.md`.</span>
      </div>
    </section>
  );
}
