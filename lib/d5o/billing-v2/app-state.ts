import type { EndUserWorkspaceSummary } from "../end-user/page-focus-config";
import type { BillingBackupPackage } from "./types";

export function applyBillingV2CompletionToWorkspaceSummary(
  summary: EndUserWorkspaceSummary,
  billingPackage: BillingBackupPackage
): EndUserWorkspaceSummary {
  if (billingPackage.state !== "billing_blocker_cleared") return summary;
  if (!["billing", "command-center"].includes(summary.pageId)) return summary;

  return {
    ...summary,
    status: summary.status === "blocked" ? "ready" : summary.status,
    statusReason: "Billing V2 backup blocker cleared.",
    primaryAction: {
      ...summary.primaryAction,
      id: "billing-v2-cleared-review-records",
      title: "Review billing records",
      ctaLabel: "Review billing records",
      href: summary.pageId === "billing" ? "#commercial-exposure" : "/billing#commercial-exposure",
      severity: "info",
      whyItMatters: billingPackage.outcomeRecord?.outcome ?? "The Billing V2 backup blocker has been cleared and persisted.",
      taskOutcome: {
        ...summary.primaryAction.taskOutcome,
        concreteCtaLabel: "Review billing records",
        targetHref: summary.pageId === "billing" ? "#commercial-exposure" : "/billing#commercial-exposure",
        expectedOutcome: "Billing backup blocker cleared."
      }
    },
    criticalBlockers: summary.criticalBlockers.filter((blocker) =>
      !blocker.title.toLowerCase().includes("billing backup") &&
      !blocker.title.toLowerCase().includes("missing billing")
    )
  };
}
