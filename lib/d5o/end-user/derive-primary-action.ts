import type { SimplifiedNextAction } from "../simplification/derive-next-actions";
import { fallbackNextAction } from "../simplification/derive-next-actions";
import type { PageOperatingSummary, SimplifiedPageId } from "../simplification/page-summary";
import type { WorkflowSeverity } from "../workflow/types";
import {
  getBillingBackupProofAction,
  getCloseoutProofAction,
  getFieldIssueProofAction
} from "../workflow-completion/completion-service";
import {
  buildTaskOutcomeContract,
  type TaskOutcomeContract
} from "./task-outcome-contract";

export type EndUserAction = {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  whyItMatters: string;
  ctaLabel: string;
  href: string;
  severity: WorkflowSeverity;
  taskOutcome: TaskOutcomeContract;
};

function trimText(value: string, fallback: string) {
  const sentence = value.split(/[.!?]/)[0]?.trim();
  if (!sentence) return fallback;
  const words = sentence.split(/\s+/).filter(Boolean);
  const trimmed = words.length > 14 ? `${words.slice(0, 14).join(" ")}.` : sentence;
  return trimmed || fallback;
}

function mapAction(action: SimplifiedNextAction, pageId: SimplifiedPageId): EndUserAction {
  const taskOutcome = buildTaskOutcomeContract(action, pageId);

  return {
    ...action,
    ctaLabel: taskOutcome.concreteCtaLabel,
    href: taskOutcome.targetHref,
    taskOutcome,
    whyItMatters: trimText(action.whyItMatters, "Required before work can move forward.")
  };
}

export function derivePrimaryAction(summary: PageOperatingSummary): EndUserAction {
  if (summary.pageId === "command-center" || summary.pageId === "billing") {
    const billingBackupAction = getBillingBackupProofAction();

    if (billingBackupAction) {
      return mapAction(billingBackupAction, summary.pageId);
    }
  }

  if (summary.pageId === "field-execution") {
    return mapAction(getFieldIssueProofAction(), summary.pageId);
  }

  if (summary.pageId === "closeout") {
    return mapAction(getCloseoutProofAction(), summary.pageId);
  }

  const action = summary.nextActions[0] ?? fallbackNextAction(summary.workflowType);
  return mapAction(action, summary.pageId);
}

export function deriveSecondaryActions(summary: PageOperatingSummary): EndUserAction[] {
  return summary.nextActions.slice(1, 3).map((action) => mapAction(action, summary.pageId));
}
