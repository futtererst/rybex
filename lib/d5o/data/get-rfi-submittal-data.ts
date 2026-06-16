import { dailyReports, projects, rfis, submittals, workPackages } from "../seed-data";

export function getRfiSubmittalData() {
  return {
    dailyReports,
    projects,
    rfis,
    submittals,
    workPackages
  };
}
