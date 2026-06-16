import type {
  ImprovementActionStatus,
  LessonCategory,
  LessonStatus,
  OptimizeSeverity,
  OptimizeTargetModule,
  PursuitPosture,
  VendorUsePosture
} from "./types";

export const lessonCategoryLabels: Record<LessonCategory, string> = {
  estimating: "Estimating",
  scope: "Scope",
  contract: "Contract",
  mobilization: "Mobilization",
  field_execution: "Field Execution",
  safety: "Safety",
  quality: "Quality",
  rfi_submittal: "RFI / Submittal",
  change_control: "Change Control",
  billing: "Billing",
  closeout: "Closeout",
  gc_client: "GC / Client",
  vendor: "Vendor",
  crew_productivity: "Crew Productivity",
  documentation: "Documentation",
  other: "Other"
};

export const lessonStatusLabels: Record<LessonStatus, string> = {
  draft: "Draft",
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  implemented: "Implemented",
  verified: "Verified",
  closed: "Closed",
  deferred: "Deferred"
};

export const improvementStatusLabels: Record<ImprovementActionStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  implemented: "Implemented",
  verified: "Verified",
  closed: "Closed",
  deferred: "Deferred",
  overdue: "Overdue"
};

export const optimizeStatusTone: Record<LessonStatus | ImprovementActionStatus, string> = {
  draft: "neutral",
  open: "warning",
  assigned: "info",
  in_progress: "warning",
  implemented: "success",
  verified: "success",
  closed: "neutral",
  deferred: "neutral",
  overdue: "critical"
};

export const optimizeSeverityLabels: Record<OptimizeSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical"
};

export const optimizeSeverityTone: Record<OptimizeSeverity, string> = {
  low: "info",
  medium: "warning",
  high: "critical",
  critical: "critical"
};

export const pursuitPostureLabels: Record<PursuitPosture, string> = {
  preferred: "Preferred",
  pursue: "Pursue",
  pursue_with_controls: "Pursue with Controls",
  caution: "Caution",
  avoid: "Avoid"
};

export const pursuitPostureTone: Record<PursuitPosture, string> = {
  preferred: "success",
  pursue: "info",
  pursue_with_controls: "warning",
  caution: "critical",
  avoid: "critical"
};

export const vendorPostureLabels: Record<VendorUsePosture, string> = {
  preferred: "Preferred",
  approved: "Approved",
  approved_with_controls: "Approved with Controls",
  probation: "Probation",
  avoid: "Avoid"
};

export const vendorPostureTone: Record<VendorUsePosture, string> = {
  preferred: "success",
  approved: "info",
  approved_with_controls: "warning",
  probation: "critical",
  avoid: "critical"
};

export const targetModuleLabels: Record<OptimizeTargetModule, string> = {
  pipeline: "Pipeline",
  projects: "Projects",
  mobilization: "Mobilization",
  field_execution: "Field Execution",
  safety: "Safety",
  quality: "Quality",
  rfis_submittals: "RFIs / Submittals",
  changes: "Changes",
  billing: "Billing",
  closeout: "Closeout",
  reports: "Optimize",
  admin: "Admin"
};

export const scoreTone = (score: number) => {
  if (score >= 85) return "success";
  if (score >= 70) return "info";
  if (score >= 55) return "warning";
  return "critical";
};

export const optimizeHelperText = {
  productionRates:
    "Production rate variance should update future estimating assumptions when the sample is credible.",
  gcBehavior:
    "GC payment and change approval behavior should influence future go/no-go scoring.",
  lessons:
    "Lessons learned are only valuable if they update the operating system, not if they sit in a meeting note."
};
