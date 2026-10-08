import { BillingV2WorkflowClient } from "./BillingV2WorkflowClient";
import type { BillingBackupPackage } from "@/lib/d5o/billing-v2";

type BillingV2GuidedWorkflowProps = {
  cameFromPilot?: boolean;
  initialPackage: BillingBackupPackage;
  storageLabel: string;
};

export function BillingV2GuidedWorkflow({
  cameFromPilot = false,
  initialPackage,
  storageLabel
}: BillingV2GuidedWorkflowProps) {
  return (
    <BillingV2WorkflowClient
      cameFromPilot={cameFromPilot}
      initialPackage={initialPackage}
      storageLabel={storageLabel}
    />
  );
}
