import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (key) => { if (!(key in dependencies)) throw new Error(`Unexpected dependency ${key}`); return dependencies[key]; }, structuredClone, console }, { filename: file });
  return exports;
}
const pricing = load("components/d5o/platform/develop-pricing.ts");
const errors = load("lib/d5o/prototype-work/store-error.ts");
const policyCommands = load("lib/d5o/prototype-work/pricing-policy-command.ts", { "@/components/d5o/platform/develop-pricing": pricing, "./store-error": errors });
const policy = { id: "d5o-price", version: 1, status: "published", workspace: "rybex", name: "UK service", currency: "GBP", effectiveFrom: "2026-10-01", targetMarginPercent: 25, floorMarginPercent: 15, overheadPercent: 5, contingencyPercent: 5, maxDiscountPercent: 10, method: "target-margin", solutionApproverRole: "operations_leader", pricingApproverRole: "operations_leader", proposalApproverRole: "operations_leader", rates: [
  { id: "tech", category: "labor", label: "Technical labor", unit: "hour", amount: "50.00", scope: { kind: "default", value: "" }, effectiveFrom: "2026-10-01", source: "Published labor catalog" },
  { id: "tech", category: "labor", label: "Contract labor", unit: "hour", amount: "60.00", scope: { kind: "customer", value: "Example customer" }, effectiveFrom: "2026-10-01", source: "Approved customer contract" },
] };
const input = { currency: "GBP", workType: "Technical delivery", customer: "Example customer", region: "London", pricedAt: "2026-10-07", expectedAwardDate: "2026-10-20", discountPercent: 0, riskBasis: "Site access allowance", estimateMaturity: "Budgetary", definitionRevision: 2, solutionRevision: 3, lines: [
  { id: "labor", scopeRef: "REQ-1", category: "labor", description: "Certified installer", quantity: "10", unit: "hour", rateId: "tech", source: "Published labor catalog", assumption: "10 hours from survey" },
] };
assert.equal(pricing.validatePricingPolicy(policy).length, 0);
assert.equal(pricing.parseMinor("12.34", "GBP"), 1234);
assert.equal(pricing.parseMinor("12.345", "GBP"), null);
const result = pricing.evaluatePricing(policy, input, "2026-10-07T12:00:00Z");
assert.equal(result.directCostMinor, 60000, "customer-specific rate takes precedence");
assert.equal(result.includedCostMinor, 66000);
assert.equal(result.proposedPriceMinor, 88000);
assert.equal(result.marginPercent, 25);
assert.equal(result.recommendation, "Ready for pricing review");
assert.equal(pricing.evaluatePricing(policy, { ...input, lines: [{ ...input.lines[0], rateId: "missing" }] }).issues.some((issue) => issue.code === "missing_rate"), true);
const procure = { id: "item", scopeRef: "REQ-2", category: "material", description: "Distribution unit", quantity: "1", unit: "each", manualRate: "200.00", source: "QUOTE-1", validUntil: "2026-10-15", assumption: "One unit", procurement: { leadDays: 56, calendar: "calendar", earliestOrderDate: "2026-10-20", requiredOnSite: "2026-11-30", bufferDays: 5, supplierConfirmed: true } };
const constrained = pricing.evaluatePricing(policy, { ...input, lines: [...input.lines, procure] });
assert.equal(constrained.issues.some((issue) => issue.code === "expired_quote"), true);
assert.equal(constrained.issues.some((issue) => issue.code === "late_procurement"), true);
assert.equal(constrained.lines[1].procurement.latestOrder, "2026-09-30");
const expedited = pricing.evaluatePricing(policy, { ...input, lines: [...input.lines, { ...procure, procurement: { ...procure.procurement, expediteCost: "150.00", expediteDays: 25 } }] });
assert.equal(expedited.lines[1].procurement.expedite.meetsRequiredDate, true);
assert.equal(expedited.lines[1].procurement.expedite.meetsMarginFloor, false);
assert.equal(expedited.issues.some((issue) => issue.code === "expedite_option" && issue.message.includes("£165.00")), true);
const recurring = pricing.evaluatePricing(policy, { ...input, lines: [{ ...input.lines[0], id: "service", category: "recurring", quantity: "1", unit: "month", rateId: undefined, manualRate: "100.00", recurringMonths: 24 }] });
assert.equal(recurring.annualRecurringMinor, 120000);
assert.equal(recurring.totalRecurringMinor, 240000);
assert.equal(recurring.directCostMinor, 240000, "full contracted recurring cost enters contract margin");
assert.equal(pricing.evaluatePricing(policy, { ...input, method: "fixed-price", fixedPrice: "650.00" }).issues.some((issue) => issue.code === "method"), true);
const belowFloor = pricing.evaluatePricing({ ...policy, method: "fixed-price", fixedPrice: "650.00" }, input);
assert.equal(belowFloor.recommendation, "Escalate for margin decision");
const state = { pricingPolicies: [], activePricingPolicy: null, pricingPolicyHistory: [] };
assert.throws(() => policyCommands.applyPricingPolicyCommand(state, "rybex", { id: "editor", role: "project_manager" }, { action: "save-draft", policy: { ...policy, status: "draft" } }), (error) => error.code === "pricing_config_forbidden");
const draft = policyCommands.applyPricingPolicyCommand(state, "rybex", { id: "admin", role: "admin" }, { action: "save-draft", policy: { ...policy, status: "draft" } });
assert.equal(draft.pricingPolicies.length, 1);
const published = policyCommands.applyPricingPolicyCommand(draft, "rybex", { id: "admin", role: "admin" }, { action: "publish", policyId: policy.id, policyVersion: 1 });
assert.equal(published.pricingPolicies[0].status, "published");
const active = policyCommands.applyPricingPolicyCommand(published, "rybex", { id: "admin", role: "admin" }, { action: "activate", policyId: policy.id, policyVersion: 1 });
assert.equal(active.activePricingPolicy.version, 1);
console.log("Develop pricing arithmetic, precedence, procurement, recurring value, margin, and administration: PASS");
