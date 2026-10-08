import type { DiscoverAssessment, DiscoverCRM, WorkRecord } from "./work-types";

export type DiscoverPolicy = {
  version: string;
  source: "published" | "synthetic-demo";
  weights: { strategicFit: number; needCredibility: number; commercialAttractiveness: number; deliveryFeasibility: number; risk: number };
  pursueThreshold: number;
  conditionalThreshold: number;
  riskEscalationBelow: number;
  required: Array<"customer" | "site" | "need" | "owner" | "buyingProcess" | "decisionMaker" | "funding" | "awardDate">;
};

const demoPolicy: Omit<DiscoverPolicy, "version"> = {
  source: "synthetic-demo", weights: { strategicFit: 25, needCredibility: 25, commercialAttractiveness: 20, deliveryFeasibility: 20, risk: 10 },
  pursueThreshold: 75, conditionalThreshold: 55, riskEscalationBelow: 3,
  required: ["customer", "site", "need", "owner", "buyingProcess", "decisionMaker", "funding", "awardDate"],
};
const supportedFacts = ["customer", "site", "need", "owner", "buyingProcess", "decisionMaker", "funding", "awardDate"] as const;

export function defaultDiscoverPolicy(): Omit<DiscoverPolicy, "version"> { return structuredClone(demoPolicy); }

export function validateDiscoverPolicy(policy: Omit<DiscoverPolicy, "version">): string[] {
  const values = Object.values(policy.weights);
  const errors: string[] = [];
  if (values.length !== 5 || values.some((value) => !Number.isFinite(value) || value < 0 || value > 100) || values.reduce((sum, value) => sum + value, 0) !== 100) errors.push("Discover policy weights must total 100%.");
  if (!Number.isFinite(policy.conditionalThreshold) || !Number.isFinite(policy.pursueThreshold) || policy.conditionalThreshold < 0 || policy.pursueThreshold > 100 || policy.conditionalThreshold > policy.pursueThreshold) errors.push("Discover thresholds are invalid.");
  if (!Number.isInteger(policy.riskEscalationBelow) || policy.riskEscalationBelow < 0 || policy.riskEscalationBelow > 5) errors.push("Risk escalation anchor must be from 0 to 5.");
  if (!Array.isArray(policy.required) || !policy.required.includes("decisionMaker") || !policy.required.includes("funding") || policy.required.some((item) => !supportedFacts.includes(item))) errors.push("Discover mandatory facts are invalid; decision-maker and funding must remain mandatory.");
  return errors;
}

export function resolveDiscoverPolicy(manifest: Record<string, unknown> | undefined, versionId: string): DiscoverPolicy {
  const presentation = manifest?.d5oPresentation as Record<string, unknown> | undefined;
  const configured = presentation?.discoverDecisionPolicy as Partial<DiscoverPolicy> | undefined;
  const weights = configured?.weights;
  const entries = weights && Object.values(weights);
  const valid = configured && entries?.length === 5 && entries.every((value) => typeof value === "number" && value >= 0 && value <= 100)
    && entries.reduce((sum, value) => sum + value, 0) === 100
    && typeof configured.pursueThreshold === "number" && typeof configured.conditionalThreshold === "number"
    && configured.pursueThreshold >= configured.conditionalThreshold && configured.pursueThreshold <= 100
    && Array.isArray(configured.required) && configured.required.includes("decisionMaker") && configured.required.includes("funding")
    && configured.required.every((item) => supportedFacts.includes(item))
    && (configured.riskEscalationBelow === undefined || typeof configured.riskEscalationBelow === "number");
  return valid ? { ...configured, riskEscalationBelow: configured.riskEscalationBelow ?? demoPolicy.riskEscalationBelow, version: versionId, source: "published" } as DiscoverPolicy : { ...demoPolicy, version: `${versionId || "unavailable"}:synthetic-demo` };
}

export function assessDiscover(work: WorkRecord, policy: DiscoverPolicy, at = new Date().toISOString()): DiscoverAssessment {
  const crm = work.discovery?.crm;
  const missing: string[] = [];
  const facts: Record<DiscoverPolicy["required"][number], boolean> = {
    customer: Boolean(work.customer && work.customer !== "To be confirmed"), site: Boolean(work.site && work.site !== "To be confirmed"),
    need: Boolean(work.discovery?.need.trim()), owner: Boolean(work.owner && work.owner !== "Unassigned"),
    buyingProcess: Boolean(crm?.buyingProcess.trim()), decisionMaker: Boolean(crm?.contacts.some((person) => person.role === "Decision-maker")),
    funding: crm?.funding === "Confirmed", awardDate: Boolean(crm?.forecast.awardDate),
  };
  for (const requirement of policy.required) if (!facts[requirement]) missing.push(requirement.replace(/([A-Z])/g, " $1").toLowerCase());
  const dimensions: Array<[keyof DiscoverPolicy["weights"], string, number | null | undefined]> = [
    ["strategicFit", "Strategic fit", crm?.strategicFit], ["needCredibility", "Need and buying credibility", crm?.needCredibility],
    ["commercialAttractiveness", "Commercial attractiveness", crm?.commercialAttractiveness], ["deliveryFeasibility", "Delivery feasibility", crm?.deliveryFeasibility],
    ["risk", "Risk and constraints", crm?.risk],
  ];
  const known = dimensions.filter(([, , value]) => value !== null && value !== undefined && Number.isFinite(value));
  const contributions = known.map(([key, label, value]) => ({ label, score: Math.max(0, Math.min(5, Number(value))), weight: policy.weights[key] }));
  const coverage = Math.round(100 * known.length / dimensions.length);
  const score = known.length === dimensions.length ? Math.round(contributions.reduce((sum, row) => sum + row.score / 5 * row.weight, 0)) : null;
  const disqualifier = crm?.disqualifier && crm.disqualifier !== "None" ? crm.disqualifier : null;
  const riskEscalation = crm?.risk !== null && crm?.risk !== undefined && crm.risk < policy.riskEscalationBelow;
  const concerns = [...(disqualifier ? [`Non-waivable restriction: ${disqualifier}`] : []), ...missing.map((item) => `Missing mandatory ${item}`), ...(coverage < 100 ? [`Assessment coverage ${coverage}% — unknown criteria cannot be scored as zero or assumed positive`] : []), ...(riskEscalation ? [`Delivery risk manageability ${crm?.risk}/5 triggers escalation below ${policy.riskEscalationBelow}/5`] : [])];
  const recommendation = disqualifier ? "Decline" : missing.length || score === null ? "Hold for information" : score >= policy.pursueThreshold && !riskEscalation ? "Pursue" : score >= policy.conditionalThreshold ? "Pursue with conditions" : "Decline";
  const weaker = contributions.filter((row) => row.score < 4).sort((a, b) => a.score - b.score || b.weight - a.weight);
  const conditions = [...missing.map((item) => `Record ${item} and reassess`),
    ...(recommendation === "Pursue with conditions" ? weaker.slice(0, 2).map((row) => `Improve ${row.label.toLowerCase()} with recorded evidence and reassess`) : []),
    ...(riskEscalation ? ["Assign risk mitigation and obtain escalation review before qualification"] : []),
    ...(crm?.funding === "Unconfirmed" ? ["Confirm customer funding"] : [])];
  return { revision: (crm?.assessmentHistory.at(-1)?.revision ?? 0) + 1, at, policyVersion: policy.version, basis: assessmentBasis(work), recommendation, score, coverage,
    evidenceConfidence: work.proof?.length ? "References recorded; verification unknown" : "No references",
    reasons: [
      ...(score === null ? [] : [`Weighted fit ${score}/100 against ${policy.pursueThreshold} pursue and ${policy.conditionalThreshold} conditional thresholds`]),
      ...(crm?.contacts.some((person) => person.role === "Decision-maker") ? ["Decision-maker identified in People & buying"] : []),
      ...(crm?.funding === "Confirmed" ? ["Funding recorded as confirmed in opportunity details"] : []),
      ...(crm?.buyingProcess ? ["Buying process recorded in opportunity details"] : []),
    ], concerns, conditions, contributions };
}

export function assessmentBasis(work: WorkRecord): string {
  const c = work.discovery?.crm;
  return JSON.stringify([work.customer, work.site, work.owner, work.discovery?.need, c?.desiredOutcome, c?.businessImpact, c?.urgency, c?.preliminaryScope, c?.buyingProcess, c?.funding, c?.commercialStatus, c?.competition, c?.access, c?.contacts.map((person) => [person.id, person.role, person.relationship]), c?.forecast.value, c?.forecast.awardDate, c?.forecast.category, c?.strategicFit, c?.needCredibility, c?.commercialAttractiveness, c?.deliveryFeasibility, c?.risk, c?.disqualifier]);
}

export function activeForecast(work: WorkRecord): boolean {
  const control = work.discovery?.pursuitControl;
  const crm = work.discovery?.crm;
  return Boolean(work.discovery && !["held", "declined"].includes(control?.status ?? "") && work.discovery.outcome !== "Won" && work.discovery.outcome !== "Lost" && work.discovery.outcome !== "No bid" && !["Awarded", "Lost"].includes(crm?.commercialStatus ?? "") && crm?.forecast.category !== "Excluded");
}

export function weightedPotential(crm: DiscoverCRM): number | null {
  const { value, probability } = crm.forecast;
  return value !== null && probability !== null && Number.isFinite(value) && Number.isFinite(probability) && probability >= 0 && probability <= 100 ? value * probability / 100 : null;
}
