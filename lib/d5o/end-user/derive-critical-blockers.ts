import type { OperatingNotification } from "../notifications/types";
import type { PageOperatingSummary } from "../simplification/page-summary";

export type EndUserBlocker = {
  id: string;
  title: string;
  action: string;
  owner: string;
  dueDate: string;
  href: string;
};

const severeFirst = {
  critical: 0,
  high: 1,
  watch: 2,
  info: 3,
  resolved: 4
} as const;

function mapNotification(notification: OperatingNotification): EndUserBlocker {
  return {
    id: notification.id,
    title: notification.title,
    action: notification.requiredAction,
    owner: notification.owner,
    dueDate: notification.dueDate,
    href: notification.targetHref
  };
}

export function deriveCriticalBlockers(summary: PageOperatingSummary): EndUserBlocker[] {
  const fromRisks = summary.riskItems
    .filter((risk) => risk.status !== "resolved" && risk.status !== "dismissed")
    .sort((a, b) => severeFirst[a.severity] - severeFirst[b.severity])
    .map(mapNotification);

  if (fromRisks.length > 0) {
    return fromRisks.slice(0, 2);
  }

  return summary.readinessItems
    .filter((item) => item.status === "blocking" || item.status === "pending")
    .slice(0, 2)
    .map((item) => ({
      id: item.id,
      title: item.label,
      action: item.detail,
      owner: summary.ownerRole,
      dueDate: "Now",
      href: "#details-records"
    }));
}
