import type { SimplifiedNextAction } from "../simplification/derive-next-actions";
import type { SimplifiedPageId } from "../simplification/page-summary";
import type { CompletionWorkflowId } from "../workflow-completion/definition-types";
import {
  getBillingBackupProofFocusId,
  getCloseoutProofFocusId,
  getFieldIssueProofFocusId
} from "../workflow-completion/completion-service";
import { getCompletionWorkflowDefinition } from "../workflow-completion/workflow-completion-registry";

export type TaskOutcomeContract = {
  focusId: string;
  sourceModule: SimplifiedPageId;
  targetRoute: string;
  targetHref: string;
  concreteCtaLabel: string;
  expectedOutcome: string;
  targetSection: string;
  targetObjectTitle: string;
  nextStepInstruction: string;
  reason: string;
  workflowCompletionId?: string;
  workflowCompletionRegistryId?: CompletionWorkflowId;
  workflowCompletionType?: "billing_backup_blocker" | "field_issue_escalation" | "closeout_requirement_completion";
};

const concreteLabels: Record<SimplifiedPageId, string> = {
  "command-center": "Open task",
  pipeline: "Review go/no-go decision",
  projects: "Resolve contract baseline gap",
  mobilization: "Review blocked field start",
  "field-execution": "Review field issue",
  "rfis-submittals": "Resolve information blocker",
  changes: "Protect change recovery",
  billing: "Clear billing blocker",
  safety: "Close safety action",
  quality: "Close quality action",
  closeout: "Clear closeout requirement",
  reports: "Apply learning action"
};

const nextSteps: Record<SimplifiedPageId, string> = {
  "command-center": "Open the focused task, confirm the owner, then resolve or assign the next action.",
  pipeline: "Review the pursuit decision, confirm risk, then approve or hold the go/no-go.",
  projects: "Review the baseline gap, confirm evidence, then clear or hold the D2 gate.",
  mobilization: "Review the field-start blocker, confirm evidence, then clear or hold mobilization.",
  "field-execution": "Review the field signal, then submit the report or create the needed RFI/change action.",
  "rfis-submittals": "Review the blocking item, confirm owner and due date, then drive response or escalation.",
  changes: "Review notice, backup, and pricing status, then protect recovery before the window closes.",
  billing: "Review the cash blocker, identify missing backup, then clear the pay application path.",
  safety: "Review the corrective action, confirm evidence, then close or hold field work.",
  quality: "Review the deficiency or test gap, confirm proof, then close the quality blocker.",
  closeout: "Review the missing requirement, confirm evidence, then clear acceptance or final billing.",
  reports: "Review the learning action, assign the update, then publish or resolve the improvement."
};

const targetSections: Record<SimplifiedPageId, string> = {
  "command-center": "Leadership priority",
  pipeline: "Pipeline decision",
  projects: "D2 baseline action",
  mobilization: "D3 field-start action",
  "field-execution": "Field execution action",
  "rfis-submittals": "Information-control action",
  changes: "Change recovery action",
  billing: "Billing blocker",
  safety: "Safety action",
  quality: "Quality action",
  closeout: "Closeout requirement",
  reports: "Optimize action"
};

function sanitizeFocusId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "focused-task";
}

function pageFromHref(href: string, fallback: SimplifiedPageId): SimplifiedPageId {
  const path = href.split(/[?#]/)[0] || "";
  const segment = path.replace(/^\//, "").split("/")[0] || fallback;

  if (segment === "command-center") return "command-center";
  if (segment === "pipeline") return "pipeline";
  if (segment === "projects") return "projects";
  if (segment === "mobilization") return "mobilization";
  if (segment === "field-execution") return "field-execution";
  if (segment === "rfis-submittals") return "rfis-submittals";
  if (segment === "changes") return "changes";
  if (segment === "billing") return "billing";
  if (segment === "safety") return "safety";
  if (segment === "quality") return "quality";
  if (segment === "closeout") return "closeout";
  if (segment === "reports") return "reports";

  return fallback;
}

function concreteLabelForAction(action: SimplifiedNextAction, sourceModule: SimplifiedPageId) {
  const text = `${action.title} ${action.whyItMatters} ${action.href}`.toLowerCase();

  if (action.id === getBillingBackupProofFocusId() || /billing backup|pay application cannot move|stored material billing/.test(text)) {
    return "Add missing billing backup";
  }

  if (action.id === getFieldIssueProofFocusId() || /field issue escalation|unclear conduit routing|zone b/.test(text)) {
    return "Escalate field issue";
  }

  if (action.id === getCloseoutProofFocusId() || /closeout requirement|as-built redline|final billing release/.test(text)) {
    return "Complete closeout requirement";
  }

  if (/go\/?no-go|pursuit|bid|opportunit|intake/.test(text)) return "Review go/no-go decision";
  if (/contract|baseline|scope|budget|schedule|d2/.test(text)) return "Resolve contract baseline gap";
  if (/mobiliz|field start|locate|material|jha|d3/.test(text)) return "Review blocked field start";
  if (/daily report|field issue|changed condition|production|crew/.test(text)) return "Review field issue";
  if (/rfi|submittal|information|clarification|approval/.test(text)) return "Resolve information blocker";
  if (/change|notice|pricing|backup|recovery/.test(text)) return "Protect change recovery";
  if (/billing|pay app|cash|retainage|sov|invoice/.test(text)) return "Clear billing blocker";
  if (/safety|incident|corrective|toolbox/.test(text)) return "Close safety action";
  if (/quality|deficien|test|punch|inspection/.test(text)) return "Close quality action";
  if (/closeout|acceptance|final billing|warranty|as-built/.test(text)) return "Clear closeout requirement";
  if (/lesson|learning|rate|improvement|optimize/.test(text)) return "Apply learning action";

  return concreteLabels[sourceModule];
}

export function buildFocusedTaskHref(href: string, focusId: string) {
  if (href.startsWith("#") || href.length === 0) {
    return `?focus=${encodeURIComponent(focusId)}#focused-task`;
  }

  if (!href.startsWith("/")) {
    return href;
  }

  const url = new URL(href, "https://rybexos.local");
  url.searchParams.set("focus", focusId);
  url.hash = "focused-task";
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildTaskOutcomeContract(
  action: SimplifiedNextAction,
  sourceModule: SimplifiedPageId
): TaskOutcomeContract {
  const targetModule = pageFromHref(action.href, sourceModule);
  const isBillingBackupProof = action.id === getBillingBackupProofFocusId() ||
    /billing backup|pay application cannot move|stored material billing/.test(`${action.title} ${action.whyItMatters}`.toLowerCase());
  const isFieldIssueProof = action.id === getFieldIssueProofFocusId() ||
    /field issue escalation|unclear conduit routing|zone b/.test(`${action.title} ${action.whyItMatters}`.toLowerCase());
  const isCloseoutProof = action.id === getCloseoutProofFocusId() ||
    /closeout requirement|as-built redline|final billing release/.test(`${action.title} ${action.whyItMatters}`.toLowerCase());
  const billingRegistryId = getCompletionWorkflowDefinition("billing-backup-cash-recovery").id;
  const fieldRegistryId = getCompletionWorkflowDefinition("field-issue-escalation").id;
  const closeoutRegistryId = getCompletionWorkflowDefinition("closeout-requirement-final-billing-release").id;
  const focusId = isBillingBackupProof
    ? getBillingBackupProofFocusId()
    : isFieldIssueProof
      ? getFieldIssueProofFocusId()
      : isCloseoutProof
        ? getCloseoutProofFocusId()
        : sanitizeFocusId(`${targetModule}-${action.id}`);
  const concreteCtaLabel = concreteLabelForAction(action, targetModule);
  const targetObjectTitle = action.title;

  return {
    focusId,
    sourceModule,
    targetRoute: action.href.split(/[?#]/)[0] || `/${targetModule}`,
    targetHref: buildFocusedTaskHref(action.href, focusId),
    concreteCtaLabel,
    expectedOutcome: isBillingBackupProof
      ? "Missing billing backup can be added, reviewed, and approved so blocked cash can move."
      : `Focused task panel opens for ${targetObjectTitle}.`,
    targetSection: targetSections[targetModule],
    targetObjectTitle: isBillingBackupProof
      ? "Add missing billing backup"
      : isFieldIssueProof
        ? "Escalate field issue"
        : isCloseoutProof
          ? "Complete closeout requirement"
        : targetObjectTitle,
    nextStepInstruction: isBillingBackupProof
      ? "Start the backup package, add required proof, then send the package to commercial review."
      : isFieldIssueProof
        ? "Create an RFI, create a change event, or mark the issue controlled."
        : isCloseoutProof
          ? "Attach evidence, waive with a reason, send to review, or resolve the closeout blocker."
      : nextSteps[targetModule],
    reason: action.whyItMatters,
    workflowCompletionId: isBillingBackupProof
      ? getBillingBackupProofFocusId()
      : isFieldIssueProof
        ? getFieldIssueProofFocusId()
        : isCloseoutProof
          ? getCloseoutProofFocusId()
        : undefined,
    workflowCompletionRegistryId: isBillingBackupProof
      ? billingRegistryId
      : isFieldIssueProof
        ? fieldRegistryId
        : isCloseoutProof
          ? closeoutRegistryId
        : undefined,
    workflowCompletionType: isBillingBackupProof
      ? "billing_backup_blocker"
      : isFieldIssueProof
        ? "field_issue_escalation"
        : isCloseoutProof
          ? "closeout_requirement_completion"
        : undefined
  };
}
