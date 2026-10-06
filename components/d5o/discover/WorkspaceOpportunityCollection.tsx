"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { OwnDiscoverSort, OwnDiscoverState } from "@/lib/d5o/discover/capture-list";
import type { WorkspaceOpportunity, WorkspaceOpportunityPage } from "@/lib/d5o/discover/workspace-opportunities";
import styles from "./WorkspaceOpportunityCollection.module.css";

type Cursor = { updatedAt: string; workId: string };
type Props = { workspaceId: string; loadPage: (input: {
  query: string; state: OwnDiscoverState; sort: OwnDiscoverSort; cursor?: Cursor;
}) => Promise<WorkspaceOpportunityPage> };
const states: Record<Exclude<OwnDiscoverState, "all">, string> = {
  intake_draft: "Intake drafts", pending_owner_acceptance: "Awaiting owner",
  triage_assigned: "Triage assigned", duplicate_closed: "Historical duplicates",
};

export function WorkspaceOpportunityCollection({ workspaceId, loadPage }: Props) {
  return <WorkspaceOpportunityCollectionInner key={workspaceId} workspaceId={workspaceId} loadPage={loadPage} />;
}

function WorkspaceOpportunityCollectionInner({ workspaceId, loadPage }: Props) {
  const sequence = useRef(0);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<OwnDiscoverState>("all");
  const [sort, setSort] = useState<OwnDiscoverSort>("newest");
  const [group, setGroup] = useState(false);
  const [items, setItems] = useState<WorkspaceOpportunity[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "denied" | "unavailable" | "invalid">("loading");
  const [busyMore, setBusyMore] = useState(false);

  function saveView(nextQuery: string, nextState: OwnDiscoverState, nextSort: OwnDiscoverSort,
    nextGroup: boolean) {
    const url = new URL(window.location.href);
    for (const key of ["crmWorkspace", "crmQuery", "crmState", "crmSort", "crmGroup", "crmWork"]) url.searchParams.delete(key);
    url.searchParams.set("crmWorkspace", workspaceId);
    if (nextQuery) url.searchParams.set("crmQuery", nextQuery);
    if (nextState !== "all") url.searchParams.set("crmState", nextState);
    if (nextSort !== "newest") url.searchParams.set("crmSort", nextSort);
    if (nextGroup) url.searchParams.set("crmGroup", "state");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }
  async function fetchPage(nextQuery: string, nextState: OwnDiscoverState, nextSort: OwnDiscoverSort,
    nextCursor?: Cursor) {
    const request = ++sequence.current;
    if (nextCursor) setBusyMore(true);
    else { setStatus("loading"); setItems([]); setCursor(null); }
    try {
      const result = await loadPage({ query: nextQuery, state: nextState, sort: nextSort, cursor: nextCursor });
      if (request !== sequence.current) return;
      if (result.status !== "ok") {
        setStatus(result.status); setItems([]); setCursor(null);
        return;
      }
      setItems(previous => nextCursor
        ? [...previous, ...result.items.filter(item => !previous.some(existing => existing.workId === item.workId))]
        : result.items);
      setCursor(result.nextCursor); setStatus("ok");
    } catch {
      if (request === sequence.current) setStatus("unavailable");
    } finally {
      if (request === sequence.current) setBusyMore(false);
    }
  }
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const params = new URLSearchParams(window.location.search);
      const same = params.get("crmWorkspace") === workspaceId;
      const q = same ? (params.get("crmQuery") ?? "").slice(0, 120) : "";
      const nextState = same && Object.hasOwn(states, params.get("crmState") ?? "")
        ? params.get("crmState") as OwnDiscoverState : "all";
      const nextSort: OwnDiscoverSort = same && params.get("crmSort") === "oldest" ? "oldest" : "newest";
      const nextGroup = same && params.get("crmGroup") === "state";
      setInput(q); setQuery(q); setState(nextState); setSort(nextSort); setGroup(nextGroup);
      void fetchPage(q, nextState, nextSort);
    });
    return () => { active = false; sequence.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply(nextQuery: string, nextState: OwnDiscoverState, nextSort: OwnDiscoverSort) {
    setQuery(nextQuery); setState(nextState); setSort(nextSort); setSelectedId(null);
    saveView(nextQuery, nextState, nextSort, group);
    void fetchPage(nextQuery, nextState, nextSort);
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); apply(input.trim().slice(0, 120), state, sort);
  }
  const selected = items.find(item => item.workId === selectedId) ?? null;
  const groups = group ? [...(Object.keys(states) as Array<Exclude<OwnDiscoverState, "all">>)
    .map(key => ({ key, label: states[key], records: items.filter(item => item.state === key) })),
    { key: "other", label: "Other states", records: items.filter(item => !(item.state in states)) }]
    .filter(entry => entry.records.length) : [{ key: "all", label: "", records: items }];
  return <section className={styles.shell} aria-label="Workspace Discover opportunities">
    <header><div><p className={styles.eyebrow}>Work / Commercial / Discover</p><h1>Workspace opportunities</h1>
      <p>Identify current opportunities across authors in this workspace. This view has no capture or decision authority.</p></div></header>
    <div className={styles.scope} role="note"><strong>Scoped commercial view</strong>
      <span>Only verified members with an explicit opportunity-read grant see this projection. Provisional names are marked; no registry match is inferred from text.</span></div>
    <form className={styles.toolbar} onSubmit={search}>
      <div className={styles.search}><label htmlFor="workspace-opportunity-search">Search opportunities</label>
        <input id="workspace-opportunity-search" value={input} onChange={event => setInput(event.target.value)} maxLength={120}
          placeholder="Opportunity, account, or site" /><button type="submit">Search</button></div>
      <div className={styles.controls}><div><label htmlFor="workspace-opportunity-state">State</label>
        <select id="workspace-opportunity-state" value={state} onChange={event => apply(query, event.target.value as OwnDiscoverState, sort)}>
          <option value="all">All states</option>{Object.entries(states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></div><div><label htmlFor="workspace-opportunity-sort">Sort</label>
        <select id="workspace-opportunity-sort" value={sort} onChange={event => apply(query, state, event.target.value as OwnDiscoverSort)}>
          <option value="newest">Recently updated</option><option value="oldest">Oldest updated</option>
        </select></div><div><label htmlFor="workspace-opportunity-group">Group</label>
        <select id="workspace-opportunity-group" value={group ? "state" : "none"} onChange={event => {
          const next = event.target.value === "state"; setGroup(next); saveView(query, state, sort, next);
        }}><option value="none">No grouping</option><option value="state">By state</option></select></div>
        <button type="button" className={styles.clear} onClick={() => { setInput(""); apply("", "all", sort); }}>Clear filters</button>
      </div>
    </form>
    <div className={styles.content}><div className={styles.collection}>
      {status === "loading" ? <p className={styles.message} role="status">Loading workspace opportunities…</p> : null}
      {status === "denied" ? <p className={styles.message} role="alert">Workspace opportunity access is unavailable to this identity.</p> : null}
      {status === "unavailable" || status === "invalid" ? <div className={styles.message} role="alert">Opportunities could not be loaded. Nothing changed.
        <button type="button" onClick={() => void fetchPage(query, state, sort)}>Try again</button></div> : null}
      {status === "ok" && !items.length ? <p className={styles.message}>No matching accessible opportunities. Clear filters or try another search.</p> : null}
      {status === "ok" && items.length ? <><div className={styles.count}>{items.length} accessible opportunities loaded{cursor ? " · more available" : ""}</div>
        <div className={styles.tableWrap}><table><thead><tr><th scope="col">Opportunity</th><th scope="col">Account / site</th><th scope="col">Author</th><th scope="col">State</th></tr></thead>
          {groups.map(entry => <tbody key={entry.key}>{group ? <tr className={styles.groupHead}><th colSpan={4} scope="rowgroup">{entry.label} · {entry.records.length} loaded</th></tr> : null}
            {entry.records.map(item => <tr key={item.workId} className={selectedId === item.workId ? styles.selected : ""}>
              <td><button type="button" className={styles.record} onClick={() => setSelectedId(item.workId)}>{item.title}</button><small>Work {item.workId}</small></td>
              <td>{item.customerName || "Customer provisional"}<small>{item.siteName || "Site provisional"} · {item.identityStatus}</small></td>
              <td>{item.authorName}</td><td><span className={styles.badge}>{item.state.replaceAll("_", " ")}</span></td>
            </tr>)}</tbody>)}</table></div>
        {cursor ? <div className={styles.more}><button type="button" disabled={busyMore} onClick={() => void fetchPage(query, state, sort, cursor)}>{busyMore ? "Loading…" : "Load more"}</button></div> : null}</> : null}
    </div>
      {selected ? <aside className={styles.detail} aria-label="Selected workspace opportunity"><div className={styles.detailHead}><strong>Opportunity summary</strong>
        <button type="button" onClick={() => setSelectedId(null)}>Close</button></div>
        <h2>{selected.title}</h2><p className={styles.id}>Work {selected.workId} · version {selected.recordVersion}</p>
        <dl><div><dt>Account</dt><dd>{selected.customerName || "Provisional"}</dd></div>
          <div><dt>Site</dt><dd>{selected.siteName || "Provisional"}</dd></div>
          <div><dt>Identity</dt><dd>{selected.identityStatus === "registered" ? "Explicit registry link" : "Provisional text"}</dd></div>
          <div><dt>Customer need</dt><dd>{selected.needSummary || "Not recorded"}</dd></div>
          <div><dt>Capture author</dt><dd>{selected.authorName}</dd></div>
          <div><dt>State</dt><dd>{selected.state.replaceAll("_", " ")}</dd></div></dl>
        <p className={styles.note}>This is a scoped opportunity summary. Capture, duplicate disposition, triage, qualification and spending use separate authority and commands.</p>
        <Link className={styles.detailLink} href={`/discover-trial/opportunity/${selected.workId}`}>Open this Work record</Link>
      </aside> : null}
    </div>
  </section>;
}
