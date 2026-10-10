import type { WorkRecord } from "./work-types";
import { currentAcceptedRelease, deployState } from "./deploy-model";
export type JobCost = { id: string; kind: "Committed" | "Incurred"; category: string;
  amount_minor: number; cost_date: string; package_id: string | null; source: string;
  reconciles_id: string | null };
export type JobBill = { id: string; revision: number; status: string; basis?: { currency: string; contractMinor: number; designRevision: number; deployRevision: number; lines: unknown[] } | null;
  lines: Array<{ packageId: string; description: string; amountMinor: number; quantity: string; unit: string; evidenceId: string }>;
  prepared_by: string; reviewed_by: string | null; review_reason: string | null };
export type JobBillHistory = { bill_id: string; revision: number; status: string;
  reviewed_by: string | null; review_reason: string | null; recorded_at: string };
export type JobCash = { id: string; bill_id: string; kind: "Billed" | "Paid";
  amount_minor: number; event_date: string; source: string };
export type JobFinanceRead = { revision: number; currency: string | null;
  baseline: { pricingBasis?: { priceMinor?: number; includedCostMinor?: number; currency?: string; policyId?: string; policyVersion?: number }; revision?: number; awardEventId?: string; estimateRevision?: number } | null;
  remainingForecastMinor: number | null; forecastSource: string | null; forecastAt: string | null;
  changes: Array<{ id: string; packageId: string; priceAmount: string; currency: string;
    customerAuthorization: unknown; revisedReleaseId: string }>;
  costs: JobCost[]; bills: JobBill[]; billHistory: JobBillHistory[]; cashEvents: JobCash[] };
export function dollarsToMinor(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, cents = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(cents.padEnd(2,"0"));
  return Number.isSafeInteger(result) ? result : null;
}
export function moneyMinor(value: number | null, currency = "USD") {
  return value === null || !Number.isSafeInteger(value) ? "Unknown" :
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value / 100);
}
const safeSum = (values: number[]): number | null => {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(total + value)) return null;
    total += value;
  }
  return total;
};
export function assessJobFinance(read: JobFinanceRead, work: WorkRecord) {
  const currency = read.currency ?? read.baseline?.pricingBasis?.currency ?? null;
  const original = read.baseline?.pricingBasis?.priceMinor ?? null;
  const changes = currency ? read.changes.filter((item) => item.currency === currency &&
    item.customerAuthorization && item.revisedReleaseId).map((item) => ({ ...item, amountMinor: dollarsToMinor(item.priceAmount) })) : [];
  const invalidChange = read.changes.length !== changes.length || changes.some((item) => item.amountMinor === null);
  const changeTotal = safeSum(changes.map((item) => item.amountMinor ?? NaN));
  const revised = original !== null && !invalidChange && changeTotal !== null ? safeSum([original, changeTotal]) : null;
  const incurred = safeSum(read.costs.filter((item) => item.kind === "Incurred").map((item) => item.amount_minor));
  const outstanding = safeSum(read.costs.filter((item) => item.kind === "Committed").map((item) => {
    const reconciled = safeSum(read.costs.filter((fact) => fact.reconciles_id === item.id).map((fact) => fact.amount_minor));
    return reconciled === null || reconciled > item.amount_minor ? NaN : item.amount_minor - reconciled;
  }));
  const forecastFinal = read.remainingForecastMinor === null || incurred === null || outstanding === null
    ? null : safeSum([incurred, outstanding, read.remainingForecastMinor]);
  const forecastProfit = revised === null || forecastFinal === null ? null : revised - forecastFinal;
  const forecastMargin = forecastProfit === null || revised === null || revised <= 0 ? null : forecastProfit / revised * 100;
  const billed = safeSum(read.cashEvents.filter((item) => item.kind === "Billed").map((item) => item.amount_minor));
  const paid = safeSum(read.cashEvents.filter((item) => item.kind === "Paid").map((item) => item.amount_minor));
  const state = deployState(work);
  const eligible = (work.packages ?? []).flatMap((pkg) => {
    const release = currentAcceptedRelease(work,pkg.id);
    const turnover = release && state.turnovers.find((item) => item.status === "Client accepted" && item.releaseIds.includes(release.id));
    const completion = release && state.completions?.find((item) => item.packageId === pkg.id && item.releaseId === release.id);
    const proof = (state.evidence ?? []).filter((item) => item.packageId === pkg.id && item.state === "Reviewed");
    return turnover && completion ? [{ packageId: pkg.id, packageName: pkg.name, releaseId: release!.id,
      reviewedQuantity: completion.reviewedQuantity, unit: completion.unit, evidence: proof }] : [];
  });
  return { currency, original, changes, revised, incurred, outstanding,
    remaining: read.remainingForecastMinor, forecastFinal, forecastProfit, forecastMargin,
    billed, paid, eligible, blocked: [
      ...(!read.baseline ? ["No recorded awarded fixed-price offer establishes the baseline."] : []),
      ...(invalidChange ? ["An authorized change has an unknown or different-currency price."] : []),
      ...(read.remainingForecastMinor === null ? ["Finance has not recorded a sourced remaining-cost forecast."] : []),
      ...([incurred, outstanding, billed, paid].some((amount) => amount === null) ? ["A monetary total exceeds safe precision or has inconsistent reconciliation."] : []),
      ...(!eligible.length ? ["No current package has reviewed completion, scoped acceptance and a current release."] : [])
    ] };
}
