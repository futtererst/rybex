import Link from "next/link";
import { evaluateD2Gate } from "@/lib/d5o/d2-gate";
import {
  contractStatusLabels,
  contractStatusTone,
  launchDecisionLabels,
  launchDecisionTone
} from "@/lib/d5o/project-config";
import { chipClass, compactCurrency, dateLabel } from "@/lib/d5o/presentation";
import type { RybexProject } from "@/lib/d5o/types";

export function ProjectListTable({ projects }: { projects: RybexProject[] }) {
  return (
    <div className="table-wrap">
      <table className="opportunity-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>GC / Client</th>
            <th>Phase</th>
            <th>Contract</th>
            <th>Value</th>
            <th>D2 Ready</th>
            <th>Launch Decision</th>
            <th>Next Action</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const readiness = evaluateD2Gate(project);

            return (
              <tr id={project.id} key={project.id}>
                <td>
                  <strong>{project.name}</strong>
                  <small className="muted">{project.projectNumber}</small>
                </td>
                <td>{project.gcClient}</td>
                <td>{project.d5oPhase.toUpperCase()}</td>
                <td>
                  <span className={chipClass(contractStatusTone[project.contractStatus])}>
                    {contractStatusLabels[project.contractStatus]}
                  </span>
                </td>
                <td>{compactCurrency.format(project.contractValue)}</td>
                <td>{readiness.readinessPercent}%</td>
                <td>
                  <span className={chipClass(launchDecisionTone[readiness.recommendedDecision])}>
                    {launchDecisionLabels[readiness.recommendedDecision]}
                  </span>
                </td>
                <td>
                  {project.nextAction} <Link href={`/projects#${project.id}`}>Review</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
