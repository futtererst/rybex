import {
  gcPerformanceProfiles,
  improvementActions,
  lessonsLearned,
  productionRateRecords,
  projectPerformanceScorecards,
  riskLibraryItems,
  vendorPerformanceProfiles
} from "../seed-data";

export function getOptimizeData() {
  return {
    gcPerformanceProfiles,
    improvementActions,
    lessonsLearned,
    productionRateRecords,
    projectPerformanceScorecards,
    riskLibraryItems,
    vendorPerformanceProfiles
  };
}
