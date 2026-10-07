export const designReviewDisciplines = ["Engineering", "Delivery", "Safety", "Quality", "Procurement"] as const;
export type DesignReviewDiscipline = typeof designReviewDisciplines[number];

// This is a phase-contract component, not a second configuration publication path.
// Accepted sources, engineering approval, and safety cannot be waived here.
export type DesignControlPolicy = {
  schemaVersion: 1;
  requiredReviews: DesignReviewDiscipline[];
  requireCustomerTechnicalApproval: boolean;
  requireCrewDemand: boolean;
  requireMaterialAvailability: boolean;
  requirePermit: boolean;
  requireAccess: boolean;
  requireMop: boolean;
  requireRollback: boolean;
  allowPartialRelease: boolean;
  reviewLeadDays: number;
  procurementBufferDays: number;
};

export function defaultDesignControlPolicy(workTypeKey: string): DesignControlPolicy {
  const service = workTypeKey === "lifecycle-service" || workTypeKey === "modernization-service";
  return {
    schemaVersion: 1,
    requiredReviews: service ? ["Engineering", "Delivery", "Safety", "Quality"] : [...designReviewDisciplines],
    requireCustomerTechnicalApproval: false,
    requireCrewDemand: true,
    requireMaterialAvailability: !service,
    requirePermit: !service,
    requireAccess: true,
    requireMop: true,
    requireRollback: true,
    allowPartialRelease: true,
    reviewLeadDays: 3,
    procurementBufferDays: service ? 0 : 2,
  };
}

export function validateDesignControlPolicy(policy: DesignControlPolicy): string[] {
  const errors: string[] = [];
  if (!policy || policy.schemaVersion !== 1) return ["Design policy schema is invalid."];
  if (!Array.isArray(policy.requiredReviews) || !policy.requiredReviews.includes("Engineering") || !policy.requiredReviews.includes("Safety")
    || policy.requiredReviews.some((value) => !designReviewDisciplines.includes(value))
    || new Set(policy.requiredReviews).size !== policy.requiredReviews.length) errors.push("Engineering and Safety reviews are mandatory and review roles must be distinct.");
  for (const key of ["requireCustomerTechnicalApproval", "requireCrewDemand", "requireMaterialAvailability", "requirePermit", "requireAccess", "requireMop", "requireRollback", "allowPartialRelease"] as const)
    if (typeof policy[key] !== "boolean") errors.push(`${key} must be a boolean.`);
  for (const key of ["reviewLeadDays", "procurementBufferDays"] as const)
    if (!Number.isInteger(policy[key]) || policy[key] < 0 || policy[key] > 90) errors.push(`${key} must be 0–90 calendar days.`);
  return errors;
}

export const legacyDesignControlPolicy: DesignControlPolicy = {
  ...defaultDesignControlPolicy("technical-delivery"), requiredReviews: ["Engineering", "Delivery", "Safety", "Quality"],
  requireMaterialAvailability: true, procurementBufferDays: 0,
};
