import type { EvidenceRequirement } from "../evidence/types";
import type { PageOperatingSummary } from "../simplification/page-summary";

export type EndUserEvidenceItem = {
  id: string;
  title: string;
  owner: string;
  dueDate?: string;
  blocks: string;
};

function blockedBy(item: EvidenceRequirement) {
  if (item.requiredForBilling) return "billing";
  if (item.requiredForCloseout) return "closeout";
  if (item.requiredForChangeRecovery) return "change recovery";
  if (item.requiredForGate) return "gate";
  return "next action";
}

export function deriveEvidenceNeededNow(summary: PageOperatingSummary): EndUserEvidenceItem[] {
  return summary.evidenceItems
    .filter((item) => item.status === "missing" || item.status === "pending" || item.status === "rejected")
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      owner: item.owner,
      dueDate: item.dueDate,
      blocks: blockedBy(item)
    }));
}
