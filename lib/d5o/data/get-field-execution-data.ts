import { dailyReports, mobilizationPlans, projects, workPackages } from "../seed-data";

export function getFieldExecutionData() {
  return {
    dailyReports,
    mobilizationPlans,
    projects,
    workPackages
  };
}
