import { SafetyObservationCard } from "./SafetyObservationCard";
import type { SafetyObservation } from "@/lib/d5o/types";

export function SafetyObservationTable({ observations }: { observations: SafetyObservation[] }) {
  if (observations.length === 0) {
    return <p className="empty-state">No safety observations are currently open.</p>;
  }

  return (
    <div className="project-detail-grid">
      {observations.map((observation) => (
        <SafetyObservationCard key={observation.id} observation={observation} />
      ))}
    </div>
  );
}
