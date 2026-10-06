import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { requireRequestContext } from "../auth/request-context";
import { createRybexSupabaseAdminClient, createRybexSupabaseServerClient } from "../auth/supabase-server";
import { scanEvidence } from "./scanner/scanner";
import type { EvidenceFinalizeInput } from "./production-evidence-service";

type EvidenceRow = { id: string; workspace_id: string; project_id: string | null; bucket_id: string; object_path: string; original_filename: string; mime_type: string; upload_status: string; version: number };
type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
export async function prepareEvidenceScanReceipt(input: EvidenceFinalizeInput): Promise<{ success: true } | { success: false; error: string }> {
  const context = await requireRequestContext("evidence.view");
  const userClient = await createRybexSupabaseServerClient();
  const actor = await userClient.auth.getUser();
  if (actor.error || !actor.data.user || !context.workspace) return { success: false, error: "unauthenticated" };
  const found = await userClient.from("evidence_objects").select("id,workspace_id,project_id,bucket_id,object_path,original_filename,mime_type,upload_status,version").eq("id", input.evidenceId).single();
  const row = found.data as unknown as EvidenceRow | null;
  if (found.error || !row || row.workspace_id !== context.workspace.id) return { success: false, error: "not_found" };
  // Completed commands still go through authenticated RPC replay/access checks.
  if (row.upload_status === "uploaded") return { success: true };
  if (row.version !== input.expectedVersion) return { success: false, error: "concurrency_conflict" };
  if (row.upload_status !== "pending_upload") return { success: false, error: "evidence_not_pending" };
  const admin = createRybexSupabaseAdminClient();
  const bucket = admin.storage.from(row.bucket_id);
  const before = await bucket.info(row.object_path);
  if (before.error || !before.data.version) return { success: false, error: "storage_version_unavailable" };
  const download = await bucket.download(row.object_path);
  if (download.error) return { success: false, error: "missing_storage_object" };
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (checksum !== input.checksumSha256 || bytes.byteLength !== input.sizeBytes) return { success: false, error: "evidence_bytes_mismatch" };
  const after = await bucket.info(row.object_path);
  const timestamp = before.data.lastModified ?? before.data.updatedAt;
  if (after.error || after.data.id !== before.data.id || after.data.version !== before.data.version || (after.data.lastModified ?? after.data.updatedAt) !== timestamp || !timestamp) return { success: false, error: "storage_version_changed" };
  const scan = await scanEvidence({ evidenceId: row.id, filename: row.original_filename, mimeType: row.mime_type, sizeBytes: bytes.byteLength, checksumSha256: checksum, bytes, correlationId: input.correlationId });
  const rpc = admin.rpc.bind(admin) as unknown as Rpc;
  const recorded = await rpc("record_evidence_scan_receipt_v1", {
    p_evidence_id: row.id, p_workspace_id: row.workspace_id, p_project_id: row.project_id, p_requested_by: actor.data.user.id,
    p_storage_object_id: before.data.id, p_bucket_id: row.bucket_id, p_object_path: row.object_path,
    p_storage_version: before.data.version, p_storage_updated_at: timestamp, p_sha256: checksum, p_size_bytes: bytes.byteLength,
    p_scanner: scan.scanner, p_result: scan.status, p_scanned_at: scan.scannedAt, p_expected_version: row.version,
    p_correlation_id: input.correlationId ?? randomUUID(), p_receipt_key: randomUUID()
  });
  if (recorded.error) return { success: false, error: recorded.error.message };
  if (!(recorded.data as { success?: boolean } | null)?.success) return { success: false, error: "scan_receipt_rejected" };
  if (scan.status !== "clean") return { success: false, error: scan.status };
  return { success: true };
}
