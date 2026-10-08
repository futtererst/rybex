import "server-only";

import { requireRequestContext } from "../auth/request-context";
import { createRybexSupabaseServerClient } from "../auth/supabase-server";
import { prepareEvidenceScanReceipt } from "./scan-receipt-service";
import type { RybexCommandResult } from "../commands/types";

export type EvidenceUploadIntentInput = {
  projectId?: string;
  entityId?: string;
  entityType: string;
  filename: string;
  mimeType: string;
};

export type EvidenceFinalizeInput = {
  evidenceId: string;
  commandId: string;
  entityId: string;
  entityType: string;
  sizeBytes: number;
  checksumSha256: string;
  expectedVersion: number;
  correlationId?: string;
};

export type EvidenceUploadIntent = {
  evidenceId: string;
  bucket: string;
  objectPath: string;
  uploadStatus: string;
};

type UntypedRpc = (functionName: string, args: Record<string, unknown>) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

export async function createEvidenceUploadIntent(input: EvidenceUploadIntentInput): Promise<RybexCommandResult<EvidenceUploadIntent>> {
  await requireRequestContext("evidence.view");

  const supabase = await createRybexSupabaseServerClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
  const result = await rpc("create_evidence_upload_intent_v1", {
    p_entity_id: input.entityId ?? null,
    p_project_id: input.projectId ?? null,
    p_entity_type: input.entityType,
    p_original_filename: input.filename,
    p_mime_type: input.mimeType
  });

  if (result.error) {
    return { success: false, error: result.error.message };
  }

  return result.data as RybexCommandResult<EvidenceUploadIntent>;
}

export async function finalizeEvidenceUpload(input: EvidenceFinalizeInput): Promise<RybexCommandResult> {
  await requireRequestContext("evidence.view");
  const scan = await prepareEvidenceScanReceipt(input);
  if (!scan.success) return scan;

  const supabase = await createRybexSupabaseServerClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
  const result = await rpc("finalize_evidence_upload_v1", {
    p_evidence_id: input.evidenceId,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_relationship_type: "supporting_evidence",
    p_size_bytes: input.sizeBytes,
    p_checksum_sha256: input.checksumSha256,
    p_expected_version: input.expectedVersion,
    p_command_id: input.commandId,
    p_correlation_id: input.correlationId ?? null
  });

  if (result.error) {
    return { success: false, error: result.error.message };
  }

  return result.data as RybexCommandResult;
}

export async function createEvidenceDownloadGrant(evidenceId: string): Promise<RybexCommandResult<{ bucket?: string; objectPath?: string; expiresIn?: number }>> {
  await requireRequestContext("evidence.view");

  const supabase = await createRybexSupabaseServerClient();
  const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;
  const result = await rpc("create_evidence_download_grant_v1", {
    p_evidence_id: evidenceId
  });

  if (result.error) {
    return { success: false, error: result.error.message };
  }

  return result.data as RybexCommandResult<{ bucket?: string; objectPath?: string; expiresIn?: number }>;
}
