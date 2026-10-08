import { billingV2OperatingSlice } from "../billing-v2/operating-slice";
import { closeoutFinalBillingOperatingSlice } from "../closeout-final-billing/operating-slice";
import { fieldIssueOperatingSlice } from "../field-issue-escalation/operating-slice";
import type { OperatingSliceConformanceSummary, OperatingSliceId } from "./types";

export const operatingSliceRegistry: OperatingSliceConformanceSummary[] = [
  billingV2OperatingSlice,
  fieldIssueOperatingSlice,
  closeoutFinalBillingOperatingSlice
];

export function listOperatingSlices() {
  return operatingSliceRegistry;
}

export function getOperatingSlice(sliceId: OperatingSliceId) {
  return operatingSliceRegistry.find((slice) => slice.sliceId === sliceId);
}
