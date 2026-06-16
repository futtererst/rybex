import { chipClass, dateLabel } from "@/lib/d5o/presentation";
import { safetyIncidentTypeLabels, safetySeverityLabels, safetySeverityTone, safetyStatusLabels, safetyStatusTone } from "@/lib/d5o/safety-config";
import type { SafetyIncident } from "@/lib/d5o/types";

export function IncidentRegister({ incidents }: { incidents: SafetyIncident[] }) {
  return (
    <section className="control-list">
      <h3>Incident / near-miss register</h3>
      <ul className="record-list">
        {incidents.map((incident) => (
          <li key={incident.id}>
            <div>
              <strong>{safetyIncidentTypeLabels[incident.incidentType]}: {incident.description}</strong>
              <span>{incident.projectName} | {dateLabel(incident.date)}</span>
            </div>
            <span className={chipClass(safetySeverityTone[incident.severity])}>{safetySeverityLabels[incident.severity]}</span>
            <span className={chipClass(safetyStatusTone[incident.status])}>{safetyStatusLabels[incident.status]}</span>
            <p>{incident.nextAction}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
