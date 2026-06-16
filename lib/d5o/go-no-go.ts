import type {
  GoNoGoDimensionInput,
  GoNoGoDimensionKey,
  GoNoGoRecommendation,
  Opportunity,
  OpportunityRiskLevel
} from "./types";

export type GoNoGoDimensionScore = GoNoGoDimensionInput & {
  id: GoNoGoDimensionKey;
};

export type GoNoGoResult = {
  totalScore: number;
  recommendation: GoNoGoRecommendation;
  riskLevel: OpportunityRiskLevel;
  dimensionScores: GoNoGoDimensionScore[];
  strengths: string[];
  concerns: string[];
  requiredMitigations: string[];
  requiredApprovals: string[];
};

const dimensionWeights: Record<GoNoGoDimensionKey, number> = {
  strategic_fit: 0.25,
  execution_fit: 0.3,
  commercial_fit: 0.25,
  risk_exposure: 0.2
};

export const dimensionLabels: Record<GoNoGoDimensionKey, string> = {
  strategic_fit: "Strategic Fit",
  execution_fit: "Execution Fit",
  commercial_fit: "Commercial Fit",
  risk_exposure: "Risk Exposure"
};

export function calculateGoNoGo(opportunity: Opportunity): GoNoGoResult {
  const dimensionScores = (Object.keys(dimensionWeights) as GoNoGoDimensionKey[]).map(
    (id) => ({
      id,
      ...opportunity.scoring[id],
      score: clampScore(opportunity.scoring[id].score)
    })
  );

  const totalScore = Math.round(
    dimensionScores.reduce(
      (total, dimension) =>
        total + (dimension.score / 5) * 100 * dimensionWeights[dimension.id],
      0
    )
  );

  const severeRiskCount = opportunity.riskFactors.filter(
    (risk) => risk.severity === "severe"
  ).length;
  const highRiskCount = opportunity.riskFactors.filter((risk) => risk.severity === "high").length;
  const missingReviewCount = opportunity.requiredReviews.filter(
    (review) => review.status !== "complete"
  ).length;
  const missingCriticalDocuments = requiredDocumentGaps(opportunity);

  const riskLevel = deriveRiskLevel(totalScore, severeRiskCount, highRiskCount);
  const recommendation = deriveRecommendation(
    totalScore,
    riskLevel,
    missingReviewCount,
    missingCriticalDocuments.length,
    opportunity.status
  );

  const strengths = dimensionScores
    .filter((dimension) => dimension.score >= 4)
    .map((dimension) => `${dimensionLabels[dimension.id]}: ${dimension.rationale}`);

  const concerns = [
    ...dimensionScores
      .filter((dimension) => dimension.score <= 3)
      .map((dimension) => `${dimensionLabels[dimension.id]}: ${dimension.rationale}`),
    ...opportunity.riskFactors
      .filter((risk) => risk.severity === "high" || risk.severity === "severe")
      .map((risk) => `${risk.title}: ${risk.rationale}`),
    ...missingCriticalDocuments.map((document) => `${document} has not been received.`)
  ];

  const requiredMitigations = opportunity.riskFactors
    .filter((risk) => risk.severity !== "low")
    .map((risk) => risk.mitigation);

  const requiredApprovals = opportunity.requiredReviews
    .filter((review) => review.status !== "complete")
    .map((review) => `${review.label} - ${review.owner}`);

  return {
    totalScore,
    recommendation,
    riskLevel,
    dimensionScores,
    strengths: strengths.length > 0 ? strengths : ["No major strengths have been validated yet."],
    concerns: concerns.length > 0 ? concerns : ["No material pursuit concerns are currently flagged."],
    requiredMitigations:
      requiredMitigations.length > 0
        ? requiredMitigations
        : ["Maintain D1 gate approval record before estimating starts."],
    requiredApprovals:
      requiredApprovals.length > 0 ? requiredApprovals : ["D1 pursuit gate approval is complete."]
  };
}

function clampScore(score: number) {
  return Math.max(1, Math.min(5, score));
}

function deriveRiskLevel(
  totalScore: number,
  severeRiskCount: number,
  highRiskCount: number
): OpportunityRiskLevel {
  if (severeRiskCount > 0 || totalScore < 45) {
    return "severe";
  }

  if (highRiskCount >= 2 || totalScore < 62) {
    return "high";
  }

  if (highRiskCount === 1 || totalScore < 78) {
    return "moderate";
  }

  return "low";
}

function deriveRecommendation(
  totalScore: number,
  riskLevel: OpportunityRiskLevel,
  missingReviewCount: number,
  missingDocumentCount: number,
  status: Opportunity["status"]
): GoNoGoRecommendation {
  if (status === "declined") {
    return "decline";
  }

  if (status === "no_bid") {
    return "no_bid";
  }

  if (riskLevel === "severe" || totalScore < 45) {
    return "no_bid";
  }

  if (missingReviewCount > 1 || missingDocumentCount > 0) {
    return "hold_for_clarification";
  }

  if (riskLevel === "high" || totalScore < 78) {
    return "pursue_with_mitigations";
  }

  return "pursue";
}

function requiredDocumentGaps(opportunity: Opportunity) {
  const required = ["Drawings", "Specifications", "Bid Form"];
  return required.filter(
    (document) =>
      !opportunity.documentsReceived.some((received) =>
        received.toLowerCase().includes(document.toLowerCase())
      )
  );
}
