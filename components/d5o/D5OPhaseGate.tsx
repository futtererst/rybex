import { d5oPhaseMap } from "@/lib/d5o/config";
import { artifactLabels, chipClass, dateLabel } from "@/lib/d5o/presentation";
import type { D5OGate } from "@/lib/d5o/types";

type D5OPhaseGateProps = {
  gate: D5OGate;
  compact?: boolean;
};

export function D5OPhaseGate({ gate, compact = false }: D5OPhaseGateProps) {
  const phase = d5oPhaseMap[gate.phaseId];
  const status = phase.statusOptions.find((option) => option.id === gate.status);
  const missingArtifacts = gate.artifacts.filter((artifact) => artifact.status === "missing");
  const readinessPercent = Math.max(0, Math.min(100, gate.readinessPercent));

  return (
    <article className="gate-card">
      <div className="gate-heading">
        <div>
          <p className="eyebrow">{phase.label}</p>
          <h3>{gate.name}</h3>
        </div>
        <span className={chipClass(status?.tone ?? "neutral")}>
          {status?.label ?? gate.status}
        </span>
      </div>

      <p className="muted">{phase.purpose}</p>

      <div className="status-row">
        <strong>{readinessPercent}% ready</strong>
        <span className="muted">Owner: {gate.owner}</span>
      </div>
      <div className="progress-track" aria-label={`${readinessPercent}% gate ready`}>
        <div
          className="progress-bar"
          style={{ width: `${readinessPercent}%` }}
        />
      </div>

      {!compact && (
        <div className="detail-grid">
          <div className="detail">
            <span>Approver</span>
            <strong>{gate.approver}</strong>
          </div>
          <div className="detail">
            <span>Next Action</span>
            <strong>{gate.nextRequiredAction}</strong>
          </div>
        </div>
      )}

      {gate.artifacts.length > 0 ? (
        <ul className="artifact-list">
          {gate.artifacts.map((artifact) => (
            <li key={artifact.id}>
              <span className={`artifact-state artifact-${artifact.status}`} />
              <span>
                <strong>{artifact.name}</strong>
                <small className="muted">
                  {artifactLabels[artifact.status]} by {artifact.owner}
                  {artifact.dueDate ? ` due ${dateLabel(artifact.dueDate)}` : ""}
                </small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No required artifacts have been configured for this gate.</p>
      )}

      {missingArtifacts.length > 0 ? (
        <p className="missing-callout">
          Missing: {missingArtifacts.map((artifact) => artifact.name).join(", ")}
        </p>
      ) : gate.artifacts.length > 0 ? (
        <p className="ready-callout">No required artifacts are missing.</p>
      ) : null}
    </article>
  );
}
