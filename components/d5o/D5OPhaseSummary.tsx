import Link from "next/link";
import { d5oPhaseMap } from "@/lib/d5o/config";
import { chipClass, healthLabels, healthTone } from "@/lib/d5o/presentation";
import type { D5OPhaseId, RybexProject } from "@/lib/d5o/types";

type D5OPhaseSummaryProps = {
  phaseId: D5OPhaseId;
  projects: RybexProject[];
};

export function D5OPhaseSummary({ phaseId, projects }: D5OPhaseSummaryProps) {
  const phase = d5oPhaseMap[phaseId];

  return (
    <section className="phase-lane">
      <div className="phase-lane-header">
        <div>
          <strong>{phase.label}</strong>
          <p className="muted">{phase.primaryQuestion}</p>
        </div>
        <span className="chip chip-neutral">{projects.length}</span>
      </div>

      {projects.length > 0 ? (
        <ul className="compact-list">
          {projects.map((project) => (
            <li key={project.id}>
              <span className="artifact-state artifact-complete" />
              <span>
                <Link href={`/projects#${project.id}`}>
                  <strong>{project.name}</strong>
                </Link>
                <small className={chipClass(healthTone[project.healthStatus])}>
                  {healthLabels[project.healthStatus]}
                </small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          No active work is currently assigned to this phase. New records will appear
          here as pursuits and projects move through D5O.
        </p>
      )}
    </section>
  );
}
