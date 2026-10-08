"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DiscoverDraftCollection } from "@/components/d5o/discover/DiscoverDraftCollection";
import { WorkspaceOpportunityCollection } from "@/components/d5o/discover/WorkspaceOpportunityCollection";
import { OpportunityCapture } from "@/components/d5o/discover/OpportunityCapture";
import type { OwnCaptureView } from "@/lib/d5o/discover/capture-read";
import type { OwnDiscoverSort, OwnDiscoverState } from "@/lib/d5o/discover/capture-list";
import type { TriageOwnerOptionsResult } from "@/lib/d5o/discover/triage-owners";
import { trialCaptureDraft, trialEditDraft, trialFindCandidates, trialListDrafts, trialListWorkspaceOpportunities, trialLoadDraft, trialLoadIdentity, trialLinkIdentity, trialSubmitTriage, trialTriageOwners, trialTriagePreflight } from "./actions";
import styles from "./DiscoverTrialWorkspace.module.css";

export function DiscoverTrialWorkspace({ workspaceId, showG1ReviewLink }: {
  workspaceId: string; showG1ReviewLink: boolean;
}) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [listRevision, setListRevision] = useState(0);
  const [savedWorkId, setSavedWorkId] = useState<string | null>(null);
  const [editView, setEditView] = useState<OwnCaptureView | null>(null);
  const [ownerOptions, setOwnerOptions] = useState<TriageOwnerOptionsResult | null>(null);
  const [view, setView] = useState<"mine" | "workspace" | null>(null);
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("view") === "workspace" ? "workspace" : "mine";
    queueMicrotask(() => setView(next));
  }, []);
  function showView(next: "mine" | "workspace") {
    const url = new URL(window.location.href);
    if (next === "workspace") url.searchParams.set("view", "workspace");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    setView(next);
  }
  useEffect(() => {
    if (!captureOpen) return;
    let active = true;
    queueMicrotask(() => { if (active) setOwnerOptions(null); });
    void trialTriageOwners(workspaceId).then(result => { if (active) setOwnerOptions(result); })
      .catch(() => { if (active) setOwnerOptions({ status: "unavailable" }); });
    return () => { active = false; };
  }, [captureOpen, workspaceId]);
  const loadPage = useCallback((input: { query: string; state: OwnDiscoverState; sort: OwnDiscoverSort;
    cursor?: { updatedAt: string; workId: string } }) =>
    trialListDrafts(workspaceId, input.query, input.state, input.sort, input.cursor), [workspaceId]);
  const loadWorkspacePage = useCallback((input: { query: string; state: OwnDiscoverState; sort: OwnDiscoverSort;
    cursor?: { updatedAt: string; workId: string } }) =>
    trialListWorkspaceOpportunities(workspaceId, input.query, input.state, input.sort, input.cursor), [workspaceId]);
  const loadDraft = useCallback((workId: string) => trialLoadDraft(workspaceId, workId), [workspaceId]);
  const loadIdentity = useCallback((workId: string) => trialLoadIdentity(workspaceId, workId), [workspaceId]);
  const linkIdentity = useCallback((input: Parameters<typeof trialLinkIdentity>[1]) =>
    trialLinkIdentity(workspaceId, input), [workspaceId]);
  const loadPreflight = useCallback((workId: string) => trialTriagePreflight(workspaceId, workId), [workspaceId]);
  const submitTriage = useCallback((workId: string, expectedVersion: number, commandId: string) =>
    trialSubmitTriage(workspaceId, workId, expectedVersion, commandId), [workspaceId]);
  const findCandidates = useCallback((customer: string, title: string) =>
    trialFindCandidates(workspaceId, customer, title), [workspaceId]);
  const saveDraft = useCallback((input: { commandId: string; draft: Parameters<typeof trialCaptureDraft>[2] }) =>
    trialCaptureDraft(workspaceId, input.commandId, input.draft), [workspaceId]);
  const saveEdit = useCallback((input: { commandId: string; draft: Parameters<typeof trialCaptureDraft>[2] }) => {
    if (!editView) throw new Error("No selected draft");
    return trialEditDraft(workspaceId, editView.workId, editView.recordVersion, input.commandId, input.draft);
  }, [workspaceId, editView]);

  return <main className={styles.main}>
    <p className={styles.reviewLink}><Link href="/discover-trial/review">Commercial duplicate review</Link><span>Separate reviewer task · synthetic trial</span> · <Link href="/discover-trial/triage">My triage assignments</Link> {showG1ReviewLink ? <> · <Link href="/discover-trial/g1-review">G1 decision queue</Link></> : null} · <Link href="/discover-trial/resources">Resource profiles</Link> · <Link href="/discover-trial/jobs">Field job planning</Link> · <Link href="/discover-trial/dispatch">Crew planning</Link> · <Link href="/auth/sign-out">Switch trial identity</Link></p>
    <nav className={styles.viewSwitch} aria-label="Discover opportunity views">
      <button type="button" aria-current={view === "mine" ? "page" : undefined} onClick={() => showView("mine")}>My captures</button>
      <button type="button" aria-current={view === "workspace" ? "page" : undefined} onClick={() => showView("workspace")}>Workspace opportunities</button>
    </nav>
    {savedWorkId ? <div className={styles.receipt} role="status">Intake draft saved under Work {savedWorkId}. It has not been submitted for triage. If this was an edit, the independent duplicate review must cover the new Work version.</div> : null}
    {view === "workspace" ? <WorkspaceOpportunityCollection workspaceId={workspaceId} loadPage={loadWorkspacePage} /> : view === "mine" ?
    <DiscoverDraftCollection key={`${workspaceId}:${listRevision}`} workspaceId={workspaceId}
      loadPage={loadPage} loadDraft={loadDraft} loadIdentity={loadIdentity} linkIdentity={linkIdentity} loadPreflight={loadPreflight} submitTriage={submitTriage}
      onCapture={() => { setSavedWorkId(null); setEditView(null); setCaptureOpen(true); }}
      onEdit={selected => { setSavedWorkId(null); setEditView(selected); setCaptureOpen(true); }} /> : null}
    {captureOpen ? <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={editView ? "Edit opportunity" : "Capture opportunity"}>
        <OpportunityCapture key={editView?.workId ?? "new"}
          ownerOptions={ownerOptions?.status === "ok" ? ownerOptions.items : []}
          ownerOptionsStatus={ownerOptions?.status ?? "loading"} findCandidates={findCandidates}
          initialView={editView} saveDraft={editView ? saveEdit : saveDraft}
          onSaved={workId => { setSavedWorkId(workId); setCaptureOpen(false); setEditView(null); setListRevision(previous => previous + 1); }}
          onClose={() => { setCaptureOpen(false); setEditView(null); }} />
      </div>
    </div> : null}
  </main>;
}
