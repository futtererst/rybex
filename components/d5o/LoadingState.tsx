type LoadingStateProps = {
  label?: string;
  detail?: string;
};

export function LoadingState({
  label = "Loading operating data",
  detail = "Preparing the current D5O control view."
}: LoadingStateProps) {
  return (
    <section className="state-panel state-loading" aria-live="polite">
      <p className="eyebrow">Loading</p>
      <h3>{label}</h3>
      <p>{detail}</p>
    </section>
  );
}
