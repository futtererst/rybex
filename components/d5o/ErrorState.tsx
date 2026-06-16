type ErrorStateProps = {
  title?: string;
  message: string;
  recoveryAction?: string;
};

export function ErrorState({
  title = "Operating view unavailable",
  message,
  recoveryAction = "Refresh the view or contact the platform owner if the condition repeats."
}: ErrorStateProps) {
  return (
    <section className="state-panel state-error" role="alert">
      <p className="eyebrow">Error</p>
      <h3>{title}</h3>
      <p>{message}</p>
      <small>{recoveryAction}</small>
    </section>
  );
}
