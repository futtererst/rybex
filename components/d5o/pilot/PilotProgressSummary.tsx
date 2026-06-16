"use client";

import { useState } from "react";
import { formatPilotProgressTitle } from "@/lib/d5o/pilot/pilot-slice";
import type { CompletionWorkflowId } from "@/lib/d5o/workflow-completion/definition-types";
import { useWorkflowCompletion } from "@/components/d5o/workflow-completion/WorkflowCompletionProvider";
import { PilotWorkflowCard } from "./PilotWorkflowCard";

type PilotProgressSummaryProps = {
  completionModeLabel: string;
};

export function PilotProgressSummary({ completionModeLabel }: PilotProgressSummaryProps) {
  const completion = useWorkflowCompletion();
  const [resetMessage, setResetMessage] = useState("");
  const progress = completion.getPilotProgress();
  const progressTitle = formatPilotProgressTitle(progress);

  function resetPilotDemoState() {
    const confirmed = window.confirm("Reset only the three Pilot Mode demo workflows?");
    if (!confirmed) return;

    completion.resetPilotWorkflows();
    setResetMessage("Pilot demo state reset.");
  }

  return (
    <section className="pilot-progress" data-qa="pilot-progress-summary">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pilot progress</p>
            <h2 data-qa="pilot-progress-title">{progressTitle}</h2>
            <p>Work through the proven operating slice in order or open any workflow directly.</p>
          </div>
          <span className="chip chip-info" data-qa="pilot-progress-percent">{progress.percentComplete}% complete</span>
        </div>
        <div className="metrics-grid">
          <div className="metric-card metric-success">
            <span className="metric-label">Complete</span>
            <strong data-qa="pilot-progress-complete-count">{progress.completed}</strong>
            <span>Resolved workflows</span>
          </div>
          <div className="metric-card metric-warning">
            <span className="metric-label">In progress</span>
            <strong data-qa="pilot-progress-in-progress-count">{progress.inProgress}</strong>
            <span>Started but not resolved</span>
          </div>
          <div className="metric-card metric-info">
            <span className="metric-label">Not started</span>
            <strong data-qa="pilot-progress-not-started-count">{progress.notStarted}</strong>
            <span>Ready to begin</span>
          </div>
          <div className="metric-card metric-warning">
            <span className="metric-label">Mode</span>
            <strong>{completionModeLabel}</strong>
            <span>Database pilot is opt-in</span>
          </div>
        </div>
        <div className="completion-action-row">
          <button className="button button-secondary" data-qa="reset-pilot-demo-state" onClick={resetPilotDemoState} type="button">
            Reset Pilot Demo State
          </button>
          {resetMessage ? <span className="muted" data-qa="pilot-reset-message">{resetMessage}</span> : null}
        </div>
      </section>

      <div className="project-detail-grid" data-qa="pilot-workflow-list">
        {progress.workflows.map((workflow) => (
          <PilotWorkflowCard
            businessValue={workflow.businessValue}
            completionItemId={workflow.completionItemId}
            completionModeLabel={completionModeLabel}
            currentState={workflow.currentState}
            dueDate={workflow.dueDate}
            key={workflow.workflowId}
            outcomeRecord={completion.getOutcomeRecord(workflow.workflowId as CompletionWorkflowId)}
            owner={workflow.owner}
            status={workflow.status}
            targetRoute={workflow.targetRoute}
            title={workflow.label}
            traceHref={workflow.traceHref}
          />
        ))}
      </div>
    </section>
  );
}
