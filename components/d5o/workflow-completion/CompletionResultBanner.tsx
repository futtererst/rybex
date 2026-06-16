type CompletionResultBannerProps = {
  message: string;
  nextStep: string;
  qaSelector?: string;
  tone?: "success" | "warning" | "error";
};

export function CompletionResultBanner({ message, nextStep, qaSelector = "workflow-completion-result", tone = "success" }: CompletionResultBannerProps) {
  return (
    <div className={`completion-result completion-result-${tone}`} data-qa={qaSelector}>
      <strong>{message}</strong>
      <span>{nextStep}</span>
    </div>
  );
}
