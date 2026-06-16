import { QualityInspectionCard } from "./QualityInspectionCard";
import type { QualityInspection } from "@/lib/d5o/types";

export function InspectionRegister({ inspections }: { inspections: QualityInspection[] }) {
  return (
    <div className="project-detail-grid">
      {inspections.map((inspection) => (
        <QualityInspectionCard inspection={inspection} key={inspection.id} />
      ))}
    </div>
  );
}
