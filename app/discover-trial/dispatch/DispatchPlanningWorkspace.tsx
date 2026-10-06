"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { RmListResult } from "@/lib/d5o/rm01-trial";
import type { RmJobList } from "@/lib/d5o/rm02-trial";
import type { RmPlanList,RmPlanPreview,RmPlanShift } from "@/lib/d5o/rm03-trial";
import type { D4Readiness } from "@/lib/d5o/d4-readiness-trial";
import { previewPlanAction,commitPlanAction,cancelPlanAction,refreshPlansAction,
  reviewD4ReadinessAction } from "./actions";
import styles from "./dispatch.module.css";
import reviewStyles from "./release-review.module.css";

type Profiles=Extract<RmListResult,{status:"ok"}>;
type Jobs=Extract<RmJobList,{status:"ok"}>;
type Plans=Extract<RmPlanList,{status:"ok"}>;
const zone="America/New_York";
const messages:Record<string,string>={
  job_planning_not_ready:"Job planning fields are not ready.",
  outside_job_span:"Slot falls outside the job span.",
  overnight_shift:"Split multi-day work into explicit daily shifts.",
  non_working_day:"Technician is not scheduled to work that day.",
  outside_working_hours:"Slot falls outside the technician's working hours.",
  pto_unavailable:"Technician is unavailable on this PTO date.",
  inactive_technician:"Inactive technicians cannot receive new planning slots.",
  overlapping_plan:"This technician already has a tentative overlapping slot.",
  grade_mismatch:"Required grade is not met.",
};
const errorMessage:Record<string,string>={
  denied:"This identity has no explicit planning right.",
  invalid:"The job, technician or interval is invalid. Recheck the current records.",
  blocked:"The server found a blocker. Refresh the preview; your chosen slot remains here.",
  stale:"The job or technician profile changed. Refresh the preview before committing.",
  conflict:"This slot changed or the command conflicts. Refresh before retrying.",
  warning_ack_required:"Explain the qualification warning before committing.",
  unavailable:"The result could not be confirmed. Retry the same unchanged request.",
};
const displayIssue=(x:string)=>x.startsWith("skill_mismatch:")
  ?`Skill not on profile: ${x.slice(15)}. A reason is required to reserve tentatively.`
  :messages[x]??x;
const releaseReasons:Record<string,string>={
  job_planning_incomplete:"Job planning fields are not ready.",
  crew_window_incomplete:"The required crew is not covered for the entire job window.",
  stale_plan_revision:"A crew slot references an older job or technician revision.",
  qualification_warning_needs_release_policy:"A qualification warning needs a governed release rule.",
  g3_scope_authority_unconnected:"Accepted G3 scope and commercial authority are not linked.",
  design_method_clearances_unconnected:"Approved design and method versions are not linked.",
  hseq_access_supply_clearances_unconnected:"HSEQ, access, material and equipment clearances are not linked.",
  certificate_policy_unconfigured:"Mandatory certificate policy and validity evidence are not configured.",
  site_calendar_policy_unconfigured:"The tenant site calendar and time-zone policy are not configured.",
  d4_release_authority_unconfigured:"No scoped D4 package release authority is configured.",
  execution_pack_and_notification_unconnected:"The crew execution pack and notification channel are not linked.",
};
function siteParts(iso:string){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",
    day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso));
  const part=(name:string)=>parts.find(x=>x.type===name)?.value??"00";
  return {date:`${part("year")}-${part("month")}-${part("day")}`,
    hour:Number(part("hour")),minute:Number(part("minute")),
    time:`${part("hour")}:${part("minute")}`};
}
function weekDates(date:string){
  const center=new Date(`${date}T12:00:00Z`);
  const monday=new Date(center);monday.setUTCDate(center.getUTCDate()-((center.getUTCDay()+6)%7));
  return Array.from({length:7},(_,i)=>{
    const d=new Date(monday);d.setUTCDate(monday.getUTCDate()+i);return d.toISOString().slice(0,10);
  });
}
const localInput=(iso:string)=>iso?iso.slice(0,16):"";
const utcValue=(input:string)=>input?`${input}:00Z`:"";
const shortDate=(day:string)=>new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US",
  {weekday:"short",month:"short",day:"numeric",timeZone:"UTC"});

export function DispatchPlanningWorkspace({profiles,jobs,plans}:{profiles:Profiles;jobs:Jobs;plans:Plans}){
  const [shifts,setShifts]=useState(plans.items);
  const [day,setDay]=useState(jobs.items[0]?.payload.scheduledStart.slice(0,10)??"2026-10-05");
  const [view,setView]=useState<"day"|"week">("day");
  const [filter,setFilter]=useState("");
  const [workId,setWorkId]=useState(jobs.items[0]?.workId??"");
  const [resourceId,setResourceId]=useState("");
  const [startsAt,setStartsAt]=useState(jobs.items[0]?.payload.scheduledStart??"");
  const [endsAt,setEndsAt]=useState(jobs.items[0]?.payload.scheduledEnd??"");
  const [preview,setPreview]=useState<RmPlanPreview|null>(null);
  const [ackReason,setAckReason]=useState("");
  const [status,setStatus]=useState("");
  const [pending,setPending]=useState(false);
  const [cancelId,setCancelId]=useState("");
  const [cancelReason,setCancelReason]=useState("");
  const [readiness,setReadiness]=useState<D4Readiness|null>(null);
  const [readinessStatus,setReadinessStatus]=useState("");
  const command=useRef<{key:string;id:string}|null>(null);
  const cancelCommand=useRef<{key:string;id:string}|null>(null);
  const job=jobs.items.find(x=>x.workId===workId);
  const active=shifts.filter(x=>x.cancelledAt===null);
  const visibleProfiles=profiles.items.filter(x=>{
    const q=filter.toLowerCase().trim();
    return !q||[x.profile.name,x.profile.grade,x.profile.region,...x.profile.skills]
      .some(v=>v.toLowerCase().includes(q));
  });
  const selectedDayShifts=active.filter(x=>siteParts(x.startsAt).date===day);
  const selectedJobDayShifts=selectedDayShifts.filter(x=>x.workId===workId);
  const dayPeople=new Set(selectedJobDayShifts.map(x=>x.resourceId)).size;
  function changeSlot(patch:Partial<{workId:string;resourceId:string;startsAt:string;endsAt:string}>){
    if(patch.workId!==undefined)setWorkId(patch.workId);
    if(patch.resourceId!==undefined)setResourceId(patch.resourceId);
    if(patch.startsAt!==undefined)setStartsAt(patch.startsAt);
    if(patch.endsAt!==undefined)setEndsAt(patch.endsAt);
    setPreview(null);setStatus("");command.current=null;
  }
  async function reload(){
    const refreshed=await refreshPlansAction();
    if(refreshed.status==="ok")setShifts(refreshed.items);
    setReadiness(null);
  }
  async function reviewReadiness(){
    if(!workId||pending)return;
    setPending(true);setReadiness(null);setReadinessStatus("");
    try{
      const result=await reviewD4ReadinessAction(workId);
      if(result.status==="ok")setReadiness(result.review);
      else setReadinessStatus(result.status==="denied"
        ?"This identity cannot inspect this Work's readiness."
        :"The readiness review is unavailable. Retry after checking the current Work.");
    }finally{setPending(false);}
  }
  async function runPreview(){
    if(!workId||!resourceId)return setStatus("Choose a job and technician first.");
    setPending(true);setStatus("");setPreview(null);
    try{
      const result=await previewPlanAction({workId,resourceId,startsAt,endsAt});
      if(result.status==="ok")setPreview(result.preview);
      else setStatus(errorMessage[result.status]??"Preview unavailable.");
    }finally{setPending(false);}
  }
  async function commit(){
    if(!preview||preview.blockers.length||pending)return;
    const key=JSON.stringify({workId,resourceId,startsAt,endsAt,
      jobRevision:preview.jobRevision,resourceRevision:preview.resourceRevision,ackReason});
    if(!command.current||command.current.key!==key)command.current={key,id:crypto.randomUUID()};
    setPending(true);setStatus("");
    try{
      const result=await commitPlanAction({workId,resourceId,startsAt,endsAt,
        expectedJobRevision:preview.jobRevision,
        expectedResourceRevision:preview.resourceRevision,ackReason,
        commandId:command.current.id});
      if(result.status==="saved"){
        await reload();setPreview(null);setAckReason("");command.current=null;
        setStatus(`Tentative slot saved. ${result.crewAfterPlan}/${result.crewRequired} people cover this window. Release is still blocked.`);
      }else{
        setStatus(errorMessage[result.status]??"The slot was not confirmed.");
        if(result.status==="blocked"||result.status==="stale")setPreview(null);
      }
    }finally{setPending(false);}
  }
  async function cancel(){
    if(!cancelId||cancelReason.trim().length<20||pending)return;
    const key=JSON.stringify({cancelId,reason:cancelReason.trim()});
    if(!cancelCommand.current||cancelCommand.current.key!==key)
      cancelCommand.current={key,id:crypto.randomUUID()};
    setPending(true);setStatus("");
    try{
      const result=await cancelPlanAction({shiftId:cancelId,reason:cancelReason,
        commandId:cancelCommand.current.id});
      if(result.status==="cancelled"){
        await reload();setCancelId("");setCancelReason("");setPreview(null);
        cancelCommand.current=null;
        setStatus("Tentative slot cancelled with its reason retained in history.");
      }else setStatus(errorMessage[result.status]??"Cancellation was not confirmed.");
    }finally{setPending(false);}
  }
  function selectJob(id:string){
    const next=jobs.items.find(x=>x.workId===id);
    changeSlot({workId:id,startsAt:next?.payload.scheduledStart??"",
      endsAt:next?.payload.scheduledEnd??""});
    if(next?.payload.scheduledStart)setDay(next.payload.scheduledStart.slice(0,10));
    setReadiness(null);setReadinessStatus("");
  }
  return <main className={styles.shell}>
    <nav><Link href="/discover-trial">Discover</Link> / <Link href="/discover-trial/jobs">Field jobs</Link> / Tentative crew planning / <Link href={`/discover-trial/packages?workId=${workId}`}>Work-package drafts</Link></nav>
    <header><p className={styles.eyebrow}>RM03 · bounded trial</p><h1>Crew planning</h1>
      <p>Preview availability, then reserve an explicit daily slot. All slots are tentative and remain outside the technician&apos;s executable schedule.</p></header>
    <div className={styles.hold}><strong>Release hold:</strong> D4 package release, mandatory certificate policy, site-time-zone policy and technician notification are not connected. A planning slot cannot authorize field work.</div>
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <section className={styles.panel}><h2>Job demand</h2>
          {jobs.items.length===0&&<p>No field job is ready for planning.</p>}
          {jobs.items.map(x=>{
            const people=new Set(active.filter(s=>s.workId===x.workId&&siteParts(s.startsAt).date===day)
              .map(s=>s.resourceId)).size;
            return <button type="button" key={x.workId}
              className={`${styles.jobCard} ${workId===x.workId?styles.chosen:""}`}
              onClick={()=>selectJob(x.workId)}><strong>{x.jobCode}</strong><span>{x.accountName} · {x.siteName}</span>
              <span>{x.payload.jobType} · {x.payload.requiredSkills.join(", ")}</span>
              <em>{people}/{x.payload.requiredCrewSize} people planned on {shortDate(day)}
                {people<x.payload.requiredCrewSize?" · Partial crew":""}</em></button>;
          })}
        </section>
        <section className={styles.panel}><h2>Plan one daily slot</h2>
          {!plans.canPlan&&<p className={styles.readOnly}>Read-only identity. Explicit planning permission is required.</p>}
          <div className={styles.form}>
            <label>Job<select value={workId} disabled={!plans.canPlan}
              onChange={e=>selectJob(e.target.value)}>
              {jobs.items.map(x=><option key={x.workId} value={x.workId}>{x.jobCode} · {x.siteName}</option>)}</select></label>
            <label>Technician<select aria-label="Technician" value={resourceId} disabled={!plans.canPlan}
              onChange={e=>changeSlot({resourceId:e.target.value})}>
              <option value="">Choose technician</option>{profiles.items.map(x=><option key={x.resourceId}
                value={x.resourceId}>{x.profile.name} · {x.profile.grade}</option>)}</select></label>
            <div className={styles.pair}><label>Starts · UTC<input type="datetime-local"
              value={localInput(startsAt)} disabled={!plans.canPlan}
              onChange={e=>changeSlot({startsAt:utcValue(e.target.value)})}/></label>
              <label>Ends · UTC<input type="datetime-local"
                value={localInput(endsAt)} disabled={!plans.canPlan}
                onChange={e=>changeSlot({endsAt:utcValue(e.target.value)})}/></label></div>
            <p className={styles.hint}>Availability checks use the synthetic site&apos;s New York working calendar. Each day needs its own slot; the job span does not book nights.</p>
            {plans.canPlan&&<button type="button" disabled={pending||!resourceId}
              onClick={runPreview}>Preview slot</button>}
            {preview&&<div className={styles.preview}><strong>Server preview · job revision {preview.jobRevision}, technician revision {preview.resourceRevision}</strong>
              {preview.blockers.length?<ul className={styles.blocks}>{preview.blockers.map(x=><li key={x}>{displayIssue(x)}</li>)}</ul>
                :<p>No scheduling blockers for this tentative slot.</p>}
              {preview.warnings.length>0&&<><p><strong>Qualification warnings</strong></p>
                <ul>{preview.warnings.map(x=><li key={x}>{displayIssue(x)}</li>)}</ul>
                <label>Reason to proceed despite warning<textarea value={ackReason} rows={3}
                  onChange={e=>setAckReason(e.target.value)} placeholder="Explain the limited planning exception"/></label></>}
              <p>After this slot: {preview.crewAfterPlan}/{preview.crewRequired} people covering this window
                {preview.crewAfterPlan<preview.crewRequired?" · Partial crew":""}.</p>
              {preview.blockers.length===0&&<button type="button" disabled={pending||
                preview.warnings.length>0&&ackReason.trim().length<20} onClick={commit}>
                Reserve tentative slot</button>}</div>}
          </div>
        </section>
      </aside>
      <section className={styles.panel} aria-label="Planning calendar">
        <div className={styles.calendarHead}><div><h2>Planning calendar</h2><p>New York site time · tentative only</p></div>
          <div className={styles.controls}><label>Date<input type="date" value={day}
            onChange={e=>setDay(e.target.value)}/></label><div role="group" aria-label="Calendar view">
              <button type="button" aria-pressed={view==="day"} onClick={()=>setView("day")}>Day</button>
              <button type="button" aria-pressed={view==="week"} onClick={()=>setView("week")}>Week</button></div></div></div>
        <div className={styles.summary}><strong>{job?.jobCode??"No job selected"}</strong>
          <span>{dayPeople}/{job?.payload.requiredCrewSize??0} unique people planned on {shortDate(day)}</span>
          {job&&dayPeople<job.payload.requiredCrewSize&&<em>Partial crew · release remains blocked</em>}</div>
        <div className={reviewStyles.releaseReview}>
          <div><h3>D4 release readiness</h3><p>Inspect current server checks for this Work. This review cannot release or dispatch it.</p></div>
          <button type="button" disabled={!workId||pending} onClick={reviewReadiness}>Check readiness</button>
          {readinessStatus&&<p role="status">{readinessStatus}</p>}
          {readiness&&<div className={reviewStyles.releaseResult}>
            <strong>Blocked · Work v{readiness.workVersion}, job revision {readiness.jobRevision}</strong>
            <p>{readiness.plannedPeople} people have tentative slots; minimum coverage across the full job window is {readiness.minimumCrewAcrossWindow}/{readiness.requiredCrew}. {readiness.staleShifts} stale slots; {readiness.warningShifts} slots with qualification warnings.</p>
            <ul>{readiness.blockers.map(x=><li key={x}>{releaseReasons[x]??x}</li>)}</ul>
            <p>No D4 release action is available in this trial.</p>
          </div>}
        </div>
        <label className={styles.filter}>Filter technicians<input value={filter}
          onChange={e=>setFilter(e.target.value)} placeholder="Name, skill, grade or region"/></label>
        {view==="day"?<div className={styles.dayGrid}>
          <div className={styles.axis}><span>Technician</span><div className={styles.hours}>
            {Array.from({length:13},(_,i)=><small key={i}>{String(i+7).padStart(2,"0")}:00</small>)}</div></div>
          {visibleProfiles.map(person=><div className={styles.row} key={person.resourceId}>
            <div className={styles.person}><strong>{person.profile.name}</strong>
              <small>{person.profile.grade} · {person.profile.region}</small>
              <small>{person.profile.skills.join(", ")}</small></div>
            <div className={styles.track}>{selectedDayShifts.filter(x=>x.resourceId===person.resourceId)
              .map(shift=>{
                const a=siteParts(shift.startsAt),b=siteParts(shift.endsAt);
                const left=Math.max(0,Math.min(100,((a.hour+a.minute/60-7)/12)*100));
                const right=Math.max(0,Math.min(100,((b.hour+b.minute/60-7)/12)*100));
                return <button type="button" key={shift.id} className={styles.slot}
                  style={{left:`${left}%`,width:`${Math.max(right-left,5)}%`}}
                  title={`${a.time}–${b.time} · ${jobs.items.find(j=>j.workId===shift.workId)?.jobCode??"Job"} · tentative`}
                  onClick={()=>{setCancelId(shift.id);setCancelReason("");}}>
                  {a.time}–{b.time}</button>;
              })}</div></div>)}
        </div>:<div className={styles.weekGrid}><div className={styles.weekHeader}><strong>Technician</strong>
          {weekDates(day).map(d=><strong key={d}>{shortDate(d)}</strong>)}</div>
          {visibleProfiles.map(person=><div className={styles.weekRow} key={person.resourceId}>
            <strong>{person.profile.name}</strong>{weekDates(day).map(d=><div key={d}>
              {active.filter(x=>x.resourceId===person.resourceId&&siteParts(x.startsAt).date===d)
                .map(x=><button type="button" key={x.id} className={styles.weekSlot}
                  onClick={()=>{setCancelId(x.id);setCancelReason("");}}>
                  {siteParts(x.startsAt).time} · {jobs.items.find(j=>j.workId===x.workId)?.jobCode??"Job"}</button>)}</div>)}
          </div>)}</div>}
        {visibleProfiles.length===0&&<p>No technicians match this filter.</p>}
        {status&&<p role="status" className={styles.status}>{status}</p>}
        {cancelId&&<div className={styles.cancelBox}><strong>Cancel tentative slot</strong>
          <p>The slot remains in audit history. This does not cancel the job or any field release.</p>
          <label>Reason<textarea value={cancelReason} rows={2}
            onChange={e=>setCancelReason(e.target.value)} placeholder="Why is this planning slot being removed?"/></label>
          <div><button type="button" disabled={pending||cancelReason.trim().length<20}
            onClick={cancel}>Record cancellation</button>
            <button type="button" onClick={()=>setCancelId("")}>Keep slot</button></div></div>}
        <p className={styles.hint}>Changed job or technician revisions make existing plans stale for release review. No drag action or notification is connected to these tentative slots.</p>
        {active.some(x=>x.jobRevision!==x.currentJobRevision||
          x.resourceRevision!==x.currentResourceRevision)&&<p className={styles.stale}>
          A plan references an older job or technician revision and needs revalidation before release.</p>}
      </section>
    </div>
  </main>;
}
