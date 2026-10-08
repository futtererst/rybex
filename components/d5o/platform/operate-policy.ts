export type OperateControlPolicy = { version: 1; allowLegacyOnboarding: boolean; allowPartialHandoff: boolean; requireDocumentationReview: boolean; requireCustomerContact: boolean; requireExplicitCoverageDisposition: boolean; allowNoCoverage: boolean; defaultResponseHours: number | null; responseCalendar: "Business hours" | "Continuous"; timezone: string; holidayDates: string[]; businessStartHour?: number; businessEndHour?: number; maxMaintenanceFrequencyDays: number; slaPauseReasons?: string[] };
export const legacyOperateControlPolicy: OperateControlPolicy = { version: 1, allowLegacyOnboarding: true, allowPartialHandoff: false, requireDocumentationReview: true, requireCustomerContact: true, requireExplicitCoverageDisposition: true, allowNoCoverage: true, defaultResponseHours: null, responseCalendar: "Business hours", timezone: "America/New_York", holidayDates: [], businessStartHour: 9, businessEndHour: 17, maxMaintenanceFrequencyDays: 3650, slaPauseReasons: ["Customer access unavailable", "Awaiting customer information"] };
export const defaultOperateControlPolicy = (_workType: string): OperateControlPolicy => ({ ...legacyOperateControlPolicy });
export function validateOperateControlPolicy(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["Operate controls are missing."];
  const item = value as Partial<OperateControlPolicy>, errors: string[] = [];
  if (item.version !== 1) errors.push("Unsupported Operate controls version.");
  for (const key of ["allowLegacyOnboarding", "allowPartialHandoff", "requireDocumentationReview", "requireCustomerContact", "requireExplicitCoverageDisposition", "allowNoCoverage"] as const) if (typeof item[key] !== "boolean") errors.push(`${key} must be true or false.`);
  if (item.defaultResponseHours !== null && (typeof item.defaultResponseHours !== "number" || !Number.isInteger(item.defaultResponseHours) || item.defaultResponseHours < 1 || item.defaultResponseHours > 720)) errors.push("Default response hours must be 1–720 or blank.");
  if (!["Business hours", "Continuous"].includes(item.responseCalendar ?? "")) errors.push("Response calendar is invalid.");
  if (typeof item.timezone !== "string" || !item.timezone.trim()) errors.push("Response time zone is required.");
  else try { new Intl.DateTimeFormat("en-US", { timeZone: item.timezone }).format(); } catch { errors.push("Response time zone is invalid."); }
  if (!Array.isArray(item.holidayDates) || item.holidayDates.some((date) => typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) errors.push("Holiday dates must use YYYY-MM-DD.");
  if (item.businessStartHour !== undefined || item.businessEndHour !== undefined) {
    const start = item.businessStartHour ?? 9, end = item.businessEndHour ?? 17;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 24 || start >= end) errors.push("Business hours must have a valid start and later end (0–24).");
  }
  if (item.slaPauseReasons !== undefined && (!Array.isArray(item.slaPauseReasons) || item.slaPauseReasons.some((reason) => typeof reason !== "string" || reason.trim().length < 5 || reason.length > 120) || new Set(item.slaPauseReasons).size !== item.slaPauseReasons.length)) errors.push("SLA pause reasons must be distinct nonempty labels.");
  if (!Number.isInteger(item.maxMaintenanceFrequencyDays) || (item.maxMaintenanceFrequencyDays ?? 0) < 1 || (item.maxMaintenanceFrequencyDays ?? 0) > 3650) errors.push("Maintenance frequency limit is invalid.");
  return errors;
}
