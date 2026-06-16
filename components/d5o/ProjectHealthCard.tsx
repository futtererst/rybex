import Link from "next/link";
import { d5oPhaseMap } from "@/lib/d5o/config";
import {
  chipClass,
  compactCurrency,
  dateLabel,
  healthLabels,
  healthTone
} from "@/lib/d5o/presentation";
import { serviceLineLabels } from "@/lib/d5o/opportunity-config";
import type { RybexProject } from "@/lib/d5o/types";

type ProjectHealthCardProps = {
  project: RybexProject;
  openRiskCount: number;
  openIssueCount: number;
  openRfiCount: number;
  openChangeCount: number;
  missingArtifactCount: number;
};

export function ProjectHealthCard({
  project,
  openRiskCount,
  openIssueCount,
  openRfiCount,
  openChangeCount,
  missingArtifactCount
}: ProjectHealthCardProps) {
  const phase = d5oPhaseMap[project.d5oPhase];

  return (
    <article className="project-card" id={project.id}>
      <div className="project-card-top">
        <div>
          <h3>{project.name}</h3>
          <p className="muted">{project.gcClient}</p>
        </div>
        <span className={chipClass(healthTone[project.healthStatus])}>
          {healthLabels[project.healthStatus]}
        </span>
      </div>

      <div className="detail-grid">
        <div className="detail">
          <span>Service Line</span>
          <strong>{project.serviceLines.map((line) => serviceLineLabels[line]).join(", ")}</strong>
        </div>
        <div className="detail">
          <span>Location</span>
          <strong>{project.location}</strong>
        </div>
        <div className="detail">
          <span>D5O Phase</span>
          <strong>{phase.label}</strong>
        </div>
        <div className="detail">
          <span>Contract Value</span>
          <strong>
            {project.contractValue ? compactCurrency.format(project.contractValue) : "Not baselined"}
          </strong>
        </div>
        <div className="detail">
          <span>Next Milestone</span>
          <strong>{project.nextMilestone}</strong>
        </div>
        <div className="detail">
          <span>Milestone Date</span>
          <strong>{dateLabel(project.nextMilestoneDate)}</strong>
        </div>
      </div>

      <div className="card-row">
        <span className="muted">
          {openRiskCount + openIssueCount} risks/issues | {openRfiCount} RFIs |{" "}
          {openChangeCount} changes · {missingArtifactCount} missing artifacts
        </span>
      </div>
      <div className="card-row">
        <strong className="muted">Owner: {project.projectManager}</strong>
        <Link className="button button-secondary" href={`/projects#${project.id}`}>
          View Project
        </Link>
      </div>
    </article>
  );
}
