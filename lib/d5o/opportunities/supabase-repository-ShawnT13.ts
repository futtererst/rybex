import { randomUUID } from "node:crypto";
import { canCreateSupabaseServerClient, createRybexSupabaseAdminClient, createRybexSupabaseServerClient } from "@/lib/d5o/auth/supabase-server";
import { getRuntimeMode } from "@/lib/d5o/security/runtime-mode";
import { mapDetail, mapOpportunity } from "./database-mapper";
import type {
  AttachBidApprovalEvidenceInput,
  AttachDecisionSupportEvidenceInput,
  BidSubmissionInput,
  CreateOpportunityInput,
  DecisionActionInput,
  DecisionAccountabilityInput,
  DecisionOwnerOption,
  OpportunityAction,
  OpportunityDetail,
  PursuitAuthorizationInput,
  BidSubmissionApprovalInput,
  QualificationInput
} from "./types";

export async function listOpportunityActions(): Promise<OpportunityAction[]> {
  if (!canUseDatabase()) return [];
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "p1_01a_list_opportunity_actions_v1");
  if (error || !data?.success) return [];
  return Array.isArray(data.items) ? data.items.map((row: Record<string, unknown>) => mapOpportunity(row)) : [];
}

export async function listDecisionOwnerOptions(): Promise<DecisionOwnerOption[]> {
  if (!canUseDatabase()) return [];
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "p1_01a_list_decision_owner_options_v1");
  if (error || !data?.success || !Array.isArray(data.items)) return [];
  return data.items.map((row: Record<string, unknown>) => ({
    userId: row.userId ? String(row.userId) : undefined,
    profileId: row.profileId ? String(row.profileId) : undefined,
    membershipId: row.membershipId ? String(row.membershipId) : undefined,
    role: String(row.role ?? ""),
    name: String(row.name ?? "Decision owner"),
    email: row.email ? String(row.email) : undefined,
    initials: String(row.initials ?? "DO")
  }));
}

export async function getOpportunityById(id: string): Promise<OpportunityDetail | null> {
  const result = await getOpportunityResult(id);
  return result.success ? result.detail : null;
}

export async function getOpportunityResult(id: string): Promise<
  | { success: true; detail: OpportunityDetail }
  | { success: false; error: string; message?: string }
> {
  if (!canUseDatabase()) return { success: false, error: "unavailable", message: "Pipeline is temporarily unavailable." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "p1_01a_get_opportunity_v1", { p_opportunity_id: id });
  if (error) return { success: false, error: "unavailable", message: error.message };
  if (!data?.success) return { success: false, error: String(data?.error ?? "unavailable"), message: data?.message ? String(data.message) : undefined };
  const readiness = await getPricingReviewReadiness(supabase, id);
  const pursuitAuthorizationReadiness = await getPursuitAuthorizationReadiness(supabase, id);
  const bidSubmissionApprovalReadiness = await getBidSubmissionApprovalReadiness(supabase, id);
  const bidSubmissionEvents = await listBidSubmissionEventsWithProvenance(supabase, id, data.bidSubmissionEvents);
  const submissionApprover = await getSubmissionApproverSummary(supabase, data.opportunity);
  return { success: true, detail: mapDetail({ ...data, bidSubmissionEvents, submissionApprover, pricingReviewReadiness: readiness, pursuitAuthorizationReadiness, bidSubmissionApprovalReadiness }) };
}

export async function createOpportunity(input: CreateOpportunityInput, commandId: string) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Opportunity database mode is not configured." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "create_opportunity_v1", {
    p_payload: input,
    p_command_id: commandId,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) {
    return {
      error: data?.error ?? "persistence_failed",
      message: data?.message,
      duplicateCount: data?.duplicateCount,
      duplicateCandidates: data?.duplicateCandidates
    };
  }
  return mapDetail(data);
}

export async function updateOpportunity(id: string, input: CreateOpportunityInput, expectedVersion: number, commandId: string) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Opportunity database mode is not configured." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "update_opportunity_v1", {
    p_opportunity_id: id,
    p_payload: input,
    p_command_id: commandId,
    p_expected_version: expectedVersion,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };
  return mapDetail(data);
}

export async function saveQualification(id: string, input: QualificationInput, expectedVersion: number, commandId: string) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Opportunity database mode is not configured." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "save_opportunity_qualification_v1", {
    p_opportunity_id: id,
    p_payload: input,
    p_command_id: commandId,
    p_expected_version: expectedVersion,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };
  return mapDetail(data);
}

export async function attachDecisionSupportEvidence(id: string, input: AttachDecisionSupportEvidenceInput, expectedVersion: number, commandId: string) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Opportunity database mode is not configured." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "attach_opportunity_decision_support_evidence_v1", {
    p_opportunity_id: id,
    p_payload: input,
    p_command_id: commandId,
    p_expected_version: expectedVersion,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };
  return mapDetail(data);
}

export async function attachBidApprovalEvidence(id: string, input: AttachBidApprovalEvidenceInput, expectedVersion: number, commandId: string) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Opportunity database mode is not configured." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "attach_opportunity_bid_approval_evidence_v1", {
    p_opportunity_id: id,
    p_relationship_type: input.relationshipType,
    p_payload: {
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256
    },
    p_command_id: commandId,
    p_expected_version: expectedVersion,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };
  return mapDetail(data);
}

export async function setDecisionAccountability(id: string, input: DecisionAccountabilityInput, expectedVersion: number, commandId: string) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Pipeline is temporarily unavailable." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "set_opportunity_decision_accountability_v1", {
    p_opportunity_id: id,
    p_decision_owner_user_id: input.decisionOwnerUserId,
    p_decision_due_at: input.decisionDueAt,
    p_command_id: commandId,
    p_expected_version: expectedVersion,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };
  return mapDetail(data);
}

export async function submitForDecision(id: string, expectedVersion: number, commandId: string) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Opportunity database mode is not configured." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "submit_opportunity_for_decision_v1", {
    p_opportunity_id: id,
    p_command_id: commandId,
    p_expected_version: expectedVersion,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };
  return mapDetail(data);
}

async function getPricingReviewReadiness(supabase: Awaited<ReturnType<typeof createRybexSupabaseServerClient>>, id: string) {
  const { data, error } = await rpc(supabase, "p1_01a_pricing_review_readiness_v1", { p_opportunity_id: id });
  if (error || !data) {
    return {
      available: false,
      ready: false,
      reason: "configuration_unavailable",
      deficiencies: ["configuration_unavailable"],
      evidenceRequirements: [],
      missingEvidence: [],
      decisionOwnerAccountability: null,
      provenanceLabel: null
    };
  }
  return data;
}

async function getPursuitAuthorizationReadiness(supabase: Awaited<ReturnType<typeof createRybexSupabaseServerClient>>, id: string) {
  const { data, error } = await rpc(supabase, "p1_01b1_pursuit_authorization_readiness_v1", { p_opportunity_id: id });
  if (error || !data) {
    return {
      available: false,
      ready: false,
      reason: "configuration_unavailable",
      deficiencies: ["configuration_unavailable"],
      entryRequirements: [],
      evidenceRequirements: [],
      missingEvidence: [],
      contributionRequirements: [],
      profitability: null,
      decisionOwnerAccountability: null,
      permittedOutcomes: [],
      recommendation: "none",
      provenanceLabel: null
    };
  }
  return data;
}

async function getBidSubmissionApprovalReadiness(supabase: Awaited<ReturnType<typeof createRybexSupabaseServerClient>>, id: string) {
  const { data, error } = await rpc(supabase, "p1_01b2_bid_submission_approval_readiness_v1", { p_opportunity_id: id });
  if (error || !data) {
    return {
      available: false,
      ready: false,
      reason: "configuration_unavailable",
      deficiencies: ["configuration_unavailable"],
      evidenceRequirements: [],
      missingEvidence: [],
      submissionApproverAccountability: null,
      permittedOutcomes: [],
      provenanceLabel: null
    };
  }
  return data;
}

async function listBidSubmissionEventsWithProvenance(
  supabase: Awaited<ReturnType<typeof createRybexSupabaseServerClient>>,
  opportunityId: string,
  fallback: unknown
) {
  const db = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          order: (column: string, options: { ascending: boolean }) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await db
    .from("opportunity_bid_submission_events")
    .select("id,event_type,bid_action,from_status,to_status,reason,actor_user_id,actor_profile_id,created_at,package_version,metadata,configuration_version_id,configuration_gate_key,configuration_outcome_key")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });
  if (error || !data) return fallback;
  return data;
}

async function getSubmissionApproverSummary(
  supabase: Awaited<ReturnType<typeof createRybexSupabaseServerClient>>,
  opportunity: unknown
) {
  const row = opportunity && typeof opportunity === "object" ? opportunity as Record<string, unknown> : {};
  const profileId = row.submission_approver_user_id ? String(row.submission_approver_user_id) : "";
  if (!profileId) return null;
  const db = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await db
    .from("user_profiles")
    .select("id,user_id,display_name,email")
    .eq("id", profileId)
    .maybeSingle();
  if (error || !data) return null;
  const name = String(data.display_name ?? data.email ?? "Submission Approver");
  return {
    profileId: String(data.id),
    userId: data.user_id ? String(data.user_id) : undefined,
    name,
    email: data.email ? String(data.email) : undefined,
    initials: initialsFor(name)
  };
}

function initialsFor(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "S"}${parts[1]?.[0] ?? "A"}`.toUpperCase();
}

export async function recordDecisionAction(id: string, input: DecisionActionInput, expectedVersion: number, commandId: string) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Pipeline is temporarily unavailable." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "record_opportunity_decision_action_v1", {
    p_opportunity_id: id,
    p_decision_action: input.action,
    p_reason: input.reason ?? "",
    p_command_id: commandId,
    p_expected_version: expectedVersion,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };
  return mapDetail(data);
}

export async function recordPursuitAuthorization(id: string, input: PursuitAuthorizationInput, expectedVersion: number, commandId: string) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Pipeline is temporarily unavailable." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "record_opportunity_pursuit_authorization_v1", {
    p_opportunity_id: id,
    p_pursuit_action: input.action,
    p_reason: input.reason ?? "",
    p_command_id: commandId,
    p_expected_version: expectedVersion,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };
  return mapDetail(data);
}

export async function completePursuitContribution(id: string, contributorUserId: string, expectedVersion: number) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Pipeline is temporarily unavailable." };
  const supabase = await createRybexSupabaseServerClient();
  const actorId = await authenticatedActorId(supabase);
  if (!actorId) return { error: "unauthenticated", message: "Sign in before recording contribution readiness." };

  const scoped = await getOpportunityResult(id);
  if (!scoped.success) return { error: scoped.error, message: scoped.message };
  const validation = await validatePursuitCorrectionRequest(supabase, scoped.detail, contributorUserId, expectedVersion, "contribution");
  if (validation) return validation;

  const alreadyActive = scoped.detail.assignments.some((assignment) =>
    assignment.userId === contributorUserId
    && assignment.assignmentType === "estimator"
    && assignment.status === "active"
  );
  if (alreadyActive) {
    return getOpportunityById(id);
  }

  const commandId = randomUUID();
  const { data, error } = await rpc(supabase, "manage_opportunity_assignment_v1", {
    p_opportunity_id: id,
    p_user_id: contributorUserId,
    p_assignment_type: "estimator",
    p_status: "active",
    p_command_id: commandId,
    p_expected_version: expectedVersion,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };

  return getOpportunityById(id);
}

export async function setPursuitAuthority(id: string, pursuitAuthorityUserId: string, expectedVersion: number) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Pipeline is temporarily unavailable." };
  const supabase = await createRybexSupabaseServerClient();
  const actorId = await authenticatedActorId(supabase);
  if (!actorId) return { error: "unauthenticated", message: "Sign in before assigning Pursuit Authorization ownership." };
  const actorProfileId = await actorProfileIdForUser(supabase, actorId);
  if ("error" in actorProfileId) return actorProfileId;

  const scoped = await getOpportunityResult(id);
  if (!scoped.success) return { error: scoped.error, message: scoped.message };
  const validation = await validatePursuitCorrectionRequest(supabase, scoped.detail, pursuitAuthorityUserId, expectedVersion, "owner");
  if (validation) return validation;

  const admin = createRybexSupabaseAdminClient() as any;
  const { data: currentAuthority, error: currentAuthorityError } = await admin
    .from("opportunities")
    .select("pursuit_authority_user_id")
    .eq("id", id)
    .single();
  if (currentAuthorityError) return { error: "persistence_failed", message: currentAuthorityError.message };

  if (currentAuthority?.pursuit_authority_user_id === pursuitAuthorityUserId) {
    if (scoped.detail.pursuitAuthorizationReadiness.deficiencies.includes("invalid_pursuit_decision_owner")) {
      return { error: "validation_failed", message: "Choose an eligible Operations Leader before assigning Pursuit Authorization ownership." };
    }
    return getOpportunityById(id);
  }

  const { data, error } = await admin
    .from("opportunities")
    .update({
      pursuit_authority_user_id: pursuitAuthorityUserId,
      pursuit_authorization_due_at: scoped.detail.opportunity.pursuitAuthorizationDueAt ?? scoped.detail.decisionDueAt,
      version: expectedVersion + 1,
      updated_at: new Date().toISOString(),
      updated_by: actorProfileId.profileId
    })
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("id")
    .maybeSingle();
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data) return { error: "concurrency_conflict", message: "Opportunity changed before Decision Owner assignment was recorded." };

  const { data: persisted, error: persistedError } = await admin
    .from("opportunities")
    .select("pursuit_authority_user_id")
    .eq("id", id)
    .single();
  if (persistedError) return { error: "persistence_failed", message: persistedError.message };
  if (persisted?.pursuit_authority_user_id !== pursuitAuthorityUserId) {
    return { error: "persistence_failed", message: "Decision Owner assignment was not persisted." };
  }

  return getOpportunityById(id);
}

export async function setSubmissionApprover(id: string, submissionApproverProfileId: string, expectedVersion: number, commandId = randomUUID()) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Pipeline is temporarily unavailable." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "assign_opportunity_submission_approver_v1", {
    p_opportunity_id: id,
    p_submission_approver_profile_id: submissionApproverProfileId,
    p_expected_version: expectedVersion,
    p_command_id: commandId,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };
  return mapDetail(data);
}

export async function recordConfiguredBidSubmissionApproval(id: string, input: BidSubmissionApprovalInput, expectedVersion: number, commandId: string) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Pipeline is temporarily unavailable." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "record_configured_bid_submission_approval_v1", {
    p_opportunity_id: id,
    p_outcome_key: input.outcomeKey,
    p_reason: input.reason ?? "",
    p_command_id: commandId,
    p_expected_version: expectedVersion,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };
  return mapDetail(data);
}

export async function recordBidSubmissionAction(id: string, input: BidSubmissionInput, expectedVersion: number, commandId: string) {
  if (!canUseDatabase()) return { error: "database_unavailable", message: "Pipeline is temporarily unavailable." };
  const supabase = await createRybexSupabaseServerClient();
  const { data, error } = await rpc(supabase, "record_opportunity_bid_submission_action_v1", {
    p_opportunity_id: id,
    p_bid_action: input.action,
    p_reason: input.reason ?? "",
    p_recipient: input.recipient ?? "",
    p_channel: input.channel ?? "",
    p_confirmation: input.confirmation ?? "",
    p_command_id: commandId,
    p_expected_version: expectedVersion,
    p_correlation_id: commandId
  });
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.success) return { error: data?.error ?? "persistence_failed", message: data?.message, currentVersion: data?.currentVersion };
  return mapDetail(data);
}

function canUseDatabase() {
  return getRuntimeMode() !== "production" && canCreateSupabaseServerClient();
}

function rpc(client: Awaited<ReturnType<typeof createRybexSupabaseServerClient>>, name: string, args?: Record<string, unknown>) {
  return (client as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> }).rpc(name, args);
}

async function authenticatedActorId(client: Awaited<ReturnType<typeof createRybexSupabaseServerClient>>) {
  const auth = client as unknown as { auth?: { getUser: () => Promise<{ data?: { user?: { id?: string } | null }; error?: unknown }> } };
  const result = await auth.auth?.getUser();
  return result?.data?.user?.id ? String(result.data.user.id) : null;
}

async function actorProfileIdForUser(client: Awaited<ReturnType<typeof createRybexSupabaseServerClient>>, actorId: string) {
  const db = client as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await db
    .from("user_profiles")
    .select("id")
    .eq("user_id", actorId)
    .maybeSingle();
  if (error) return { error: "persistence_failed", message: error.message };
  if (!data?.id) return { error: "forbidden", message: "Authenticated actor profile could not be verified." };
  return { profileId: String(data.id) };
}

async function validatePursuitCorrectionRequest(
  client: Awaited<ReturnType<typeof createRybexSupabaseServerClient>>,
  detail: OpportunityDetail,
  targetUserId: string,
  expectedVersion: number,
  mode: "contribution" | "owner"
) {
  if (!targetUserId) {
    return { error: "validation_failed", message: mode === "contribution" ? "Choose an eligible Entity Contribution Owner." : "Choose an eligible Operations Leader." };
  }
  if (detail.accessMode === "read_only") {
    return { error: "forbidden", message: mode === "contribution" ? "Read-only users cannot complete contribution requirements." : "Read-only users cannot assign pursuit authority." };
  }
  if (!["operations_leader", "admin"].includes(detail.workspaceAccessRole)) {
    return { error: "forbidden", message: "Only an authorized Operations Leader can correct the Pursuit Authorization package." };
  }
  if (detail.opportunity.version !== expectedVersion) {
    return { error: "concurrency_conflict", message: "Opportunity changed before the correction was recorded.", currentVersion: detail.opportunity.version };
  }
  if (!detail.opportunity.submittedForDecisionAt || detail.opportunity.decisionReadinessStatus !== "decision_approved") {
    return { error: "invalid_state", message: "Pricing Review must be submitted and approved before Pursuit Authorization corrections." };
  }
  if (!["not_started", "ready_for_authorization", "hold_pending_evidence"].includes(detail.opportunity.pursuitAuthorizationStatus)) {
    return { error: "invalid_state", message: "Pursuit Authorization is already in a state that cannot be corrected." };
  }
  const readiness = detail.pursuitAuthorizationReadiness;
  if (!readiness.available || !readiness.provenanceLabel) {
    return { error: "configuration_unavailable", message: "Pursuit Authorization rules are unavailable." };
  }
  if (!readiness.permittedOutcomes.some((outcome) => outcome.outcomeKey === "pursue" && outcome.mapsToAction === "approve_pursuit")) {
    return { error: "configuration_invalid", message: "Active Pursuit Authorization outcomes are incomplete." };
  }
  const targetMembership = await resolveTargetWorkspaceMembership(client, detail.opportunity.id, targetUserId);
  if ("error" in targetMembership) return targetMembership;
  if (!["operations_leader", "admin"].includes(targetMembership.role)) {
    return { error: "forbidden", message: mode === "contribution" ? "Contributor must satisfy the configured Entity Contribution Owner accountability." : "Decision Owner must satisfy the configured Operations Leader accountability." };
  }
  const eligibleOptions = await listDecisionOwnerOptions();
  const target = eligibleOptions.find((option) => option.userId === targetUserId);
  if (!target || !["operations_leader", "admin"].includes(target.role)) {
    return { error: "forbidden", message: mode === "contribution" ? "Contributor must be an active eligible member of this workspace." : "Decision Owner must be an active Operations Leader for this workspace." };
  }
  if (mode === "contribution") {
    const contributionRequirement = readiness.contributionRequirements.find((requirement) => requirement.key === "entity-contribution-owner-attestation");
    if (!contributionRequirement) {
      return { error: "configuration_invalid", message: "Configured entity contribution requirement is unavailable." };
    }
    if (contributionRequirement.satisfied) {
      return { error: "already_satisfied", message: "Entity contribution is already satisfied." };
    }
  }
  if (mode === "owner") {
    const requiredAccountability = readiness.decisionOwnerAccountability;
    if (!requiredAccountability || requiredAccountability.roleKey !== "operations_leader") {
      return { error: "configuration_invalid", message: "Configured Pursuit Authorization accountability is unavailable." };
    }
  }
  return null;
}

async function resolveTargetWorkspaceMembership(
  client: Awaited<ReturnType<typeof createRybexSupabaseServerClient>>,
  opportunityId: string,
  targetUserId: string
) {
  const db = client as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
          };
          single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data: opportunity, error: opportunityError } = await db
    .from("opportunities")
    .select("workspace_id")
    .eq("id", opportunityId)
    .single();
  if (opportunityError || !opportunity?.workspace_id) {
    return { error: "forbidden", message: "Opportunity workspace could not be verified." };
  }
  const { data: membership, error: membershipError } = await db
    .from("workspace_memberships")
    .select("role,status")
    .eq("workspace_id", String(opportunity.workspace_id))
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (membershipError) return { error: "forbidden", message: "Target workspace membership could not be verified." };
  if (!membership || membership.status !== "active") {
    return { error: "forbidden", message: "Target user must be an active member of this workspace." };
  }
  return { role: String(membership.role ?? "") };
}
