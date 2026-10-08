import type { QualificationInput } from "./types";

export const qualificationCriteria = [
  ["strategicFit", "Strategic fit"],
  ["customerRelationship", "Customer / GC relationship"],
  ["geographyFit", "Geography"],
  ["projectTypeFit", "Project type"],
  ["scopeClarity", "Scope clarity"],
  ["designMaturity", "Design maturity"],
  ["commercialTermsRisk", "Commercial terms"],
  ["scheduleFeasibility", "Schedule feasibility"],
  ["crewCapacityFit", "Crew / capacity fit"],
  ["materialLeadTimeRisk", "Material lead-time risk"],
  ["permitsAccessRisk", "Permits / access risk"],
  ["safetyQualityComplexity", "Safety / quality complexity"],
  ["subcontractorDependency", "Subcontractor dependency"],
  ["cashFlowRisk", "Cash-flow risk"],
  ["marginConfidence", "Margin confidence"],
  ["contractualRisk", "Contractual risk"]
] as const;

export const criterionOptions = ["strong", "acceptable", "risk", "unknown"] as const;

export function qualificationFromForm(formData: FormData): QualificationInput {
  const input = Object.fromEntries(
    qualificationCriteria.map(([key]) => [key, String(formData.get(key) ?? "")])
  ) as Record<keyof Omit<QualificationInput, "riskSummary" | "assumptions" | "recommendation">, string>;

  return {
    ...input,
    riskSummary: String(formData.get("riskSummary") ?? ""),
    assumptions: String(formData.get("assumptions") ?? ""),
    recommendation: String(formData.get("recommendation") ?? "hold_for_clarification")
  };
}
