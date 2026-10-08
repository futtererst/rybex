"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkRecord, WorkspaceKey } from "./work-types";
import { operateState } from "./operate-model";
import { buildSupportQueue, type SupportQueueItem } from "./operate-queue";
import type { OperateTab } from "./OperateWorkspace";
import style from "./OperateBoard.module.css";

type QueueFilter = "All" | SupportQueueItem["severity"];
const filters: QueueFilter[] = ["All", "Overdue", "Action", "Upcoming"];
const dueLabel = (at: string, timezone: string) => /^\d{4}-\d{2}-\d{2}$/.test(at) ? `Due ${at}` : `Due ${new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(at))}`;

export function OperateBoard({ workspace, workspaceName, work, timezoneByWorkId, onOpen, onBrowse }: {
  workspace: WorkspaceKey;
  workspaceName: string;
  work: WorkRecord[];
  timezoneByWorkId: Record<string, string>;
  onOpen: (workId: string, section: OperateTab) => void;
  onBrowse: () => void;
}) {
  const [filter, setFilter] = useState<QueueFilter>("All");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().toISOString()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const records = useMemo(() => work.filter((item) => item.workspace === workspace), [work, workspace]);
  const byId = useMemo(() => new Map(records.map((item) => [item.id, item])), [records]);
  const queue = useMemo(() => buildSupportQueue(records, workspace, now, (record) => timezoneByWorkId[record.id] ?? "UTC"), [records, workspace, now, timezoneByWorkId]);
  const query = search.trim().toLocaleLowerCase();
  const shown = queue.filter((item) => {
    if (filter !== "All" && item.severity !== filter) return false;
    const record = byId.get(item.workId);
    return !query || [item.label, item.detail, item.owner, record?.title, record?.customer, record?.site].some((value) => value?.toLocaleLowerCase().includes(query));
  });
  const supported = records.filter((item) => item.operate || item.deploy?.workAcceptance?.receipt === "Accepted" || item.deploy?.turnovers?.some((entry) => entry.status === "Client accepted" && entry.receipt === "Accepted"));
  const activeCount = supported.filter((item) => operateState(item).activation?.status === "Active").length;

  return <section className={style.board} aria-label="Operate across this workspace">
    <header className={style.hero}>
      <div><p className={style.kicker}>D6 OPERATE · {workspaceName.toUpperCase()}</p><h1>Support work and obligations</h1><p>See what needs an Operations decision, then open the exact Work Record to act. Support activation, Finance closeout and lifecycle pursuits remain separate.</p></div>
    </header>
    <div className={style.metrics} aria-label="Operate status">
      <button type="button" onClick={() => setFilter("Overdue")} aria-pressed={filter === "Overdue"}><strong>{queue.filter((item) => item.severity === "Overdue").length}</strong><span>Overdue</span></button>
      <button type="button" onClick={() => setFilter("Action")} aria-pressed={filter === "Action"}><strong>{queue.filter((item) => item.severity === "Action").length}</strong><span>Action needed</span></button>
      <button type="button" onClick={() => setFilter("Upcoming")} aria-pressed={filter === "Upcoming"}><strong>{queue.filter((item) => item.severity === "Upcoming").length}</strong><span>Upcoming</span></button>
      <div><strong>{activeCount}</strong><span>Active support records</span></div>
    </div>
    <section className={style.panel} aria-labelledby="operate-queue-heading">
      <div className={style.panelHead}><div><p className={style.kicker}>OPERATIONS QUEUE</p><h2 id="operate-queue-heading">Next support actions</h2><p>Based on recorded handoffs, requests, SLA clocks, coverage and maintenance plans.</p></div><span>{shown.length} shown · {queue.length} total</span></div>
      <div className={style.controls}><div className={style.filters} role="group" aria-label="Filter support actions">{filters.map((item) => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item} <span>{item === "All" ? queue.length : queue.filter((entry) => entry.severity === item).length}</span></button>)}</div><label>Find customer, work or action<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search support work" /></label></div>
      <div className={style.rows}>{shown.map((item) => {
        const record = byId.get(item.workId);
        return <article className={style.row} key={item.key}><div><span className={`${style.severity} ${style[item.severity.toLowerCase()]}`}>{item.severity}</span><h3>{item.label}</h3><p>{record?.title ?? "Work Record unavailable"} · {record?.customer ?? "Customer unknown"} · {record?.site ?? "Site unknown"}</p><small>{item.detail}</small></div><div className={style.rowAction}><span>{item.owner}</span><span>{item.dueAt ? dueLabel(item.dueAt, timezoneByWorkId[item.workId] ?? "UTC") : "No deadline recorded"}</span><button type="button" onClick={() => onOpen(item.workId, item.section)} disabled={!record}>Open action →</button></div></article>;
      })}{!shown.length ? <p className={style.empty}>{queue.length ? "No actions match these filters." : "No support exception is recorded. Open a supported Work Record below to review its operating position."}</p> : null}</div>
    </section>
    <section className={style.panel} aria-labelledby="supported-work-heading"><div className={style.panelHead}><div><p className={style.kicker}>SUPPORT PORTFOLIO</p><h2 id="supported-work-heading">Supported work</h2><p>Accepted handoffs and operating records in this workspace.</p></div><span>{supported.length} Work Records</span></div><div className={style.workRows}>{supported.map((item) => { const state = operateState(item); return <article className={style.workRow} key={item.id}><div><b>{item.title}</b><span>{item.customer} · {item.site}</span></div><span>{state.activation?.status ?? (state.source ? "Awaiting activation" : "Awaiting receipt")}</span><span>{state.requests.filter((request) => !["Resolved", "Closed"].includes(request.status)).length} open requests</span><button type="button" onClick={() => onOpen(item.id, "Overview")}>Open Operate →</button></article>; })}{!supported.length ? <div className={style.empty}>No accepted handoff or operating record is available in this workspace yet. <button type="button" onClick={onBrowse}>Browse Work Records →</button></div> : null}</div></section>
    <p className={style.disclosure}>Synthetic prototype. Actions and decisions are recorded on their owning Work Record; this queue does not authorize support or close work.</p>
  </section>;
}
