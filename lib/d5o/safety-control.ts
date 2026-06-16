import type {
  CorrectiveAction,
  JhaRecord,
  SafetyIncident,
  SafetyObservation,
  SafetyPlan,
  ToolboxTalk
} from "./types";

const today = "2026-06-10";
const isOpen = (status: string) => !["closed", "verified", "passed"].includes(status);
const isOverdue = (date: string, status: string) => isOpen(status) && date < today;

export type SafetyControlSummary = {
  safetyControlScore: number;
  blockers: string[];
  warnings: string[];
  overdueActions: CorrectiveAction[];
  missingReadinessItems: string[];
  incidentFollowUps: SafetyIncident[];
  requiredActions: string[];
  nextActions: string[];
};

export function evaluateSafetyControl({
  safetyPlans,
  jhaRecords,
  toolboxTalks,
  observations,
  incidents,
  correctiveActions
}: {
  safetyPlans: SafetyPlan[];
  jhaRecords: JhaRecord[];
  toolboxTalks: ToolboxTalk[];
  observations: SafetyObservation[];
  incidents: SafetyIncident[];
  correctiveActions: CorrectiveAction[];
}): SafetyControlSummary {
  const missingPlans = safetyPlans.filter((plan) =>
    plan.requiredForMobilization && ["not_started", "draft", "blocked"].includes(plan.status)
  );
  const missingJhas = jhaRecords.filter((record) =>
    record.requiredBeforeWork && (!record.crewAcknowledged || ["draft", "overdue", "blocked"].includes(record.status))
  );
  const toolboxDue = toolboxTalks.filter((talk) => ["scheduled", "overdue"].includes(talk.status));
  const openObservations = observations.filter((observation) => isOpen(observation.status));
  const overdueActions = correctiveActions.filter((action) => isOverdue(action.dueDate, action.status));
  const incidentFollowUps = incidents.filter((incident) =>
    isOpen(incident.status) || incident.rootCause.toLowerCase().includes("pending")
  );
  const competentPersonGaps = safetyPlans.filter((plan) =>
    plan.competentPersonRequired && !plan.competentPersonAssigned
  );

  const blockers = [
    ...missingPlans.map((plan) => `${plan.projectName}: safety plan not ready for mobilization.`),
    ...missingJhas.map((record) => `${record.projectName}: ${record.title} missing crew acknowledgement.`),
    ...overdueActions.map((action) => `${action.projectName}: ${action.title} is overdue.`),
    ...competentPersonGaps.map((plan) => `${plan.projectName}: competent person assignment missing.`)
  ];
  const warnings = [
    ...toolboxDue.map((talk) => `${talk.projectName}: toolbox talk ${talk.topic} is due.`),
    ...openObservations.map((observation) => `${observation.projectName}: ${observation.description}`),
    ...incidentFollowUps.map((incident) => `${incident.projectName}: ${incident.description}`)
  ];
  const totalSignals =
    safetyPlans.length +
    jhaRecords.length +
    toolboxTalks.length +
    observations.length +
    incidents.length +
    correctiveActions.length;
  const openRiskCount =
    missingPlans.length +
    missingJhas.length +
    toolboxDue.length +
    openObservations.length +
    overdueActions.length +
    incidentFollowUps.length +
    competentPersonGaps.length;
  const safetyControlScore = Math.max(0, Math.min(100, Math.round(100 - (openRiskCount / Math.max(totalSignals, 1)) * 100)));

  return {
    safetyControlScore,
    blockers,
    warnings,
    overdueActions,
    missingReadinessItems: [
      ...missingPlans.map((plan) => plan.planName),
      ...missingJhas.map((record) => record.title),
      ...competentPersonGaps.map((plan) => `Competent person: ${plan.projectName}`)
    ],
    incidentFollowUps,
    requiredActions: blockers.slice(0, 6),
    nextActions: [
      ...overdueActions.map((action) => action.nextAction),
      ...missingJhas.map((record) => record.nextAction),
      ...incidentFollowUps.map((incident) => incident.nextAction)
    ].filter(Boolean).slice(0, 6)
  };
}
