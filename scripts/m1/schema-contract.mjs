import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const normalize=s=>s.replaceAll('\r\n','\n').replace(/^\\(?:un)?restrict .*$/gm,'');
function blocks(s){return normalize(s).split(/(?=^--\n-- Name: )/m).map(x=>x.trim()).filter(Boolean);}
function header(s){return s.split('\n')[1]??'<preamble>';}
export function compareSchema(baseline,current,utcDate){
 const old=blocks(baseline),now=blocks(current);const map=new Map(old.map(x=>[header(x),x]));assert.equal(map.size,old.length,'duplicate baseline schema header');const names=new Set();const additions=[];const retained=[];
 for(const block of now){const name=header(block);assert(!names.has(name),'duplicate current schema header');names.add(name);if(map.has(name)){assert.equal(block,map.get(name),'changed schema block: '+name);retained.push(block);}else additions.push(block);}
 assert.deepEqual(retained,old,'removed or reordered baseline schema blocks');
 if(!additions.length)return {status:'PASS',mode:'EXACT',baselineSha256:sha(normalize(baseline)),currentSha256:sha(normalize(current)),unchangedBlocks:old.length,addedBlocks:[]};
 assert(/^\d{4}-\d{2}-\d{2}$/.test(utcDate),'explicit UTC date required');
 const day=new Date(utcDate+'T00:00:00Z');const dated=offset=>new Date(day.getTime()+offset*86400000).toISOString().slice(0,10);const next=dated(3),end=dated(4),previous=dated(2);
 const newName='messages_'+next.replaceAll('-','_'),oldName='messages_'+previous.replaceAll('-','_');
 // The sealed run crosses one UTC day. Permit only the new +3-day child, generated exactly from the existing prior-day child.
 assert.equal(additions.length,7,'unexpected platform partition object count');
 const template=old.filter(x=>header(x).includes(oldName));assert.equal(template.length,7,'missing sealed prior-day partition template');
 const substitutions=new Map([[oldName,newName],[previous,next],[next,end]]);const regex=new RegExp([...substitutions.keys()].join('|'),'g');
 const expected=template.map(x=>x.replace(regex,y=>substitutions.get(y))).sort();assert.deepEqual([...additions].sort(),expected,'unexpected partition definition, boundary, owner, index or ACL');
 assert(additions.every(x=>header(x).includes('Schema: realtime;')),'non-Realtime addition');
 return {status:'PASS',mode:'EXPECTED_REALTIME_DATE_PARTITION',utcDate,partition:newName,range:[next,end],baselineSha256:sha(normalize(baseline)),currentSha256:sha(normalize(current)),unchangedBlocks:old.length,addedBlocks:additions.map(header),comparison:'Every existing ordered schema block is byte-identical after transport normalization; all seven added blocks equal the sealed partition template with dates advanced one day.'};
}
