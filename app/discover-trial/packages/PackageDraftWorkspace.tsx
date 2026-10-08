"use client";

import Link from "next/link";
import { useRef,useState } from "react";
import type { RmJob } from "@/lib/d5o/rm02-trial";
import type { D4Package,D4PackageList,D4PackagePayload } from "@/lib/d5o/d4-package-trial";
import type { D4FieldList } from "@/lib/d5o/d4-buildability-trial";
import type { D4ClearanceMatrix } from "@/lib/d5o/d4-clearance-matrix-trial";
import { listPackagesAction,savePackageAction,listFieldReviewsAction,
  submitFieldReviewAction,respondFieldReviewAction,packageMatrixAction } from "./actions";
import styles from "./packages.module.css";
import reviewStyles from "./field-review.module.css";
import matrixStyles from "./clearance-matrix.module.css";
import { EvidenceRequestRegister } from "./EvidenceRequestRegister";

type Loaded=Extract<D4PackageList,{status:"ok"}>;
type FieldLoaded=Extract<D4FieldList,{status:"ok"}>;
const keys:[keyof D4PackagePayload,string,number][]=[
  ["scopeSummary","Proposed package scope",4],
  ["siteZone","Site zone",1],
  ["methodReference","Proposed design or method reference",1],
  ["hazardNotes","Hazards and draft controls",3],
  ["permitNotes","Permit and access needs",3],
  ["materialNotes","Materials and tools needed",3],
  ["testInstructions","Test and acceptance instructions",3],
  ["holdPoints","Hold points",3],
  ["contingency","Contingency and escalation",3],
];
function empty(job:RmJob):D4PackagePayload{
  return {scopeSummary:"",siteZone:job.siteName,methodReference:"",
    hazardNotes:"",permitNotes:"",materialNotes:"",testInstructions:"",
    holdPoints:"",contingency:"",plannedStart:job.payload.scheduledStart,
    plannedEnd:job.payload.scheduledEnd};
}
const localInput=(x:string)=>x?x.slice(0,16):"";
const utcValue=(x:string)=>x?`${x}:00Z`:"";
const errors:Record<string,string>={
  denied:"This identity has no explicit right to edit package drafts.",
  invalid:"Check the scope, site zone and package window. The window must fit inside the current job.",
  stale:"The job changed. Reload the current job before editing this package.",
  conflict:"This package changed. Reload its latest revision before retrying.",
  unavailable:"The result could not be confirmed. Retry the unchanged request.",
};
export function PackageDraftWorkspace({jobs,job,packages,fieldReviews,initialMatrix}:{
  jobs:RmJob[];job:RmJob;packages:Loaded;fieldReviews:FieldLoaded;
  initialMatrix:D4ClearanceMatrix|null}){
  const [items,setItems]=useState(packages.items);
  const [selected,setSelected]=useState<string|null>(packages.items[0]?.id??null);
  const current=items.find(x=>x.id===selected);
  const [payload,setPayload]=useState<D4PackagePayload>(current?.payload??empty(job));
  const [status,setStatus]=useState("");
  const [pending,setPending]=useState(false);
  const [reviews,setReviews]=useState(fieldReviews.items);
  const [reviewStatus,setReviewStatus]=useState("");
  const [reviewReason,setReviewReason]=useState("");
  const [disposition,setDisposition]=useState<"reviewed"|"returned">("reviewed");
  const [reviewPending,setReviewPending]=useState(false);
  const [matrix,setMatrix]=useState(initialMatrix);
  const [matrixStatus,setMatrixStatus]=useState("");
  const matrixRequest=useRef(0);
  const command=useRef<{key:string;id:string}|null>(null);
  const submitCommand=useRef<{key:string;id:string}|null>(null);
  const responseCommand=useRef<{key:string;id:string}|null>(null);
  const currentReview=current&&reviews.find(x=>x.packageId===current.id
    &&x.packageRevision===current.revision);
  const reviewHistory=selected?reviews.filter(x=>x.packageId===selected):[];
  async function refreshMatrix(packageId:string){
    const request=++matrixRequest.current;
    const result=await packageMatrixAction(packageId);
    if(request!==matrixRequest.current)return;
    if(result.status==="ok")setMatrix(result.matrix);
    else {setMatrix(null);setMatrixStatus("Package controls could not be loaded.");}
  }
  function choose(x:D4Package|null){
    matrixRequest.current++;
    setSelected(x?.id??null);setPayload(x?.payload??empty(job));
    setStatus("");setReviewStatus("");setReviewReason("");
    setMatrix(null);setMatrixStatus("");
    command.current=null;submitCommand.current=null;responseCommand.current=null;
    if(x)void refreshMatrix(x.id);
  }
  function change(key:keyof D4PackagePayload,value:string){
    setPayload(p=>({...p,[key]:value}));setStatus("");command.current=null;
    if(matrix)setMatrixStatus("Unsaved edits are not part of the current matrix. Save the draft to recalculate controls.");
  }
  async function save(){
    if(!packages.canEdit||pending)return;
    const key=JSON.stringify({workId:job.workId,packageId:selected,
      expectedRevision:current?.revision??0,expectedJobRevision:job.revision,payload});
    if(!command.current||command.current.key!==key)
      command.current={key,id:crypto.randomUUID()};
    setPending(true);setStatus("");
    try{
      const result=await savePackageAction({workId:job.workId,packageId:selected,
        expectedRevision:current?.revision??0,expectedJobRevision:job.revision,
        commandId:command.current.id,payload});
      if(result.status==="saved"){
        const refreshed=await listPackagesAction(job.workId);
        if(refreshed.status==="ok"){
          setItems(refreshed.items);setSelected(result.packageId);
          setPayload(refreshed.items.find(x=>x.id===result.packageId)?.payload??payload);
          command.current=null;
          const currentReviews=await listFieldReviewsAction(job.workId);
          if(currentReviews.status==="ok")setReviews(currentReviews.items);
          await refreshMatrix(result.packageId);
          setStatus(`Draft revision ${result.revision} saved with an audit receipt. No clearance or release was granted.`);
        }else setStatus("Saved, but the list could not be refreshed. Reload to confirm the current revision.");
      }else setStatus(errors[result.status]??"The package was not confirmed.");
    }finally{setPending(false);}
  }
  async function sendForReview(){
    if(!current||reviewPending)return;
    const key=JSON.stringify({packageId:current.id,revision:current.revision,
      jobRevision:job.revision});
    if(!submitCommand.current||submitCommand.current.key!==key)
      submitCommand.current={key,id:crypto.randomUUID()};
    setReviewPending(true);setReviewStatus("");
    try{
      const result=await submitFieldReviewAction({workId:job.workId,
        packageId:current.id,expectedPackageRevision:current.revision,
        expectedJobRevision:job.revision,commandId:submitCommand.current.id});
      if(result.status==="submitted"){
        const refreshed=await listFieldReviewsAction(job.workId);
        if(refreshed.status==="ok")setReviews(refreshed.items);
        await refreshMatrix(current.id);
        submitCommand.current=null;
        setReviewStatus("This exact draft revision is pending field-supervisor buildability review. No D4 release was requested.");
      }else setReviewStatus(result.status==="incomplete"
        ?"Add a proposed method, hazard controls and hold points before field review."
        :errors[result.status]??"Field review submission could not be confirmed.");
    }finally{setReviewPending(false);}
  }
  async function respond(){
    if(!currentReview||reviewReason.trim().length<20||reviewPending)return;
    const key=JSON.stringify({submissionId:currentReview.submissionId,
      disposition,reason:reviewReason.trim()});
    if(!responseCommand.current||responseCommand.current.key!==key)
      responseCommand.current={key,id:crypto.randomUUID()};
    setReviewPending(true);setReviewStatus("");
    try{
      const result=await respondFieldReviewAction({
        submissionId:currentReview.submissionId,disposition,
        reason:reviewReason,commandId:responseCommand.current.id});
      if(result.status==="responded"){
        const refreshed=await listFieldReviewsAction(job.workId);
        if(refreshed.status==="ok")setReviews(refreshed.items);
        await refreshMatrix(currentReview.packageId);
        responseCommand.current=null;setReviewReason("");
        setReviewStatus(disposition==="reviewed"
          ?"Buildability review recorded for this frozen draft only. Other D4 clearances and release remain blocked."
          :"Returned to the draft author with the reason retained. Revise and resubmit a new package version.");
      }else setReviewStatus(result.status==="stale"
        ?"The package or job changed. Reload its current revision before responding."
        :errors[result.status]??"Field response could not be confirmed.");
    }finally{setReviewPending(false);}
  }
  return <main className={styles.shell}>
    <nav><Link href="/discover-trial">Discover</Link> / <Link href="/discover-trial/jobs">Field jobs</Link> / <Link href="/discover-trial/dispatch">Crew planning</Link> / Package drafts</nav>
    <header><p className={styles.eyebrow}>D4 · preparation only</p>
      <h1>Work-package drafts</h1>
      <p>Break the job into scoped packages. Draft content is a proposal until its source, discipline clearances and release authority are recorded.</p></header>
    <div className={styles.hold}><strong>Release hold:</strong> A saved package draft does not approve the method, clear hazards, authorize spending, or dispatch a crew. G3 and D4 authority remain unconnected.</div>
    <div className={styles.layout}>
      <aside className={styles.aside}>
        <section className={styles.card}><h2>Field jobs</h2>
          {jobs.map(x=><Link key={x.workId}
            className={x.workId===job.workId?styles.chosen:""}
            href={`/discover-trial/packages?workId=${x.workId}`}>
            <strong>{x.jobCode}</strong><span>{x.siteName} · {x.accountName}</span></Link>)}
        </section>
        <section className={styles.card}><h2>Packages on this Work</h2>
          <p>Work {job.workId} · job revision {job.revision}</p>
          {items.map(x=><button type="button" key={x.id}
            className={selected===x.id?styles.chosen:""} onClick={()=>choose(x)}>
            <strong>{x.code} · draft v{x.revision}</strong>
            <span>{x.payload.siteZone} · {x.payload.scopeSummary}</span></button>)}
          {items.length===0&&<p>No package draft has been saved.</p>}
          {packages.canEdit&&<button type="button" onClick={()=>choose(null)}>+ New package draft</button>}
        </section>
      </aside>
      <section className={styles.card}>
        <h2>{current?`${current.code} · revision ${current.revision}`:"New package draft"}</h2>
        <p className={styles.explainer}>Each package has its own ID and revision; the Work ID stays the same. Text below records proposed requirements, not verified approvals or evidence.</p>
        {!packages.canEdit&&<p className={styles.readOnly}>Read-only identity. Draft editing requires an explicit right.</p>}
        <div className={styles.form}>
          {keys.map(([key,label,rows])=><label key={key}>{label}
            {rows===1?<input value={payload[key]} disabled={!packages.canEdit}
              onChange={e=>change(key,e.target.value)}/>
              :<textarea rows={rows} value={payload[key]} disabled={!packages.canEdit}
                onChange={e=>change(key,e.target.value)}/>}</label>)}
          <div className={styles.pair}>
            <label>Package starts · UTC<input type="datetime-local"
              value={localInput(payload.plannedStart)} disabled={!packages.canEdit}
              onChange={e=>change("plannedStart",utcValue(e.target.value))}/></label>
            <label>Package ends · UTC<input type="datetime-local"
              value={localInput(payload.plannedEnd)} disabled={!packages.canEdit}
              onChange={e=>change("plannedEnd",utcValue(e.target.value))}/></label>
          </div>
          {packages.canEdit&&<button type="button" disabled={pending||
            payload.scopeSummary.trim().length<20||payload.siteZone.trim().length<2}
            onClick={save}>{pending?"Saving…":"Save draft revision"}</button>}
          {status&&<p role="status" className={styles.status}>{status}</p>}
        </div>
        {current&&<section className={reviewStyles.review}>
          <h3>Field buildability review</h3>
          <p>A separate field supervisor reviews the frozen package scope and sequence. This is not technical design approval, HSEQ clearance or release.</p>
          {currentReview?<div className={reviewStyles.reviewState}>
            <strong>{currentReview.disposition===null?"Pending field response":
              currentReview.disposition==="reviewed"?"Buildability reviewed":"Returned for correction"} · package v{currentReview.packageRevision}</strong>
            <p>Frozen scope: {currentReview.frozenPayload.scopeSummary}</p>
            <p>Frozen method: {currentReview.frozenPayload.methodReference}</p>
            <p>Frozen hazards: {currentReview.frozenPayload.hazardNotes}</p>
            {currentReview.reason&&<p>Response reason: {currentReview.reason}</p>}
          </div>:<p>No field review for this package revision.</p>}
          {fieldReviews.canSubmit&&!currentReview&&<button type="button"
            disabled={reviewPending||pending} onClick={sendForReview}>
            Send revision {current.revision} for field review</button>}
          {fieldReviews.canRespond&&currentReview?.disposition===null
            &&currentReview.currentPackageRevision===currentReview.packageRevision
            &&currentReview.currentJobRevision===currentReview.jobRevision&&<div className={reviewStyles.responseForm}>
            <label>Field response<select value={disposition}
              onChange={e=>setDisposition(e.target.value as "reviewed"|"returned")}>
              <option value="reviewed">Reviewed buildability of this draft</option>
              <option value="returned">Return for correction</option>
            </select></label>
            <label>Specific reason<textarea rows={3} value={reviewReason}
              onChange={e=>{setReviewReason(e.target.value);responseCommand.current=null;}}
              placeholder="Describe the sequence checked or the correction needed"/></label>
            <button type="button" disabled={reviewPending||reviewReason.trim().length<20}
              onClick={respond}>Record field response</button>
          </div>}
          {currentReview?.disposition===null
            &&(currentReview.currentPackageRevision!==currentReview.packageRevision
              ||currentReview.currentJobRevision!==currentReview.jobRevision)
            &&<p className={styles.readOnly}>This submission is stale; it cannot be reviewed. Submit the current package revision.</p>}
          {reviewHistory.length>1&&<p>{reviewHistory.length} retained submissions on this package. Earlier responses remain in audit history.</p>}
          {reviewStatus&&<p role="status" className={styles.status}>{reviewStatus}</p>}
        </section>}
        {current&&<section className={matrixStyles.matrix}>
          <div className={matrixStyles.heading}><div><h3>Package clearance matrix</h3>
            <p>Current source records for package v{current.revision}. A reviewed field sequence does not clear the other disciplines.</p></div>
            <button type="button" onClick={()=>void refreshMatrix(current.id)}>Refresh controls</button></div>
          {matrixStatus&&<p role="status">{matrixStatus}</p>}
          {matrix&&<><div className={matrixStyles.summary}>
            <strong>Release blocked</strong><span>Minimum crew {matrix.minimumCrewAcrossWindow}/{matrix.requiredCrew}</span>
            <span>{matrix.custodyCandidates} accepted, scanned custody candidates linked to this package</span></div>
            <div className={matrixStyles.rows}>{matrix.rows.map(row=><div key={row.key}
              className={matrixStyles.row}><div><strong>{row.label}</strong>
                <p>{row.detail}</p>{row.sourceId&&<small>Source response {row.sourceId}</small>}</div>
              <span data-status={row.status}>{row.status.replaceAll("_"," ")}</span></div>)}</div>
            <p className={matrixStyles.foot}>Technical, HSEQ, supply and access remain uncommissioned. This matrix records current gaps; it cannot authorize package release.</p>
          </>}
        </section>}
        {current&&<EvidenceRequestRegister key={`${current.id}:${current.revision}`}
          packageId={current.id} revision={current.revision}
          jobRevision={job.revision}/>}
      </section>
    </div>
  </main>;
}
