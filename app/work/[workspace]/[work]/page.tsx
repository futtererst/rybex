import { redirect } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { assertProofEnvironment, loadWorkExtensions, loadWorkRecord } from "@/lib/d5o/work-record/server";
import { WorkRecordWorkspace } from "@/components/d5o/work-record/WorkRecordWorkspace";
import { prototypeWorkspaceLabel } from "@/lib/d5o/prototype/catalog";

type WorkspacePageProps = { params: Promise<{ workspace: string; work: string }>; searchParams?: Promise<{ result?: string }> };

export async function generateMetadata({ params }: WorkspacePageProps) {
  assertProofEnvironment();
  const { workspace } = await params;
  const context = await getRequestContext();
  const name = context.authenticated && context.status === "authorized" && context.workspace?.id === workspace ? context.workspace.name : undefined;
  return { title: name ? `${name} work workspace | D5O` : "Work Record workspace | D5O" };
}

export default async function WorkspacePage({ params, searchParams }: WorkspacePageProps) {
  assertProofEnvironment();
  const { workspace, work } = await params;
  const context = await getRequestContext();
  const destination = `/work/${encodeURIComponent(workspace)}/${encodeURIComponent(work)}`;
  if (!context.authenticated) redirect(`/auth/sign-in?next=${encodeURIComponent(destination)}`);

  let view: Awaited<ReturnType<typeof loadWorkRecord>>;
  let extensions: Awaited<ReturnType<typeof loadWorkExtensions>>;
  try {
    [view, extensions] = await Promise.all([loadWorkRecord(workspace, work), loadWorkExtensions(workspace, work)]);
    if (context.status !== "authorized" || context.workspace?.id !== view.work.workspace_id) throw new Error("forbidden");
  } catch {
    return <section style={{ padding: 24, background: "white", border: "1px solid #dbe3eb", borderRadius: 12 }}><h1>Work unavailable</h1><p>This Work Record is unavailable in your selected workspace, or you do not have access.</p></section>;
  }
  const result = (await searchParams)?.result;
  return <WorkRecordWorkspace view={view} extensions={extensions} workspaceName={prototypeWorkspaceLabel(context.workspace.id, context.workspace.name)} result={result} />;
}
