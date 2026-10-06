"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { RmJob, RmJobList, RmJobPayload, RmJobReadiness } from "@/lib/d5o/rm02-trial";
import { saveJobAction } from "./actions";
import styles from "./jobs.module.css";

type Data = Extract<RmJobList, { status: "ok" }>;
const empty: RmJobPayload = { jobType: "", scope: "", priority: "normal",
  siteAddress: "", requiredSkills: [], requiredGrades: [],
  estimatedPersonHours: 0, requiredCrewSize: 0, scheduledStart: "",
  scheduledEnd: "", customerContact: "", notes: "", documentRefs: [] };
const labels: Record<string, string> = {
  job_type_required: "Choose a job type.",scope_required: "Describe the scope (at least 20 characters).",
  priority_required: "Choose a priority.",site_address_required: "Enter the site address.",
  crew_size_invalid: "Enter a crew size from 1 to 30.",
  person_hours_invalid: "Enter total planned person-hours greater than zero.",
  qualification_required: "Enter at least one required skill or grade.",
  schedule_required: "Enter the start and end of the job span.",
  schedule_invalid: "The end must be after the start.",
  customer_contact_missing: "Customer contact is missing; confirm the tenant rule before dispatch.",
  documents_missing: "No custody document is linked to this Work yet.",
};
const errors: Record<string, string> = {
  denied: "This identity has no explicit job-save right.",
  conflict: "The job changed. Reload it before saving; your entered values remain here.",
  invalid: "The job or a linked value is invalid. Correct the fields and retry.",
  not_ready: "The server found readiness blockers. Correct them before marking planning ready.",
  handoff_required: "The current D1→D2 receiving handoff must be accepted first.",
  unavailable: "The result is unavailable. Retry the same unchanged request; your draft remains here.",
};
const split = (text: string) => text.split(",").map(x => x.trim()).filter(Boolean);
const stateLabel = (state: RmJob["state"]) => state === "draft"
  ? "Draft" : "Planning fields ready · release pending";
const localUtc = (iso: string) => iso ? iso.slice(0,16) : "";
const toUtc = (value: string) => value ? `${value}:00Z` : "";

function preview(p: RmJobPayload): RmJobReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!p.jobType) blockers.push("job_type_required");
  if (p.scope.trim().length < 20) blockers.push("scope_required");
  if (!p.priority) blockers.push("priority_required");
  if (p.siteAddress.trim().length < 10) blockers.push("site_address_required");
  if (!Number.isInteger(p.requiredCrewSize) || p.requiredCrewSize < 1 || p.requiredCrewSize > 30)
    blockers.push("crew_size_invalid");
  if (p.estimatedPersonHours <= 0 || p.estimatedPersonHours > 10000)
    blockers.push("person_hours_invalid");
  if (p.requiredSkills.length === 0 && p.requiredGrades.length === 0)
    blockers.push("qualification_required");
  const start = Date.parse(p.scheduledStart), end = Date.parse(p.scheduledEnd);
  if (!p.scheduledStart || !p.scheduledEnd) blockers.push("schedule_required");
  else if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    blockers.push("schedule_invalid");
  if (p.customerContact.trim().length < 3) warnings.push("customer_contact_missing");
  if (p.documentRefs.length === 0) warnings.push("documents_missing");
  return { blockers,warnings,estimatedPersonHours:p.estimatedPersonHours,
    requiredCrewSize:p.requiredCrewSize,
    equalShareHours:p.requiredCrewSize ? Math.round(p.estimatedPersonHours/p.requiredCrewSize*100)/100 : 0,
    jobSpanHours:Number.isFinite(start) && Number.isFinite(end) && end>start
      ? Math.round((end-start)/36000)/100 : null };
}

export function JobPlanningWorkspace({ data }: { data: Data }) {
  const [items,setItems] = useState(data.items);
  const [workId,setWorkId] = useState(data.works[0]?.workId ?? "");
  const initial = data.items.find(j => j.workId === workId);
  const [payload,setPayload] = useState<RmJobPayload>(initial?.payload ?? {
    ...empty,siteAddress:data.works[0]?.siteAddress ?? "" });
  const [skillsText,setSkillsText] = useState((initial?.payload.requiredSkills ?? []).join(", "));
  const [gradesText,setGradesText] = useState((initial?.payload.requiredGrades ?? []).join(", "));
  const [revision,setRevision] = useState(initial?.revision ?? 0);
  const [state,setState] = useState(initial?.state ?? "draft");
  const [status,setStatus] = useState("");
  const [pending,setPending] = useState(false);
  const command = useRef<{ key: string; id: string } | null>(null);
  const work = data.works.find(w => w.workId === workId);
  const current = items.find(j => j.workId === workId);
  const readiness = preview(payload);
  function selectWork(id: string) {
    const job = items.find(j => j.workId === id);
    setWorkId(id);setPayload(job?.payload ?? { ...empty,
      siteAddress:data.works.find(w => w.workId === id)?.siteAddress ?? "" });
    setSkillsText((job?.payload.requiredSkills ?? []).join(", "));
    setGradesText((job?.payload.requiredGrades ?? []).join(", "));
    setRevision(job?.revision ?? 0);setState(job?.state ?? "draft");
    setStatus("");command.current=null;
  }
  function update<K extends keyof RmJobPayload>(key: K, value: RmJobPayload[K]) {
    setPayload(p => ({ ...p, [key]: value }));setStatus("");
  }
  async function save(mode: "save" | "ready") {
    if (!workId || pending) return;
    const key = JSON.stringify({ workId,revision,mode,payload });
    if (!command.current || command.current.key !== key)
      command.current = { key,id:crypto.randomUUID() };
    setPending(true);setStatus("");
    try {
      const result = await saveJobAction({ workId,expectedRevision:revision,
        commandId:command.current.id,mode,payload });
      if (result.status === "saved") {
        setRevision(result.revision);setState(result.state);
        setStatus(`Saved revision ${result.revision} · ${result.state === "draft" ? "draft" : "planning ready"}.`);
        command.current=null;
        const next: RmJob = { workId,jobCode:current?.jobCode ?? `J-${workId.replaceAll("-","").slice(0,8).toUpperCase()}`,
          accountName:work?.accountName ?? "",siteName:work?.siteName ?? "",
          revision:result.revision,state:result.state,payload,readiness:result.readiness,
          updatedAt:new Date().toISOString() };
        setItems(before => [next,...before.filter(j => j.workId !== workId)]);
      } else setStatus(errors[result.status] ?? "The save could not be confirmed.");
    } finally { setPending(false); }
  }
  return <main className={styles.shell}>
    <nav><Link href="/discover-trial">Discover</Link> / <Link href="/discover-trial/resources">Resources</Link> / Field job planning · <Link href="/discover-trial/dispatch">Crew planning</Link></nav>
    <header><p className={styles.eyebrow}>RM02 · bounded trial</p><h1>Field job planning</h1>
      <p>Plan a field job against the existing Work. A planning-ready result does not release a package, assign a crew or authorize spending.</p></header>
    <div className={styles.banner}>Synthetic tenant A · only Work with an accepted D1→D2 receiving handoff and registered account/site appears. Schedule inputs are UTC in this trial; site-time-zone conversion remains to be designed.</div>
    <div className={styles.grid}>
      <aside className={styles.panel}><h2>Eligible Work</h2>
        {data.works.length===0 && <p>No Work is eligible. Complete its account/site link and D1→D2 acceptance first.</p>}
        {data.works.map(w => <button type="button" key={w.workId}
          className={`${styles.workCard} ${workId===w.workId?styles.selected:""}`}
          onClick={() => selectWork(w.workId)}>
          <strong>{w.title}</strong><span>{w.accountName} · {w.siteName}</span>
          <small>Work {w.workId} · version {w.workVersion}</small>
          {items.find(j=>j.workId===w.workId) && <em>{stateLabel(items.find(j=>j.workId===w.workId)!.state)}</em>}
        </button>)}
      </aside>
      <div className={styles.main}>
        {!work ? <section className={styles.panel}><h2>Select Work</h2><p>Choose an eligible Work record to plan its field job.</p></section> : <>
          <section className={styles.panel}><div className={styles.head}><div>
            <p className={styles.eyebrow}>{current?.jobCode ?? "New job"} · Work {workId}</p>
            <h2>{work.title}</h2></div><span className={styles.state}>{stateLabel(state)} · revision {revision}</span></div>
            <div className={styles.identity}><div><small>Client</small><strong>{work.accountName}</strong></div>
              <div><small>Registered site</small><strong>{work.siteName}</strong></div></div>
            <p className={styles.hint}>The account and site come from the Discover Work link. They cannot be silently rematched here.</p>
          </section>
          <section className={styles.panel}><h2>Job definition</h2><div className={styles.form}>
            <div className={styles.pair}><label>Job type<select value={payload.jobType} disabled={!data.canSave}
              onChange={e=>update("jobType",e.target.value)}><option value="">Select type</option>
              {data.jobTypes.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
              <label>Priority<select value={payload.priority} disabled={!data.canSave}
                onChange={e=>update("priority",e.target.value)}>
                <option value="">Select priority</option>{data.priorities.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</select></label></div>
            <label>Scope<textarea value={payload.scope} disabled={!data.canSave} rows={4}
              onChange={e=>update("scope",e.target.value)} placeholder="What will the crew deliver or inspect?" /></label>
            <label>Registered site address<input value={payload.siteAddress} readOnly
              aria-describedby="site-address-source" /></label>
            <p id="site-address-source" className={styles.hint}>This address comes from the linked tenant site registry. If it is missing or wrong, correct the registry before planning readiness.</p>
            <div className={styles.pair}><label>Required skills <small>comma separated</small>
              <input value={skillsText} disabled={!data.canSave}
                onChange={e=>{setSkillsText(e.target.value);update("requiredSkills",split(e.target.value));}}
                placeholder="Controls, Electrical" /></label>
              <label>Required grades <small>comma separated</small>
                <input value={gradesText} disabled={!data.canSave}
                  onChange={e=>{setGradesText(e.target.value);update("requiredGrades",split(e.target.value));}}
                  placeholder="Senior Technician" /></label></div>
          </div></section>
          <section className={styles.panel}><h2>Crew demand and job span</h2><div className={styles.form}>
            <div className={styles.pair}><label>Required crew size<input type="number" min="1" max="30"
              value={payload.requiredCrewSize || ""} disabled={!data.canSave}
              onChange={e=>update("requiredCrewSize",Number(e.target.value))} /></label>
              <label>Total planned person-hours<input type="number" min="0.25" max="10000" step="0.25"
                value={payload.estimatedPersonHours || ""} disabled={!data.canSave}
                onChange={e=>update("estimatedPersonHours",Number(e.target.value))} /></label></div>
            <div className={styles.pair}><label>Job span starts · UTC<input type="datetime-local"
              value={localUtc(payload.scheduledStart)} disabled={!data.canSave}
              onChange={e=>update("scheduledStart",toUtc(e.target.value))} /></label>
              <label>Job span ends · UTC<input type="datetime-local"
                value={localUtc(payload.scheduledEnd)} disabled={!data.canSave}
                onChange={e=>update("scheduledEnd",toUtc(e.target.value))} /></label></div>
            <div className={styles.math}><div><small>Job span</small><strong>{readiness.jobSpanHours ?? "—"} hours</strong></div>
              <div><small>Total labor demand</small><strong>{payload.estimatedPersonHours || "—"} person-hours</strong></div>
              <div><small>Equal-share illustration</small><strong>{payload.requiredCrewSize ? readiness.equalShareHours : "—"} hours/person</strong></div></div>
            <p className={styles.hint}>The equal share is an estimate, not an assignment. Individual shifts are chosen later and may differ.</p>
          </div></section>
          <section className={styles.panel}><h2>Field context</h2><div className={styles.form}>
            <label>Customer point of contact<input value={payload.customerContact} disabled={!data.canSave}
              onChange={e=>update("customerContact",e.target.value)} placeholder="Name and contact method" /></label>
            <label>Notes<textarea value={payload.notes} rows={3} disabled={!data.canSave}
              onChange={e=>update("notes",e.target.value)} /></label>
            <div className={styles.docBox}><strong>Drawings / MOPs</strong>
              <p>{payload.documentRefs.length ? `${payload.documentRefs.length} Work custody document(s) linked.` :
                "No custody document is linked to this job. Document selection and upload are not yet connected in this RM02 trial."}</p></div>
          </div></section>
          <section className={styles.panel}><h2>Planning readiness</h2>
            <p className={styles.hint}>Live preview for the entered draft. The server repeats all checks when you save.</p>
            <div className={styles.readiness}>
              <div><strong>Blockers ({readiness.blockers.length})</strong>
                {readiness.blockers.length ? <ul>{readiness.blockers.map(x=><li key={x}>{labels[x] ?? x}</li>)}</ul>
                  : <p>Required planning fields are present.</p>}</div>
              <div><strong>Warnings ({readiness.warnings.length})</strong>
                {readiness.warnings.length ? <ul>{readiness.warnings.map(x=><li key={x}>{labels[x] ?? x}</li>)}</ul>
                  : <p>No current planning warnings.</p>}</div>
            </div>
            {status && <p role="status" className={styles.status}>{status}</p>}
            {data.canSave ? <div className={styles.actions}>
              <button type="button" disabled={pending} onClick={()=>save("save")}>Save draft</button>
              <button type="button" disabled={pending} onClick={()=>save("ready")}>Check and mark planning ready</button>
            </div> : <p className={styles.banner}>Read-only for this identity. An explicit job-save grant is required.</p>}
          </section>
        </>}
      </div>
    </div>
  </main>;
}
