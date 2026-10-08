import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestContext } from "@/lib/d5o/auth/request-context";
import { loadWorkspaceOpportunity } from "@/lib/d5o/discover/workspace-opportunities";
import { loadG1StartContext } from "@/lib/d5o/discover/g1-start";
import { loadG1Assessment } from "@/lib/d5o/discover/g1-assessment";
import { loadG1Decision } from "@/lib/d5o/discover/g1-decision";
import { loadSpend } from "@/lib/d5o/discover/spend";
import { loadD2Handoff } from "@/lib/d5o/discover/d2-handoff";
import { listDiscoverTriageOwners } from "@/lib/d5o/discover/triage-owners";
import { G1AssessmentWorkspace } from "@/components/d5o/discover/G1AssessmentWorkspace";
import { G1DecisionWorkspace } from "@/components/d5o/discover/G1DecisionWorkspace";
import { SpendWorkspace } from "@/components/d5o/discover/SpendWorkspace";
import { D2HandoffWorkspace } from "@/components/d5o/discover/D2HandoffWorkspace";
import { assertDiscoverTrialEnvironment } from "@/lib/d5o/discover/trial-environment";
import { randomUUID } from "node:crypto";
import { startG1AssessmentAction } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover opportunity | D5O trial" };
const configurationVersions: Record<string, string> = {
  "a2000000-0000-4000-8000-000000000001": "a8000000-0000-4000-8000-000000000001",
  "a2000000-0000-4000-8000-000000000002": "a8000000-0000-4000-8000-000000000002",
};

export default async function WorkspaceOpportunityPage({ params, searchParams }: {
  params: Promise<{ workId: string }>;
  searchParams: Promise<{ g1?: string }>;
}) {
  assertDiscoverTrialEnvironment();
  const { workId } = await params;
  const context = await getRequestContext();
  if (!context.authenticated) return <main className={styles.page}><h1>Sign in required</h1>
    <Link href={`/auth/sign-in?next=${encodeURIComponent(`/discover-trial/opportunity/${workId}`)}`}>Sign in to view this opportunity</Link></main>;
  const workspaceId = context.status === "authorized" ? context.workspace?.id : undefined;
  const configurationVersionId = workspaceId ? configurationVersions[workspaceId] : undefined;
  if (!workspaceId || !configurationVersionId) return <main className={styles.page}><h1>Opportunity unavailable</h1>
    <p>This identity has no active trial workspace.</p></main>;
  const result = await loadWorkspaceOpportunity({ workspaceId, configurationVersionId, workId });
  if (result.status === "not_found" || result.status === "invalid") notFound();
  if (result.status !== "ok") return <main className={styles.page}><Link href="/discover-trial?view=workspace">← Workspace opportunities</Link>
    <h1>Opportunity unavailable</h1><p>{result.status === "denied"
      ? "This identity does not have the explicit Discover opportunity-read grant."
      : "The opportunity could not be loaded. Try again from the workspace view."}</p></main>;
  const item = result.item;
  const g1 = await loadG1StartContext(workspaceId, workId);
  const assessment = g1.status === "ok" && g1.context.g1InstanceId
    ? await loadG1Assessment(workspaceId, workId) : null;
  const decision = g1.status === "ok" && g1.context.g1InstanceId
    ? await loadG1Decision(workspaceId, workId) : null;
  const spend = await loadSpend(workspaceId, workId);
  const d2 = await loadD2Handoff(workspaceId, workId);
  const ownerOptions = assessment?.status === "ok" && assessment.context.canEdit
    ? await listDiscoverTriageOwners(workspaceId, configurationVersionId) : null;
  const feedback = (await searchParams).g1;
  return <main className={styles.page}>
    <Link href="/discover-trial?view=workspace">← Workspace opportunities</Link>
    <p className={styles.eyebrow}>Work / Commercial / Discover</p>
    <h1>{item.title}</h1>
    <p className={styles.identity}>Work {item.workId} · version {item.recordVersion}</p>
    <div className={styles.state}>{item.state.replaceAll("_", " ")}</div>
    <div className={styles.note}>This scoped opportunity summary and the actions below use separate rights. Triage, qualification and spending remain distinct.</div>
    <dl>
      <div><dt>Account</dt><dd>{item.customerName || "Provisional"}</dd></div>
      <div><dt>Site</dt><dd>{item.siteName || "Provisional"}</dd></div>
      <div><dt>Identity</dt><dd>{item.identityStatus === "registered" ? "Explicit registry link" : "Provisional text"}</dd></div>
      <div><dt>Customer need</dt><dd>{item.needSummary || "Not recorded"}</dd></div>
      <div><dt>Capture author</dt><dd>{item.authorName}</dd></div>
      <div><dt>Last draft update</dt><dd>{new Date(item.updatedAt).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })}</dd></div>
    </dl>
    <section className={styles.next} aria-label="G1 assessment">
      <p className={styles.eyebrow}>Next decision · Discover G1</p>
      <h2>Pursuit qualification</h2>
      <p>Owner triage acceptance assigns responsibility. It does not qualify pursuit or authorize spending.</p>
      {feedback === "started" ? <p className={styles.success} role="status">G1 assessment started and recorded against this Work. No qualification or spending decision was made.</p> : null}
      {feedback && feedback !== "started" ? <p className={styles.error} role="alert">G1 assessment could not be started ({feedback}). Refresh this Work and check its current authority and state.</p> : null}
      {g1.status !== "ok" ? <p>G1 status unavailable. Refresh this Work before taking action.</p> : <>
        <p className={styles.g1State}>G1: <strong>{decision?.status === "ok" && decision.context.status === "qualified"
          ? "trial pursuit qualified" : decision?.status === "ok" && decision.context.status === "returned"
            ? "returned for correction" : assessment?.status === "ok" && assessment.context.status === "submitted"
              ? "submitted for decision" : g1.context.g1Status.replaceAll("_", " ")}</strong> · Spending: <strong>{spend.status === "ok" && spend.context.spendingAuthorized
                ? "Synthetic bounded authority active" : "Not authorized"}</strong></p>
        {g1.context.canStart ? <form action={startG1AssessmentAction}>
          <input type="hidden" name="workId" value={item.workId} />
          <input type="hidden" name="expectedVersion" value={item.recordVersion} />
          <input type="hidden" name="commandId" value={`d5o-g1-start-${randomUUID()}`} />
          <button type="submit">Start G1 assessment</button>
        </form> : null}
        {g1.context.g1Status === "assessment_draft" && assessment?.status === "ok"
          ? <G1AssessmentWorkspace key={`${workId}:${assessment.context.assessmentRevision ?? 0}`}
            workId={workId} context={assessment.context}
            decisionStatus={decision?.status === "ok" ? decision.context.status : undefined}
            returnReason={decision?.status === "ok" && decision.context.status === "preparing"
              ? decision.context.decisionReason : null}
            ownerOptions={ownerOptions?.status === "ok" ? ownerOptions.items : []}
            ownerOptionsAvailable={ownerOptions?.status === "ok"} /> : null}
        {g1.context.g1Status === "assessment_draft" && decision?.status === "ok"
          ? <G1DecisionWorkspace key={`${workId}:${decision.context.status}:${decision.context.decisionId ?? "none"}`}
            workId={workId} context={decision.context}
            proposedCapAmount={assessment?.status === "ok" ? assessment.context.payload?.proposedCapAmount ?? null : null} /> : null}
        {g1.context.g1Status === "assessment_draft" && decision?.status !== "ok"
          ? <p>G1 decision status is unavailable. Refresh before taking action.</p> : null}
        {g1.context.g1Status === "assessment_draft" && assessment?.status !== "ok"
          ? <p>The assessment cannot be loaded. Refresh before entering evidence.</p> : null}
        {g1.context.g1Status === "gate_unconfigured" ? <p>The G1 trial gate is not configured for this Work.</p> : null}
        {spend.status === "ok" ? <SpendWorkspace workId={workId} context={spend.context} />
          : <p>Spending status is unavailable. Refresh before relying on any authority.</p>}
        {d2.status === "ok" ? <D2HandoffWorkspace key={`${workId}:${d2.context.revision ?? 0}:${d2.context.status}`}
          workId={workId} context={d2.context}
          proposedReceiverId={assessment?.status === "ok" ? assessment.context.payload?.nextOwnerProfileId ?? null : null}
          proposedReceiverName={assessment?.status === "ok" ? assessment.context.nextOwnerName ?? null : null} />
          : d2.status === "unavailable" ? <p>Define handoff status is unavailable. Refresh before taking action.</p> : null}
      </>}
    </section>
  </main>;
}
