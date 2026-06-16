import {
  acceptanceRecords,
  asBuiltRecords,
  changeEvents,
  closeoutPackages,
  closeoutRequirements,
  correctiveActions,
  dailyReports,
  lienWaivers,
  payApplications,
  projects,
  punchItems,
  qualityDeficiencies,
  rfis,
  submittals,
  testRecords,
  warrantyRecords
} from "../seed-data";

export function getCloseoutData() {
  return {
    acceptanceRecords,
    asBuiltRecords,
    changeEvents,
    closeoutPackages,
    closeoutRequirements,
    correctiveActions,
    dailyReports,
    lienWaivers,
    payApplications,
    projects,
    punchItems,
    qualityDeficiencies,
    rfis,
    submittals,
    testRecords,
    warrantyRecords
  };
}
