import "server-only";
import { getRequestContext } from "../auth/request-context";
import { createRybexSupabaseServerClient } from "../auth/supabase-server";
import { assertProofEnvironment } from "../work-record/server";

export type DiscoverDraftFields = {
  customerContext: string | null;
  siteContext: string | null;
  needSummary: string | null;
  sourceDescription: string | null;
  dueOn: string | null;
  knownRisk: string | null;
};

export type DiscoverDraftView = {
  workId: string;
  recordVersion: number;
  editable: boolean;
  draft: {
    work_id: string;
    workspace_id: string;
    customer_context: string | null;
    site_context: string | null;
    need_summary: string | null;
    source_description: string | null;
    due_on: string | null;
    known_risk: string | null;
    updated_at: string;
  } | null;
};

export type SaveDiscoverDraft = {
  workspaceId: string;
  workId: string;
  expectedVersion: number;
  commandId: string;
  fields: DiscoverDraftFields;
};

type RpcResult = { data: unknown; error: { message: string } | null };
export type SaveDiscoverReceipt = {
  success: true;
  workId: string;
  recordVersion: number;
  draft: NonNullable<DiscoverDraftView["draft"]>;
  events: { audit: string; event: string };
  replayed?: boolean;
};
type DiscoverRpc = (
  name: "d5o_load_discover_draft_v1" | "d5o_save_discover_draft_v1",
  args: Record<string, unknown>,
) => Promise<RpcResult>;

async function scopedRpc(workspaceId: string): Promise<DiscoverRpc> {
  assertProofEnvironment();
  const context = await getRequestContext();
  if (!context.authenticated || context.status !== "authorized" || context.workspace?.id !== workspaceId) {
    throw new Error("forbidden");
  }
  const client = await createRybexSupabaseServerClient();
  return client.rpc.bind(client) as unknown as DiscoverRpc;
}

export async function loadDiscoverDraft(workspaceId: string, workId: string): Promise<DiscoverDraftView> {
  const rpc = await scopedRpc(workspaceId);
  const { data, error } = await rpc("d5o_load_discover_draft_v1", {
    p_workspace_id: workspaceId,
    p_work_id: workId,
  });
  if (error) throw new Error(error.message);
  const view = data as DiscoverDraftView;
  if (view?.workId !== workId || !Number.isInteger(view.recordVersion)) throw new Error("invalid_response");
  if (view.draft && (view.draft.work_id !== workId || view.draft.workspace_id !== workspaceId)) {
    throw new Error("invalid_response");
  }
  return view;
}

export async function saveDiscoverDraft(input: SaveDiscoverDraft): Promise<SaveDiscoverReceipt> {
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw new Error("invalid_command");
  if (!input.commandId || input.commandId.length < 8 || input.commandId.length > 200) throw new Error("invalid_command");
  const rpc = await scopedRpc(input.workspaceId);
  const { data, error } = await rpc("d5o_save_discover_draft_v1", {
    p_workspace_id: input.workspaceId,
    p_work_id: input.workId,
    p_expected_version: input.expectedVersion,
    p_command_id: input.commandId,
    p_payload: input.fields,
  });
  if (error) throw new Error(error.message);
  const receipt = data as SaveDiscoverReceipt;
  if (receipt?.success !== true || receipt.workId !== input.workId || !Number.isInteger(receipt.recordVersion)
    || receipt.draft?.work_id !== input.workId || receipt.draft.workspace_id !== input.workspaceId
    || !receipt.events?.audit || !receipt.events.event) {
    throw new Error("invalid_response");
  }
  return receipt;
}
