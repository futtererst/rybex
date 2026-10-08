"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { OwnDiscoverCard, OwnDiscoverPage, OwnDiscoverSort, OwnDiscoverState } from "@/lib/d5o/discover/capture-list";
import type { OwnCaptureResult, OwnCaptureView } from "@/lib/d5o/discover/capture-read";
import type { IdentityContextResult, IdentityLinkResult } from "@/lib/d5o/discover/identity-link";
import { DiscoverIdentityLink } from "./DiscoverIdentityLink";
import type { TriagePreflightResult } from "@/lib/d5o/discover/triage-preflight";
import type { TriageCommandResult } from "@/lib/d5o/discover/triage-transfer";
import { DiscoverTriagePreflight } from "./DiscoverTriagePreflight";
import styles from "./DiscoverDraftCollection.module.css";

type Cursor = { updatedAt: string; workId: string };
const valueLabels: Record<string, string> = {
  unknown: "Unknown", below_100k: "Below 100k", "100k_250k": "100k–250k",
  "250k_500k": "250k–500k", above_500k: "Above 500k",
};
const displayEnum = (value: string | null | undefined, fallback: string) =>
  value ? value.replaceAll("_", " ").replace(/^./, first => first.toUpperCase()) : fallback;
type Props = {
  workspaceId: string;
  loadPage: (input: { query: string; state: OwnDiscoverState; sort: OwnDiscoverSort; cursor?: Cursor }) => Promise<OwnDiscoverPage>;
  loadDraft: (workId: string) => Promise<OwnCaptureResult>;
  onCapture: () => void;
  onEdit: (view: OwnCaptureView) => void;
  loadIdentity: (workId: string) => Promise<IdentityContextResult>;
  linkIdentity: (input: { workId: string; expectedVersion: number; commandId: string; accountId: string; siteId: string }) => Promise<IdentityLinkResult>;
  loadPreflight: (workId: string) => Promise<TriagePreflightResult>;
  submitTriage: (workId: string, version: number, commandId: string) => Promise<TriageCommandResult>;
};

/** An author-owned trial collection. It makes no claim to show all tenant opportunities. */
export function DiscoverDraftCollection({ workspaceId, loadPage, loadDraft, onCapture, onEdit, loadIdentity, linkIdentity, loadPreflight, submitTriage }: Props) {
  return <DiscoverDraftCollectionInner key={workspaceId} workspaceId={workspaceId} loadPage={loadPage} loadDraft={loadDraft} onCapture={onCapture} onEdit={onEdit} loadIdentity={loadIdentity} linkIdentity={linkIdentity} loadPreflight={loadPreflight} submitTriage={submitTriage} />;
}

function DiscoverDraftCollectionInner({ workspaceId, loadPage, loadDraft, onCapture, onEdit, loadIdentity, linkIdentity, loadPreflight, submitTriage }: Props) {
  const sequence = useRef(0);
  const detailSequence = useRef(0);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<OwnDiscoverState>("all");
  const [sortOrder, setSortOrder] = useState<OwnDiscoverSort>("newest");
  const [groupByState, setGroupByState] = useState(false);
  const [items, setItems] = useState<OwnDiscoverCard[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "denied" | "unavailable" | "invalid">("loading");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<OwnCaptureResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [retainedBusy, setRetainedBusy] = useState(false);
  const [retainedFeedback, setRetainedFeedback] = useState("");
  const [busyMore, setBusyMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);

  function saveView(nextQuery: string, nextState: OwnDiscoverState, nextSort: OwnDiscoverSort,
    nextGroup: boolean, nextWorkId: string | null) {
    const url = new URL(window.location.href);
    for (const name of ["discoverWorkspace", "q", "state", "sort", "group", "work"]) url.searchParams.delete(name);
    url.searchParams.set("discoverWorkspace", workspaceId);
    if (nextQuery) url.searchParams.set("q", nextQuery);
    if (nextState !== "all") url.searchParams.set("state", nextState);
    if (nextSort !== "newest") url.searchParams.set("sort", nextSort);
    if (nextGroup) url.searchParams.set("group", "state");
    if (nextWorkId) url.searchParams.set("work", nextWorkId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  async function fetchPage(nextQuery: string, nextState: OwnDiscoverState,
    nextSort: OwnDiscoverSort, nextCursor?: Cursor) {
    const request = ++sequence.current;
    setMoreFailed(false);
    if (nextCursor) setBusyMore(true);
    else { setStatus("loading"); setItems([]); setCursor(null); }
    try {
      const result = await loadPage({ query: nextQuery, state: nextState, sort: nextSort, cursor: nextCursor });
      if (request !== sequence.current) return;
      if (result.status !== "ok") {
        if (nextCursor && result.status === "unavailable") { setMoreFailed(true); return; }
        setStatus(result.status);
        setItems([]);
        setCursor(null);
        setSelected(null);
        setDetail(null);
        return;
      }
      setItems(previous => nextCursor
        ? [...previous, ...result.items.filter(item => !previous.some(existing => existing.workId === item.workId))]
        : result.items);
      setCursor(result.nextCursor);
      setStatus("ok");
    } catch {
      if (request === sequence.current) {
        if (nextCursor) setMoreFailed(true);
        else { setStatus("unavailable"); setItems([]); setCursor(null); setSelected(null); setDetail(null); }
      }
    } finally {
      if (request === sequence.current) setBusyMore(false);
    }
  }

  useEffect(() => {
    // The keyed parent remounts this collection on a workspace change, so no
    // previous workspace detail is rendered while the new request begins.
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const params = new URLSearchParams(window.location.search);
      const sameWorkspace = params.get("discoverWorkspace") === workspaceId;
      const savedQuery = sameWorkspace ? (params.get("q") ?? "").slice(0, 120) : "";
      const savedState = sameWorkspace && ["intake_draft", "pending_owner_acceptance", "triage_assigned", "duplicate_closed"]
        .includes(params.get("state") ?? "") ? params.get("state") as OwnDiscoverState : "all";
      const savedSort: OwnDiscoverSort = sameWorkspace && params.get("sort") === "oldest" ? "oldest" : "newest";
      const savedGroup = sameWorkspace && params.get("group") === "state";
      const savedWork = sameWorkspace && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(params.get("work") ?? "") ? params.get("work") : null;
      setInput(savedQuery); setQuery(savedQuery); setStateFilter(savedState);
      setSortOrder(savedSort); setGroupByState(savedGroup);
      saveView(savedQuery, savedState, savedSort, savedGroup, savedWork);
      void fetchPage(savedQuery, savedState, savedSort);
      if (savedWork) void open(savedWork, true);
    });
    return () => { active = false; sequence.current += 1; detailSequence.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = input.trim().slice(0, 120);
    setQuery(next);
    setSelected(null); setDetail(null); detailSequence.current += 1;
    saveView(next, stateFilter, sortOrder, groupByState, null);
    void fetchPage(next, stateFilter, sortOrder);
  }

  function changeView(nextState: OwnDiscoverState, nextSort: OwnDiscoverSort) {
    setStateFilter(nextState); setSortOrder(nextSort);
    setSelected(null); setDetail(null); detailSequence.current += 1;
    saveView(query, nextState, nextSort, groupByState, null);
    void fetchPage(query, nextState, nextSort);
  }

  async function open(workId: string, preserveView = false) {
    const request = ++detailSequence.current;
    if (!preserveView) saveView(query, stateFilter, sortOrder, groupByState, workId);
    setRetainedFeedback("");
    setSelected(workId); setDetail(null); setDetailLoading(true);
    try {
      const result = await loadDraft(workId);
      if (request === detailSequence.current) {
        if (result.status === "denied") {
          // A revoked read cannot leave cached business names visible.
          sequence.current += 1;
          setItems([]); setCursor(null); setStatus("denied"); setSelected(null); setDetail(null);
        } else setDetail(result);
      }
    } catch {
      if (request === detailSequence.current) setDetail({ status: "unavailable" });
    } finally {
      if (request === detailSequence.current) setDetailLoading(false);
    }
  }

  async function openRetained(workId: string) {
    const request = ++detailSequence.current;
    setRetainedFeedback(""); setRetainedBusy(true);
    try {
      const result = await loadDraft(workId);
      if (request !== detailSequence.current) return;
      if (result.status !== "ok") {
        setRetainedFeedback(result.status === "denied"
          ? "This retained Work is not in your captures. Ask its responsible author to continue it."
          : "The retained Work could not be loaded. Try again from your captures.");
        return;
      }
      setInput(""); setQuery(""); setSelected(workId); setDetail(result);
      setStateFilter("all");
      saveView("", "all", sortOrder, groupByState, workId);
      void fetchPage("", "all", sortOrder);
    } catch {
      if (request === detailSequence.current) setRetainedFeedback("The retained Work could not be loaded. Try again from your captures.");
    } finally {
      setRetainedBusy(false);
    }
  }

  const empty = status === "ok" && items.length === 0;
  const stateLabels: Record<Exclude<OwnDiscoverState, "all">, string> = {
    intake_draft: "Intake drafts", pending_owner_acceptance: "Awaiting owner acceptance",
    triage_assigned: "Triage assigned", duplicate_closed: "Historical duplicates",
  };
  const groups = groupByState
    ? [...(Object.keys(stateLabels) as Array<Exclude<OwnDiscoverState, "all">>)
      .map(key => ({ key, label: stateLabels[key], records: items.filter(item => item.lifecycleState === key) }))
      .filter(group => group.records.length > 0),
      { key: "other", label: "Other states", records: items.filter(item => !(item.lifecycleState in stateLabels)) }]
      .filter(group => group.records.length > 0)
    : [{ key: "all", label: "", records: items }];
  return <section className={styles.shell} aria-label="My captured Discover drafts" data-d5o-discover-collection="own-drafts-v1">
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Work / Commercial / Discover</p><h1>Discover opportunities</h1>
        <p>Find opportunities you captured. Continue intake, submit a reviewed opportunity for commercial triage, or inspect its handoff.</p></div>
      <button type="button" className={styles.primary} onClick={onCapture}>Capture opportunity</button>
    </header>
    <div className={styles.scope} role="note"><strong>My captures</strong><span>Active intake, pending owner acceptance, assigned triage, and historical duplicate closures are shown. Triage does not qualify pursuit or authorize spending. Other authors’ work is not shown.</span></div>
    <form className={styles.toolbar} onSubmit={search}>
      <div className={styles.searchRow}><label htmlFor="discover-draft-search">Search my captures</label>
        <input id="discover-draft-search" value={input} onChange={event => setInput(event.target.value)} maxLength={120} placeholder="Opportunity, customer, or site" />
        <button type="submit" className={styles.secondary}>Search</button></div>
      <div className={styles.viewRow}>
        <div className={styles.viewControl}><label htmlFor="discover-draft-state">State</label>
          <select id="discover-draft-state" value={stateFilter} onChange={event => changeView(event.target.value as OwnDiscoverState, sortOrder)}>
            <option value="all">All states</option>{Object.entries(stateLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></div>
        <div className={styles.viewControl}><label htmlFor="discover-draft-sort">Sort</label>
          <select id="discover-draft-sort" value={sortOrder} onChange={event => changeView(stateFilter, event.target.value as OwnDiscoverSort)}>
            <option value="newest">Recently updated</option><option value="oldest">Oldest updated</option>
          </select></div>
        <div className={styles.viewControl}><label htmlFor="discover-draft-group">Group</label>
          <select id="discover-draft-group" value={groupByState ? "state" : "none"} onChange={event => {
            const next = event.target.value === "state"; setGroupByState(next);
            saveView(query, stateFilter, sortOrder, next, selected);
          }}><option value="none">No grouping</option><option value="state">By state</option></select></div>
        <div className={styles.viewActions}>
          {query || stateFilter !== "all" ? <button type="button" className={styles.textButton} onClick={() => {
            setInput(""); setQuery(""); setStateFilter("all");
            setSelected(null); setDetail(null); detailSequence.current += 1;
            saveView("", "all", sortOrder, groupByState, null);
            void fetchPage("", "all", sortOrder);
          }}>Clear filters</button> : null}
          <button type="button" className={styles.textButton} onClick={() => { setSelected(null); setDetail(null); detailSequence.current += 1; saveView(query, stateFilter, sortOrder, groupByState, null); void fetchPage(query, stateFilter, sortOrder); }}>Refresh</button>
        </div>
      </div>
    </form>
    <div className={styles.content}>
      <div className={styles.collection}>
        {status === "loading" ? <div className={styles.state} role="status">Loading your Discover drafts…</div> : null}
        {status === "denied" ? <div className={styles.state} role="alert"><h2>Access changed</h2><p>Your identity or workspace no longer permits this collection. No draft details are shown.</p></div> : null}
        {status === "unavailable" || status === "invalid" ? <div className={styles.state} role="alert"><h2>Drafts unavailable</h2><p>The collection could not be loaded. Nothing has been changed.</p><button type="button" className={styles.secondary} onClick={() => void fetchPage(query, stateFilter, sortOrder)}>Try again</button></div> : null}
        {empty ? <div className={styles.state}><h2>{query || stateFilter !== "all" ? "No matching opportunities" : "No captured opportunities yet"}</h2><p>{query || stateFilter !== "all" ? "Clear filters or try another search within your own captures." : "Capture an opportunity to start a private Discover draft."}</p></div> : null}
        {status === "ok" && items.length ? <><div className={styles.listHead}><strong>Opportunities</strong><span>{items.length} matching captures loaded{cursor ? " · more available" : ""}</span></div>
          <div className={styles.tableWrap}><table><thead><tr><th scope="col">Opportunity</th><th scope="col">Customer / site</th><th scope="col">Author plan · provisional</th><th scope="col">Response due</th><th scope="col">State</th></tr></thead>
            {groups.map(group => <tbody key={group.key}>{groupByState ? <tr className={styles.groupHead}><th colSpan={5} scope="rowgroup">{group.label} · {group.records.length} loaded</th></tr> : null}{group.records.map(item => <tr key={item.workId} className={selected === item.workId ? styles.selected : ""}>
              <td><button type="button" className={styles.recordButton} onClick={() => void open(item.workId)} aria-current={selected === item.workId ? "true" : undefined}>{item.title}</button><small className={styles.workId}>Work {item.workId}</small></td>
              <td>{item.customerContext || <span className={styles.missing}>Customer unverified</span>}<small>{item.siteContext || "Site unconfirmed"}</small></td>
              <td>{item.nextAction || <span className={styles.missing}>Follow-up not set</span>}</td>
              <td>{item.responseDueOn || "Not set"}</td>
              <td><span className={styles.badge}>{item.lifecycleState === "intake_draft" ? "Intake draft" : item.lifecycleState === "duplicate_closed" ? "Duplicate closed" : item.lifecycleState === "pending_owner_acceptance" ? "Awaiting owner acceptance" : item.lifecycleState === "triage_assigned" ? "Triage assigned" : item.lifecycleState}</span></td>
            </tr>)}</tbody>)}</table></div>
          {cursor ? <div className={styles.more}>{moreFailed ? <p role="alert">More drafts could not be loaded. The drafts above remain available.</p> : null}<button type="button" className={styles.secondary} disabled={busyMore} onClick={() => void fetchPage(query, stateFilter, sortOrder, cursor)}>{busyMore ? "Loading…" : moreFailed ? "Retry loading more" : "Load more"}</button></div> : null}</> : null}
      </div>
      {selected ? <aside className={styles.detail} aria-label="Selected Discover draft">
        <div className={styles.detailHead}><strong>Work record</strong><button type="button" className={styles.textButton} onClick={() => { detailSequence.current += 1; setSelected(null); setDetail(null); saveView(query, stateFilter, sortOrder, groupByState, null); }}>Close</button></div>
        {detailLoading ? <p role="status">Loading this draft…</p> : detail?.status === "denied" ? <p role="alert">Access to this draft is no longer available.</p> : detail?.status === "unavailable" ? <p role="alert">This draft could not be loaded. Return to the list and retry.</p> : detail?.status === "ok" ? <>
          <h2>{detail.view.draft.title}</h2><p className={styles.workId}>Work {detail.view.workId} · version {detail.view.recordVersion}</p>
          {detail.view.lifecycleState === "duplicate_closed" ? <div className={styles.historical} role="status"><strong>Historical capture · duplicate closed</strong><p>An independent reviewer found this to be the same opportunity.</p><p className={styles.workId}>Retained Work {detail.view.retainedWorkId || "unavailable"}</p><p>This record cannot be edited, linked, or submitted for triage.</p>
            {detail.view.retainedWorkId ? <button type="button" className={styles.secondary} disabled={retainedBusy}
              onClick={() => void openRetained(detail.view.retainedWorkId!)}>{retainedBusy ? "Opening retained Work…" : "Open retained Work"}</button> : null}
            {retainedFeedback ? <p role="alert">{retainedFeedback}</p> : null}
          </div> : null}
          {detail.view.lifecycleState === "pending_owner_acceptance" ? <div className={styles.historical} role="status"><strong>Submitted · owner response pending</strong><p>The reviewed snapshot is frozen. The proposed owner must explicitly accept or return it. This is not qualification or spending approval.</p></div> : null}
          {detail.view.lifecycleState === "triage_assigned" ? <div className={styles.historical} role="status"><strong>Commercial triage assigned</strong><p>The owner accepted responsibility for triage on this Work ID. Qualification and spending remain separate decisions.</p></div> : null}
          {detail.view.lifecycleState === "intake_draft" && detail.view.triageHistory[0]?.disposition === "returned" ? <div className={styles.historical} role="status"><strong>Returned for correction · submission {detail.view.triageHistory[0].submissionRevision}</strong>
            <p>{detail.view.triageHistory[0].reason}</p><p>Edit this Work, then obtain a new independent duplicate review before resubmitting.</p></div> : null}
          {detail.view.lifecycleState === "intake_draft" ? <button type="button" className={styles.secondary} onClick={() => onEdit(detail.view)}>Edit draft</button> : null}
          {detail.view.lifecycleState === "intake_draft" ? <DiscoverTriagePreflight workId={detail.view.workId} recordVersion={detail.view.recordVersion} load={loadPreflight} submit={submitTriage}
            onSubmitted={() => { void open(detail.view.workId); void fetchPage(query, stateFilter, sortOrder); }} /> : null}
          <dl><div><dt>Customer</dt><dd>{detail.view.draft.customerContext || "Unverified"}</dd></div><div><dt>Site</dt><dd>{detail.view.draft.siteContext || "Unconfirmed"}</dd></div><div><dt>Customer need</dt><dd>{detail.view.draft.needSummary || "Not described"}</dd></div><div><dt>Source</dt><dd>{displayEnum(detail.view.draft.source, "Not recorded")}</dd></div><div><dt>Author plan · provisional</dt><dd>{detail.view.draft.nextAction || "Not set"}</dd></div></dl>
          <dl><div><dt>Response due</dt><dd>{detail.view.draft.responseDueOn || "Not set"}</dd></div><div><dt>Potential work type</dt><dd>{displayEnum(detail.view.draft.workType, "Unknown")}</dd></div><div><dt>Indicative value · not an approved budget</dt><dd>{valueLabels[detail.view.draft.valueBand]}{detail.view.draft.valueBand !== "unknown" ? ` ${detail.view.draft.currency || ""}` : ""}</dd></div><div><dt>Procurement route</dt><dd>{displayEnum(detail.view.draft.procurement, "Unknown")}</dd></div></dl>
          {detail.view.lifecycleState === "intake_draft" ? <DiscoverIdentityLink key={detail.view.workId} workId={detail.view.workId}
            recordVersion={detail.view.recordVersion} load={loadIdentity} link={linkIdentity}
            onLinked={() => { void open(detail.view.workId); void fetchPage(query, stateFilter, sortOrder); }} /> : null}
          {detail.view.triageHistory.length ? <section className={styles.historical} aria-label="Triage submission history"><strong>Submission history</strong>
            <ol>{detail.view.triageHistory.map(entry => <li key={entry.submissionId}>
              Submission {entry.submissionRevision} · {entry.disposition === "accepted" ? "Owner accepted" : entry.disposition === "returned" ? "Returned to author" : "Awaiting owner response"}
              {entry.reason ? <p>{entry.reason}</p> : null}<small className={styles.workId}>Snapshot {entry.snapshotDigest}</small>
            </li>)}</ol></section> : null}
          <p className={styles.detailNote}>{detail.view.lifecycleState === "duplicate_closed" ? "Closed for duplicate resolution only; no commercial or lifecycle acceptance is implied." : "This is a private intake draft. Triage, qualification, spending and receiving acceptance are separate actions."}</p>
        </> : null}
      </aside> : null}
    </div>
  </section>;
}
