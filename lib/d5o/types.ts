export type D5OPhaseId =
  | "discover"
  | "define"
  | "prepare"
  | "deliver"
  | "close"
  | "optimize";

export type UserRole =
  | "executive"
  | "operations_leader"
  | "project_manager"
  | "estimator"
  | "superintendent"
  | "field_supervisor"
  | "safety_manager"
  | "quality_manager"
  | "finance_admin"
  | "admin";

export type ProjectHealthStatus =
  | "on_track"
  | "watch"
  | "at_risk"
  | "critical"
  | "blocked"
  | "closed";

export type ArtifactStatus = "complete" | "missing" | "pending" | "waived";

export type OpportunityStatus =
  | "new_intake"
  | "under_review"
  | "awaiting_go_no_go"
  | "approved_to_bid"
  | "estimating"
  | "submitted"
  | "won"
  | "lost"
  | "declined"
  | "no_bid";

export type OpportunityProjectType =
  | "telecom_carrier"
  | "data_center"
  | "broadband_expansion"
  | "long_haul_fiber"
  | "edge_facility"
  | "utility_civil"
  | "structured_cabling"
  | "underground_infrastructure";

export type OpportunityServiceLine =
  | "engineering"
  | "infrastructure"
  | "integration"
  | "civil_support"
  | "data_center_support"
  | "structured_cabling"
  | "fiber_splicing_testing";

export type OpportunityRiskLevel = "low" | "moderate" | "high" | "severe";

export type GoNoGoRecommendation =
  | "pursue"
  | "pursue_with_mitigations"
  | "hold_for_clarification"
  | "decline"
  | "no_bid";

export type PursuitDecision =
  | "pending"
  | "approve_to_bid"
  | "hold_for_clarification"
  | "decline_no_bid";

export type GoNoGoDimensionKey =
  | "strategic_fit"
  | "execution_fit"
  | "commercial_fit"
  | "risk_exposure";

export type GoNoGoDimensionInput = {
  score: number;
  label: string;
  rationale: string;
};

export type OpportunityRiskCategory =
  | "strategic"
  | "execution"
  | "commercial"
  | "safety"
  | "documentation";

export type OpportunityRiskFactor = {
  id: string;
  category: OpportunityRiskCategory;
  title: string;
  severity: OpportunityRiskLevel;
  rationale: string;
  mitigation: string;
  owner?: string;
};

export type OpportunityReviewStatus = "not_started" | "in_review" | "complete" | "blocked";

export type RequiredOpportunityReview = {
  id: string;
  label: string;
  owner: string;
  role: UserRole;
  status: OpportunityReviewStatus;
  dueDate?: string;
};

export type ContractStatus =
  | "not_started"
  | "draft_received"
  | "under_review"
  | "redlines_required"
  | "approved"
  | "executed"
  | "blocked";

export type BaselineStatus = "not_started" | "draft" | "under_review" | "approved" | "blocked";

export type ProjectLaunchDecision =
  | "ready_for_mobilization_planning"
  | "hold_for_contract_review"
  | "hold_for_scope_clarification"
  | "hold_for_budget_baseline"
  | "hold_for_schedule_alignment"
  | "blocked";

export type MobilizationReadinessStatus =
  | "not_started"
  | "planning"
  | "awaiting_inputs"
  | "blocked"
  | "ready_for_review"
  | "approved_for_field_start"
  | "field_started";

export type MobilizationDecision =
  | "approve_field_start"
  | "hold_for_safety"
  | "hold_for_access_or_permits"
  | "hold_for_materials"
  | "hold_for_crew_or_equipment"
  | "hold_for_work_packages"
  | "hold_for_quality_requirements"
  | "blocked";

export type WorkPackageStatus =
  | "draft"
  | "awaiting_inputs"
  | "ready_for_field"
  | "in_progress"
  | "complete"
  | "blocked";

export type DailyReportStatus =
  | "draft"
  | "submitted"
  | "supervisor_review"
  | "approved"
  | "rejected"
  | "missing"
  | "late";

export type ProductionStatus =
  | "ahead"
  | "on_plan"
  | "behind"
  | "blocked"
  | "not_started"
  | "complete";

export type FieldExecutionDecision =
  | "continue_work"
  | "escalate_issue"
  | "create_rfi"
  | "create_change_event"
  | "create_safety_action"
  | "create_quality_action"
  | "hold_work"
  | "ready_for_closeout_review";

export type SafetyQualityStatus =
  | "not_started"
  | "draft"
  | "scheduled"
  | "open"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "passed"
  | "failed"
  | "corrected"
  | "verified"
  | "closed"
  | "overdue"
  | "blocked";

export type SafetySeverity = "low" | "medium" | "high" | "critical";
export type SafetyObservationType = "positive" | "at_risk_condition" | "at_risk_behavior" | "near_miss" | "incident" | "stop_work";
export type SafetyIncidentType = "near_miss" | "first_aid" | "recordable" | "property_damage" | "utility_strike" | "vehicle_equipment" | "environmental";
export type CorrectiveActionSourceType = "safety_observation" | "safety_incident" | "quality_deficiency" | "quality_inspection" | "punch_item" | "field_report";
export type JhaRecordType = "jha" | "toolbox_talk";
export type QualitySeverity = "low" | "medium" | "high" | "critical";
export type QualityInspectionType = "conduit_depth" | "fiber_test" | "rack_integration" | "structured_cabling" | "grounding_bonding" | "restoration" | "photo_documentation" | "general";
export type QualityPassFailResult = "not_recorded" | "pass" | "pass_with_notes" | "fail";
export type TestRecordType = "otdr" | "copper_certification" | "fiber_power_meter" | "grounding" | "continuity" | "photo_evidence" | "conduit_mandrel" | "other";

export type PaymentTerm = {
  billingCycle: string;
  payWhenPaid: boolean;
  retainagePercent: number;
  notes: string;
};

export type NoticeRequirement = {
  trigger: string;
  noticeWindow: string;
  deliveryMethod: string;
  owner: string;
};

export type FlowDownObligation = {
  id: string;
  title: string;
  owner: string;
  status: ArtifactStatus;
  businessImpact: string;
};

export type ScopeMatrixItem = {
  id: string;
  category: "included" | "excluded" | "assumption" | "clarification" | "dependency";
  description: string;
  owner: string;
  status: ArtifactStatus;
};

export type ContractBaseline = {
  status: ContractStatus;
  summary: string;
  reviewedBy: string;
  reviewDueDate?: string;
  redlineNotes: string[];
};

export type BudgetBaseline = {
  status: BaselineStatus;
  originalEstimateValue: number;
  laborBudget: number;
  materialBudget: number;
  equipmentBudget: number;
  subcontractorBudget: number;
  contingency: number;
  notes: string;
};

export type ScheduleBaseline = {
  status: BaselineStatus;
  start: string;
  finish: string;
  milestones: string[];
  crewLoadingAssumptions: string[];
  materialProcurementAssumptions: string[];
  constraints: string[];
};

export type ProjectSetupArtifact = {
  id: string;
  name: string;
  status: ArtifactStatus;
  owner: string;
  dueDate?: string;
  requiredForD3: boolean;
};

export type D2GateReadiness = {
  readinessPercent: number;
  readyBoolean: boolean;
  missingRequiredArtifacts: string[];
  blockers: string[];
  warnings: string[];
  recommendedDecision: ProjectLaunchDecision;
  requiredApprovals: string[];
  nextActions: string[];
};

export type MobilizationBlocker = {
  id: string;
  category:
    | "safety"
    | "access"
    | "permit"
    | "locate"
    | "crew"
    | "equipment"
    | "material"
    | "quality"
    | "work_package"
    | "commercial";
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  owner: string;
  dueDate?: string;
  businessImpact: string;
  requiredAction: string;
};

export type CrewPlan = {
  crewName: string;
  supervisor: string;
  crewSize: number;
  availabilityStatus: ArtifactStatus;
  notes: string;
};

export type EquipmentReadinessItem = {
  id: string;
  name: string;
  status: ArtifactStatus;
  owner: string;
  neededDate: string;
  notes: string;
};

export type MaterialReadinessItem = {
  id: string;
  name: string;
  status: ArtifactStatus;
  owner: string;
  neededDate: string;
  deliveryStatus: string;
};

export type PermitAccessItem = {
  id: string;
  name: string;
  type: "permit" | "access" | "badging" | "row" | "environmental";
  status: ArtifactStatus;
  owner: string;
  dueDate?: string;
  notes: string;
};

export type UtilityLocateRecord = {
  required: boolean;
  status: ArtifactStatus;
  ticketNumber?: string;
  expirationDate?: string;
  owner: string;
  notes: string;
};

export type TrafficControlRequirement = {
  required: boolean;
  status: ArtifactStatus;
  owner: string;
  notes: string;
};

export type SafetyReadinessItem = {
  id: string;
  name: string;
  status: ArtifactStatus;
  owner: string;
  dueDate?: string;
  notes: string;
};

export type QualityReadinessItem = {
  id: string;
  name: string;
  status: ArtifactStatus;
  owner: string;
  dueDate?: string;
  notes: string;
};

export type WorkPackage = {
  id: string;
  projectId: string;
  name: string;
  location: string;
  scopeDescription: string;
  assignedCrew: string;
  fieldSupervisor: string;
  plannedStartDate: string;
  plannedFinishDate: string;
  drawings: string[];
  specifications: string[];
  materials: string[];
  equipment: string[];
  safetyNotes: string[];
  qualityChecks: string[];
  productionTarget: string;
  requiredPhotos: string[];
  requiredTests: string[];
  status: WorkPackageStatus;
  blockers: string[];
  nextAction: string;
};

export type KickoffRecord = {
  status: ArtifactStatus;
  scheduledDate?: string;
  completedDate?: string;
  attendees: string[];
  notes: string;
};

export type MobilizationPlan = {
  id: string;
  projectId: string;
  projectName: string;
  d5oPhase: D5OPhaseId;
  readinessStatus: MobilizationReadinessStatus;
  readinessPercent: number;
  plannedMobilizationDate: string;
  plannedFieldStartDate: string;
  mobilizationOwner: string;
  projectManager: string;
  superintendent: string;
  fieldSupervisor: string;
  safetyOwner: string;
  qualityOwner: string;
  operationsLead: string;
  crewPlan: CrewPlan;
  equipmentPlan: EquipmentReadinessItem[];
  materialPlan: MaterialReadinessItem[];
  permitAccessPlan: PermitAccessItem[];
  utilityLocateStatus: UtilityLocateRecord;
  trafficControlStatus: TrafficControlRequirement;
  safetyPlanStatus: ArtifactStatus;
  jhaStatus: ArtifactStatus;
  qualityPlanStatus: ArtifactStatus;
  workPackages: WorkPackage[];
  kickoffStatus: KickoffRecord;
  requiredSubmittalsStatus: ArtifactStatus;
  procurementStatus: ArtifactStatus;
  blockers: MobilizationBlocker[];
  warnings: string[];
  requiredApprovals: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type D3GateReadiness = {
  readinessPercent: number;
  readyBoolean: boolean;
  missingRequiredItems: string[];
  blockers: string[];
  warnings: string[];
  recommendedDecision: MobilizationDecision;
  requiredApprovals: string[];
  nextActions: string[];
};

export type FieldCrewMember = {
  id: string;
  name: string;
  role: string;
  company: string;
};

export type LaborHourEntry = {
  crewMemberId: string;
  name: string;
  role: string;
  regularHours: number;
  overtimeHours: number;
  costCode: string;
};

export type EquipmentUsageEntry = {
  id: string;
  name: string;
  hoursUsed: number;
  status: "available" | "used" | "down" | "standby";
  notes: string;
};

export type MaterialReceipt = {
  id: string;
  material: string;
  quantity: number;
  unit: string;
  status: "received" | "partial" | "short" | "damaged" | "not_received";
  notes: string;
};

export type InstalledQuantity = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  productionTarget: number;
  costCode: string;
};

export type FieldSafetyObservation = {
  id: string;
  type: "positive" | "observation" | "near_miss" | "incident" | "corrective_action";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  correctiveAction?: string;
  owner: string;
  status: "open" | "closed" | "escalated";
};

export type FieldQualityCheck = {
  id: string;
  check: string;
  status: "passed" | "deficiency" | "rework_required" | "pending";
  requirement: string;
  evidence: string[];
  owner: string;
  correctiveAction?: string;
};

export type FieldDelay = {
  id: string;
  reason: string;
  startTime?: string;
  durationHours: number;
  responsibleParty: "rybex" | "gc" | "owner" | "utility" | "weather" | "vendor" | "unknown";
  scheduleImpact: boolean;
  costImpact: boolean;
  documentationNeeded: string;
};

export type FieldBlocker = {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  owner: string;
  businessImpact: string;
  requiredAction: string;
};

export type ChangedCondition = {
  id: string;
  description: string;
  affectsCost: boolean;
  affectsSchedule: boolean;
  affectsScope: boolean;
  rfiNeeded: boolean;
  changeEventNeeded: boolean;
  noticeDeadline?: string;
  documentationStatus: ArtifactStatus;
};

export type FieldPhotoRecord = {
  id: string;
  description: string;
  category: "progress" | "safety" | "quality" | "changed_condition" | "closeout" | "delay";
  captured: boolean;
  requiredForCloseout: boolean;
};

export type SupervisorSignoff = {
  status: "not_started" | "pending" | "signed" | "rejected";
  signedBy?: string;
  signedAt?: string;
  notes: string;
};

export type D4GateReadiness = {
  controlScore: number;
  readyForCloseoutReviewBoolean: boolean;
  missingRequiredRecords: string[];
  blockers: string[];
  warnings: string[];
  recommendedDecision: FieldExecutionDecision;
  requiredActions: string[];
  productionHealth: ProductionStatus;
  documentationHealth: "healthy" | "watch" | "at_risk" | "blocked";
  safetyHealth: "healthy" | "watch" | "at_risk" | "blocked";
  qualityHealth: "healthy" | "watch" | "at_risk" | "blocked";
};

export type D5OStatusOption = {
  id: string;
  label: string;
  tone: "success" | "warning" | "critical" | "info" | "neutral" | "blocked";
};

export type D5OPhase = {
  id: D5OPhaseId;
  label: string;
  shortLabel: string;
  purpose: string;
  primaryQuestion: string;
  requiredArtifacts: string[];
  gateName: string;
  gateCriteria: string[];
  typicalOwners: UserRole[];
  statusOptions: D5OStatusOption[];
};

export type D5OGate = {
  id: string;
  phaseId: D5OPhaseId;
  name: string;
  owner: string;
  approver: string;
  readinessPercent: number;
  status: D5OStatusOption["id"];
  nextRequiredAction: string;
  artifacts: GateArtifact[];
};

export type GateArtifact = {
  id: string;
  name: string;
  status: ArtifactStatus;
  owner: string;
  dueDate?: string;
};

export type Opportunity = {
  id: string;
  name: string;
  gcClient: string;
  ownerOrPrime?: string;
  projectLocation: string;
  serviceLines: OpportunityServiceLine[];
  projectType: OpportunityProjectType;
  estimatedValue: number;
  bidDueDate: string;
  receivedDate: string;
  status: OpportunityStatus;
  d5oPhase: D5OPhaseId;
  pursuitOwner: string;
  estimator?: string;
  operationsReviewer: string;
  safetyReviewer?: string;
  financeReviewer?: string;
  probability: number;
  goNoGoScore: number;
  riskLevel: OpportunityRiskLevel;
  decision: PursuitDecision;
  decisionDate?: string;
  nextAction: string;
  nextActionOwner: string;
  documentsReceived: string[];
  addendaCount: number;
  scopeSummary: string;
  knownExclusions: string[];
  assumptions: string[];
  clarificationsNeeded: string[];
  riskFactors: OpportunityRiskFactor[];
  requiredReviews: RequiredOpportunityReview[];
  scoring: Record<GoNoGoDimensionKey, GoNoGoDimensionInput>;
  createdAt: string;
  updatedAt: string;
};

export type RybexProject = {
  id: string;
  projectNumber: string;
  name: string;
  sourceOpportunityId?: string;
  gcClient: string;
  ownerOrPrime?: string;
  location: string;
  serviceLines: OpportunityServiceLine[];
  projectType: OpportunityProjectType;
  d5oPhase: D5OPhaseId;
  healthStatus: ProjectHealthStatus;
  contractStatus: ContractStatus;
  contractBaseline: ContractBaseline;
  contractValue: number;
  originalEstimateValue: number;
  approvedChangeValue: number;
  pendingChangeValue: number;
  retainagePercent: number;
  paymentTerms: PaymentTerm;
  noticeRequirements: NoticeRequirement[];
  changeOrderTerms: string[];
  scheduleStart: string;
  scheduleFinish: string;
  baselineScheduleStatus: BaselineStatus;
  baselineBudgetStatus: BaselineStatus;
  budgetBaseline: BudgetBaseline;
  scheduleBaseline: ScheduleBaseline;
  scopeSummary: string;
  includedScope: string[];
  excludedScope: string[];
  assumptions: string[];
  clarifications: string[];
  scopeMatrix: ScopeMatrixItem[];
  flowDownObligations: FlowDownObligation[];
  requiredSubmittals: ProjectSetupArtifact[];
  requiredCloseoutDocuments: ProjectSetupArtifact[];
  setupArtifacts: ProjectSetupArtifact[];
  risks: string[];
  issues: string[];
  projectManager: string;
  superintendent?: string;
  estimator: string;
  operationsLead: string;
  financeOwner: string;
  safetyOwner: string;
  qualityOwner: string;
  nextMilestone: string;
  nextMilestoneDate: string;
  nextAction: string;
  missingArtifacts: string[];
  launchDecision: ProjectLaunchDecision;
  createdAt: string;
  updatedAt: string;
  gate: D5OGate;
};

export type ProjectRisk = {
  id: string;
  projectId: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  owner: string;
  status: "open" | "mitigating" | "closed";
  impact: string;
  mitigation: string;
};

export type ProjectIssue = {
  id: string;
  projectId: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  owner: string;
  status: "open" | "blocked" | "resolved";
  impact: string;
  nextAction: string;
};

export type ProjectDecision = {
  id: string;
  projectId: string;
  title: string;
  owner: string;
  dueDate: string;
  businessImpact: string;
  requiredAction: string;
};

export type RfiStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "answered"
  | "overdue"
  | "closed"
  | "void";

export type SubmittalStatus =
  | "not_started"
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "approved_as_noted"
  | "revise_and_resubmit"
  | "rejected"
  | "overdue"
  | "closed";

export type ControlPriority = "low" | "normal" | "high" | "critical";

export type ControlDiscipline =
  | "civil"
  | "underground"
  | "fiber"
  | "structured_cabling"
  | "data_center"
  | "telecom"
  | "safety"
  | "quality"
  | "commercial"
  | "schedule";

export type ChangeEventSource =
  | "daily_report"
  | "field_directive"
  | "rfi_response"
  | "changed_condition"
  | "owner_request"
  | "gc_direction"
  | "design_revision"
  | "access_delay"
  | "material_substitution"
  | "safety_requirement"
  | "quality_correction"
  | "other";

export type ChangeEventStatus =
  | "potential"
  | "notice_required"
  | "notice_submitted"
  | "pricing_required"
  | "pricing_submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "disputed"
  | "billed"
  | "closed";

export type PricingStatus =
  | "not_started"
  | "backup_needed"
  | "pricing_in_progress"
  | "submitted"
  | "approved"
  | "rejected"
  | "disputed";

export type BackupStatus = "missing" | "partial" | "complete" | "verified";

export type BillingStatus =
  | "not_billable"
  | "pending_approval"
  | "approved_not_billed"
  | "billed"
  | "paid"
  | "disputed";

export type PayApplicationStatus =
  | "draft"
  | "ready_for_review"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid"
  | "partially_paid"
  | "aging"
  | "disputed"
  | "closed";

export type LienWaiverStatus =
  | "not_required"
  | "required"
  | "pending"
  | "submitted"
  | "accepted"
  | "rejected"
  | "missing";

export type LienWaiverType =
  | "conditional_progress"
  | "unconditional_progress"
  | "conditional_final"
  | "unconditional_final";

export type BillingBackupType =
  | "daily_report"
  | "quantity_record"
  | "photo"
  | "test_report"
  | "approved_change"
  | "tm_ticket"
  | "submittal_approval"
  | "gc_direction"
  | "rfi_response"
  | "lien_waiver"
  | "closeout_evidence";

export type CommercialExposureStatus =
  | "open"
  | "notice_at_risk"
  | "backup_missing"
  | "pricing_pending"
  | "approval_pending"
  | "approved_not_billed"
  | "disputed"
  | "rejected"
  | "recovered"
  | "written_off";

export type CommercialExposureType =
  | "approved_change_unbilled"
  | "pending_change"
  | "disputed_change"
  | "rejected_change"
  | "missing_backup"
  | "retainage_release"
  | "pay_app_aging"
  | "quantity_gap";

export type ChangeType =
  | "scope_added"
  | "changed_condition"
  | "delay"
  | "acceleration"
  | "rework"
  | "substitution"
  | "allowance"
  | "documentation";

export type ChangeEvent = {
  id: string;
  projectId: string;
  projectName: string;
  changeNumber: string;
  title: string;
  description: string;
  status: ChangeEventStatus;
  source: ChangeEventSource;
  sourceRecordIds: string[];
  changeType: ChangeType;
  noticeRequired: boolean;
  noticeDeadline: string;
  noticeStatus: "not_required" | "required" | "submitted" | "late" | "waived";
  pricingStatus: PricingStatus;
  backupStatus: BackupStatus;
  scheduleImpact: boolean;
  costImpactEstimate: number;
  submittedAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
  disputedAmount: number;
  billingStatus: BillingStatus;
  owner: string;
  gcContact: string;
  requiredAction: string;
  linkedRfiIds: string[];
  linkedDailyReportIds: string[];
  linkedWorkPackageIds: string[];
  attachments: string[];
  createdAt: string;
  updatedAt: string;
  valueEstimate: number;
  noticeDueDate: string;
  businessImpact: string;
};

export type ScheduleOfValueLine = {
  id: string;
  projectId: string;
  description: string;
  costCode: string;
  originalValue: number;
  approvedChangeValue: number;
  revisedValue: number;
  previousBilled: number;
  currentBilled: number;
  storedMaterials: number;
  totalBilledToDate: number;
  percentComplete: number;
  remainingBalance: number;
  backupStatus: BackupStatus;
  linkedDailyReportIds: string[];
  linkedWorkPackageIds: string[];
  linkedQuantityRecords: string[];
};

export type BillingBackupItem = {
  id: string;
  projectId: string;
  payApplicationId: string;
  type: BillingBackupType;
  title: string;
  status: BackupStatus;
  requiredForBilling: boolean;
  linkedRecordIds: string[];
  owner: string;
  dueDate: string;
  notes: string;
};

export type LienWaiver = {
  id: string;
  projectId: string;
  payApplicationId: string;
  waiverType: LienWaiverType;
  status: LienWaiverStatus;
  amount: number;
  requiredDate: string;
  submittedDate?: string;
  receivedDate?: string;
  notes: string;
};

export type CommercialExposureItem = {
  id: string;
  projectId: string;
  sourceType: "change_event" | "pay_application" | "daily_report" | "retainage" | "billing_backup";
  sourceId: string;
  title: string;
  exposureType: CommercialExposureType;
  estimatedValue: number;
  status: CommercialExposureStatus;
  owner: string;
  requiredAction: string;
  dueDate: string;
  businessImpact: string;
};

export type PayApplication = {
  id: string;
  projectId: string;
  projectName: string;
  payApplicationNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  status: PayApplicationStatus;
  contractValueAtBilling: number;
  originalContractValue: number;
  approvedChangeValue: number;
  pendingChangeValue: number;
  previousBillings: number;
  currentWorkBilling: number;
  currentStoredMaterials: number;
  currentApprovedChangesBilling: number;
  totalCompletedAndStoredToDate: number;
  retainagePercent: number;
  retainageThisPeriod: number;
  totalRetainageHeld: number;
  amountRequestedThisPeriod: number;
  amountApprovedThisPeriod: number;
  amountPaidThisPeriod: number;
  paymentDueDate: string;
  paymentReceivedDate?: string;
  lienWaiverStatus: LienWaiverStatus;
  backupStatus: BackupStatus;
  scheduleOfValues: ScheduleOfValueLine[];
  includedChangeEventIds: string[];
  excludedApprovedChangeEventIds: string[];
  missingBackupItems: string[];
  rejectedLineItems: string[];
  disputedItems: string[];
  owner: string;
  financeOwner: string;
  pmOwner: string;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type RFI = {
  id: string;
  projectId: string;
  projectName: string;
  rfiNumber: string;
  title: string;
  question: string;
  status: RfiStatus;
  priority: ControlPriority;
  discipline: ControlDiscipline;
  specificationReference?: string;
  drawingReference?: string;
  location: string;
  submittedBy: string;
  assignedTo: string;
  dueDate: string;
  submittedDate?: string;
  responseDate?: string;
  responseSummary?: string;
  scheduleImpact: boolean;
  costImpact: boolean;
  linkedDailyReportIds: string[];
  linkedWorkPackageIds: string[];
  linkedChangeEventIds: string[];
  attachments: string[];
  requiredDecision: string;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  businessImpact: string;
};

export type Submittal = {
  id: string;
  projectId: string;
  projectName: string;
  submittalNumber: string;
  title: string;
  packageName: string;
  specificationSection: string;
  discipline: ControlDiscipline;
  status: SubmittalStatus;
  priority: ControlPriority;
  requiredDate: string;
  submittedDate?: string;
  reviewDueDate: string;
  responseDate?: string;
  reviewer: string;
  supplierOrVendor: string;
  revision: string;
  result?: string;
  linkedWorkPackageIds: string[];
  linkedMaterialItems: string[];
  linkedCloseoutRequirements: string[];
  attachments: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  owner: string;
  businessImpact: string;
};

export type DailyReport = {
  id: string;
  projectId: string;
  projectName: string;
  workPackageId: string;
  workPackageName: string;
  reportDate: string;
  reportStatus: DailyReportStatus;
  submittedBy: string;
  supervisor: string;
  weather: string;
  siteConditions: string;
  crewMembers: FieldCrewMember[];
  laborHours: LaborHourEntry[];
  equipmentUsed: EquipmentUsageEntry[];
  materialsReceived: MaterialReceipt[];
  installedQuantities: InstalledQuantity[];
  workPerformed: string;
  workAreas: string[];
  safetyObservations: FieldSafetyObservation[];
  safetyIncidents: FieldSafetyObservation[];
  qualityChecks: FieldQualityCheck[];
  qualityDeficiencies: FieldQualityCheck[];
  photos: FieldPhotoRecord[];
  requiredPhotosComplete: boolean;
  requiredTestsComplete: boolean;
  delays: FieldDelay[];
  blockers: FieldBlocker[];
  changedConditions: ChangedCondition[];
  extraWorkObserved: boolean;
  rfiNeeded: boolean;
  changeEventNeeded: boolean;
  punchItemsCreated: string[];
  productionStatus: ProductionStatus;
  supervisorSignoff: SupervisorSignoff;
  gcCoordinationNotes: string;
  nextDayPlan: string;
  createdAt: string;
  updatedAt: string;
};

export type SafetyRecord = {
  id: string;
  projectId: string;
  projectName: string;
  workPackageId?: string;
  title: string;
  recordType: "observation" | "near_miss" | "incident" | "corrective_action";
  severity: SafetySeverity;
  status: SafetyQualityStatus;
  date: string;
  location: string;
  observedBy: string;
  assignedTo: string;
  owner: string;
  dueDate: string;
  description: string;
  closeoutImpact: boolean;
  requiredAction: string;
  nextAction: string;
  linkedRecordIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SafetyPlan = {
  id: string;
  projectId: string;
  projectName: string;
  planName: string;
  status: SafetyQualityStatus;
  owner: string;
  effectiveDate: string;
  requiredForMobilization: boolean;
  hazardsCovered: string[];
  emergencyContactsComplete: boolean;
  competentPersonRequired: boolean;
  competentPersonAssigned: string;
  trainingRequirements: string[];
  ppeRequirements: string[];
  attachments: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type JhaRecord = {
  id: string;
  projectId: string;
  projectName: string;
  workPackageId?: string;
  title: string;
  recordType: JhaRecordType;
  date: string;
  status: SafetyQualityStatus;
  hazards: string[];
  controls: string[];
  crewAcknowledged: boolean;
  owner: string;
  requiredBeforeWork: boolean;
  attachments: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type ToolboxTalk = {
  id: string;
  projectId: string;
  projectName: string;
  topic: string;
  date: string;
  presenter: string;
  attendees: string[];
  status: SafetyQualityStatus;
  linkedWorkPackageIds: string[];
  followUpActions: string[];
  createdAt: string;
  updatedAt: string;
};

export type SafetyObservation = {
  id: string;
  projectId: string;
  projectName: string;
  workPackageId?: string;
  date: string;
  type: SafetyObservationType;
  severity: SafetySeverity;
  description: string;
  location: string;
  observedBy: string;
  assignedTo: string;
  status: SafetyQualityStatus;
  correctiveActionRequired: boolean;
  correctiveActionId?: string;
  photos: string[];
  dueDate: string;
  closeoutImpact: boolean;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type SafetyIncident = {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  incidentType: SafetyIncidentType;
  severity: SafetySeverity;
  description: string;
  location: string;
  peopleInvolved: string[];
  immediateActions: string[];
  rootCause: string;
  correctiveActions: string[];
  status: SafetyQualityStatus;
  reportRequired: boolean;
  attachments: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type CorrectiveAction = {
  id: string;
  projectId: string;
  projectName: string;
  sourceType: CorrectiveActionSourceType;
  sourceId: string;
  title: string;
  description: string;
  severity: SafetySeverity | QualitySeverity;
  owner: string;
  dueDate: string;
  status: SafetyQualityStatus;
  verificationRequired: boolean;
  verificationStatus: SafetyQualityStatus;
  verifiedBy?: string;
  verifiedDate?: string;
  closeoutImpact: boolean;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type QualityRecord = {
  id: string;
  projectId: string;
  projectName: string;
  workPackageId?: string;
  title: string;
  recordType: "inspection" | "deficiency" | "test" | "punch_item";
  severity: QualitySeverity;
  status: SafetyQualityStatus;
  owner: string;
  dueDate: string;
  closeoutImpact: boolean;
  billingImpact: boolean;
  requiredAction: string;
  nextAction: string;
  linkedRecordIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type QualityInspection = {
  id: string;
  projectId: string;
  projectName: string;
  workPackageId?: string;
  inspectionNumber: string;
  title: string;
  inspectionType: QualityInspectionType;
  date: string;
  inspector: string;
  status: SafetyQualityStatus;
  acceptanceCriteria: string[];
  checklistItems: string[];
  passFailResult: QualityPassFailResult;
  deficienciesFound: number;
  linkedDeficiencyIds: string[];
  requiredPhotos: string[];
  photosComplete: boolean;
  requiredTests: string[];
  testsComplete: boolean;
  closeoutRequired: boolean;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type QualityDeficiency = {
  id: string;
  projectId: string;
  projectName: string;
  workPackageId?: string;
  title: string;
  description: string;
  severity: QualitySeverity;
  location: string;
  discoveredDate: string;
  discoveredBy: string;
  assignedTo: string;
  status: SafetyQualityStatus;
  correctiveActionId?: string;
  reinspectionRequired: boolean;
  reinspectionStatus: SafetyQualityStatus;
  closeoutImpact: boolean;
  billingImpact: boolean;
  photos: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type TestRecord = {
  id: string;
  projectId: string;
  projectName: string;
  workPackageId?: string;
  testType: TestRecordType;
  title: string;
  requiredForCloseout: boolean;
  status: SafetyQualityStatus;
  performedDate?: string;
  performedBy: string;
  result: QualityPassFailResult;
  acceptanceCriteria: string;
  attachments: string[];
  linkedInspectionId?: string;
  linkedCloseoutRequirementIds: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type PunchItem = {
  id: string;
  projectId: string;
  projectName: string;
  workPackageId?: string;
  title: string;
  description: string;
  severity: QualitySeverity;
  status: SafetyQualityStatus;
  assignedTo: string;
  dueDate: string;
  verifiedBy?: string;
  verifiedDate?: string;
  closeoutImpact: boolean;
  acceptanceImpact: boolean;
  photos: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type CloseoutStatus =
  | "not_started"
  | "assembling"
  | "missing_requirements"
  | "ready_for_review"
  | "submitted"
  | "accepted"
  | "rejected"
  | "closed"
  | "archived";

export type AcceptanceStatus =
  | "not_submitted"
  | "submitted"
  | "under_review"
  | "accepted"
  | "accepted_with_exceptions"
  | "rejected"
  | "closed";

export type RetainageReleaseStatus =
  | "not_ready"
  | "blocked"
  | "pending_final_billing"
  | "pending_waiver"
  | "submitted"
  | "released"
  | "disputed";

export type CloseoutRequirementCategory =
  | "as_built"
  | "redline"
  | "test_record"
  | "inspection"
  | "photo_evidence"
  | "warranty"
  | "om_document"
  | "certification"
  | "submittal_closeout"
  | "rfi_closure"
  | "change_closure"
  | "punch_item"
  | "safety_record"
  | "quality_record"
  | "final_billing"
  | "lien_waiver"
  | "retainage_release"
  | "acceptance"
  | "archive";

export type CloseoutSourceModule =
  | "projects"
  | "field_execution"
  | "safety"
  | "quality"
  | "rfis_submittals"
  | "changes"
  | "billing"
  | "closeout";

export type CloseoutRequirementStatus =
  | "not_started"
  | "missing"
  | "in_progress"
  | "submitted"
  | "accepted"
  | "rejected"
  | "waived"
  | "blocked"
  | "archived";

export type CloseoutDecision =
  | "continue_assembling"
  | "hold_for_missing_documents"
  | "hold_for_punch_resolution"
  | "hold_for_test_records"
  | "hold_for_as_builts"
  | "hold_for_change_closure"
  | "hold_for_final_billing"
  | "hold_for_retainage_requirements"
  | "submit_for_acceptance"
  | "accepted_ready_to_archive";

export type CloseoutRequirement = {
  id: string;
  projectId: string;
  packageId: string;
  category: CloseoutRequirementCategory;
  title: string;
  description: string;
  requiredBy: string;
  status: CloseoutRequirementStatus;
  owner: string;
  dueDate: string;
  sourceModule: CloseoutSourceModule;
  sourceRecordIds: string[];
  closeoutImpact: boolean;
  acceptanceImpact: boolean;
  finalBillingImpact: boolean;
  retainageImpact: boolean;
  attachments: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type AcceptanceRecord = {
  id: string;
  projectId: string;
  packageId: string;
  reviewer: string;
  reviewerOrganization: string;
  status: AcceptanceStatus;
  submittedDate?: string;
  responseDate?: string;
  acceptedDate?: string;
  exceptions: string[];
  rejectionReasons: string[];
  requiredCorrections: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type AsBuiltRecord = {
  id: string;
  projectId: string;
  packageId: string;
  title: string;
  status: CloseoutRequirementStatus;
  drawingReference: string;
  redlineSource: string;
  preparedBy: string;
  reviewedBy: string;
  submittedDate?: string;
  acceptedDate?: string;
  attachments: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type WarrantyRecord = {
  id: string;
  projectId: string;
  packageId: string;
  title: string;
  vendorOrSupplier: string;
  warrantyType: string;
  effectiveDate: string;
  expirationDate: string;
  status: CloseoutRequirementStatus;
  attachments: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type CloseoutPackage = {
  id: string;
  projectId: string;
  projectName: string;
  packageNumber: string;
  status: CloseoutStatus;
  closeoutOwner: string;
  projectManager: string;
  qualityOwner: string;
  financeOwner: string;
  gcReviewer: string;
  targetSubmissionDate: string;
  submittedDate?: string;
  acceptedDate?: string;
  readinessScore: number;
  acceptanceStatus: AcceptanceStatus;
  finalBillingStatus: PayApplicationStatus;
  retainageReleaseStatus: RetainageReleaseStatus;
  requiredDocuments: string[];
  asBuiltStatus: CloseoutRequirementStatus;
  redlineStatus: CloseoutRequirementStatus;
  testRecordStatus: CloseoutRequirementStatus;
  photoEvidenceStatus: CloseoutRequirementStatus;
  warrantyStatus: CloseoutRequirementStatus;
  omDocumentStatus: CloseoutRequirementStatus;
  safetyQualityEvidenceStatus: CloseoutRequirementStatus;
  rfiSubmittalClosureStatus: CloseoutRequirementStatus;
  changeClosureStatus: CloseoutRequirementStatus;
  punchClosureStatus: CloseoutRequirementStatus;
  billingClosureStatus: CloseoutRequirementStatus;
  blockers: string[];
  warnings: string[];
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type CloseoutItem = {
  id: string;
  projectId: string;
  title: string;
  status: "open" | "overdue" | "submitted" | "accepted";
  owner: string;
  dueDate: string;
  agingDays: number;
  businessImpact: string;
};

export type LessonCategory =
  | "estimating"
  | "scope"
  | "contract"
  | "mobilization"
  | "field_execution"
  | "safety"
  | "quality"
  | "rfi_submittal"
  | "change_control"
  | "billing"
  | "closeout"
  | "gc_client"
  | "vendor"
  | "crew_productivity"
  | "documentation"
  | "other";

export type LessonStatus =
  | "draft"
  | "open"
  | "assigned"
  | "in_progress"
  | "implemented"
  | "verified"
  | "closed"
  | "deferred";

export type OptimizeSeverity = "low" | "medium" | "high" | "critical";
export type OptimizePriority = "low" | "medium" | "high" | "critical";
export type PursuitPosture = "preferred" | "pursue" | "pursue_with_controls" | "caution" | "avoid";
export type VendorUsePosture = "preferred" | "approved" | "approved_with_controls" | "probation" | "avoid";
export type ConfidenceLevel = "low" | "medium" | "high";
export type ImprovementActionStatus = "open" | "assigned" | "in_progress" | "implemented" | "verified" | "closed" | "deferred" | "overdue";
export type OptimizeTargetModule =
  | "pipeline"
  | "projects"
  | "mobilization"
  | "field_execution"
  | "safety"
  | "quality"
  | "rfis_submittals"
  | "changes"
  | "billing"
  | "closeout"
  | "reports"
  | "admin";

export type ProjectPerformanceScorecard = {
  id: string;
  projectId: string;
  projectName: string;
  projectType: OpportunityProjectType;
  serviceLines: OpportunityServiceLine[];
  gcClient: string;
  location: string;
  completedDate: string;
  reviewedDate: string;
  originalContractValue: number;
  finalContractValue: number;
  originalEstimatedMargin: number;
  finalGrossMargin: number;
  marginVariance: number;
  scheduleVarianceDays: number;
  productionVariancePercent: number;
  changeRecoveryRate: number;
  approvedChangeValue: number;
  rejectedDisputedChangeValue: number;
  billingCycleTimeDays: number;
  closeoutCycleTimeDays: number;
  retainageReleaseStatus: RetainageReleaseStatus;
  safetyScore: number;
  qualityScore: number;
  documentationScore: number;
  gcPerformanceScore: number;
  vendorPerformanceScore: number;
  overallProjectScore: number;
  keyWins: string[];
  keyFailures: string[];
  recommendedActions: string[];
  createdAt: string;
  updatedAt: string;
};

export type LessonLearned = {
  id: string;
  projectId: string;
  projectName: string;
  category: LessonCategory;
  title: string;
  description: string;
  rootCause: string;
  impact: string;
  severity: OptimizeSeverity;
  owner: string;
  actionRequired: string;
  recommendedChange: string;
  targetModule: OptimizeTargetModule;
  status: LessonStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductionRateRecord = {
  id: string;
  workType: string;
  serviceLine: OpportunityServiceLine;
  projectType: OpportunityProjectType;
  region: string;
  crewType: string;
  unitOfMeasure: string;
  estimatedRate: number;
  actualRate: number;
  variancePercent: number;
  sampleProjectIds: string[];
  conditions: string[];
  confidenceLevel: ConfidenceLevel;
  recommendedEstimatingRate: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type GcPerformanceProfile = {
  id: string;
  gcClient: string;
  relationshipStatus: PursuitPosture;
  projectCount: number;
  totalContractValue: number;
  paymentReliabilityScore: number;
  changeApprovalScore: number;
  scheduleCoordinationScore: number;
  documentationBurdenScore: number;
  safetyCoordinationScore: number;
  fieldAccessReliabilityScore: number;
  disputeRiskScore: number;
  overallScore: number;
  recommendedPursuitPosture: PursuitPosture;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type VendorPerformanceProfile = {
  id: string;
  vendorName: string;
  vendorType: string;
  projectCount: number;
  scopeCategories: string[];
  deliveryReliabilityScore: number;
  qualityScore: number;
  responsivenessScore: number;
  pricingCompetitivenessScore: number;
  documentationScore: number;
  safetyComplianceScore: number;
  overallScore: number;
  recommendedUsePosture: VendorUsePosture;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ImprovementAction = {
  id: string;
  sourceType: "lesson" | "production_rate" | "gc_profile" | "vendor_profile" | "risk_library" | "scorecard";
  sourceId: string;
  title: string;
  description: string;
  owner: string;
  priority: OptimizePriority;
  status: ImprovementActionStatus;
  dueDate: string;
  targetModule: OptimizeTargetModule;
  expectedBenefit: string;
  completionEvidence: string;
  createdAt: string;
  updatedAt: string;
};

export type RiskLibraryItem = {
  id: string;
  riskCategory: LessonCategory;
  title: string;
  description: string;
  triggerConditions: string[];
  likelyImpact: string;
  recommendedMitigation: string;
  affectedModules: OptimizeTargetModule[];
  shouldUpdateGoNoGoScoring: boolean;
  shouldUpdateEstimateAssumptions: boolean;
  shouldUpdateMobilizationChecklist: boolean;
  shouldUpdateWorkPackageTemplate: boolean;
  severity: OptimizeSeverity;
  createdAt: string;
  updatedAt: string;
};

export type OperatingActionSeverity = "low" | "medium" | "high" | "critical";

export type OperatingActionCategory =
  | "Stage gate approval needed"
  | "Contract baseline blocked"
  | "Scope matrix incomplete"
  | "Baseline schedule blocked"
  | "Flow-down review overdue"
  | "Submittal register missing"
  | "Utility locates missing"
  | "Safety package incomplete"
  | "Material readiness unconfirmed"
  | "Work package not ready"
  | "Traffic control required"
  | "Changed condition needs action"
  | "Work package behind plan"
  | "Required photos missing"
  | "Field safety observation unresolved"
  | "Submittal blocking work"
  | "Change event missing backup"
  | "Approved change not billed"
  | "RFI answered needs change event"
  | "Pay application aging"
  | "Billing backup missing"
  | "Lien waiver missing"
  | "Cash at risk"
  | "Retainage release blocked"
  | "Safety blocker"
  | "Safety action overdue"
  | "Near miss follow-up"
  | "Quality evidence missing"
  | "Punch item blocking closeout"
  | "Inspection overdue"
  | "Closeout package blocked"
  | "As-built missing"
  | "Final billing blocked"
  | "Acceptance pending"
  | "Archive package incomplete"
  | "Optimize review required"
  | "Production rate update recommended"
  | "GC pursuit caution"
  | "Vendor performance issue"
  | "Improvement action overdue"
  | "Risk library update needed"
  | "RFI overdue"
  | "Change notice deadline"
  | "Daily report missing"
  | "Mobilization blocker"
  | "Safety corrective action overdue"
  | "Quality deficiency overdue"
  | "Pay application due"
  | "Closeout item overdue";

export type OperatingActionItem = {
  id: string;
  severity: OperatingActionSeverity;
  category: OperatingActionCategory;
  projectId: string;
  owner: string;
  dueDate: string;
  businessImpact: string;
  requiredAction: string;
  href: string;
};
