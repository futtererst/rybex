import { changeEvents, dailyReports, projects, rfis, workPackages } from "../seed-data";

export function getChangeControlData() {
  return {
    changeEvents,
    dailyReports,
    projects,
    rfis,
    workPackages
  };
}
