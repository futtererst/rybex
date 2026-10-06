import type { ProposalPackage } from "./work-types";

export type CommercialAuthorityProfile = {
  id: string;
  role: string;
  maxOfferValue: number;
  minimumMarginPercent: number;
  maximumPriceChangePercent: number;
  mayApproveScopeChanges: boolean;
  mayApproveTermsChanges: boolean;
};

// These examples make the prototype reviewable. They are intentionally not
// business policy and must never be used as evidence of delegated authority.
export const syntheticDemoCommercialProfiles: Record<"rybex" | "rotork", CommercialAuthorityProfile[]> = {
  rybex: [
    { id: "demo-rybex-delivery-commercial-lead", role: "Delivery Commercial Lead", maxOfferValue: 250_000, minimumMarginPercent: 25, maximumPriceChangePercent: 5, mayApproveScopeChanges: false, mayApproveTermsChanges: false },
    { id: "demo-rybex-commercial-director", role: "Commercial Director", maxOfferValue: 1_000_000, minimumMarginPercent: 20, maximumPriceChangePercent: 10, mayApproveScopeChanges: true, mayApproveTermsChanges: false },
    { id: "demo-rybex-executive-sponsor", role: "Executive Sponsor", maxOfferValue: 10_000_000, minimumMarginPercent: 15, maximumPriceChangePercent: 20, mayApproveScopeChanges: true, mayApproveTermsChanges: true },
  ],
  rotork: [
    { id: "demo-rotork-service-commercial-manager", role: "Service Commercial Manager", maxOfferValue: 500_000, minimumMarginPercent: 22.5, maximumPriceChangePercent: 5, mayApproveScopeChanges: false, mayApproveTermsChanges: false },
    { id: "demo-rotork-regional-service-director", role: "Regional Service Director", maxOfferValue: 2_500_000, minimumMarginPercent: 18, maximumPriceChangePercent: 10, mayApproveScopeChanges: true, mayApproveTermsChanges: true },
    { id: "demo-rotork-global-commercial-director", role: "Global Commercial Director", maxOfferValue: 20_000_000, minimumMarginPercent: 15, maximumPriceChangePercent: 20, mayApproveScopeChanges: true, mayApproveTermsChanges: true },
  ],
};

export type CommercialApprovalAssessment = {
  matchedProfile?: CommercialAuthorityProfile;
  grossMarginPercent: number | null;
  priceChangePercent: number;
  scopeChanged: boolean;
  termsChanged: boolean;
  reasons: string[];
};

export function assessCommercialAuthority(
  profiles: CommercialAuthorityProfile[],
  current: ProposalPackage | undefined,
  baseline: ProposalPackage | undefined,
  estimatedCost: number,
): CommercialApprovalAssessment {
  if (!current) return { grossMarginPercent: null, priceChangePercent: 0, scopeChanged: false, termsChanged: false, reasons: ["Save a proposal package before resolving commercial authority."] };
  const grossMarginPercent = current.sellPrice > 0 ? ((current.sellPrice - estimatedCost) / current.sellPrice) * 100 : null;
  const priceChangePercent = baseline?.sellPrice ? Math.abs((current.sellPrice - baseline.sellPrice) / baseline.sellPrice) * 100 : 0;
  const scopeChanged = Boolean(baseline && current.scope.trim() !== baseline.scope.trim());
  const termsChanged = Boolean(baseline && ["assumptions", "exclusions", "commercialTerms"].some((key) => current[key as keyof ProposalPackage] !== baseline[key as keyof ProposalPackage]));

  const ordered = profiles.slice().sort((a, b) => a.maxOfferValue - b.maxOfferValue || a.maximumPriceChangePercent - b.maximumPriceChangePercent || b.minimumMarginPercent - a.minimumMarginPercent);
  const matchedProfile = ordered.find((profile) => current.sellPrice <= profile.maxOfferValue
    && grossMarginPercent !== null && grossMarginPercent >= profile.minimumMarginPercent
    && priceChangePercent <= profile.maximumPriceChangePercent
    && (!scopeChanged || profile.mayApproveScopeChanges)
    && (!termsChanged || profile.mayApproveTermsChanges));
  const reasons: string[] = [];
  if (!profiles.length) reasons.push("No commercial authority profiles are configured.");
  if (grossMarginPercent === null) reasons.push("Offer value must be greater than zero to calculate margin.");
  if (profiles.length && !matchedProfile) {
    const unmet = new Set<string>();
    for (const profile of profiles) {
      if (current.sellPrice > profile.maxOfferValue) unmet.add(`Offer value exceeds ${profile.role}'s ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(profile.maxOfferValue)} limit.`);
      if (grossMarginPercent !== null && grossMarginPercent < profile.minimumMarginPercent) unmet.add(`Calculated margin is below ${profile.role}'s ${profile.minimumMarginPercent}% minimum.`);
      if (priceChangePercent > profile.maximumPriceChangePercent) unmet.add(`Price movement exceeds ${profile.role}'s ${profile.maximumPriceChangePercent}% limit.`);
      if (scopeChanged && !profile.mayApproveScopeChanges) unmet.add(`${profile.role} is not configured to approve changed scope.`);
      if (termsChanged && !profile.mayApproveTermsChanges) unmet.add(`${profile.role} is not configured to approve changed commercial terms.`);
    }
    reasons.push(...unmet);
    if (!unmet.size) reasons.push("No configured profile covers this offer's combined approval conditions.");
  }
  return { matchedProfile, grossMarginPercent, priceChangePercent, scopeChanged, termsChanged, reasons };
}
