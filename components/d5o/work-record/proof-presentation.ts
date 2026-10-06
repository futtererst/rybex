import type { JsonObject } from "@/lib/d5o/work-record/types";

export const text = (value: unknown): string => typeof value === "string" || typeof value === "number" ? String(value) : "";
export const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
export const rows = (value: unknown): JsonObject[] => Array.isArray(value) ? value.map(object) : [];
export function readable(value: unknown): string {
  const label = text(value).replaceAll("_", " ").replaceAll("-", " ");
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Not specified";
}
export function outcomeLabel(config: JsonObject, key: unknown): string {
  return text(rows(config.outcomes).find(row => row.outcome_key === key)?.label) || readable(key);
}
export function blockerLabel(config: JsonObject, blocker: JsonObject): string {
  const rule = object(blocker.requirement);
  const right = rows(config.rights).find(row => row.decision_right_key === rule.right);
  const evidence = rows(config.evidenceTypes).find(row => row.evidence_type_key === rule.key);
  // Presentation of server-reported blockers only. Never evaluate or relax a rule here.
  switch (rule.op) {
    case "decision_recorded": return `${text(right?.label) || "Configured decision"}: the required decision outcome remains unmet.`;
    case "evidence_valid": return `${text(evidence?.label) || "Required evidence"}: the evidence requirement remains unmet.`;
    case "fact_equals": return `${rule.key ? readable(rule.key) : "Required condition"}: the configured condition remains unmet.`;
    case "exception_satisfies": return `${rule.key ? readable(rule.key) : "Required result"}: the required result or permitted, independently authorized exception remains unmet.`;
    default: return "A configured requirement remains unmet. Review its details before proceeding.";
  }
}
export function requiredProof(config: JsonObject): { id: string; label: string; level: string }[] {
  const gate = object(config.gate);
  return rows(config.requirements).filter(row => row.status === "active" && row.gate_id === gate.id).map((row, index) => {
    const type = rows(config.evidenceTypes).find(type => type.id === row.evidence_type_id);
    return { id: text(row.id) || `requirement-${index}`, label: text(type?.label) || "Configured evidence requirement", level: readable(row.requirement_level) };
  });
}
