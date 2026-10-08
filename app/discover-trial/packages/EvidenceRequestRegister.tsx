"use client";

import { useEffect,useRef,useState } from "react";
import { evidenceDisciplines,type D4EvidenceList,
  type EvidenceDiscipline } from "@/lib/d5o/d4-evidence-request-contract";
import { listEvidenceRequestsAction,recordEvidenceRequestAction,
  listStagedUploadsAction,stageEvidenceFileAction } from "./actions";
import type { StagedList } from "@/lib/d5o/d4-private-staging-trial";
import styles from "./evidence-requests.module.css";

const labels:Record<EvidenceDiscipline,string>={
  g3_scope:"G3 scope and authority",technical_design:"Technical design and method",
  hseq_access:"HSEQ and site access",supply_equipment:"Supply and equipment",
  certificate_policy:"Mandatory credentials",execution_pack:"Execution pack"};
type Loaded=Extract<D4EvidenceList,{status:"ok"}>;
type StagedLoaded=Extract<StagedList,{status:"ok"}>;
export function EvidenceRequestRegister({packageId,revision,jobRevision}:{
  packageId:string;revision:number;jobRevision:number}){
  const [loaded,setLoaded]=useState<Loaded|null>(null);
  const [status,setStatus]=useState("Loading evidence requests…");
  const [discipline,setDiscipline]=useState<EvidenceDiscipline>("technical_design");
  const [title,setTitle]=useState("");
  const [criterion,setCriterion]=useState("");
  const [pending,setPending]=useState(false);
  const [staged,setStaged]=useState<StagedLoaded|null>(null);
  const [uploadRequestId,setUploadRequestId]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [uploadPending,setUploadPending]=useState(false);
  const [uploadStatus,setUploadStatus]=useState("");
  const command=useRef<{key:string;id:string}|null>(null);
  const uploadCommand=useRef<{key:string;id:string}|null>(null);
  useEffect(()=>{
    let live=true;
    void listEvidenceRequestsAction(packageId).then(result=>{
      if(!live)return;
      if(result.status==="ok"){
        setLoaded(result);setStatus("");
      }else setStatus("Evidence requests could not be loaded.");
    });
    void listStagedUploadsAction(packageId).then(result=>{
      if(live&&result.status==="ok")setStaged(result);
    });
    return()=>{live=false;};
  },[packageId,revision]);
  async function refresh(){
    const result=await listEvidenceRequestsAction(packageId);
    if(result.status==="ok"){setLoaded(result);setStatus("");}
    else setStatus("Evidence requests could not be refreshed.");
    const uploads=await listStagedUploadsAction(packageId);
    if(uploads.status==="ok")setStaged(uploads);
  }
  async function upload(){
    if(uploadPending||!file||!uploadRequestId)return;
    const key=JSON.stringify({requestId:uploadRequestId,revision,jobRevision,
      name:file.name,size:file.size,lastModified:file.lastModified});
    if(!uploadCommand.current||uploadCommand.current.key!==key)
      uploadCommand.current={key,id:crypto.randomUUID()};
    const form=new FormData();
    form.set("file",file);form.set("requestId",uploadRequestId);
    form.set("packageRevision",String(revision));
    form.set("jobRevision",String(jobRevision));
    form.set("commandId",uploadCommand.current.id);
    setUploadPending(true);setUploadStatus("");
    try{
      const result=await stageEvidenceFileAction(form);
      if(result.status==="stored_pending_scan"){
        await refresh();setFile(null);uploadCommand.current=null;
        setUploadStatus("File stored privately with an audit receipt. Scanning is not configured; this file is not verified and cannot clear the package.");
      }else setUploadStatus(result.status==="stale"
        ?"The package or job changed. Reload before uploading."
        :result.status==="denied"?"This identity cannot upload for this package."
        :result.status==="invalid"?"Choose a supported file up to 1 MB."
        :result.status==="bytes_mismatch"?"Stored bytes did not match the selected file; no evidence was accepted."
        :"Private upload could not be confirmed. Retry the same file.");
    }finally{setUploadPending(false);}
  }
  async function record(){
    if(pending||!loaded?.canRequest)return;
    const key=JSON.stringify({packageId,revision,jobRevision,discipline,
      title:title.trim(),criterion:criterion.trim()});
    if(!command.current||command.current.key!==key)
      command.current={key,id:crypto.randomUUID()};
    setPending(true);setStatus("");
    try{
      const result=await recordEvidenceRequestAction({packageId,
        expectedRevision:revision,expectedJobRevision:jobRevision,
        discipline,title,acceptanceCriterion:criterion,
        commandId:command.current.id});
      if(result.status==="recorded"){
        await refresh();command.current=null;setTitle("");setCriterion("");
        setStatus("Evidence request recorded for this package revision. Evidence is still needed; no clearance or release was granted.");
      }else setStatus(result.status==="stale"
        ?"The package or job changed. Reload before requesting evidence."
        :result.status==="denied"?"This identity cannot request package evidence."
        :result.status==="invalid"?"Enter a specific title and acceptance criterion."
        :"The request could not be confirmed. Retry the unchanged request.");
    }finally{setPending(false);}
  }
  return <section className={styles.register}>
    <div className={styles.heading}><div><h3>Evidence requests</h3>
      <p>Specify what must be supplied for package v{revision}. A request is a missing item, not a verified file or discipline approval.</p></div>
      <button type="button" onClick={()=>void refresh()}>Refresh requests</button></div>
    {loaded&&<><p className={styles.count}>
      {loaded.items.filter(x=>x.status==="evidence_needed").length} current requests ·
      {" "}{loaded.items.filter(x=>x.status==="historical").length} retained from earlier revisions
    </p>
    {loaded.items.length===0?<p>No evidence has been requested for this package.</p>
      :<ul className={styles.list}>{loaded.items.map(item=><li key={item.id}>
        <div><strong>{item.title}</strong><span>{labels[item.discipline]} · package v{item.packageRevision} · job v{item.jobRevision}</span></div>
        <p>{item.acceptanceCriterion}</p>
        <b>{item.status==="historical"?"Historical request":"Evidence needed"}</b>
      </li>)}</ul>}
    {loaded.canRequest&&loaded.currentRevision===revision&&<div className={styles.form}>
      <h4>Request required evidence</h4>
      <label>Discipline<select value={discipline}
        onChange={e=>{setDiscipline(e.target.value as EvidenceDiscipline);command.current=null;}}>
        {evidenceDisciplines.map(key=><option key={key} value={key}>{labels[key]}</option>)}
      </select></label>
      <label>Required source or document<input value={title} maxLength={160}
        onChange={e=>{setTitle(e.target.value);command.current=null;}}
        placeholder="For example, approved method revision"/></label>
      <label>Acceptance criterion<textarea rows={3} value={criterion} maxLength={1000}
        onChange={e=>{setCriterion(e.target.value);command.current=null;}}
        placeholder="Describe what an independent reviewer must verify"/></label>
      <button type="button" disabled={pending||title.trim().length<8
        ||criterion.trim().length<20} onClick={()=>void record()}>
        {pending?"Recording…":"Record evidence request"}</button>
    </div>}
    {!loaded.canRequest&&<p className={styles.readOnly}>Read-only identity. Request recording requires an explicit package edit right.</p>}
    <div className={styles.staging}>
      <h4>Private file staging</h4>
      <p>Staged bytes are not accepted evidence. Scanning and independent verification remain unavailable in this trial.</p>
      {staged?.items.length?<ul className={styles.list}>{staged.items.map(item=><li key={item.evidenceId}>
        <div><strong>{item.filename}</strong><span>Package v{item.packageRevision} · job v{item.jobRevision}</span></div>
        <p>{item.uploadStatus==="uploaded"?`${item.sizeBytes} bytes stored privately`:
          "Upload intent recorded; file not confirmed"} · scan {item.scanStatus} · verification {item.verificationStatus}</p>
        <b>{item.current?"Cannot clear package":"Historical revision"}</b>
      </li>)}</ul>:<p>No package file has been staged.</p>}
      {loaded.canRequest&&loaded.currentRevision===revision&&<div className={styles.form}>
        <label>Evidence request<select value={uploadRequestId}
          onChange={e=>{setUploadRequestId(e.target.value);uploadCommand.current=null;}}>
          <option value="">Choose a current request</option>
          {loaded.items.filter(x=>x.status==="evidence_needed").map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
        </select></label>
        <label>File<input type="file" accept=".txt,.pdf,.png,.jpg,.jpeg,.webp"
          onChange={e=>{setFile(e.target.files?.[0]??null);uploadCommand.current=null;}}/></label>
        <button type="button" disabled={uploadPending||!uploadRequestId||!file}
          onClick={()=>void upload()}>{uploadPending?"Storing…":"Store private file"}</button>
      </div>}
      {uploadStatus&&<p role="status" className={styles.status}>{uploadStatus}</p>}
    </div>
    </>}
    {status&&<p role="status" className={styles.status}>{status}</p>}
  </section>;
}
