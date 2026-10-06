import { calculateGoNoGo } from "../go-no-go";
import { evaluateD2Gate } from "../d2-gate";
import { evaluateD3Gate } from "../d3-gate";
import * as seedData from "../seed-data";
import type { D5OPhaseId, OperatingActionItem, RybexProject } from "../types";
import { workflowTypeConfig, workflowTypeOrder } from "./config";
import type {
  DerivedWorkflowSummary,
  OperatingWorkflow,
  OperatingWorkflowType,
  WorkflowResolutionState,
  WorkflowSeverity,
  WorkflowStatus
} from "./types";

const operatingDate = "2026-06-11";
const canonicalFieldIssueWorkflowBlockerId = "field-issue-lake-001";
const canonicalCloseoutFinalBillingWorkflowBlockerId = "closeout-final-billing-lake-001";
const canonicalCloseoutFinalBillingPackageId = "cop-bluegrass-001";
const canonicalCloseoutFinalBillingRequirementIds = new Set(["cor-blue-restoration", "cor-blue-waiver", "cor-blue-retainage"]);
const canonicalCloseoutFinalBillingHref = `/closeout?focus=${canonicalCloseoutFinalBillingWorkflowBlockerId}#closeout-final-billing`;

type WorkflowSeedData = Partial<typeof seedData>;

type WorkflowInput = Omit<OperatingWorkflow, "createdAt" | "updatedAt"> & {
  createdAt?: string;
  updatedAt?: string;
};

const phaseIds: D5OPhaseId[] = ["discover", "define", "prepare", "deliver", "close", "optimize"];

function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00`);
  const current = new Date(`${operatingDate}T00:00:00`);

  return Math.ceil((target.getTime() - current.getTime()) / 86_400_000);
}

function workflow(input: WorkflowInput): OperatingWorkflow {
  return {
    createdAt: operatingDate,
    updatedAt: operatingDate,
    ...input
  };
}

function severityFromDomain(severity?: string): WorkflowSeverity {
  if (severity === "critical" || severity === "severe") return "critical";
  if (severity === "high") return "high";
  if (severity === "medium" || severity === "moderate") return "watch";
  if (severity === "low") return "info";
  return "watch";
}

function statusFromState(state: WorkflowResolutionState): WorkflowStatus {
  if (state === "blocked") return "blocked";
  if (state === "overdue") return "overdue";
  if (state === "ready_for_review") return "ready_for_review";
  if (state === "resolved") return "resolved";
  if (state === "in_progress") return "active";
  return "at_risk";
}

function dueState(dueDate: string, defaultState: WorkflowResolutionState = "needs_action") {
  return daysUntil(dueDate) < 0 ? "overdue" : defaultState;
}

function dueSeverity(dueDate: string, base: WorkflowSeverity = "high"): WorkflowSeverity {
  const days = daysUntil(dueDate);
  if (days < 0) return "critical";
  if (days <= 1) return "critical";
  if (days <= 3) return "high";
  return base;
}

function consequenceByType(type: OperatingWorkflowType) {
  const consequences: Record<OperatingWorkflowType, string> = {
    pursuit_control: "Estimating capacity may be spent on work Rybex should not pursue.",
    contract_baseline: "Unclear scope or commercial terms can reach the field and erode margin.",
    mobilization_readiness: "Crews may arrive before the site, permits, safety plan, or materials are ready.",
    field_execution: "Production, delay, safety, quality, or change recovery proof may be lost.",
    information_control: "Field work may be blocked and entitlement may weaken while responses age.",
    change_recovery: "Notice, backup, pricing, or billing recovery may be missed.",
    billing_cash_control: "Completed or approved work may sit unbilled, age, or be rejected.",
    safety_control: "Unsafe conditions may continue or required safety evidence may be incomplete.",
    quality_control: "Defects, missing tests, or punch items may block acceptance and closeout.",
    closeout_acceptance: "Acceptance, final billing, retainage release, or archive readiness may be delayed.",
    optimize_learning: "The same production, partner, or process failure may repeat on future work.",
    system_readiness: "Demo/platform boundaries may be unclear during stakeholder review."
  };

  return consequences[type];
}

function projectById(projects: RybexProject[], projectId?: string) {
  return projects.find((project) => project.id === projectId);
}

function mapTargetHref(module: string) {
  const map: Record<string, string> = {
    pipeline: "/pipeline",
    projects: "/projects",
    mobilization: "/mobilization",
    field_execution: "/field-execution",
    rfis_submittals: "/rfis-submittals",
    changes: "/changes",
    billing: "/billing",
    safety: "/safety",
    quality: "/quality",
    closeout: "/closeout",
    reports: "/reports",
    admin: "/admin"
  };

  return map[module] ?? "/command-center";
}

function typeForAction(action: OperatingActionItem): OperatingWorkflowType {
  const category = action.category.toLowerCase();
  if (category.includes("contract") || category.includes("baseline") || category.includes("flow-down")) return "contract_baseline";
  if (category.includes("mobilization") || category.includes("work package")) return "mobilization_readiness";
  if (category.includes("daily report") || category.includes("changed condition")) return "field_execution";
  if (category.includes("rfi") || category.includes("submittal")) return "information_control";
  if (category.includes("change notice")) return "change_recovery";
  if (category.includes("pay application") || category.includes("billing") || category.includes("retainage") || category.includes("cash")) return "billing_cash_control";
  if (category.includes("safety")) return "safety_control";
  if (category.includes("quality") || category.includes("inspection")) return "quality_control";
  if (category.includes("closeout") || category.includes("acceptance") || category.includes("archive")) return "closeout_acceptance";
  if (category.includes("optimize") || category.includes("production rate") || category.includes("vendor") || category.includes("improvement") || category.includes("risk library") || category.includes("gc pursuit")) return "optimize_learning";
  return "field_execution";
}

function actionToWorkflow(action: OperatingActionItem, projects: RybexProject[]): OperatingWorkflow {
  const workflowType = typeForAction(action);
  const config = workflowTypeConfig[workflowType];
  const project = projectById(projects, action.projectId);
  const state = dueState(action.dueDate, action.severity === "critical" ? "blocked" : "needs_action");

  return workflow({
    id: `workflow-action-${action.id}`,
    workflowType,
    title: action.category,
    description: action.businessImpact,
    d5oPhase: config.d5oPhase,
    sourceModule: "operating_actions",
    sourceRecordType: "operating_action",
    sourceRecordId: action.id,
    projectId: action.projectId,
    projectName: project?.name,
    entityName: project?.name ?? action.category,
    signal: { title: action.category, detail: action.businessImpact },
    requiredDecision: { question: config.primaryQuestion },
    requiredAction: { title: action.requiredAction, detail: action.requiredAction },
    evidenceNeeded: { required: config.typicalEvidence.slice(0, 3), currentState: "Evidence is tracked in the target workflow module." },
    currentStatus: statusFromState(state),
    resolutionState: state,
    owner: action.owner,
    dueDate: action.dueDate,
    businessImpact: action.businessImpact,
    consequenceIfMissed: consequenceByType(workflowType),
    targetModule: config.targetModule,
    targetHref: action.href,
    nextGateOrStatus: { to: config.shortLabel, label: "Resolve workflow control" },
    severity: severityFromDomain(action.severity)
  });
}

function addWorkflow(workflows: OperatingWorkflow[], input: WorkflowInput) {
  workflows.push(workflow(input));
}

function rankWorkflow(workflowItem: OperatingWorkflow) {
  const severityRank: Record<WorkflowSeverity, number> = {
    critical: 0,
    high: 1,
    watch: 2,
    info: 3,
    resolved: 4
  };
  const stateRank: Record<WorkflowResolutionState, number> = {
    blocked: 0,
    overdue: 1,
    needs_decision: 2,
    needs_action: 3,
    ready_for_review: 4,
    in_progress: 5,
    resolved: 6
  };

  return (
    severityRank[workflowItem.severity] * 10_000 +
    stateRank[workflowItem.resolutionState] * 1_000 -
    (workflowItem.valueAtRisk ?? 0) / 100_000 +
    Math.max(daysUntil(workflowItem.dueDate), -30)
  );
}

function groupByType(workflows: OperatingWorkflow[]) {
  return workflowTypeOrder.reduce((groups, type) => {
    groups[type] = workflows.filter((item) => item.workflowType === type);
    return groups;
  }, {} as DerivedWorkflowSummary["workflowsByType"]);
}

function groupByPhase(workflows: OperatingWorkflow[]) {
  return phaseIds.reduce((groups, phaseId) => {
    groups[phaseId] = workflows.filter((item) => item.d5oPhase === phaseId);
    return groups;
  }, {} as DerivedWorkflowSummary["workflowsByD5OPhase"]);
}

function groupByOwner(workflows: OperatingWorkflow[]) {
  return workflows.reduce((groups, item) => {
    groups[item.owner] = groups[item.owner] ?? [];
    groups[item.owner].push(item);
    return groups;
  }, {} as DerivedWorkflowSummary["workflowsByOwner"]);
}

export function deriveOperatingWorkflows(data: WorkflowSeedData = seedData): DerivedWorkflowSummary {
  const workflows: OperatingWorkflow[] = [];
  const projects = data.projects ?? seedData.projects;
  const opportunities = data.opportunities ?? seedData.opportunities;
  const mobilizationPlans = data.mobilizationPlans ?? seedData.mobilizationPlans;
  const dailyReports = data.dailyReports ?? seedData.dailyReports;
  const rfis = data.rfis ?? seedData.rfis;
  const submittals = data.submittals ?? seedData.submittals;
  const changeEvents = data.changeEvents ?? seedData.changeEvents;
  const payApplications = data.payApplications ?? seedData.payApplications;
  const billingBackupItems = data.billingBackupItems ?? seedData.billingBackupItems;
  const lienWaivers = data.lienWaivers ?? seedData.lienWaivers;
  const commercialExposureItems = data.commercialExposureItems ?? seedData.commercialExposureItems;
  const safetyObservations = data.safetyObservations ?? seedData.safetyObservations;
  const safetyIncidents = data.safetyIncidents ?? seedData.safetyIncidents;
  const correctiveActions = data.correctiveActions ?? seedData.correctiveActions;
  const jhaRecords = data.jhaRecords ?? seedData.jhaRecords;
  const qualityInspections = data.qualityInspections ?? seedData.qualityInspections;
  const qualityDeficiencies = data.qualityDeficiencies ?? seedData.qualityDeficiencies;
  const testRecords = data.testRecords ?? seedData.testRecords;
  const punchItems = data.punchItems ?? seedData.punchItems;
  const closeoutPackages = data.closeoutPackages ?? seedData.closeoutPackages;
  const closeoutRequirements = data.closeoutRequirements ?? seedData.closeoutRequirements;
  const lessonsLearned = data.lessonsLearned ?? seedData.lessonsLearned;
  const productionRateRecords = data.productionRateRecords ?? seedData.productionRateRecords;
  const improvementActions = data.improvementActions ?? seedData.improvementActions;
  const operatingActions = data.operatingActions ?? seedData.operatingActions;

  operatingActions.forEach((action) => workflows.push(actionToWorkflow(action, projects)));

  opportunities
    .filter((opportunity) => ["awaiting_go_no_go", "under_review", "new_intake"].includes(opportunity.status) || daysUntil(opportunity.bidDueDate) <= 7 || ["high", "severe"].includes(calculateGoNoGo(opportunity).riskLevel))
    .forEach((opportunity) => {
      const score = calculateGoNoGo(opportunity);
      const state: WorkflowResolutionState = opportunity.status === "awaiting_go_no_go" ? "needs_decision" : dueState(opportunity.bidDueDate, "needs_action");
      addWorkflow(workflows, {
        id: `workflow-pursuit-${opportunity.id}`,
        workflowType: "pursuit_control",
        title: `D1 decision needed: ${opportunity.name}`,
        description: opportunity.nextAction,
        d5oPhase: "discover",
        sourceModule: "pipeline",
        sourceRecordType: "opportunity",
        sourceRecordId: opportunity.id,
        entityName: opportunity.name,
        signal: { title: daysUntil(opportunity.bidDueDate) <= 7 ? "Bid deadline pressure" : "Pursuit gate signal", detail: `${opportunity.gcClient} bid due ${opportunity.bidDueDate}; ${score.riskLevel} risk.` },
        requiredDecision: { question: "Should Rybex pursue, hold, or no-bid this opportunity?", options: ["Approve to bid", "Hold for clarification", "Decline/no-bid"] },
        requiredAction: { title: opportunity.nextAction, detail: `Owner: ${opportunity.nextActionOwner}` },
        evidenceNeeded: { required: ["Go/no-go score", "Reviewer notes", "Bid documents", "Risk mitigations"], currentState: `${opportunity.documentsReceived.length} document(s), ${opportunity.requiredReviews.filter((review) => review.status !== "complete").length} review(s) open.` },
        currentStatus: statusFromState(state),
        resolutionState: state,
        owner: opportunity.nextActionOwner,
        dueDate: opportunity.bidDueDate,
        businessImpact: `Estimated value ${opportunity.estimatedValue.toLocaleString("en-US", { currency: "USD", style: "currency", maximumFractionDigits: 0 })}; pursuit risk must be governed before estimating capacity is committed.`,
        consequenceIfMissed: consequenceByType("pursuit_control"),
        targetModule: "Pipeline",
        targetHref: "/pipeline",
        nextGateOrStatus: { from: "D1 intake", to: "D1 approved or no-bid", label: "D1 go/no-go movement" },
        valueAtRisk: opportunity.estimatedValue,
        severity: ["high", "severe"].includes(score.riskLevel) || daysUntil(opportunity.bidDueDate) <= 1 ? "critical" : "high",
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt
      });
    });

  projects.forEach((project) => {
    const d2 = evaluateD2Gate(project);
    if (!d2.readyBoolean || project.missingArtifacts.length > 0 || project.contractStatus === "blocked") {
      const dueDate = project.nextMilestoneDate;
      addWorkflow(workflows, {
        id: `workflow-d2-${project.id}`,
        workflowType: "contract_baseline",
        title: `D2 baseline control: ${project.name}`,
        description: project.nextAction,
        d5oPhase: "define",
        sourceModule: "projects",
        sourceRecordType: "project",
        sourceRecordId: project.id,
        projectId: project.id,
        projectName: project.name,
        entityName: project.name,
        signal: { title: d2.blockers[0] ?? "D2 baseline gap", detail: d2.missingRequiredArtifacts.join(", ") || project.contractBaseline.summary },
        requiredDecision: { question: "Can this project move toward mobilization planning?", options: ["Release to D3 planning", "Hold for contract review", "Hold for baseline completion"] },
        requiredAction: { title: project.nextAction, detail: d2.nextActions[0] ?? project.nextAction },
        evidenceNeeded: { required: ["Contract baseline", "Scope matrix", "Budget baseline", "Schedule baseline", "Notice requirements"], currentState: `${d2.readinessPercent}% D2 readiness.` },
        currentStatus: d2.blockers.length > 0 ? "blocked" : statusFromState(dueState(dueDate)),
        resolutionState: d2.blockers.length > 0 ? "blocked" : dueState(dueDate),
        owner: project.projectManager,
        dueDate,
        businessImpact: "Sold scope, exclusions, notice rules, budget, and schedule must be controlled before field planning starts.",
        consequenceIfMissed: consequenceByType("contract_baseline"),
        targetModule: "Projects",
        targetHref: "/projects",
        nextGateOrStatus: { from: "D2 Define", to: "D3 mobilization planning", label: "D2 gate movement" },
        valueAtRisk: project.contractValue,
        severity: d2.blockers.length > 0 ? "critical" : "high",
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      });
    }
  });

  mobilizationPlans.forEach((plan) => {
    const project = projectById(projects, plan.projectId);
    const d3 = evaluateD3Gate(plan, project);
    if (!d3.readyBoolean || plan.readinessStatus === "blocked") {
      addWorkflow(workflows, {
        id: `workflow-d3-${plan.id}`,
        workflowType: "mobilization_readiness",
        title: `D3 field-start decision: ${plan.projectName}`,
        description: plan.nextAction,
        d5oPhase: "prepare",
        sourceModule: "mobilization",
        sourceRecordType: "mobilization_plan",
        sourceRecordId: plan.id,
        projectId: plan.projectId,
        projectName: plan.projectName,
        entityName: plan.projectName,
        signal: { title: d3.blockers[0] ?? "Mobilization readiness gap", detail: d3.missingRequiredItems.join(", ") || `${plan.readinessPercent}% ready.` },
        requiredDecision: { question: "Can the crew safely and productively mobilize?", options: ["Approve field start", "Hold for safety", "Hold for access/permits", "Hold for materials/work packages"] },
        requiredAction: { title: plan.nextAction, detail: d3.nextActions[0] ?? plan.nextAction },
        evidenceNeeded: { required: ["JHA", "Utility locates", "Access/permit confirmation", "Material readiness", "Work packages"], currentState: `${d3.readinessPercent}% D3 readiness.` },
        currentStatus: d3.blockers.length > 0 ? "blocked" : "at_risk",
        resolutionState: d3.blockers.length > 0 ? "blocked" : dueState(plan.plannedFieldStartDate),
        owner: plan.mobilizationOwner,
        dueDate: plan.plannedFieldStartDate,
        businessImpact: "Field start should not proceed until safety, access, materials, equipment, and work packages are controlled.",
        consequenceIfMissed: consequenceByType("mobilization_readiness"),
        targetModule: "Mobilization",
        targetHref: "/mobilization",
        nextGateOrStatus: { from: "D3 Prepare", to: "D4 field execution", label: "D3 gate movement" },
        valueAtRisk: project?.contractValue,
        severity: d3.blockers.length > 0 ? "critical" : dueSeverity(plan.plannedFieldStartDate, "high"),
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt
      });
    }
  });

  dailyReports
    .filter((report) => ["missing", "late"].includes(report.reportStatus) || report.blockers.length > 0 || report.delays.length > 0 || report.changedConditions.length > 0 || report.rfiNeeded || report.changeEventNeeded || ["behind", "blocked"].includes(report.productionStatus))
    .forEach((report) => {
      const state = ["missing", "late"].includes(report.reportStatus) ? "overdue" : report.productionStatus === "blocked" ? "blocked" : "needs_decision";
      addWorkflow(workflows, {
        id: `workflow-d4-report-${report.id}`,
        workflowType: "field_execution",
        title: `D4 field control: ${report.workPackageName}`,
        description: report.workPerformed,
        d5oPhase: "deliver",
        sourceModule: "field_execution",
        sourceRecordType: "daily_report",
        sourceRecordId: report.id,
        projectId: report.projectId,
        projectName: report.projectName,
        entityName: report.workPackageName,
        signal: { title: report.reportStatus === "missing" ? "Daily report missing" : report.changeEventNeeded ? "Change prompt from field" : "Field execution signal", detail: report.blockers[0]?.title ?? report.delays[0]?.reason ?? report.changedConditions[0]?.description ?? report.nextDayPlan },
        requiredDecision: { question: "Should work continue, escalate, create an RFI, or create a change event?", options: ["Continue work", "Escalate issue", "Create RFI", "Create change event", "Hold work"] },
        requiredAction: { title: report.rfiNeeded ? "Create or link RFI before work proceeds." : report.changeEventNeeded ? "Create or link change event before notice is missed." : "Complete report control and supervisor review.", detail: report.gcCoordinationNotes },
        evidenceNeeded: { required: ["Daily report", "Photos", "Installed quantities", "Supervisor signoff", "Field notes"], currentState: `Photos ${report.requiredPhotosComplete ? "complete" : "incomplete"}; tests ${report.requiredTestsComplete ? "complete" : "incomplete"}.` },
        currentStatus: statusFromState(state),
        resolutionState: state,
        owner: report.supervisor,
        dueDate: report.reportDate,
        businessImpact: "Daily field proof protects production tracking, billing backup, safety/quality evidence, and change recovery.",
        consequenceIfMissed: consequenceByType("field_execution"),
        targetModule: "Field Execution",
        targetHref: report.blockers.some((blocker) => blocker.id === canonicalFieldIssueWorkflowBlockerId)
          ? "/field-execution?focus=field-issue-lake-001#field-issue-escalation"
          : "/field-execution",
        nextGateOrStatus: { from: "D4 field work", to: "Controlled field record", label: "D4 control movement" },
        severity: report.changeEventNeeded || report.reportStatus === "missing" || report.productionStatus === "blocked" ? "critical" : "high",
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      });
    });

  rfis
    .filter((rfi) => rfi.status === "overdue" || rfi.scheduleImpact || (rfi.costImpact && rfi.linkedChangeEventIds.length === 0))
    .forEach((rfi) => {
      addWorkflow(workflows, {
        id: `workflow-rfi-${rfi.id}`,
        workflowType: "information_control",
        title: `RFI control: ${rfi.title}`,
        description: rfi.businessImpact,
        d5oPhase: "deliver",
        sourceModule: "rfis_submittals",
        sourceRecordType: "rfi",
        sourceRecordId: rfi.id,
        projectId: rfi.projectId,
        projectName: rfi.projectName,
        entityName: rfi.rfiNumber,
        signal: { title: rfi.status === "overdue" ? "RFI overdue" : "Schedule/cost impact RFI", detail: rfi.question },
        requiredDecision: { question: "Does this require escalation or linked change control?", options: ["Escalate response", "Create change event", "Close after answer"] },
        requiredAction: { title: rfi.nextAction, detail: rfi.requiredDecision },
        evidenceNeeded: { required: ["Formal question", "Drawing/spec reference", "Photos", "Response record"], currentState: `${rfi.attachments.length} attachment(s).` },
        currentStatus: rfi.status === "overdue" ? "overdue" : "at_risk",
        resolutionState: rfi.status === "overdue" ? "overdue" : "needs_decision",
        owner: rfi.owner,
        dueDate: rfi.dueDate,
        businessImpact: rfi.businessImpact,
        consequenceIfMissed: consequenceByType("information_control"),
        targetModule: "RFIs & Submittals",
        targetHref: "/rfis-submittals",
        nextGateOrStatus: { to: "Answered, escalated, or linked to change recovery", label: "Information control movement" },
        severity: rfi.status === "overdue" || rfi.scheduleImpact ? "critical" : "high",
        createdAt: rfi.createdAt,
        updatedAt: rfi.updatedAt
      });
    });

  submittals
    .filter((submittal) => ["overdue", "rejected", "revise_and_resubmit"].includes(submittal.status) || submittal.linkedWorkPackageIds.length > 0)
    .forEach((submittal) => {
      addWorkflow(workflows, {
        id: `workflow-submittal-${submittal.id}`,
        workflowType: "information_control",
        title: `Submittal control: ${submittal.title}`,
        description: submittal.businessImpact,
        d5oPhase: "deliver",
        sourceModule: "rfis_submittals",
        sourceRecordType: "submittal",
        sourceRecordId: submittal.id,
        projectId: submittal.projectId,
        projectName: submittal.projectName,
        entityName: submittal.submittalNumber,
        signal: { title: submittal.status === "overdue" ? "Submittal overdue" : "Submittal affects work package", detail: submittal.businessImpact },
        requiredDecision: { question: "Can the related work proceed with this approval status?", options: ["Submit/revise package", "Escalate reviewer", "Hold work package"] },
        requiredAction: { title: submittal.nextAction, detail: `Reviewer: ${submittal.reviewer}` },
        evidenceNeeded: { required: ["Submittal package", "Spec section", "Reviewer response", "Linked work package"], currentState: `${submittal.attachments.length} attachment(s).` },
        currentStatus: submittal.status === "overdue" ? "overdue" : "at_risk",
        resolutionState: submittal.status === "overdue" ? "overdue" : "needs_action",
        owner: submittal.owner,
        dueDate: submittal.dueDate,
        businessImpact: submittal.businessImpact,
        consequenceIfMissed: consequenceByType("information_control"),
        targetModule: "RFIs & Submittals",
        targetHref: "/rfis-submittals",
        nextGateOrStatus: { to: "Approved, revised, or work hold documented", label: "Submittal movement" },
        severity: submittal.status === "overdue" || submittal.status === "rejected" ? "critical" : "high",
        createdAt: submittal.createdAt,
        updatedAt: submittal.updatedAt
      });
    });

  changeEvents
    .filter((event) => !["billed", "closed"].includes(event.status) && (event.noticeStatus !== "submitted" || event.backupStatus !== "complete" || event.pricingStatus !== "approved" || event.billingStatus === "approved_not_billed"))
    .forEach((event) => {
      const state = event.noticeRequired && event.noticeStatus !== "submitted" && daysUntil(event.noticeDeadline) <= 1 ? "overdue" : event.backupStatus === "missing" ? "blocked" : "needs_action";
      addWorkflow(workflows, {
        id: `workflow-change-${event.id}`,
        workflowType: "change_recovery",
        title: `Change recovery: ${event.title}`,
        description: event.businessImpact,
        d5oPhase: "deliver",
        sourceModule: "changes",
        sourceRecordType: "change_event",
        sourceRecordId: event.id,
        projectId: event.projectId,
        projectName: event.projectName,
        entityName: event.changeNumber,
        signal: { title: event.noticeStatus !== "submitted" ? "Notice deadline risk" : event.backupStatus !== "complete" ? "Backup gap" : "Commercial recovery action", detail: event.description },
        requiredDecision: { question: "What recovery step protects entitlement and billing?", options: ["Submit notice", "Attach backup", "Price impact", "Link billing"] },
        requiredAction: { title: event.requiredAction, detail: `GC contact: ${event.gcContact}` },
        evidenceNeeded: { required: ["Daily report", "Photos", "Directive/RFI", "Pricing backup", "T&M support"], currentState: `Notice ${event.noticeStatus}; backup ${event.backupStatus}; pricing ${event.pricingStatus}.` },
        currentStatus: statusFromState(state),
        resolutionState: state,
        owner: event.owner,
        dueDate: event.noticeDeadline,
        businessImpact: event.businessImpact,
        consequenceIfMissed: consequenceByType("change_recovery"),
        targetModule: "Change Control",
        targetHref: "/changes",
        nextGateOrStatus: { to: "Noticed, priced, approved, or billing-linked", label: "Commercial recovery movement" },
        valueAtRisk: event.costImpactEstimate || event.valueEstimate,
        severity: dueSeverity(event.noticeDeadline, event.backupStatus === "missing" ? "critical" : "high"),
        createdAt: event.createdAt,
        updatedAt: event.updatedAt
      });
    });

  payApplications
    .filter((payApp) => ["draft", "ready_for_review", "submitted", "aging", "disputed", "rejected", "partially_paid"].includes(payApp.status) || payApp.excludedApprovedChangeEventIds.length > 0 || payApp.missingBackupItems.length > 0)
    .forEach((payApp) => {
      const state = ["aging", "disputed", "rejected"].includes(payApp.status) ? "blocked" : payApp.missingBackupItems.length > 0 ? "needs_action" : "ready_for_review";
      addWorkflow(workflows, {
        id: `workflow-payapp-${payApp.id}`,
        workflowType: "billing_cash_control",
        title: `Billing control: ${payApp.payApplicationNumber}`,
        description: payApp.nextAction,
        d5oPhase: "deliver",
        sourceModule: "billing",
        sourceRecordType: "pay_application",
        sourceRecordId: payApp.id,
        projectId: payApp.projectId,
        projectName: payApp.projectName,
        entityName: payApp.payApplicationNumber,
        signal: { title: payApp.status === "aging" ? "Pay application aging" : payApp.excludedApprovedChangeEventIds.length > 0 ? "Approved change not billed" : "Billing readiness signal", detail: payApp.nextAction },
        requiredDecision: { question: "Can this pay application be submitted, approved, or collected?", options: ["Submit pay app", "Hold for backup", "Include approved change", "Escalate payment"] },
        requiredAction: { title: payApp.nextAction, detail: `Finance owner: ${payApp.financeOwner}` },
        evidenceNeeded: { required: ["SOV support", "Daily reports", "Quantity records", "Approved changes", "Lien waiver"], currentState: `Backup ${payApp.backupStatus}; waiver ${payApp.lienWaiverStatus}.` },
        currentStatus: statusFromState(state),
        resolutionState: state,
        owner: payApp.financeOwner,
        dueDate: payApp.paymentDueDate,
        businessImpact: `${payApp.amountRequestedThisPeriod.toLocaleString("en-US", { currency: "USD", style: "currency", maximumFractionDigits: 0 })} requested this period; cash recovery depends on backup and approval.`,
        consequenceIfMissed: consequenceByType("billing_cash_control"),
        targetModule: "Billing",
        targetHref: "/billing",
        nextGateOrStatus: { to: "Submitted, approved, paid, or held with reason", label: "Cash control movement" },
        valueAtRisk: payApp.amountRequestedThisPeriod - payApp.amountPaidThisPeriod,
        severity: ["aging", "disputed", "rejected"].includes(payApp.status) || payApp.excludedApprovedChangeEventIds.length > 0 ? "critical" : "high",
        createdAt: payApp.createdAt,
        updatedAt: payApp.updatedAt
      });
    });

  [...billingBackupItems.filter((item) => !["complete", "verified"].includes(item.status) && item.requiredForBilling), ...lienWaivers.filter((waiver) => ["missing", "rejected", "required", "pending"].includes(waiver.status)), ...commercialExposureItems.filter((item) => !["recovered", "written_off"].includes(item.status))]
    .slice(0, 16)
    .forEach((item) => {
      const isExposure = "estimatedValue" in item;
      const project = projectById(projects, item.projectId);
      addWorkflow(workflows, {
        id: `workflow-billing-support-${item.id}`,
        workflowType: "billing_cash_control",
        title: isExposure ? item.title : "Billing support required",
        description: isExposure ? item.businessImpact : "Billing backup or lien waiver support is required before payment can move cleanly.",
        d5oPhase: "deliver",
        sourceModule: "billing",
        sourceRecordType: isExposure ? "commercial_exposure" : "billing_support",
        sourceRecordId: item.id,
        projectId: item.projectId,
        projectName: project?.name,
        entityName: project?.name ?? item.id,
        signal: { title: isExposure ? "Commercial exposure" : "Billing evidence gap", detail: isExposure ? item.businessImpact : "Backup or waiver is incomplete." },
        requiredDecision: { question: "What billing support is needed to protect payment?", options: ["Attach backup", "Resolve waiver", "Escalate exposure"] },
        requiredAction: { title: isExposure ? item.requiredAction : "Complete billing support before pay app submission.", detail: isExposure ? item.requiredAction : "Finance and PM should verify billing support." },
        evidenceNeeded: { required: ["Billing backup", "Approved change support", "Lien waiver", "Payment evidence"], currentState: "Support record is not verified." },
        currentStatus: isExposure && item.status === "approved_not_billed" ? "at_risk" : "blocked",
        resolutionState: isExposure && item.status === "approved_not_billed" ? "needs_action" : "blocked",
        owner: isExposure ? item.owner : "owner" in item ? item.owner : project?.financeOwner ?? "Finance owner",
        dueDate: isExposure ? item.dueDate : "requiredDate" in item ? item.requiredDate : item.dueDate,
        businessImpact: isExposure ? item.businessImpact : "Payment may be delayed, rejected, or unsupported without this evidence.",
        consequenceIfMissed: consequenceByType("billing_cash_control"),
        targetModule: "Billing",
        targetHref: "/billing",
        nextGateOrStatus: { to: "Billing support verified", label: "Pay application support movement" },
        valueAtRisk: isExposure ? item.estimatedValue : "amount" in item ? item.amount : undefined,
        severity: isExposure && ["notice_at_risk", "approved_not_billed", "disputed"].includes(item.status) ? "critical" : "high",
        createdAt: operatingDate,
        updatedAt: operatingDate
      });
    });

  jhaRecords
    .filter((record) => record.requiredBeforeWork && !["closed", "verified", "passed"].includes(record.status))
    .forEach((record) => {
      addWorkflow(workflows, {
        id: `workflow-jha-${record.id}`,
        workflowType: "safety_control",
        title: `Safety readiness: ${record.title}`,
        description: record.nextAction,
        d5oPhase: "deliver",
        sourceModule: "safety",
        sourceRecordType: "jha_record",
        sourceRecordId: record.id,
        projectId: record.projectId,
        projectName: record.projectName,
        entityName: record.title,
        signal: { title: "Required JHA/toolbox record not closed", detail: record.hazards.join(", ") },
        requiredDecision: { question: "Can work proceed without this safety evidence?", options: ["Complete JHA", "Hold work", "Assign follow-up"] },
        requiredAction: { title: record.nextAction, detail: `Owner: ${record.owner}` },
        evidenceNeeded: { required: ["JHA", "Hazard controls", "Crew acknowledgement", "Attachments"], currentState: `Crew acknowledged: ${record.crewAcknowledged ? "yes" : "no"}.` },
        currentStatus: record.status === "blocked" ? "blocked" : "at_risk",
        resolutionState: record.status === "blocked" ? "blocked" : "needs_action",
        owner: record.owner,
        dueDate: record.date,
        businessImpact: "Required safety planning must be complete before field work proceeds.",
        consequenceIfMissed: consequenceByType("safety_control"),
        targetModule: "Safety",
        targetHref: "/safety",
        nextGateOrStatus: { to: "Safety evidence complete", label: "Safety control movement" },
        severity: record.status === "overdue" || record.status === "blocked" ? "critical" : "high",
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      });
    });

  safetyObservations
    .filter((item) => !["closed", "verified"].includes(item.status))
    .forEach((item) => {
      addWorkflow(workflows, {
        id: `workflow-safety-observation-${item.id}`,
        workflowType: "safety_control",
        title: item.description,
        description: item.nextAction,
        d5oPhase: "deliver",
        sourceModule: "safety",
        sourceRecordType: "safety_observation",
        sourceRecordId: item.id,
        projectId: item.projectId,
        projectName: item.projectName,
        entityName: item.projectName,
        signal: { title: "Safety observation open", detail: item.description },
        requiredDecision: { question: "Does this condition require work hold, verification, or escalation?", options: ["Verify correction", "Escalate", "Hold work", "Close with evidence"] },
        requiredAction: { title: item.nextAction, detail: "Assign and verify safety follow-up." },
        evidenceNeeded: { required: ["Observation record", "Photos", "Corrective action", "Verification"], currentState: `Status ${item.status}.` },
        currentStatus: item.status === "overdue" || item.status === "blocked" ? "blocked" : "at_risk",
        resolutionState: item.status === "overdue" ? "overdue" : item.status === "blocked" ? "blocked" : "needs_action",
        owner: item.assignedTo,
        dueDate: item.dueDate,
        businessImpact: item.closeoutImpact ? "Safety observation affects closeout evidence." : "Open safety controls can affect field start and work continuation.",
        consequenceIfMissed: consequenceByType("safety_control"),
        targetModule: "Safety",
        targetHref: "/safety",
        nextGateOrStatus: { to: "Safety action verified", label: "Safety control movement" },
        severity: severityFromDomain(item.severity),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      });
    });

  safetyIncidents
    .filter((item) => !["closed", "verified"].includes(item.status))
    .forEach((item) => {
      addWorkflow(workflows, {
        id: `workflow-safety-incident-${item.id}`,
        workflowType: "safety_control",
        title: item.description,
        description: item.nextAction,
        d5oPhase: "deliver",
        sourceModule: "safety",
        sourceRecordType: "safety_incident",
        sourceRecordId: item.id,
        projectId: item.projectId,
        projectName: item.projectName,
        entityName: item.projectName,
        signal: { title: "Incident or near miss follow-up", detail: item.description },
        requiredDecision: { question: "Does this incident require escalation, corrective action, or report closure?", options: ["Escalate", "Verify corrective action", "Close with evidence"] },
        requiredAction: { title: item.nextAction, detail: item.rootCause },
        evidenceNeeded: { required: ["Incident report", "Root cause", "Corrective actions", "Attachments"], currentState: `Status ${item.status}.` },
        currentStatus: item.status === "overdue" || item.status === "blocked" ? "blocked" : "at_risk",
        resolutionState: item.status === "overdue" ? "overdue" : item.status === "blocked" ? "blocked" : "needs_action",
        owner: item.projectName,
        dueDate: item.date,
        businessImpact: "Incident follow-up protects safety control, legal exposure, and crew readiness.",
        consequenceIfMissed: consequenceByType("safety_control"),
        targetModule: "Safety",
        targetHref: "/safety",
        nextGateOrStatus: { to: "Incident follow-up verified", label: "Safety control movement" },
        severity: severityFromDomain(item.severity),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      });
    });

  correctiveActions
    .filter((item) => item.sourceType.includes("safety") && !["closed", "verified"].includes(item.status))
    .forEach((item) => {
      addWorkflow(workflows, {
        id: `workflow-safety-corrective-${item.id}`,
        workflowType: "safety_control",
        title: item.title,
        description: item.nextAction,
        d5oPhase: "deliver",
        sourceModule: "safety",
        sourceRecordType: "corrective_action",
        sourceRecordId: item.id,
        projectId: item.projectId,
        projectName: item.projectName,
        entityName: item.projectName,
        signal: { title: "Safety corrective action open", detail: item.description },
        requiredDecision: { question: "Can this corrective action be verified or does it require escalation?", options: ["Verify correction", "Escalate", "Hold work", "Close with evidence"] },
        requiredAction: { title: item.nextAction, detail: item.description },
        evidenceNeeded: { required: ["Corrective action", "Verification", "Photos", "Source record"], currentState: `Verification ${item.verificationStatus}.` },
        currentStatus: item.status === "overdue" || item.status === "blocked" ? "blocked" : "at_risk",
        resolutionState: item.status === "overdue" ? "overdue" : item.status === "blocked" ? "blocked" : "needs_action",
        owner: item.owner,
        dueDate: item.dueDate,
        businessImpact: item.closeoutImpact ? "Safety corrective action affects closeout evidence." : "Open safety corrective action can affect field work and safety proof.",
        consequenceIfMissed: consequenceByType("safety_control"),
        targetModule: "Safety",
        targetHref: "/safety",
        nextGateOrStatus: { to: "Safety action verified", label: "Safety control movement" },
        severity: severityFromDomain(item.severity),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      });
    });

  [...qualityInspections.filter((item) => item.passFailResult === "fail" || item.status === "overdue"), ...qualityDeficiencies.filter((item) => !["closed", "verified"].includes(item.status)), ...testRecords.filter((item) => item.requiredForCloseout && (item.attachments.length === 0 || ["failed", "overdue", "blocked"].includes(item.status))), ...punchItems.filter((item) => !["closed", "verified"].includes(item.status)), ...correctiveActions.filter((item) => item.sourceType.includes("quality") && !["closed", "verified"].includes(item.status))]
    .forEach((item) => {
      const projectName = item.projectName ?? projectById(projects, item.projectId)?.name;
      addWorkflow(workflows, {
        id: `workflow-quality-${item.id}`,
        workflowType: "quality_control",
        title: "title" in item ? item.title : "Quality evidence required",
        description: "nextAction" in item ? item.nextAction : "Quality follow-up required.",
        d5oPhase: "deliver",
        sourceModule: "quality",
        sourceRecordType: "testType" in item ? "test_record" : "inspectionNumber" in item ? "quality_inspection" : "quality_record",
        sourceRecordId: item.id,
        projectId: item.projectId,
        projectName,
        entityName: projectName ?? item.id,
        signal: { title: "Quality evidence gap", detail: "description" in item ? item.description : "Quality inspection, test, or punch record requires action." },
        requiredDecision: { question: "Can this work be accepted, billed, or closed without correction?", options: ["Correct and reinspect", "Upload test", "Verify punch", "Hold closeout"] },
        requiredAction: {
          title: "nextAction" in item ? item.nextAction : "Complete quality follow-up.",
          detail: "description" in item ? item.description : "Resolve quality evidence gap."
        },
        evidenceNeeded: { required: ["Inspection record", "Photos", "Test result", "Correction verification", "Punch closure"], currentState: `Status ${item.status}.` },
        currentStatus: item.status === "overdue" || item.status === "blocked" ? "blocked" : "at_risk",
        resolutionState: item.status === "overdue" ? "overdue" : item.status === "blocked" ? "blocked" : "needs_action",
        owner: "assignedTo" in item ? item.assignedTo : "inspector" in item ? item.inspector : "owner" in item ? item.owner : projectName ?? "Quality owner",
        dueDate: "dueDate" in item ? item.dueDate : "date" in item ? item.date : item.createdAt,
        businessImpact: "Quality evidence, correction, or punch closure may affect acceptance, billing, or closeout.",
        consequenceIfMissed: consequenceByType("quality_control"),
        targetModule: "Quality",
        targetHref: "/quality",
        nextGateOrStatus: { to: "Quality evidence verified", label: "Quality control movement" },
        severity: severityFromDomain("severity" in item ? item.severity : item.status === "overdue" ? "critical" : "high"),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      });
    });

  closeoutPackages
    .filter((item) => item.status !== "closed" && item.status !== "archived" && (item.blockers.length > 0 || ["missing_requirements", "rejected"].includes(item.status) || item.retainageReleaseStatus === "blocked"))
    .forEach((item) => {
      addWorkflow(workflows, {
        id: `workflow-closeout-package-${item.id}`,
        workflowType: "closeout_acceptance",
        title: `Closeout package: ${item.projectName}`,
        description: item.nextAction,
        d5oPhase: "close",
        sourceModule: "closeout",
        sourceRecordType: "closeout_package",
        sourceRecordId: item.id,
        projectId: item.projectId,
        projectName: item.projectName,
        entityName: item.packageNumber,
        signal: { title: item.blockers[0] ?? "Closeout package blocker", detail: `Readiness ${item.readinessScore}%; acceptance ${item.acceptanceStatus}; retainage ${item.retainageReleaseStatus}.` },
        requiredDecision: { question: "Can this package be submitted, accepted, billed final, or archived?", options: ["Submit for acceptance", "Hold for evidence", "Hold for final billing", "Archive"] },
        requiredAction: { title: item.nextAction, detail: `GC reviewer: ${item.gcReviewer}` },
        evidenceNeeded: { required: ["As-builts/redlines", "Test records", "Punch closure", "Final billing", "Lien waiver", "Acceptance"], currentState: `${item.blockers.length} blocker(s).` },
        currentStatus: item.blockers.length > 0 ? "blocked" : "at_risk",
        resolutionState: item.blockers.length > 0 ? "blocked" : "ready_for_review",
        owner: item.closeoutOwner,
        dueDate: item.targetSubmissionDate,
        businessImpact: "Closeout blockers delay acceptance, final billing, retainage release, and archive readiness.",
        consequenceIfMissed: consequenceByType("closeout_acceptance"),
        targetModule: "Closeout",
        targetHref: item.id === canonicalCloseoutFinalBillingPackageId ? canonicalCloseoutFinalBillingHref : "/closeout",
        nextGateOrStatus: { from: "D5 assembling", to: "Acceptance / archive ready", label: "D5 gate movement" },
        severity: item.retainageReleaseStatus === "blocked" || item.blockers.length > 0 ? "critical" : "high",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      });
    });

  closeoutRequirements
    .filter((item) => ["missing", "blocked", "rejected"].includes(item.status))
    .forEach((item) => {
      addWorkflow(workflows, {
        id: `workflow-closeout-requirement-${item.id}`,
        workflowType: "closeout_acceptance",
        title: `Closeout evidence: ${item.title}`,
        description: item.description,
        d5oPhase: "close",
        sourceModule: "closeout",
        sourceRecordType: "closeout_requirement",
        sourceRecordId: item.id,
        projectId: item.projectId,
        projectName: projectById(projects, item.projectId)?.name,
        entityName: item.title,
        signal: { title: `${item.category.replaceAll("_", " ")} requirement ${item.status}`, detail: item.description },
        requiredDecision: { question: "Can acceptance or final billing move without this evidence?", options: ["Upload evidence", "Resolve exception", "Hold package"] },
        requiredAction: { title: item.nextAction, detail: `Required by ${item.requiredBy}` },
        evidenceNeeded: { required: ["Closeout requirement", "Source record", "Attachment", "Acceptance evidence"], currentState: `Source: ${item.sourceModule}.` },
        currentStatus: item.status === "blocked" ? "blocked" : "at_risk",
        resolutionState: item.status === "blocked" ? "blocked" : dueState(item.dueDate),
        owner: item.owner,
        dueDate: item.dueDate,
        businessImpact: item.finalBillingImpact || item.retainageImpact ? "This closeout requirement affects final billing or retainage release." : "This closeout requirement affects acceptance readiness.",
        consequenceIfMissed: consequenceByType("closeout_acceptance"),
        targetModule: "Closeout",
        targetHref: canonicalCloseoutFinalBillingRequirementIds.has(item.id) ? canonicalCloseoutFinalBillingHref : "/closeout",
        nextGateOrStatus: { to: "Closeout requirement accepted", label: "D5 evidence movement" },
        severity: item.finalBillingImpact || item.retainageImpact || item.status === "blocked" ? "critical" : "high",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      });
    });

  lessonsLearned
    .filter((lesson) => !["implemented", "verified", "closed"].includes(lesson.status))
    .forEach((lesson) => {
      addWorkflow(workflows, {
        id: `workflow-lesson-${lesson.id}`,
        workflowType: "optimize_learning",
        title: `Lesson learned: ${lesson.title}`,
        description: lesson.description,
        d5oPhase: "optimize",
        sourceModule: "reports",
        sourceRecordType: "lesson_learned",
        sourceRecordId: lesson.id,
        projectId: lesson.projectId,
        projectName: lesson.projectName,
        entityName: lesson.projectName,
        signal: { title: "Operating lesson open", detail: lesson.impact },
        requiredDecision: { question: "What should Rybex change before the next similar project?", options: ["Assign action", "Update rate", "Update checklist", "Defer with reason"] },
        requiredAction: { title: lesson.actionRequired, detail: lesson.recommendedChange },
        evidenceNeeded: { required: ["Lessons learned review", "Root cause", "Recommended change", "Owner action"], currentState: `Status ${lesson.status}.` },
        currentStatus: statusFromState(dueState(lesson.dueDate, lesson.status === "in_progress" ? "in_progress" : "needs_action")),
        resolutionState: dueState(lesson.dueDate, lesson.status === "in_progress" ? "in_progress" : "needs_action"),
        owner: lesson.owner,
        dueDate: lesson.dueDate,
        businessImpact: lesson.impact,
        consequenceIfMissed: consequenceByType("optimize_learning"),
        targetModule: "Optimize",
        targetHref: "/reports",
        nextGateOrStatus: { to: "Operating model updated", label: "Optimize movement" },
        severity: severityFromDomain(lesson.severity),
        createdAt: lesson.createdAt,
        updatedAt: lesson.updatedAt
      });
    });

  productionRateRecords
    .filter((rate) => Math.abs(rate.variancePercent) >= 15)
    .slice(0, 8)
    .forEach((rate) => {
      addWorkflow(workflows, {
        id: `workflow-rate-${rate.id}`,
        workflowType: "optimize_learning",
        title: `Production rate update: ${rate.workType}`,
        description: rate.notes,
        d5oPhase: "optimize",
        sourceModule: "reports",
        sourceRecordType: "production_rate",
        sourceRecordId: rate.id,
        entityName: rate.workType,
        signal: { title: `${rate.variancePercent}% production variance`, detail: `${rate.actualRate} actual vs ${rate.estimatedRate} estimated ${rate.unitOfMeasure}.` },
        requiredDecision: { question: "Should this update future estimating assumptions?", options: ["Update estimate rate", "Hold for more samples", "Add risk condition"] },
        requiredAction: { title: `Review recommended estimating rate ${rate.recommendedEstimatingRate}.`, detail: rate.conditions.join(", ") },
        evidenceNeeded: { required: ["Production record", "Sample projects", "Condition notes", "Confidence level"], currentState: `${rate.confidenceLevel} confidence.` },
        currentStatus: "at_risk",
        resolutionState: "needs_decision",
        owner: "Estimating Lead",
        dueDate: operatingDate,
        businessImpact: "Production variance should update future bids when sample evidence is credible.",
        consequenceIfMissed: consequenceByType("optimize_learning"),
        targetModule: "Optimize",
        targetHref: "/reports",
        nextGateOrStatus: { to: "Estimating assumption updated", label: "Rate library movement" },
        severity: Math.abs(rate.variancePercent) >= 25 ? "critical" : "high",
        createdAt: rate.createdAt,
        updatedAt: rate.updatedAt
      });
    });

  improvementActions
    .filter((action) => !["implemented", "verified", "closed", "deferred"].includes(action.status))
    .forEach((action) => {
      addWorkflow(workflows, {
        id: `workflow-improvement-${action.id}`,
        workflowType: "optimize_learning",
        title: `Improvement action: ${action.title}`,
        description: action.description,
        d5oPhase: "optimize",
        sourceModule: "reports",
        sourceRecordType: "improvement_action",
        sourceRecordId: action.id,
        entityName: action.title,
        signal: { title: action.status === "overdue" ? "Improvement action overdue" : "Improvement action open", detail: action.expectedBenefit },
        requiredDecision: { question: "What operating template, checklist, rate, or scoring model must change?", options: ["Assign action", "Publish change", "Defer with reason"] },
        requiredAction: { title: action.description, detail: action.completionEvidence },
        evidenceNeeded: { required: ["Improvement action", "Owner", "Due date", "Completion evidence"], currentState: `Status ${action.status}.` },
        currentStatus: action.status === "overdue" ? "overdue" : "active",
        resolutionState: action.status === "overdue" ? "overdue" : "in_progress",
        owner: action.owner,
        dueDate: action.dueDate,
        businessImpact: action.expectedBenefit,
        consequenceIfMissed: consequenceByType("optimize_learning"),
        targetModule: "Optimize",
        targetHref: "/reports",
        nextGateOrStatus: { to: "Operating model improved", label: "Optimize action movement" },
        severity: severityFromDomain(action.priority),
        createdAt: action.createdAt,
        updatedAt: action.updatedAt
      });
    });

  addWorkflow(workflows, {
    id: "workflow-system-readiness-demo-mode",
    workflowType: "system_readiness",
    title: "Demo/platform readiness boundary",
    description: "Seed mode remains the default runtime; persistence, auth, and RLS are scaffolded but not active.",
    d5oPhase: "optimize",
    sourceModule: "admin",
    sourceRecordType: "system_readiness",
    sourceRecordId: "seed-mode",
    entityName: "RybexOS demo environment",
    signal: {
      title: "Seed-backed demo mode active",
      detail: "Routes, docs, visual capture, and persistence scaffolding are visible without requiring database env vars."
    },
    requiredDecision: {
      question: "Is the platform ready for stakeholder demo without enabling database runtime?",
      options: ["Run verification", "Review docs", "Preserve seed fallback"]
    },
    requiredAction: {
      title: "Use Admin readiness, demo docs, and visual QA report before stakeholder review.",
      detail: "Do not enable database mode until a future persistence phase is approved."
    },
    evidenceNeeded: {
      required: ["Route smoke checks", "Visual QA report", "Demo package", "Persistence docs"],
      currentState: "Demo and visual QA scaffolding are available."
    },
    currentStatus: "ready_for_review",
    resolutionState: "ready_for_review",
    owner: "Operations Leader",
    dueDate: operatingDate,
    businessImpact: "Stakeholders can review the operating model safely without confusing demo data with live persistence.",
    consequenceIfMissed: consequenceByType("system_readiness"),
    targetModule: "Admin",
    targetHref: "/admin",
    nextGateOrStatus: { to: "Stakeholder demo ready", label: "System readiness movement" },
    severity: "info",
    createdAt: operatingDate,
    updatedAt: operatingDate
  });

  const allOperatingWorkflows = workflows
    .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((a, b) => rankWorkflow(a) - rankWorkflow(b));

  return {
    allOperatingWorkflows,
    topLeadershipWorkflows: allOperatingWorkflows.slice(0, 5),
    workflowsByType: groupByType(allOperatingWorkflows),
    workflowsByD5OPhase: groupByPhase(allOperatingWorkflows),
    workflowsByOwner: groupByOwner(allOperatingWorkflows),
    overdueWorkflows: allOperatingWorkflows.filter((item) => item.resolutionState === "overdue"),
    blockedWorkflows: allOperatingWorkflows.filter((item) => item.resolutionState === "blocked"),
    commercialExposureWorkflows: allOperatingWorkflows.filter((item) => ["change_recovery", "billing_cash_control"].includes(item.workflowType)),
    fieldReadinessWorkflows: allOperatingWorkflows.filter((item) => ["mobilization_readiness", "field_execution", "safety_control", "quality_control"].includes(item.workflowType)),
    closeoutPaymentWorkflows: allOperatingWorkflows.filter((item) => ["billing_cash_control", "closeout_acceptance"].includes(item.workflowType))
  };
}

export function getWorkflowsForType(workflowType: OperatingWorkflowType, data?: WorkflowSeedData) {
  return deriveOperatingWorkflows(data).workflowsByType[workflowType] ?? [];
}

export function getWorkflowContext(workflowType: OperatingWorkflowType, data?: WorkflowSeedData) {
  const summary = deriveOperatingWorkflows(data);
  return {
    config: workflowTypeConfig[workflowType],
    workflows: summary.workflowsByType[workflowType] ?? []
  };
}
