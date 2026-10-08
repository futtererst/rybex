import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';import { resolve } from 'node:path';
import { clients,upload,receiptArgs,finalizeArgs,evidence,sql } from './fixtures.mjs';
const results=[];
try {
 const ctx=await clients();const item=await upload(ctx,'positive');const receipt=await receiptArgs(ctx,item);
 const recorded=await ctx.service.rpc('record_evidence_scan_receipt_v1',receipt);assert(!recorded.error,recorded.error?.message);assert(recorded.data.success);results.push({test:'trusted receipt',status:'PASS'});
 const args=finalizeArgs(item);const first=await ctx.field.rpc('finalize_evidence_upload_v1',args);assert(!first.error,first.error?.message);assert(first.data.success,JSON.stringify(first.data));
 const state=JSON.parse(sql(`select row_to_json(x) from (select upload_status,scan_status,verification_status,version from evidence_objects where id='${item.evidenceId}') x;`));assert.deepEqual(state,{upload_status:'uploaded',scan_status:'clean',verification_status:'pending',version:2});results.push({test:'atomic positive finalization',status:'PASS',state});
 const repeat=await ctx.field.rpc('finalize_evidence_upload_v1',args);assert(repeat.data.replayed);assert.equal(repeat.data.linkId,first.data.linkId);results.push({test:'idempotent replay',status:'PASS'});
 const mismatch=await ctx.field.rpc('finalize_evidence_upload_v1',{...args,p_relationship_type:'different'});assert.equal(mismatch.data.error,'idempotency_mismatch');results.push({test:'full payload mismatch',status:'PASS'});
 const n=sql(`select count(*) from evidence_links where evidence_object_id='${item.evidenceId}';`);assert.equal(n,'1');
 writeFileSync(resolve(evidence,'raw/finalization-results.json'),JSON.stringify({status:'PASS',results},null,2));console.log('Finalization proof PASS');
} catch(error){results.push({status:'FAIL',error:error.message});writeFileSync(resolve(evidence,'raw/finalization-results.json'),JSON.stringify({status:'FAIL',results},null,2));throw error;}
