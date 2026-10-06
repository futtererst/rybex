import "server-only";
import { notFound } from "next/navigation";
import { getRequestContext } from "../auth/request-context";
import { createRybexSupabaseServerClient } from "../auth/supabase-server";
import type { CreateWorkRecord, JsonObject, WorkCommand, WorkRecordQueue, WorkRecordView } from "./types";

type WorkRpc = (name: "d5o_load_work_record_v1" | "d5o_execute_work_command_v1" | "d5o_create_work_record_v1" | "d5o_list_work_records_v1" | "d5o_load_work_extensions_v1" | "d5o_execute_work_extension_v1", args: JsonObject) => Promise<{ data: unknown; error: { message: string } | null }>;

export type WorkPackageExtension = {
  id: string; work_id: string; workspace_id: string; package_key: string; name: string;
  owner_profile_id: string; installed_percent: number; tested_percent: number; accepted_percent: number;
  status: "planned" | "in_progress" | "ready" | "accepted"; package_version: number;
};
export type LifecycleActionExtension = {
  id: string; work_id: string; workspace_id: string; action: string; owner_profile_id: string;
  due_at: string | null; status: "planned" | "active" | "complete" | "cancelled";
};
export type WorkExtensions = { recordVersion: number; packages: WorkPackageExtension[]; lifecycleActions: LifecycleActionExtension[] };
export type WorkExtensionCommand = {
  workspaceId: string; workId: string; expectedVersion: number; commandId: string;
  kind: "create_package" | "record_package_facts" | "plan_lifecycle_action";
  payload: JsonObject;
};

export function assertProofEnvironment() {
  if (process.env.M1_PROOF_ENABLED !== "1" || process.env.RYBEXOS_RUNTIME_MODE !== "test" || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:61421" || process.env.RYBEX_QUALIFICATION_PROJECT_ID !== "rybex-cfg03-q-m1-s1-recovery-20260928") notFound();
}
async function scopedClient(workspace: string) {
  assertProofEnvironment();
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized" || context.workspace?.id !== workspace) throw new Error("forbidden");
  return createRybexSupabaseServerClient();
}
export async function loadWorkRecord(workspaceId: string, workId: string): Promise<WorkRecordView> {
  const client = await scopedClient(workspaceId);
  const call = client.rpc.bind(client) as unknown as WorkRpc;
  const result = await call("d5o_load_work_record_v1", { p_workspace_id: workspaceId, p_work_id: workId });
  if (result.error) throw new Error(result.error.message);
  const value = result.data as unknown as WorkRecordView;
  if (!value?.work || value.work.id !== workId || value.work.workspace_id !== workspaceId) throw new Error("invalid_response");
  // The RPC uses a left join for proof packages. Normalize its all-null row to
  // the domain meaning: this Work Record has no proof package yet.
  const proofId = value.proof && typeof value.proof.id === "string" ? value.proof.id : "";
  return { ...value, proof: proofId ? value.proof : null };
}
export async function executeWorkCommand(command: WorkCommand) {
  const client = await scopedClient(command.workspaceId);
  if (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 1) throw new Error("invalid_command");
  const call = client.rpc.bind(client) as unknown as WorkRpc;
  const result = await call("d5o_execute_work_command_v1", {
    p_workspace_id: command.workspaceId, p_work_id: command.workId, p_expected_version: command.expectedVersion,
    p_proof_revision: command.proofRevision, p_command_id: command.commandId, p_kind: command.kind, p_payload: command.payload
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function loadWorkExtensions(workspaceId: string, workId: string): Promise<WorkExtensions> {
  const client = await scopedClient(workspaceId);
  const call = client.rpc.bind(client) as unknown as WorkRpc;
  const result = await call("d5o_load_work_extensions_v1", { p_workspace_id: workspaceId, p_work_id: workId });
  if (result.error) throw new Error(result.error.message);
  const value = result.data as WorkExtensions | null;
  if (!value || !Number.isInteger(value.recordVersion) || !Array.isArray(value.packages) || !Array.isArray(value.lifecycleActions)
      || value.packages.some((item) => item.work_id !== workId || item.workspace_id !== workspaceId)
      || value.lifecycleActions.some((item) => item.work_id !== workId || item.workspace_id !== workspaceId)) throw new Error("invalid_response");
  return value;
}

export async function executeWorkExtension(command: WorkExtensionCommand) {
  if (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 1 || !command.commandId) throw new Error("invalid_command");
  const client = await scopedClient(command.workspaceId);
  const call = client.rpc.bind(client) as unknown as WorkRpc;
  const result = await call("d5o_execute_work_extension_v1", {
    p_workspace_id: command.workspaceId, p_work_id: command.workId, p_expected_version: command.expectedVersion,
    p_command_id: command.commandId, p_kind: command.kind, p_payload: command.payload
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function listWorkRecords(workspaceId: string, limit = 50): Promise<WorkRecordQueue> {
  const client = await scopedClient(workspaceId);
  const call = client.rpc.bind(client) as unknown as WorkRpc;
  const result = await call("d5o_list_work_records_v1", { p_workspace_id: workspaceId, p_limit: limit });
  if (result.error) throw new Error(result.error.message);
  const value = result.data as WorkRecordQueue;
  if (!value || value.workspaceId !== workspaceId || !Array.isArray(value.records) || value.records.some((record) => record.workspace_id !== workspaceId)) throw new Error("invalid_response");
  return value;
}

export async function createWorkRecord(input: CreateWorkRecord): Promise<{ workId: string }> {
  const client = await scopedClient(input.workspaceId);
  const title = input.title.trim();
  if (!title || title.length > 180 || !input.commandId || !input.workTypeKey || !input.gateKey || !input.configurationVersionId) throw new Error("invalid_command");
  const call = client.rpc.bind(client) as unknown as WorkRpc;
  const result = await call("d5o_create_work_record_v1", {
    p_workspace_id: input.workspaceId,
    p_command_id: input.commandId,
    p_payload: { title, workTypeKey: input.workTypeKey, gateKey: input.gateKey, configurationVersionId: input.configurationVersionId }
  });
  if (result.error) throw new Error(result.error.message);
  const created = result.data as { workId?: string } | null;
  if (!created?.workId) throw new Error("invalid_response");
  return { workId: created.workId };
}
