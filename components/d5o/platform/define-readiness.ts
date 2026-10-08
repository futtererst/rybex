import type { DefinitionRecord, WorkRecord } from "./work-types";

export type DefineCheck = { key: string; label: string; met: boolean; detail: string; area: "investigation" | "scope" | "delivery" | "risks" };
export type DefineVerdict = { status: "Ready for review" | "Needs definition"; policy: string; checks: DefineCheck[]; next: DefineCheck | null };

// Advisory prototype assessment. Review decisions and Develop receipt remain separate acts.
export function assessDefine(work: WorkRecord, definition: DefinitionRecord, configurationVersion: string, configuredMissing: string[]): DefineVerdict {
  const controls = definition.scopeControl;
  const requirements = controls?.requirements ?? [];
  const interfaces = controls?.interfaces ?? [];
  const assumptions = controls?.assumptions ?? [];
  const scope = definition.registers?.scope_items ?? [];
  const acceptance = definition.registers?.acceptance_criteria ?? [];
  const findings = definition.findings ?? [];
  const openQuestions = (definition.clarifications ?? []).filter((item) => item.status === "Open");
  const check = (key: string, label: string, met: boolean, detail: string, area: DefineCheck["area"]): DefineCheck => ({ key, label, met, detail, area });
  const checks: DefineCheck[] = [
    check("source", "Eligible Discover source", work.discovery?.pursuitControl ? work.discovery.pursuitControl.handoff?.status === "accepted" : Boolean(work.discovery?.fit === "Qualified" || work.discovery?.fit === "Conditional" || work.discovery?.outcome === "Won"), work.discovery?.pursuitControl ? "The pursuit handoff must be accepted on this Work Record." : "Legacy qualified source is eligible; it is not an accepted versioned pursuit handoff.", "investigation"),
    check("context", "Customer and site investigated", Boolean(definition.project?.customerContact.trim() && definition.project.siteArea.trim() && definition.project.affectedSystems.trim() && definition.project.accessConstraints.trim()), "Name the customer contact, site area, affected systems, and access constraints.", "investigation"),
    check("findings", "Sourced facts confirmed", findings.some((item) => item.status === "Confirmed" && item.source.trim() && item.detail.trim()), "Confirm at least one finding with its source. A reference is not verified uploaded evidence.", "investigation"),
    check("questions", "Clarifications resolved", openQuestions.length === 0, `${openQuestions.length} question(s) still need sourced answers and an owner.`, "investigation"),
    check("requirements", "Requirements supported", requirements.length > 0 && requirements.every((item) => item.state === "Confirmed" && item.need.trim() && item.source.trim() && item.owner.trim()), "Record each customer requirement with an owner and source; confirm before review.", "scope"),
    check("scope", "Deliverables trace to requirements", scope.length > 0 && scope.every((row) => row.id && row.requirementId && requirements.some((item) => item.id === row.requirementId && item.state === "Confirmed") && row.deliverable?.trim() && row.boundary?.trim() && row.owner?.trim()), "Link every included deliverable to a confirmed requirement, boundary, and owner.", "scope"),
    check("acceptance", "Every deliverable is measurable", scope.length > 0 && acceptance.every((criterion) => scope.some((row) => row.id === criterion.scopeId)) && scope.every((row) => acceptance.some((criterion) => criterion.scopeId === row.id && criterion.result?.trim() && criterion.method?.trim() && criterion.proof?.trim() && criterion.authority?.trim())), "Link an acceptance result, method, proof, and accepting authority to each deliverable; remove orphan criteria.", "scope"),
    check("boundary", "Exclusions explicit", Boolean(definition.excludedScope.trim()), "State excluded work and customer responsibilities, or record an explicit none assessment.", "scope"),
    check("interfaces", "Interfaces owned", interfaces.length > 0 && interfaces.every((item) => item.boundary.trim() && item.owner.trim() && item.counterparty.trim() && item.agreement.trim()), "Record physical, technical, organizational, or commercial interfaces with both sides and the agreement basis.", "delivery"),
    check("assumptions", "Assumptions dispositioned", assumptions.every((item) => item.state !== "Open" && item.statement.trim() && item.owner.trim() && item.source.trim()), "Open assumptions need an owner and customer or technical disposition before approval.", "delivery"),
    check("agreement", "Customer scope agreement recorded", Boolean(controls?.customerAgreement?.representative.trim() && controls.customerAgreement.agreedAt && controls.customerAgreement.basis.trim()), "Record who agreed to the scope, when, and the meeting or document reference.", "scope"),
    check("configuration", "Configured review rules met", configurationVersion !== "unavailable" && configuredMissing.length === 0, configurationVersion === "unavailable" ? "The pinned Define configuration is unavailable; review cannot proceed." : configuredMissing.length ? configuredMissing.join(" ") : "All rules in the pinned phase contract are met.", "risks"),
  ];
  return { status: checks.every((item) => item.met) ? "Ready for review" : "Needs definition", policy: `Define clarity v1 · ${configurationVersion}`, checks, next: checks.find((item) => !item.met) ?? null };
}
