import {
  billingBackupItems,
  changeEvents,
  closeoutPackages,
  commercialExposureItems,
  lienWaivers,
  payApplications,
  projects,
  punchItems,
  qualityDeficiencies,
  scheduleOfValues
} from "../seed-data";

export function getBillingData() {
  return {
    billingBackupItems,
    changeEvents,
    closeoutPackages,
    commercialExposureItems,
    lienWaivers,
    payApplications,
    projects,
    punchItems,
    qualityDeficiencies,
    scheduleOfValues
  };
}
