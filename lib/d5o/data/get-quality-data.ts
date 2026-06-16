import {
  correctiveActions,
  projects,
  punchItems,
  qualityDeficiencies,
  qualityInspections,
  testRecords,
  workPackages
} from "../seed-data";

export function getQualityData() {
  return {
    correctiveActions,
    projects,
    punchItems,
    qualityDeficiencies,
    qualityInspections,
    testRecords,
    workPackages
  };
}
