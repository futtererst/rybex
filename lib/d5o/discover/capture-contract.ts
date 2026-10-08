/** Approved CRM capture input contract. Text is provisional context, never a scoped account/site identity. */
export type CaptureSource = "customer_request" | "referral" | "tender_invitation" | "crm_reference" | "lifecycle_lead";
export type CaptureWorkType = "project" | "service" | "assessment" | "lifecycle_follow_up";
export type CaptureValueBand = "unknown" | "below_100k" | "100k_250k" | "250k_500k" | "above_500k";
export type CaptureCurrency = "USD" | "GBP" | "EUR";
export type CaptureProcurement = "direct" | "competitive_tender" | "existing_agreement" | "paid_discovery";

export type CaptureDraft = {
  title: string;
  customerContext: string | null;
  siteContext: string | null;
  source: CaptureSource | null;
  sourceReference: string | null;
  needSummary: string | null;
  workType: CaptureWorkType | null;
  contactContext: string | null;
  valueBand: CaptureValueBand;
  currency: CaptureCurrency | null;
  responseDueOn: string | null;
  procurement: CaptureProcurement | null;
  triageOwnerProfileId: string | null;
  nextAction: string | null;
  duplicateDisposition: "unreviewed" | "distinct" | "same_work";
  duplicateReason: string | null;
};

export type CaptureIssue =
  | "title_required" | "title_too_long" | "field_too_long" | "invalid_enum" | "invalid_date"
  | "currency_required" | "duplicate_unresolved" | "duplicate_reason_required"
  | "customer_identity_required" | "site_identity_required" | "need_required"
  | "source_required" | "triage_owner_required";

const sources: readonly string[] = ["customer_request", "referral", "tender_invitation", "crm_reference", "lifecycle_lead"];
const workTypes: readonly string[] = ["project", "service", "assessment", "lifecycle_follow_up"];
const valueBands: readonly string[] = ["unknown", "below_100k", "100k_250k", "250k_500k", "above_500k"];
const currencies: readonly string[] = ["USD", "GBP", "EUR"];
const procurements: readonly string[] = ["direct", "competitive_tender", "existing_agreement", "paid_discovery"];
const dispositions: readonly string[] = ["unreviewed", "distinct", "same_work"];

function optionalText(value: unknown, limit: number, issues: CaptureIssue[]): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") { issues.push("invalid_enum"); return null; }
  const trimmed = value.trim();
  if (trimmed.length > limit) issues.push("field_too_long");
  return trimmed || null;
}

function selected<T extends string>(value: unknown, allowed: readonly string[], issues: CaptureIssue[]): T | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !allowed.includes(value)) { issues.push("invalid_enum"); return null; }
  return value as T;
}

function dateOrNull(value: unknown, issues: CaptureIssue[]): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) { issues.push("invalid_date"); return null; }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) { issues.push("invalid_date"); return null; }
  return value;
}

/** Parse a private draft. This deliberately cannot assign an account, site, owner or authority. */
export function normalizeCaptureDraft(raw: Record<string, unknown>):
  | { ok: true; draft: CaptureDraft }
  | { ok: false; issues: CaptureIssue[] } {
  const issues: CaptureIssue[] = [];
  const title = optionalText(raw.title, 240, issues) ?? "";
  if (!title) issues.push("title_required");
  if (title.length > 240) issues.push("title_too_long");
  const valueBand = selected<CaptureValueBand>(raw.valueBand ?? "unknown", valueBands, issues) ?? "unknown";
  const currency = selected<CaptureCurrency>(raw.currency, currencies, issues);
  if (valueBand !== "unknown" && !currency) issues.push("currency_required");
  const duplicateDisposition = selected<CaptureDraft["duplicateDisposition"]>(raw.duplicateDisposition ?? "unreviewed", dispositions, issues) ?? "unreviewed";
  const duplicateReason = optionalText(raw.duplicateReason, 1000, issues);
  if (duplicateDisposition === "distinct" && !duplicateReason) issues.push("duplicate_reason_required");
  const draft: CaptureDraft = {
    title,
    customerContext: optionalText(raw.customerContext, 240, issues),
    siteContext: optionalText(raw.siteContext, 240, issues),
    source: selected<CaptureSource>(raw.source, sources, issues),
    sourceReference: optionalText(raw.sourceReference, 500, issues),
    needSummary: optionalText(raw.needSummary, 4000, issues),
    workType: selected<CaptureWorkType>(raw.workType, workTypes, issues),
    contactContext: optionalText(raw.contactContext, 500, issues),
    valueBand,
    currency,
    responseDueOn: dateOrNull(raw.responseDueOn, issues),
    procurement: selected<CaptureProcurement>(raw.procurement, procurements, issues),
    triageOwnerProfileId: optionalText(raw.triageOwnerProfileId, 80, issues),
    nextAction: optionalText(raw.nextAction, 500, issues),
    duplicateDisposition,
    duplicateReason,
  };
  return issues.length ? { ok: false, issues: [...new Set(issues)] } : { ok: true, draft };
}

/** New-root guard. A client disposition never overrides an unresolved server match. */
export function captureCreateIssues(_draft: CaptureDraft, checked: { possibleDuplicate: boolean }): CaptureIssue[] {
  return checked.possibleDuplicate ? ["duplicate_unresolved"] : [];
}

/** Eligibility hints only. The server must resolve references, duplicates, rights and policy again. */
export function captureTriageIssues(draft: CaptureDraft, checked: {
  customerScoped: boolean; siteScoped: boolean; ownerScoped: boolean; possibleDuplicate: boolean;
}): CaptureIssue[] {
  const issues: CaptureIssue[] = [];
  if (!checked.customerScoped) issues.push("customer_identity_required");
  if (!checked.siteScoped) issues.push("site_identity_required");
  if (!draft.needSummary) issues.push("need_required");
  if (!draft.source) issues.push("source_required");
  if (!checked.ownerScoped || !draft.triageOwnerProfileId) issues.push("triage_owner_required");
  issues.push(...captureCreateIssues(draft, { possibleDuplicate: checked.possibleDuplicate }));
  return issues;
}
