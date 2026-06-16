import { StatusChip } from "@/components/d5o/StatusChip";
import { evidenceStatusLabels, evidenceStatusTones } from "@/lib/d5o/evidence/config";
import type { EvidenceStatus } from "@/lib/d5o/evidence/types";

export function EvidenceStatusChip({ status }: { status: EvidenceStatus }) {
  return (
    <StatusChip
      label={evidenceStatusLabels[status]}
      tone={evidenceStatusTones[status]}
    />
  );
}
