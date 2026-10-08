import Link from "next/link";
import { startWorkRecord } from "@/app/work/actions";
import type { WorkRecordSummary, WorkRecordView } from "@/lib/d5o/work-record/types";
import { object, readable, text } from "@/components/d5o/work-record/proof-presentation";

type PrototypeRecord = { organization: string; journey: string; description: string };
export type PrototypeAction = { workId: string; workspaceId: string; title: string; label: string; owner: string; blockers: number; destination: "action" | "proof" };

function workTitle(title: string) {
  return title.replace(/^Synthetic\s+(Synthetic\s+)?/i, "");
}

function actionHref(action: PrototypeAction) {
  return `/work/${encodeURIComponent(action.workspaceId)}/${encodeURIComponent(action.workId)}#${action.destination === "proof" ? "prepare-proof" : "take-action"}`;
}

function WorkActionList({ actions, empty }: { actions: PrototypeAction[]; empty: string }) {
  if (!actions.length) return <p className="d5o-empty-copy">{empty}</p>;
  return <div className="d5o-action-list">
    {actions.slice(0, 5).map((action) => <article className="d5o-action-row" key={`${action.workId}:${action.label}`}>
      <div className={`d5o-action-status ${action.blockers ? "is-blocked" : "is-ready"}`} aria-hidden="true" />
      <div><p className="d5o-action-work">{workTitle(action.title)}</p><h3>{action.label}</h3><p>{action.blockers ? `${action.blockers} requirement${action.blockers === 1 ? "" : "s"} must be resolved first.` : `Owned by ${action.owner}. Ready when you are.`}</p></div>
      <Link className={action.blockers ? "d5o-text-action" : "d5o-text-action is-primary"} href={actionHref(action)}>{action.blockers ? "See blocker" : "Open action"}</Link>
    </article>)}
  </div>;
}

function lifecycleGroups(records: WorkRecordSummary[]) {
  const groups = new Map<string, WorkRecordSummary[]>();
  for (const record of records) groups.set(record.lifecycle_state, [...(groups.get(record.lifecycle_state) ?? []), record]);
  return [...groups.entries()];
}

function isCuratedPrototypeTitle(value: string) {
  const title = workTitle(value).trim().toLowerCase();
  return title.length > 0 && !title.startsWith("work start") && !title.startsWith("mapped configuration");
}

function isCuratedPrototypeRecord(record: WorkRecordSummary) {
  return isCuratedPrototypeTitle(record.title);
}

function onePrimaryActionPerWork(actions: PrototypeAction[]) {
  const byWork = new Map<string, PrototypeAction>();
  for (const action of actions) {
    const current = byWork.get(action.workId);
    const isHold = /^hold\b/i.test(action.label);
    const currentIsHold = current ? /^hold\b/i.test(current.label) : false;
    if (!current || (currentIsHold && !isHold)) byWork.set(action.workId, action);
  }
  return [...byWork.values()];
}

function oneRepresentativeRecordPerStage(records: WorkRecordSummary[]) {
  const selected = new Map<string, WorkRecordSummary>();
  for (const record of records) {
    const key = `${workTitle(record.title).toLowerCase()}:${record.lifecycle_state}`;
    const current = selected.get(key);
    if (!current || record.decision_count > current.decision_count || (!!record.proof_status && !current.proof_status)) selected.set(key, record);
  }
  return [...selected.values()];
}

export function D5OWorkHome({ workspaceName, record, view, queue = [], myWork = [], result, mode = "overview", actorRole }: { workspaceName: string; record?: PrototypeRecord; view?: WorkRecordView; queue?: WorkRecordSummary[]; myWork?: PrototypeAction[]; result?: string; mode?: "overview" | "my-work" | "portfolio" | "start"; actorRole?: string }) {
  const config = view ? object(view.work.configuration_snapshot) : {};
  const gate = object(config.gate);
  const gateKey = text(gate.gate_key) || text(gate.key);
  const workHref = view ? `/work/${encodeURIComponent(view.work.workspace_id)}/${encodeURIComponent(view.work.id)}` : undefined;
  const curatedQueue = oneRepresentativeRecordPerStage(queue.filter(isCuratedPrototypeRecord));
  const curatedWorkIds = new Set(curatedQueue.map((item) => item.id));
  const curatedActions = onePrimaryActionPerWork(myWork.filter((item) => curatedWorkIds.has(item.workId)));
  const readyActions = curatedActions.filter((item) => item.blockers === 0);
  const blockedActions = curatedActions.filter((item) => item.blockers > 0);
  const primaryAction = readyActions[0] ?? blockedActions[0];
  const proofInProgress = curatedQueue.filter((item) => item.proof_status === "draft" || item.proof_status === "submitted").length;
  const completed = curatedQueue.filter((item) => item.lifecycle_state === "accepted" || item.lifecycle_state === "rollout-authorized").length;
  const stages = lifecycleGroups(curatedQueue);
  const surfaceTitle = mode === "my-work" ? "What needs you now" : mode === "portfolio" ? "Where work stands" : mode === "start" ? "Start a new piece of work" : "Work that moves with purpose.";
  const surfaceLead = mode === "my-work" ? "Your work queue shows the next governed action you can take in this workspace." : mode === "portfolio" ? "See the governed work in this workspace and open the record that needs attention." : mode === "start" ? "Start one governed unit of work on the path configured for this workspace." : "See what needs attention, understand why it matters, and move one governed Work Record forward at a time.";

  return <main className="d5o-work-home">
    <section className="d5o-home-hero" aria-labelledby="work-home-title">
      <div className="d5o-home-intro">
        <p className="d5o-kicker">D5O / WORK</p>
        <h1 id="work-home-title">{surfaceTitle}</h1>
        <p className="d5o-home-lead">{surfaceLead}</p>
        <nav aria-label="Work navigation" className="d5o-home-tabs"><Link href="/work">Work</Link><Link href="/work/my-work">My work</Link><Link href="/work/portfolio">Portfolio</Link><Link href="/work/start">Start work</Link></nav>
      </div>
      <aside className="d5o-next-action" aria-label="Next action">
        <p className="d5o-kicker">NEXT UP</p>
        {primaryAction ? <><p className="d5o-next-work">{workTitle(primaryAction.title)}</p><h2>{primaryAction.label}</h2><p>{primaryAction.blockers ? "This action is waiting for a condition to be resolved." : `You are the configured owner for this action.`}</p><Link className="button button-primary" href={actionHref(primaryAction)}>{primaryAction.blockers ? "Understand the blocker" : "Take action"}</Link></> : <><h2>Your queue is clear</h2><p>No configured action is waiting for the current role.</p>{workHref ? <Link className="button button-secondary" href={workHref}>Open current work</Link> : null}</>}
      </aside>
    </section>

    {result === "create_failed" ? <p role="alert" className="d5o-inline-alert">The Work Record was not started. No partial record was created.</p> : null}

    {mode === "overview" ? <section className="d5o-home-metrics" aria-label="Workspace summary">
      <article><strong>{curatedQueue.length}</strong><span>Active Work Records</span><small>Focused work in this workspace</small></article>
      <article><strong>{readyActions.length}</strong><span>Ready for you</span><small>Actions the current role can take</small></article>
      <article><strong>{blockedActions.length}</strong><span>Need attention</span><small>Actions waiting for requirements</small></article>
      <article><strong>{proofInProgress}</strong><span>Proof in progress</span><small>{completed} completed record{completed === 1 ? "" : "s"}</small></article>
    </section> : null}

    {(mode === "overview" || mode === "my-work") ? <div className={`d5o-home-primary-grid${mode === "my-work" ? " d5o-home-primary-single" : ""}`}>
      <section id="my-work" className="d5o-surface d5o-my-work">
        <header className="d5o-section-heading"><div><p className="d5o-kicker">MY WORK</p><h2>What needs you now</h2></div><span>{readable(actorRole ?? view?.actor.workspace_role ?? "workspace member")}</span></header>
        <WorkActionList actions={readyActions} empty="There is no action ready for the current role." />
        {blockedActions.length ? <div className="d5o-blocked-work"><div><p className="d5o-kicker">WAITING ON</p><h3>Conditions that prevent progress</h3></div><WorkActionList actions={blockedActions} empty="" /></div> : null}
      </section>

      {mode === "overview" ? <section className="d5o-surface d5o-featured-work" aria-label="Current Work Record">
        <p className="d5o-kicker">CURRENT WORK RECORD</p>
        {view ? <><h2>{workTitle(view.work.title)}</h2><p className="d5o-featured-journey">{record?.journey ?? "Governed work"}</p><dl><div><dt>Current stage</dt><dd>{readable(view.work.lifecycle_state)}</dd></div><div><dt>Decision gate</dt><dd>{text(gate.label) || readable(view.work.gate_key)}</dd></div><div><dt>Proof package</dt><dd>{view.proof ? `Revision ${view.proof.proof_package_revision} · ${readable(view.proof.status)}` : "Not started"}</dd></div></dl><p>{record?.description ?? "A single governed unit of work with clear readiness, decision and history."}</p>{workHref ? <Link className="button button-secondary" href={workHref}>Open Work Record</Link> : null}</> : <><h2>Choose a Work Record</h2><p>Work becomes visible here only when it is available within the active workspace.</p></>}
      </section> : null}
    </div> : null}

    {(mode === "overview" || mode === "portfolio") ? <section id="portfolio" className="d5o-surface d5o-portfolio">
      <header className="d5o-section-heading"><div><p className="d5o-kicker">PORTFOLIO</p><h2>Where work stands</h2><p>Every card is a governed Work Record. Stages come from each record’s pinned configuration.</p></div><span>Focused operating view</span></header>
      {curatedQueue.length ? <div className="d5o-workboard">{stages.map(([state, records]) => <section className="d5o-work-column" key={state}><header><span>{readable(state)}</span><strong>{records.length}</strong></header>{records.slice(0, 5).map((item) => <Link className="d5o-work-card" key={item.id} href={`/work/${encodeURIComponent(item.workspace_id)}/${encodeURIComponent(item.id)}`}><strong>{workTitle(item.title)}</strong><span>{readable(item.work_type_key)}</span><small>{item.proof_status ? `Proof ${readable(item.proof_status)}` : "Proof not started"} · {item.decision_count} decision{item.decision_count === 1 ? "" : "s"}</small></Link>)}</section>)}</div> : <p className="d5o-empty-copy">No Work Records match this focused view.</p>}
    </section> : null}

    {(mode === "overview" || mode === "start") ? <section id="start-work" className="d5o-start-work">
      <div><p className="d5o-kicker">START WORK</p><h2>Start a new piece of work with the right path already in place.</h2><p>{view ? `This workspace starts ${text(object(config.workType).label) || readable(view.work.work_type_key)} work using the ${text(gate.label) || readable(view.work.gate_key)} path.` : "Choose an active workspace to start governed work."}</p></div>
      {view ? <form action={startWorkRecord}><input type="hidden" name="workspaceId" value={view.work.workspace_id} /><input type="hidden" name="workTypeKey" value={view.work.work_type_key} /><input type="hidden" name="gateKey" value={gateKey} /><input type="hidden" name="configurationVersionId" value={view.work.configuration_version_id} /><label><span>What is this work called?</span><input name="title" required maxLength={180} placeholder="For example: North plant modernization pilot" /></label><button className="button button-primary" type="submit">Start work</button></form> : null}
    </section> : null}
  </main>;
}
