type PilotModeGuardrailsProps = {
  guardrails: string[];
};

export function PilotModeGuardrails({ guardrails }: PilotModeGuardrailsProps) {
  return (
    <section className="panel" data-qa="pilot-mode-guardrails">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Guardrails</p>
          <h2>Controlled internal pilot candidate</h2>
          <p>Not production ready.</p>
        </div>
      </div>
      <ul className="compact-list">
        {guardrails.map((guardrail) => (
          <li key={guardrail}>
            <span className="artifact-state artifact-pending" />
            <span>{guardrail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
