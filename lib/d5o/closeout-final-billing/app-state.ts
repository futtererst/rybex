import type { EndUserWorkspaceSummary } from "../end-user/page-focus-config";
import type { CloseoutFinalBillingBlocker } from "./types";

export function applyCloseoutFinalBillingToWorkspaceSummary(
  summary: EndUserWorkspaceSummary,
  blocker: CloseoutFinalBillingBlocker
): EndUserWorkspaceSummary {
  if (!["closeout", "command-center", "billing"].includes(summary.pageId)) return summary;

  if (blocker.state === "resolved") {
    return {
      ...summary,
      status: summary.status === "blocked" ? "ready" : summary.status,
      statusReason: summary.statusReason === blocker.requirementSummary
        ? "Closeout final billing blocker cleared."
        : summary.statusReason,
      primaryAction: summary.primaryAction.id === blocker.id
        ? {
            ...summary.primaryAction,
            id: "closeout-final-billing-resolved-review",
            title: "Review closeout release outcome",
            ctaLabel: "Review outcome",
            href: "/closeout",
            severity: "info",
            whyItMatters: blocker.outcomeRecord?.outcome ?? "Final billing and retainage release are unblocked.",
            taskOutcome: {
              ...summary.primaryAction.taskOutcome,
              concreteCtaLabel: "Review outcome",
              targetHref: "/closeout",
              expectedOutcome: "Closeout final billing blocker cleared."
            }
          }
        : summary.primaryAction,
      secondaryActions: summary.secondaryActions.filter((action) => action.id !== blocker.id),
      criticalBlockers: summary.criticalBlockers.filter((item) => item.id !== blocker.id)
    };
  }

  const closeoutAction = {
    ...summary.primaryAction,
    id: blocker.id,
    title: "Release final billing and retainage",
    owner: blocker.financeOwner,
    dueDate: blocker.dueDate,
    whyItMatters: blocker.requirementSummary,
    ctaLabel: "Release final billing",
    href: "/closeout?focus=closeout-final-billing-lake-001#closeout-final-billing",
    severity: "critical" as const,
    taskOutcome: {
      ...summary.primaryAction.taskOutcome,
      focusId: blocker.id,
      concreteCtaLabel: "Release final billing",
      targetHref: "/closeout?focus=closeout-final-billing-lake-001#closeout-final-billing",
      expectedOutcome: "Approve closeout release and clear final billing/retainage blocker."
    }
  };

  if (summary.pageId === "command-center" || summary.pageId === "billing") {
    return {
      ...summary,
      status: "blocked",
      statusReason: blocker.requirementSummary,
      secondaryActions: [
        closeoutAction,
        ...summary.secondaryActions.filter((action) => action.id !== blocker.id)
      ].slice(0, 3),
      criticalBlockers: [
        {
          id: blocker.id,
          title: blocker.requirementSummary,
          action: "Complete closeout release review and clear retainage blocker.",
          owner: blocker.financeOwner,
          dueDate: blocker.dueDate,
          href: "/closeout?focus=closeout-final-billing-lake-001#closeout-final-billing"
        },
        ...summary.criticalBlockers.filter((item) => item.id !== blocker.id)
      ]
    };
  }

  return {
    ...summary,
    status: "blocked",
    statusReason: blocker.requirementSummary,
    primaryAction: closeoutAction,
    criticalBlockers: [
      {
        id: blocker.id,
        title: blocker.requirementSummary,
        action: "Complete closeout release review and clear retainage blocker.",
        owner: blocker.financeOwner,
        dueDate: blocker.dueDate,
        href: "/closeout?focus=closeout-final-billing-lake-001#closeout-final-billing"
      },
      ...summary.criticalBlockers.filter((item) => item.id !== blocker.id)
    ]
  };
}
