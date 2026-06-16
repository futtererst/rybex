import { ProjectPerformanceScorecard } from "./ProjectPerformanceScorecard";
import type { ProjectPerformanceScorecard as Scorecard } from "@/lib/d5o/types";

export function ProjectScorecardGrid({ scorecards }: { scorecards: Scorecard[] }) {
  return (
    <div className="project-detail-grid">
      {scorecards.map((scorecard) => (
        <ProjectPerformanceScorecard key={scorecard.id} scorecard={scorecard} />
      ))}
    </div>
  );
}
