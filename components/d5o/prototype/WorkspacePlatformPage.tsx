import { redirect } from "next/navigation";
import { D5OWorkHome, type PrototypeAction } from "@/components/d5o/prototype/D5OPrototypeHome";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { prototypeRecordForWorkspace, prototypeWorkspaceLabel } from "@/lib/d5o/prototype/catalog";
import { assertProofEnvironment, listWorkRecords, loadWorkRecord } from "@/lib/d5o/work-record/server";
import { rows, text } from "@/components/d5o/work-record/proof-presentation";

export type WorkPlatformSurface = "overview" | "my-work" | "portfolio" | "start";

/** Loads the signed-in workspace once and renders one D5O platform surface.
 * It keeps the existing server-owned workspace and Work Record boundaries intact. */
export async function WorkspacePlatformPage({
  mode,
  searchParams
}: {
  mode: WorkPlatformSurface;
  searchParams?: Promise<{ result?: string }>;
}) {
  assertProofEnvironment();
  const requested = (await searchParams) ?? {};
  const context = await getRequestContext();
  if (!context.authenticated) redirect(`/auth/sign-in?next=${encodeURIComponent(mode === "overview" ? "/work" : `/work/${mode === "my-work" ? "my-work" : mode}`)}`);
  if (context.status !== "authorized" || !context.workspace) return <D5OWorkHome workspaceName="No active workspace" mode={mode} />;

  const workspace = context.workspace;
  const workspaceName = prototypeWorkspaceLabel(workspace.id, workspace.name);
  const record = prototypeRecordForWorkspace(workspace.id);
  let queue: Awaited<ReturnType<typeof listWorkRecords>>;
  try {
    queue = await listWorkRecords(workspace.id);
  } catch {
    return <D5OWorkHome workspaceName={workspaceName} mode={mode} actorRole={context.role} />;
  }

  const settled = await Promise.allSettled(queue.records.map((item) => loadWorkRecord(workspace.id, item.id)));
  const myWork = settled.flatMap<PrototypeAction>((result): PrototypeAction[] => {
    if (result.status !== "fulfilled") return [];
    const work = result.value;
    const config = work.work.configuration_snapshot;
    const rights = rows(config.rights);
    const roles = rows(config.roles);
    const decisions = work.actions.map((action) => {
      const right = rights.find((candidate) => text(candidate.decision_right_key) === action.right);
      const role = roles.find((candidate) => text(candidate.id) === text(right?.role_definition_id));
      return { workId: work.work.id, workspaceId: work.work.workspace_id, title: work.work.title, label: action.label, owner: text(role?.label) || "Configured decision owner", blockers: action.blockers.length, destination: "action" as const };
    });
    if (decisions.length > 0) return decisions;
    if (!work.ownerCanPrepare || work.work.lifecycle_state === "accepted" || work.work.lifecycle_state === "rollout-authorized") return [];
    return [{ workId: work.work.id, workspaceId: work.work.workspace_id, title: work.work.title, label: work.proof ? "Submit proof for review" : "Start proof revision", owner: "Work owner", blockers: 0, destination: "proof" as const }];
  });
  const scenarioTitle = record?.organization === "Rotork" ? "pilot to rollout" : record?.organization === "Rybex" ? "certification and turnover" : "";
  const scenarioRecord = queue.records
    .filter((item) => item.title.toLowerCase().includes(scenarioTitle))
    .sort((left, right) => right.decision_count - left.decision_count)[0];
  const primaryWorkId = record && queue.records.some((item) => item.id === record.workId) ? record.workId : scenarioRecord?.id ?? queue.records[0]?.id;
  const primaryResult = primaryWorkId ? settled.find((result) => result.status === "fulfilled" && result.value.work.id === primaryWorkId) : undefined;
  const view = primaryResult?.status === "fulfilled" ? primaryResult.value : undefined;

  return <D5OWorkHome workspaceName={workspaceName} record={record} view={view} queue={queue.records} myWork={myWork} result={requested.result} mode={mode} actorRole={context.role} />;
}
