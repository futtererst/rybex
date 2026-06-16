import {
  derivePrimaryAction,
  deriveSecondaryActions,
  type EndUserAction
} from "./derive-primary-action";
import { deriveCriticalBlockers, type EndUserBlocker } from "./derive-critical-blockers";
import { deriveEvidenceNeededNow, type EndUserEvidenceItem } from "./derive-evidence-needed-now";
import { getPageOperatingSummary, type SimplifiedPageId } from "../simplification/page-summary";
import type { PageReadinessStatus } from "../simplification/derive-page-readiness";

export type PageFocusConfig = {
  pageId: SimplifiedPageId;
  purpose: string;
  primaryUserIntent: string;
  defaultPrimaryActionType: string;
  clutterSignals: string[];
  collapseByDefault: string[];
};

export type EndUserWorkspaceSummary = {
  pageId: SimplifiedPageId;
  stageLabel: string;
  purpose: string;
  status: PageReadinessStatus;
  statusReason: string;
  d5oPhase: string;
  primaryUserIntent: string;
  primaryAction: EndUserAction;
  secondaryActions: EndUserAction[];
  criticalBlockers: EndUserBlocker[];
  evidenceNeededNow: EndUserEvidenceItem[];
  detailLabel: string;
};

export const pageFocusConfig: Record<SimplifiedPageId, PageFocusConfig> = {
  "command-center": {
    pageId: "command-center",
    purpose: "My operating priorities for decisions, blockers, cash, and evidence.",
    primaryUserIntent: "Focus on the one priority that needs leadership attention.",
    defaultPrimaryActionType: "leadership_priority",
    clutterSignals: ["module summaries", "phase maps", "metrics grids"],
    collapseByDefault: ["module summaries", "leadership watch lists", "detailed controls"]
  },
  pipeline: {
    pageId: "pipeline",
    purpose: "Decide which pursuit should move forward or stop.",
    primaryUserIntent: "Find the pursuit needing a go/no-go decision.",
    defaultPrimaryActionType: "go_no_go",
    clutterSignals: ["score details", "opportunity board", "risk library notes"],
    collapseByDefault: ["scoring detail", "pipeline register", "GC/risk intelligence"]
  },
  projects: {
    pageId: "projects",
    purpose: "Clear the contract baseline before mobilization planning.",
    primaryUserIntent: "Find the baseline item blocking D2 readiness.",
    defaultPrimaryActionType: "d2_gate",
    clutterSignals: ["project register", "phase lanes", "baseline cards"],
    collapseByDefault: ["project register", "phase lanes", "baseline detail"]
  },
  mobilization: {
    pageId: "mobilization",
    purpose: "Clear the blocker preventing field start.",
    primaryUserIntent: "Find what blocks D3 release to D4 field work.",
    defaultPrimaryActionType: "d3_field_start",
    clutterSignals: ["readiness matrix", "work package board", "artifact panels"],
    collapseByDefault: ["readiness matrix", "artifact panels", "work packages"]
  },
  "field-execution": {
    pageId: "field-execution",
    purpose: "Submit today’s report or escalate the field issue.",
    primaryUserIntent: "Find what must be reported or escalated today.",
    defaultPrimaryActionType: "daily_report_or_field_issue",
    clutterSignals: ["production details", "billing support", "closeout signals"],
    collapseByDefault: ["production dashboards", "billing support", "D5 handoff"]
  },
  "rfis-submittals": {
    pageId: "rfis-submittals",
    purpose: "Unblock work waiting on clarification or approval.",
    primaryUserIntent: "Find the RFI or submittal blocking field work.",
    defaultPrimaryActionType: "information_blocker",
    clutterSignals: ["registers", "linked change records"],
    collapseByDefault: ["RFI register", "submittal register", "commercial links"]
  },
  changes: {
    pageId: "changes",
    purpose: "Protect the change risk before notice or backup is missed.",
    primaryUserIntent: "Find the change needing notice, backup, or pricing.",
    defaultPrimaryActionType: "change_recovery",
    clutterSignals: ["change log", "pricing summaries", "billing handoff"],
    collapseByDefault: ["change log", "pricing detail", "billing handoff"]
  },
  billing: {
    pageId: "billing",
    purpose: "Clear the blocker holding cash or pay application readiness.",
    primaryUserIntent: "Find what backup is needed to bill now.",
    defaultPrimaryActionType: "billing_backup",
    clutterSignals: ["SOV tables", "payment registers", "commercial panels"],
    collapseByDefault: ["SOV", "pay application register", "commercial exposure"]
  },
  safety: {
    pageId: "safety",
    purpose: "Close the safety action that affects field work.",
    primaryUserIntent: "Find the overdue or critical safety action.",
    defaultPrimaryActionType: "safety_action",
    clutterSignals: ["safety registers", "incident detail", "JHA lists"],
    collapseByDefault: ["safety registers", "incident detail", "JHA lists"]
  },
  quality: {
    pageId: "quality",
    purpose: "Close the deficiency or test gap blocking acceptance.",
    primaryUserIntent: "Find the quality item that blocks acceptance.",
    defaultPrimaryActionType: "quality_action",
    clutterSignals: ["inspection lists", "test registers", "punch records"],
    collapseByDefault: ["inspection lists", "test registers", "punch records"]
  },
  closeout: {
    pageId: "closeout",
    purpose: "Clear the requirement blocking acceptance or final billing.",
    primaryUserIntent: "Find the closeout evidence needed now.",
    defaultPrimaryActionType: "closeout_evidence",
    clutterSignals: ["package detail", "requirement trackers", "archive panels"],
    collapseByDefault: ["package detail", "requirements", "archive records"]
  },
  reports: {
    pageId: "reports",
    purpose: "Take the learning action that improves future work.",
    primaryUserIntent: "Find the improvement action to close or publish.",
    defaultPrimaryActionType: "improvement_action",
    clutterSignals: ["analytics", "scorecards", "rate libraries"],
    collapseByDefault: ["scorecards", "analytics", "rate libraries"]
  }
};

function statusReason(status: PageReadinessStatus, blockers: EndUserBlocker[], evidence: EndUserEvidenceItem[]) {
  if (status === "blocked" && blockers[0]) return blockers[0].title;
  if (status === "at_risk" && blockers[0]) return blockers[0].title;
  if (evidence.length > 0) return `${evidence.length} evidence item(s) needed`;
  if (status === "complete") return "No action required now";
  return "Ready for assigned action";
}

export function getEndUserWorkspaceSummary(pageId: SimplifiedPageId): EndUserWorkspaceSummary {
  const operatingSummary = getPageOperatingSummary(pageId);
  const focus = pageFocusConfig[pageId];
  const criticalBlockers = deriveCriticalBlockers(operatingSummary);
  const evidenceNeededNow = deriveEvidenceNeededNow(operatingSummary);

  return {
    pageId,
    stageLabel: operatingSummary.stageLabel,
    purpose: focus.purpose,
    status: operatingSummary.status,
    statusReason: statusReason(operatingSummary.status, criticalBlockers, evidenceNeededNow),
    d5oPhase: operatingSummary.d5oPhase,
    primaryUserIntent: focus.primaryUserIntent,
    primaryAction: derivePrimaryAction(operatingSummary),
    secondaryActions: deriveSecondaryActions(operatingSummary),
    criticalBlockers,
    evidenceNeededNow,
    detailLabel: operatingSummary.detailLabel
  };
}
