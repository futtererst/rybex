import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const defaultPackPath = "config/template-packs/rybex-d5o-pipeline-qualification-v1.json";
export const defaultRuntime02PackPath = "config/template-packs/rybex-d5o-pipeline-qualification-v1.1.json";
export const defaultRuntime03PackPath = "config/template-packs/rybex-d5o-pipeline-qualification-v1.2.json";

export function assertLocalSupabaseUrl(url, label = "Supabase URL") {
  if (!url) {
    throw new Error(`${label} is required.`);
  }
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
    throw new Error(`${label} must point to localhost or 127.0.0.1, not ${parsed.hostname}.`);
  }
  if (String(url).includes("fcawktdjoxvahhgvkebx.supabase.co")) {
    throw new Error(`${label} contains the forbidden remote Supabase hostname.`);
  }
  return parsed;
}

export function createLocalServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  assertLocalSupabaseUrl(url, "NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) {
    throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for local-only CFG-RUNTIME-01 loading.");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function readJsonFile(path) {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing JSON file: ${absolutePath}`);
  }
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

export function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
}

export function validatePipelineQualificationPack(pack) {
  const errors = [];
  const requiredString = (path, value) => {
    if (typeof value !== "string" || value.trim() === "") {
      errors.push(`${path} is required`);
    }
  };
  requiredString("packKey", pack.packKey);
  requiredString("packName", pack.packName);
  requiredString("domain", pack.domain);
  requiredString("version", pack.version);
  requiredString("phase.key", pack.phase?.key);
  requiredString("gate.key", pack.gate?.key);
  requiredString("gate.label", pack.gate?.label);

  if (pack.gate?.key !== "pricing-review") {
    errors.push("pack must represent the accepted Pricing Review gate with semantic key pricing-review");
  }

  const evidenceKeys = new Set((pack.evidenceTypes ?? []).map((entry) => entry.key));
  const roleKeys = new Set((pack.roles ?? []).map((entry) => entry.key));
  const permissionKeys = new Set((pack.permissions ?? []).map((entry) => entry.key));

  if (!evidenceKeys.has("qualification_decision_support")) {
    errors.push("pack must preserve accepted P1-01A qualification_decision_support evidence");
  }

  for (const requirement of pack.gateEvidenceRequirements ?? []) {
    if (!evidenceKeys.has(requirement.evidenceTypeKey)) {
      errors.push(`gate evidence requirement references unknown evidence type: ${requirement.evidenceTypeKey}`);
    }
  }

  for (const right of pack.decisionRights ?? []) {
    if (right.gateKey !== pack.gate?.key) {
      errors.push(`decision right ${right.key} references unexpected gate ${right.gateKey}`);
    }
    if (!roleKeys.has(right.roleKey)) {
      errors.push(`decision right ${right.key} references unknown role ${right.roleKey}`);
    }
    if (!permissionKeys.has(right.permissionKey)) {
      errors.push(`decision right ${right.key} references unknown permission ${right.permissionKey}`);
    }
  }

  if ((pack.decisionRights ?? []).filter((right) => right.key === "pricing-review-decision-owner").length !== 1) {
    errors.push("pack must define exactly one pricing-review-decision-owner decision right");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid CFG-RUNTIME-01 pack:\n- ${errors.join("\n- ")}`);
  }
}

export function validatePipelineQualificationRuntime02Pack(pack) {
  validateCommonPack(pack);
  const errors = [];
  const gates = pack.gates ?? [pack.gate].filter(Boolean);
  const gateKeys = new Set(gates.map((entry) => entry.key));
  const roleKeys = new Set((pack.roles ?? []).map((entry) => entry.key));
  const permissionKeys = new Set((pack.permissions ?? []).map((entry) => entry.key));
  const evidenceKeys = new Set((pack.evidenceTypes ?? []).map((entry) => entry.key));
  const outcomeActions = new Set((pack.decisionOutcomes ?? []).map((entry) => entry.mapsToAction));

  if (!gateKeys.has("pricing-review")) errors.push("pack must preserve pricing-review gate");
  if (!gateKeys.has("pursuit-authorization")) errors.push("pack must add pursuit-authorization gate");
  if (!roleKeys.has("operations_leader")) errors.push("pack must preserve operations_leader role");
  if (!roleKeys.has("entity_contribution_owner")) errors.push("pack must define entity_contribution_owner role");
  if (!permissionKeys.has("pursuit_authorization.record")) errors.push("pack must define pursuit_authorization.record permission");
  if (!evidenceKeys.has("qualification_decision_support")) errors.push("pack must preserve qualification_decision_support evidence");
  if (!evidenceKeys.has("pursuit_authorization_basis")) errors.push("pack must define pursuit_authorization_basis evidence");
  if (!outcomeActions.has("approve_pursuit")) errors.push("pack must permit approve_pursuit");
  if (!outcomeActions.has("hold_pending_evidence")) errors.push("pack must permit hold_pending_evidence");
  if (!outcomeActions.has("decline_pursuit")) errors.push("pack must permit decline_pursuit");
  if (!(pack.kpis ?? []).some((entry) => entry.key === "expected_gross_margin_percent")) {
    errors.push("pack must define Expected Gross Margin %");
  }

  for (const requirement of pack.gateEvidenceRequirements ?? []) {
    if (!gateKeys.has(requirement.gateKey)) errors.push(`requirement references unknown gate: ${requirement.gateKey}`);
    if (!evidenceKeys.has(requirement.evidenceTypeKey)) errors.push(`requirement references unknown evidence: ${requirement.evidenceTypeKey}`);
  }

  for (const right of pack.decisionRights ?? []) {
    if (!gateKeys.has(right.gateKey)) errors.push(`decision right ${right.key} references unknown gate ${right.gateKey}`);
    if (!roleKeys.has(right.roleKey)) errors.push(`decision right ${right.key} references unknown role ${right.roleKey}`);
    if (!permissionKeys.has(right.permissionKey)) errors.push(`decision right ${right.key} references unknown permission ${right.permissionKey}`);
  }

  for (const outcome of pack.decisionOutcomes ?? []) {
    if (outcome.gateKey !== "pursuit-authorization") errors.push(`outcome ${outcome.outcomeKey} is outside pursuit-authorization`);
    if (!["approve_pursuit", "hold_pending_evidence", "decline_pursuit"].includes(outcome.mapsToAction)) {
      errors.push(`outcome ${outcome.outcomeKey} maps to unsupported action ${outcome.mapsToAction}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid CFG-RUNTIME-02 pack:\n- ${errors.join("\n- ")}`);
  }
}

export function validatePipelineQualificationRuntime03Pack(pack) {
  validateCommonPack(pack);
  const errors = [];
  const gates = pack.gates ?? [pack.gate].filter(Boolean);
  const gateKeys = new Set(gates.map((entry) => entry.key));
  const roleKeys = new Set((pack.roles ?? []).map((entry) => entry.key));
  const permissionKeys = new Set((pack.permissions ?? []).map((entry) => entry.key));
  const evidenceKeys = new Set((pack.evidenceTypes ?? []).map((entry) => entry.key));
  const outcomes = pack.decisionOutcomes ?? [];
  const bidOutcomes = outcomes.filter((entry) => entry.gateKey === "bid-submission-approval");

  if (pack.version !== "1.2.0") errors.push("pack version must be immutable 1.2.0");
  if (!gateKeys.has("pricing-review")) errors.push("pack must preserve pricing-review gate");
  if (!gateKeys.has("pursuit-authorization")) errors.push("pack must preserve pursuit-authorization gate");
  if (!gateKeys.has("bid-submission-approval")) errors.push("pack must add bid-submission-approval gate");
  if (!roleKeys.has("submission_approver")) errors.push("pack must define submission_approver role");
  if (!permissionKeys.has("bid_submission_approval.record")) errors.push("pack must define bid_submission_approval.record permission");
  for (const key of ["proposal_bid_package", "approved_estimate_version", "commercial_terms", "bid_instructions"]) {
    if (!evidenceKeys.has(key)) errors.push(`pack must define bid approval evidence ${key}`);
  }
  if (!bidOutcomes.some((entry) => entry.outcomeKey === "approve-for-submission" && entry.mapsToAction === "approve_submission" && entry.requiresJustification === false)) {
    errors.push("pack must define exact approve-for-submission outcome");
  }
  if (!bidOutcomes.some((entry) => entry.outcomeKey === "hold-submission-approval" && entry.mapsToAction === "hold_submission_approval" && entry.requiresJustification === true)) {
    errors.push("pack must define exact hold-submission-approval outcome with rationale");
  }
  for (const requirement of pack.gateEvidenceRequirements ?? []) {
    if (!gateKeys.has(requirement.gateKey)) errors.push(`requirement references unknown gate: ${requirement.gateKey}`);
    if (!evidenceKeys.has(requirement.evidenceTypeKey)) errors.push(`requirement references unknown evidence: ${requirement.evidenceTypeKey}`);
  }
  for (const right of pack.decisionRights ?? []) {
    if (!gateKeys.has(right.gateKey)) errors.push(`decision right ${right.key} references unknown gate ${right.gateKey}`);
    if (!roleKeys.has(right.roleKey)) errors.push(`decision right ${right.key} references unknown role ${right.roleKey}`);
    if (!permissionKeys.has(right.permissionKey)) errors.push(`decision right ${right.key} references unknown permission ${right.permissionKey}`);
  }
  if (!(pack.decisionRights ?? []).some((right) => right.key === "bid-submission-approval-approver" && right.roleKey === "submission_approver")) {
    errors.push("pack must define bid-submission-approval-approver decision right");
  }
  if (errors.length > 0) {
    throw new Error(`Invalid CFG-RUNTIME-03 pack:\n- ${errors.join("\n- ")}`);
  }
}

function validateCommonPack(pack) {
  const requiredString = (path, value) => {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Invalid pack: ${path} is required`);
    }
  };
  requiredString("packKey", pack.packKey);
  requiredString("packName", pack.packName);
  requiredString("domain", pack.domain);
  requiredString("version", pack.version);
}

export async function singleOrNull(query, label) {
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`${label} lookup failed: ${error.message}`);
  }
  return data ?? null;
}

export async function insertRow(client, table, values, label) {
  const { data, error } = await client.from(table).insert(values).select("*").single();
  if (error) {
    throw new Error(`${label} insert failed: ${error.message}`);
  }
  return data;
}

export async function updateRow(client, table, values, filters, label) {
  let query = client.from(table).update(values);
  for (const [column, value] of filters) {
    query = query.eq(column, value);
  }
  const { data, error } = await query.select("*").single();
  if (error) {
    throw new Error(`${label} update failed: ${error.message}`);
  }
  return data;
}
