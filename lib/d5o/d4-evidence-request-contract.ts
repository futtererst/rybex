export const evidenceDisciplines=["g3_scope","technical_design","hseq_access",
  "supply_equipment","certificate_policy","execution_pack"] as const;
export type EvidenceDiscipline=typeof evidenceDisciplines[number];
export type D4EvidenceRequest={id:string;discipline:EvidenceDiscipline;
  title:string;acceptanceCriterion:string;packageRevision:number;
  jobRevision:number;requestedBy:string;requestedAt:string;
  status:"evidence_needed"|"historical"};
export type D4EvidenceList={status:"ok";packageId:string;currentRevision:number;
  canRequest:boolean;items:D4EvidenceRequest[]}|
  {status:"denied"|"invalid"|"unavailable"};
export type D4EvidenceSave={status:"recorded";requestId:string;replayed:boolean}|
  {status:"denied"|"invalid"|"stale"|"conflict"|"unavailable"};
