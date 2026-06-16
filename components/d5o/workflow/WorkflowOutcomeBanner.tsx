import type { WorkflowTransactionResult } from "@/lib/d5o/workflow/transactions";

type WorkflowOutcomeBannerProps = {
  result: WorkflowTransactionResult;
};

export function WorkflowOutcomeBanner({ result }: WorkflowOutcomeBannerProps) {
  return (
    <div className={`workflow-outcome-banner ${result.success ? "workflow-outcome-success" : "workflow-outcome-error"}`}>
      <strong>{result.message}</strong>
      <p>{result.outcome.nextGateOrStatus.label}</p>
      <small>{result.nextRecommendedStep}</small>
    </div>
  );
}
