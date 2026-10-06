import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createRybexSupabaseServerClient } from "../auth/supabase-server";
import { requireRequestContext } from "../auth/request-context";
import { finalizeEvidenceUpload } from "../evidence/production-evidence-service";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
type UploadFile = { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };

/** Stage bytes and verify scan provenance; acceptance is a separate authenticated domain command. */
export async function stageOpportunityEvidence(opportunityId: string, expectedVersion: number, purpose: "decision_support" | "bid_approval", relationshipType: string, file: UploadFile) {
  await requireRequestContext("evidence.view");
  const allowed = purpose === "bid_approval" ? ["text/plain", "application/pdf"] : ["text/plain", "application/pdf", "image/png", "image/jpeg", "image/webp"];
  if (!file.name.trim() || file.size <= 0 || file.size > 1048576 || !allowed.includes(file.type)) return { success: false as const, error: "unsupported_evidence_file" };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size) return { success: false as const, error: "evidence_bytes_mismatch" };
  const client = await createRybexSupabaseServerClient();
  const rpc = client.rpc.bind(client) as unknown as Rpc;
  const intent = await rpc("create_opportunity_evidence_upload_intent_v1", {
    p_opportunity_id: opportunityId, p_purpose: purpose, p_relationship_type: relationshipType,
    p_expected_version: expectedVersion, p_original_filename: file.name, p_mime_type: file.type, p_size_bytes: bytes.length
  });
  if (intent.error || !intent.data?.success) return { success: false as const, error: String(intent.data?.error ?? "evidence_intent_failed") };
  const evidenceId = String(intent.data.evidenceId);
  const upload = await client.storage.from(String(intent.data.bucket)).upload(String(intent.data.objectPath), bytes, { contentType: file.type, upsert: false });
  if (upload.error) return { success: false as const, error: "evidence_upload_failed" };
  const finalized = await finalizeEvidenceUpload({
    evidenceId, entityId: opportunityId, entityType: "opportunity", expectedVersion: 1,
    sizeBytes: bytes.length, checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    commandId: randomUUID(), correlationId: randomUUID()
  });
  if (!finalized.success) return { success: false as const, error: String(finalized.error ?? "evidence_finalization_failed") };
  return { success: true as const, evidenceId, expectedEvidenceVersion: 2 };
}
