import { StageGateSummary } from "@/components/d5o/stage-gates/StageGateSummary";
import { getWorkflowContext } from "@/lib/d5o/workflow";
import type { OperatingWorkflowType } from "@/lib/d5o/workflow";
import { DecisionQueue } from "./DecisionQueue";
import { NextBestAction } from "./NextBestAction";
import { RoleContextBand } from "./RoleContextBand";

type WorkflowModuleContextProps = {
  workflowType: OperatingWorkflowType;
  queueTitle?: string;
  queueDescription?: string;
  limitPerGroup?: number;
};

export function WorkflowModuleContext({
  workflowType,
  queueTitle,
  queueDescription,
  limitPerGroup = 2
}: WorkflowModuleContextProps) {
  const { config, workflows } = getWorkflowContext(workflowType);
  const sectionId = `${workflowType}-workflow-actions`;
  const contextualWorkflows = workflows.map((workflow) => ({
    ...workflow,
    targetHref: workflow.targetHref === config.targetHref ? `#${sectionId}` : workflow.targetHref
  }));
  const topWorkflow = contextualWorkflows[0];
  const blocker = contextualWorkflows.find((workflow) => workflow.resolutionState === "blocked" || workflow.resolutionState === "overdue");
  const readinessPercent = topWorkflow
    ? topWorkflow.resolutionState === "resolved"
      ? 100
      : topWorkflow.resolutionState === "ready_for_review"
        ? 82
        : topWorkflow.resolutionState === "in_progress"
          ? 68
          : topWorkflow.resolutionState === "blocked" || topWorkflow.resolutionState === "overdue"
            ? 42
            : 58
    : 100;

  return (
    <section className="workflow-module-context" data-qa="workflow-module-context" id={sectionId}>
      <RoleContextBand workflowType={workflowType} />
      <StageGateSummary
        dueDate={topWorkflow?.dueDate}
        evidenceNeeded={topWorkflow?.evidenceNeeded.required ?? config.typicalEvidence}
        gateName={config.label}
        nextMovement={topWorkflow?.nextGateOrStatus.label ?? "No gate movement required"}
        owner={topWorkflow?.owner ?? "Module owner"}
        phase={config.d5oPhase}
        primaryBlocker={blocker?.signal.title}
        primaryCta={{ href: `#${sectionId}`, label: `Review ${config.shortLabel}` }}
        readinessPercent={readinessPercent}
        requiredAction={topWorkflow?.requiredAction.title ?? config.typicalActions[0] ?? "Review module"}
        requiredDecision={topWorkflow?.requiredDecision.question ?? config.primaryQuestion}
        status={topWorkflow ? topWorkflow.resolutionState.replaceAll("_", " ") : "clear"}
      />
      <NextBestAction
        after={topWorkflow?.nextGateOrStatus.label ?? "Module stays clear."}
        ctaLabel="Review workflow action"
        href={topWorkflow?.targetHref ?? config.targetHref}
        title={topWorkflow?.requiredAction.title ?? config.typicalActions[0] ?? "Review current work"}
        why={topWorkflow?.businessImpact ?? config.primaryQuestion}
      />
      <DecisionQueue
        limit={limitPerGroup * 4}
        title={queueTitle ?? queueDescription ?? `${config.shortLabel} actions`}
        workflows={contextualWorkflows}
      />
    </section>
  );
}
