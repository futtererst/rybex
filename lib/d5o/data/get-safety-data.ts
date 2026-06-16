import {
  correctiveActions,
  jhaRecords,
  projects,
  safetyIncidents,
  safetyObservations,
  safetyPlans,
  toolboxTalks,
  workPackages
} from "../seed-data";

export function getSafetyData() {
  return {
    correctiveActions,
    jhaRecords,
    projects,
    safetyIncidents,
    safetyObservations,
    safetyPlans,
    toolboxTalks,
    workPackages
  };
}
