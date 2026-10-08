"use client";

import { useState } from "react";
import { configuredTransitionsFor, lifecycleProfiles, roleLabel } from "./lifecycle-profiles";

type Work = {
  id: string; workspace: "rybex" | "rotork"; title: string; type: string; customer: string; site: string; stage: string; nextAction: string; value: string;
  progress: number; status: "attention" | "moving" | "complete"; blockers: string[];
  evidence?: { id: string; name: string; state: "draft" | "verified" | "accepted" }[];
  lifecycle?: { id: string; action: string; owner: string; due: string; status: "planned" | "active" }[];
};

type Filter = "all" | "blocked" | "review" | "accepted";

function handoffState(work: Work): Exclude<Filter, "all"> {
  if (work.status === "complete") return "accepted";
  if (work.blockers.length) return "blocked";
  return "review";
}

function ProofState({ done, label }: { done: boolean; label: string }) {
  return <span className={`d5o-proof-state ${done ? "is-done" : ""}`}><b>{done ? "✓" : "·"}</b>{label}</span>;
}

export function HandoffControlBoard({ workspaceName, work, onOpen }: { workspaceName: string; work: Work[]; onOpen: (item: Work) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const candidates = work.filter((item) => item.progress >= 60 || item.status === "complete");
  const shown = candidates.filter((item) => filter === "all" || handoffState(item) === filter);
  const actions = work.flatMap((item) => (item.lifecycle ?? []).map((action) => ({ ...action, work: item })));
  const profile = lifecycleProfiles[work[0]?.workspace ?? "rybex"];
  return <section className="d5o-handoff-concept">
    <header><div><p>HANDOFF & LIFECYCLE · {workspaceName.toUpperCase()}</p><h1>Finish the promise. Keep ownership after delivery.</h1><span>{profile.name} · v{profile.version}. Verify proof, record the configured acceptance, and transfer the outcome to a named lifecycle owner.</span></div><div className="d5o-handoff-summary"><article><strong>{candidates.length}</strong><span>Handoffs in view</span></article><article><strong>{candidates.filter((item) => handoffState(item) === "blocked").length}</strong><span>Controlled holds</span></article><article><strong>{actions.length}</strong><span>Lifecycle actions</span></article></div></header>
    <section className="d5o-handoff-matrix"><header><div><p>HANDOFF CONTROL BOARD</p><h2>Proof and acceptance are separate decisions</h2></div><div><button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "blocked" ? "is-active" : ""} onClick={() => setFilter("blocked")}>Blocked</button><button className={filter === "review" ? "is-active" : ""} onClick={() => setFilter("review")}>In review</button><button className={filter === "accepted" ? "is-active" : ""} onClick={() => setFilter("accepted")}>Accepted</button></div></header><div className="d5o-handoff-matrix-scroll"><div className="d5o-handoff-matrix-head"><span>WORK / OUTCOME</span><span>PACKAGE PROOF</span><span>QUALITY / REVIEW</span><span>ACCEPTANCE</span><span>NEXT OWNER / AUTHORITY</span></div>{shown.map((item) => { const state = handoffState(item); const proof = item.evidence ?? []; const reviewedCount = proof.filter((entry) => entry.state !== "draft").length; const pendingCount = proof.length - reviewedCount; const reviewed = proof.length > 0 && pendingCount === 0; const action = item.lifecycle?.[0]; const configured = configuredTransitionsFor(item.workspace, item.stage); return <button key={item.id} onClick={() => onOpen(item)}><div><small>{item.customer} · {item.site}</small><strong>{item.title}</strong><em>{item.stage} · {item.nextAction}</em></div><div><ProofState done={reviewed} label={`${reviewedCount} / ${proof.length} reviewed`} /><small>{pendingCount ? `${pendingCount} reference${pendingCount === 1 ? "" : "s"} still draft` : proof.length ? "Reviewed package linked to this record" : "Proof still required"}</small></div><div><ProofState done={reviewed && !item.blockers.length} label={item.blockers.length ? "Hold open" : reviewed ? "Reviewed" : "Awaiting review"} /><small>{item.blockers[0] || "No open controlled condition"}</small></div><div><ProofState done={state === "accepted"} label={state === "accepted" ? "Accepted" : state === "blocked" ? "Blocked" : "Awaiting authority"} /><small>{item.value}</small></div><div><strong>{configured.map((transition) => roleLabel(item.workspace, transition.role)).join(" / ") || action?.owner || "Next owner to assign"}</strong><small>{configured.map((transition) => transition.label).join(" / ") || action?.action || "Lifecycle action to plan"}</small>{action ? <small>Lifecycle owner: {action.owner} · {action.due}</small> : null}</div></button>; })}{!shown.length ? <p className="d5o-empty-state">No handoff matches this view.</p> : null}</div></section>
    <section className="d5o-lifecycle-board"><header><p>AFTER HANDOFF</p><h2>Keep the result connected to its next value action.</h2></header><div>{actions.map((action) => <button key={action.id} onClick={() => onOpen(action.work)}><i>↗</i><span><strong>{action.action}</strong><small>{action.work.title} · {action.work.value}</small></span><span><b>{action.owner}</b><small>{action.due}</small></span><em>{action.status}</em></button>)}</div></section>
  </section>;
}
