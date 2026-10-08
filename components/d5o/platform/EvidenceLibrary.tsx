"use client";

import { useState } from "react";

type Evidence = { id: string; name: string; kind: string; state: "draft" | "verified" | "accepted"; added: string; source?: string };
type Work = { id: string; title: string; customer: string; site: string; evidence?: Evidence[] };
type Filter = "all" | Evidence["state"];

export function EvidenceLibrary({ work, onOpen }: { work: Work[]; onOpen: (item: Work) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const evidence = work.flatMap((record) => (record.evidence ?? []).map((entry) => ({ ...entry, record })));
  const shown = evidence.filter((entry) => (filter === "all" || entry.state === filter) && `${entry.name} ${entry.kind} ${entry.record.title} ${entry.record.customer}`.toLowerCase().includes(search.toLowerCase()));
  const filters: { key: Filter; label: string }[] = [{ key: "all", label: "All references" }, { key: "draft", label: "Awaiting review" }, { key: "verified", label: "Reviewed" }, { key: "accepted", label: "Accepted" }];
  return <section className="d5o-library-board"><header><div><p>EVIDENCE LIBRARY</p><h1>Find proof in the work it supports.</h1><span>References remain attached to their scoped Work Record. A draft is visible here but cannot satisfy a decision requirement.</span></div><div><strong>{evidence.length}</strong><span>references in this workspace</span></div></header><section className="d5o-library-register"><header><nav aria-label="Evidence status filters">{filters.map((option) => <button key={option.key} className={filter === option.key ? "is-active" : ""} onClick={() => setFilter(option.key)}>{option.label}<b>{evidence.filter((entry) => option.key === "all" || entry.state === option.key).length}</b></button>)}</nav><label>Find proof<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference or work" /></label></header><div className="d5o-library-row-head"><span>REFERENCE</span><span>WORK RECORD</span><span>PURPOSE</span><span>STATE</span></div>{shown.map((entry) => <button key={`${entry.record.id}:${entry.id}`} onClick={() => onOpen(entry.record)}><span><strong>{entry.name}</strong><small>{entry.source || `Synthetic baseline · ${entry.added}`}</small></span><span><strong>{entry.record.title}</strong><small>{entry.record.customer} · {entry.record.site}</small></span><span>{entry.kind}</span><b className={entry.state}>{entry.state === "draft" ? "Awaiting review" : entry.state === "verified" ? "Reviewed" : "Accepted"}</b></button>)}{!shown.length ? <p className="d5o-empty-state">No evidence matches this view.</p> : null}</section></section>;
}
