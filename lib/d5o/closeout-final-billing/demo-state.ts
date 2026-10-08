import type { CloseoutFinalBillingBlocker } from "./types";

export const canonicalCloseoutFinalBillingId = "closeout-final-billing-lake-001";
export const canonicalCloseoutPackageId = "cop-bluegrass-001";
export const canonicalCloseoutPayApplicationId = "pay-bluegrass-final";
export const canonicalCloseoutCommercialExposureId = "cexp-007";
export const canonicalCloseoutLienWaiverIds = ["lw-blue-001", "lw-blue-002"];
export const canonicalCloseoutRequirementIds = ["cor-blue-restoration", "cor-blue-waiver", "cor-blue-retainage"];

export function createCloseoutFinalBillingDemoState(): CloseoutFinalBillingBlocker {
  return {
    id: canonicalCloseoutFinalBillingId,
    projectId: "proj-bluegrass-broadband",
    projectName: "Regional Broadband Restoration Package",
    closeoutPackageId: canonicalCloseoutPackageId,
    closeoutPackageNumber: "D5-BLUE-001",
    linkedPayApplicationId: canonicalCloseoutPayApplicationId,
    linkedRetainageItemId: "lw-blue-002",
    linkedCommercialExposureId: canonicalCloseoutCommercialExposureId,
    requirementSummary: "Final billing and retainage release are blocked by final waiver and restoration acceptance evidence.",
    owner: "Marcus Lee",
    financeOwner: "Tessa Grant",
    dueDate: "2026-06-20",
    retainageExposureAmount: 58000,
    state: "unresolved",
    evidenceRequirements: [
      {
        id: "restoration-acceptance-photos",
        label: "Restoration acceptance photos",
        description: "Accepted restoration evidence needed to close municipal exception.",
        required: true,
        status: "missing"
      },
      {
        id: "final-unconditional-waiver",
        label: "Final unconditional waiver",
        description: "Final unconditional lien waiver required for retainage release.",
        required: true,
        status: "missing"
      },
      {
        id: "retainage-release-request",
        label: "Retainage release request",
        description: "Finance release request tied to the final pay application.",
        required: true,
        status: "missing"
      }
    ],
    evidenceReferences: [],
    billingProjection: {
      payApplicationId: canonicalCloseoutPayApplicationId,
      lienWaiverIds: canonicalCloseoutLienWaiverIds,
      commercialExposureId: canonicalCloseoutCommercialExposureId,
      retainageExposureAmount: 58000,
      status: "blocked",
      message: "Retainage release remains blocked by closeout evidence."
    },
    history: [],
    createdAt: "2026-06-10T08:00:00.000Z",
    updatedAt: "2026-06-10T08:00:00.000Z"
  };
}
