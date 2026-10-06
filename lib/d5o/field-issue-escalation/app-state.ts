import type { EndUserWorkspaceSummary } from "../end-user/page-focus-config";
import type { FieldIssueEscalation } from "./types";

export function applyFieldIssueEscalationToWorkspaceSummary(
  summary: EndUserWorkspaceSummary,
  issue: FieldIssueEscalation
): EndUserWorkspaceSummary {
  if (!["field-execution", "command-center"].includes(summary.pageId)) return summary;

  if (issue.state === "resolved") {
    if (summary.pageId === "command-center") {
      return {
        ...summary,
        statusReason: summary.statusReason === issue.summary ? "Field issue escalated and original blocker cleared." : summary.statusReason,
        primaryAction: summary.primaryAction.id === issue.id
          ? {
              ...summary.primaryAction,
              id: "field-issue-resolved-review-records",
              title: "Review field issue outcome",
              ctaLabel: "Review outcome",
              href: "/field-execution",
              severity: "info",
              whyItMatters: issue.outcomeRecord?.outcome ?? "The canonical field issue has been escalated and resolved.",
              taskOutcome: {
                ...summary.primaryAction.taskOutcome,
                concreteCtaLabel: "Review outcome",
                targetHref: "/field-execution",
                expectedOutcome: "Field issue blocker cleared."
              }
            }
          : summary.primaryAction,
        secondaryActions: summary.secondaryActions.filter((action) => action.id !== issue.id),
        criticalBlockers: summary.criticalBlockers.filter((blocker) =>
          !blocker.title.toLowerCase().includes("field issue") &&
          !blocker.title.toLowerCase().includes("utility locates")
        )
      };
    }

    return {
      ...summary,
      status: summary.status === "blocked" ? "ready" : summary.status,
      statusReason: "Field issue escalated and original blocker cleared.",
      primaryAction: {
        ...summary.primaryAction,
        id: "field-issue-resolved-review-records",
        title: "Review field issue outcome",
        ctaLabel: "Review outcome",
        href: summary.pageId === "field-execution" ? "/field-execution" : "/field-execution",
        severity: "info",
        whyItMatters: issue.outcomeRecord?.outcome ?? "The canonical field issue has been escalated and resolved.",
        taskOutcome: {
          ...summary.primaryAction.taskOutcome,
          concreteCtaLabel: "Review outcome",
          targetHref: summary.pageId === "field-execution" ? "/field-execution" : "/field-execution",
          expectedOutcome: "Field issue blocker cleared."
        }
      },
      criticalBlockers: summary.criticalBlockers.filter((blocker) =>
        !blocker.title.toLowerCase().includes("field issue") &&
        !blocker.title.toLowerCase().includes("utility locates")
      )
    };
  }

  const fieldIssueAction = {
    ...summary.primaryAction,
    id: issue.id,
    title: "Escalate Lake Norman field issue",
    owner: issue.owner,
    dueDate: "2026-06-11",
    whyItMatters: issue.summary,
    ctaLabel: "Escalate field issue",
    href: "/field-execution?focus=field-issue-lake-001#field-issue-escalation",
    severity: "critical" as const,
    taskOutcome: {
      ...summary.primaryAction.taskOutcome,
      focusId: issue.id,
      concreteCtaLabel: "Escalate field issue",
      targetHref: "/field-execution?focus=field-issue-lake-001#field-issue-escalation",
      expectedOutcome: "Create the downstream RFI or change event and clear the original field blocker."
    }
  };

  if (summary.pageId === "command-center") {
    return {
      ...summary,
      status: "blocked",
      statusReason: issue.summary,
      secondaryActions: [
        fieldIssueAction,
        ...summary.secondaryActions.filter((action) => action.id !== issue.id)
      ].slice(0, 3),
      criticalBlockers: [
        {
          id: issue.id,
          title: issue.summary,
          action: "Assess the field issue, add evidence, create the downstream record, and resolve the original blocker.",
          owner: issue.owner,
          dueDate: "2026-06-11",
          href: "/field-execution?focus=field-issue-lake-001#field-issue-escalation"
        },
        ...summary.criticalBlockers.filter((blocker) => blocker.id !== issue.id)
      ]
    };
  }

  return {
    ...summary,
    status: "blocked",
    statusReason: issue.summary,
    primaryAction: fieldIssueAction,
      criticalBlockers: [
      {
        id: issue.id,
        title: issue.summary,
        action: "Assess the field issue, add evidence, create the downstream record, and resolve the original blocker.",
        owner: issue.owner,
        dueDate: "2026-06-11",
        href: "/field-execution?focus=field-issue-lake-001#field-issue-escalation"
      },
      ...summary.criticalBlockers.filter((blocker) => blocker.id !== issue.id)
    ]
  };
}
