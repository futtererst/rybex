import { deriveEvidenceRequirements } from "../evidence";
import { deriveOperatingNotifications } from "../notifications";
import type { OperatingNotification } from "../notifications/types";
import type { EvidenceRequirement } from "../evidence/types";
import type { OperatingWorkflowType } from "../workflow/types";
import { deriveNextActions, fallbackNextAction, type SimplifiedNextAction } from "./derive-next-actions";
import { derivePageReadiness, type PageReadinessItem, type PageReadinessStatus } from "./derive-page-readiness";

export type SimplifiedPageId =
  | "command-center"
  | "pipeline"
  | "projects"
  | "mobilization"
  | "field-execution"
  | "rfis-submittals"
  | "changes"
  | "billing"
  | "safety"
  | "quality"
  | "closeout"
  | "reports";

export type PageOperatingSummary = {
  pageId: SimplifiedPageId;
  stageLabel: string;
  purpose: string;
  status: PageReadinessStatus;
  d5oPhase: string;
  ownerRole: string;
  roleFocus: string;
  workflowType?: OperatingWorkflowType;
  nextActions: SimplifiedNextAction[];
  readinessItems: PageReadinessItem[];
  evidenceItems: EvidenceRequirement[];
  riskItems: OperatingNotification[];
  detailLabel: string;
};

const pageConfig: Record<SimplifiedPageId, {
  stageLabel: string;
  purpose: string;
  d5oPhase: string;
  ownerRole: string;
  roleFocus: string;
  workflowType?: OperatingWorkflowType;
  detailLabel: string;
}> = {
  "command-center": {
    stageLabel: "Operating priorities",
    purpose: "See decisions, blocked work, evidence gaps, cash exposure, and where to act next.",
    d5oPhase: "Today",
    ownerRole: "Executive / Operations leader",
    roleFocus: "For this role, focus on decisions, cash at risk, blocked work, and owner follow-up.",
    detailLabel: "Leadership metrics, module summaries, and readiness details continue below."
  },
  pipeline: {
    stageLabel: "Pursuit control",
    purpose: "Decide whether Rybex should pursue the work before estimating time is committed.",
    d5oPhase: "D1 Discover",
    ownerRole: "Estimator / Executive",
    roleFocus: "For this role, focus on go/no-go decisions, bid deadlines, and pursuit risk.",
    workflowType: "pursuit_control",
    detailLabel: "Opportunity board, pursuit intelligence, and registers continue below."
  },
  projects: {
    stageLabel: "Contract baseline",
    purpose: "Confirm scope, contract, budget, schedule, and notice terms before mobilization planning.",
    d5oPhase: "D2 Define",
    ownerRole: "Project Manager",
    roleFocus: "For this role, focus on gate blockers, assigned actions, and required contract evidence.",
    workflowType: "contract_baseline",
    detailLabel: "Project controls, phase lanes, and contract records continue below."
  },
  mobilization: {
    stageLabel: "Field-start readiness",
    purpose: "Confirm crew, safety, materials, access, and work packages before field work starts.",
    d5oPhase: "D3 Prepare",
    ownerRole: "Operations / Superintendent",
    roleFocus: "For this role, focus on field-start blockers, safety readiness, and access/material proof.",
    workflowType: "mobilization_readiness",
    detailLabel: "Mobilization plans, readiness panels, and work packages continue below."
  },
  "field-execution": {
    stageLabel: "Daily field control",
    purpose: "Capture what happened in the field and escalate issues before proof is lost.",
    d5oPhase: "Field operations",
    ownerRole: "Field Supervisor",
    roleFocus: "For this role, focus on today's report, quantities, blockers, evidence, and issue prompts.",
    workflowType: "field_execution",
    detailLabel: "Daily reports, production, delays, and signoff queues continue below."
  },
  "rfis-submittals": {
    stageLabel: "Information control",
    purpose: "Resolve clarifications and approvals that block work or weaken entitlement.",
    d5oPhase: "Answer control",
    ownerRole: "Project Manager",
    roleFocus: "For this role, focus on overdue responses, blocked work, and linked change exposure.",
    workflowType: "information_control",
    detailLabel: "RFI and submittal registers continue below."
  },
  changes: {
    stageLabel: "Change recovery",
    purpose: "Control notice, backup, pricing, approval, and billing recovery.",
    d5oPhase: "Commercial recovery",
    ownerRole: "Project Manager / Commercial",
    roleFocus: "For this role, focus on notice deadlines, missing backup, and approved-not-billed work.",
    workflowType: "change_recovery",
    detailLabel: "Change events, backup panels, and pricing details continue below."
  },
  billing: {
    stageLabel: "Billing and cash control",
    purpose: "Turn approved work and backup into pay applications, cash recovery, and retainage release.",
    d5oPhase: "Cash control",
    ownerRole: "Finance / Project Manager",
    roleFocus: "For this role, focus on cash at risk, billing blockers, backup, lien waivers, and retainage.",
    workflowType: "billing_cash_control",
    detailLabel: "Pay applications, SOV, exposure, and billing support continue below."
  },
  safety: {
    stageLabel: "Safety control",
    purpose: "Keep field work safe by closing incidents, observations, JHAs, and corrective actions.",
    d5oPhase: "D3/D4 Safety",
    ownerRole: "Safety Manager",
    roleFocus: "For this role, focus on overdue corrective actions, missing JHAs, incidents, and verification.",
    workflowType: "safety_control",
    detailLabel: "Safety plans, observations, incidents, and corrective records continue below."
  },
  quality: {
    stageLabel: "Quality control",
    purpose: "Verify inspections, tests, deficiencies, and punch items before acceptance is blocked.",
    d5oPhase: "D4/D5 Quality",
    ownerRole: "Quality Manager",
    roleFocus: "For this role, focus on missing tests, deficiencies, punch blockers, and proof of correction.",
    workflowType: "quality_control",
    detailLabel: "Inspection, deficiency, test, and punch records continue below."
  },
  closeout: {
    stageLabel: "Closeout and acceptance",
    purpose: "Prove completion, secure acceptance, protect final billing, and release retainage.",
    d5oPhase: "Final billing release",
    ownerRole: "Project Manager / Closeout",
    roleFocus: "For this role, focus on acceptance blockers, closeout evidence, final billing, and retainage.",
    workflowType: "closeout_acceptance",
    detailLabel: "Closeout packages, requirements, acceptance, and archive details continue below."
  },
  reports: {
    stageLabel: "Optimize learning",
    purpose: "Turn project outcomes into better pursuit, estimating, production, and partner decisions.",
    d5oPhase: "O Optimize",
    ownerRole: "Executive / Operations",
    roleFocus: "For this role, focus on lessons, production rate updates, partner cautions, and improvement actions.",
    workflowType: "optimize_learning",
    detailLabel: "Scorecards, lessons, rate libraries, and improvement records continue below."
  }
};

function evidenceForPage(pageId: SimplifiedPageId, workflowType?: OperatingWorkflowType) {
  const evidence = deriveEvidenceRequirements();
  const moduleMatches = evidence.allEvidenceRequirements.filter((item) =>
    item.sourceModule === pageId ||
    (pageId === "reports" && item.sourceModule === "optimize") ||
    (pageId === "rfis-submittals" && ["rfis_submittals", "rfi", "submittal"].includes(item.sourceModule))
  );
  const blocking = [
    ...evidence.evidenceBlockingGate,
    ...evidence.evidenceBlockingBilling,
    ...evidence.evidenceBlockingCloseout
  ];
  const workflowMatches = workflowType
    ? blocking.filter((item) => moduleMatches.some((candidate) => candidate.id === item.id))
    : blocking;
  const selected = workflowMatches.length > 0 ? workflowMatches : moduleMatches;

  return selected.slice(0, 4);
}

function risksForPage(pageId: SimplifiedPageId, workflowType?: OperatingWorkflowType) {
  const notifications = deriveOperatingNotifications();
  const filtered = notifications.allNotifications.filter((item) =>
    workflowType ? item.sourceModule === pageId || item.category.includes(workflowType.split("_")[0]) : true
  );

  return (filtered.length > 0 ? filtered : notifications.commandCenterNotifications).slice(0, 4);
}

export function getPageOperatingSummary(pageId: SimplifiedPageId): PageOperatingSummary {
  const config = pageConfig[pageId];
  const readiness = derivePageReadiness(config.workflowType);
  const nextActions = deriveNextActions(config.workflowType);

  return {
    pageId,
    stageLabel: config.stageLabel,
    purpose: config.purpose,
    status: readiness.status,
    d5oPhase: config.d5oPhase,
    ownerRole: config.ownerRole,
    roleFocus: config.roleFocus,
    workflowType: config.workflowType,
    nextActions: nextActions.length > 0 ? nextActions : [fallbackNextAction(config.workflowType)],
    readinessItems: readiness.readinessItems,
    evidenceItems: evidenceForPage(pageId, config.workflowType),
    riskItems: risksForPage(pageId, config.workflowType),
    detailLabel: config.detailLabel
  };
}
