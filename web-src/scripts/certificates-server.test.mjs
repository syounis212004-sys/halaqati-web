import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function api(){const ctx={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../src/features/certificates/server.js',import.meta.url),'utf8'),ctx);return ctx.window.HalaqatiCertificateServer;}
const draft=()=>({serverId:'uuid',studentId:'s',studentName:'طالب',halaqaId:'h',type:'sard',date:'2026-10-19',title:'شهادة',achievement:'إنجاز',style:{primary:'#123456',titleSize:44,logo:'data:image/png;base64,secret'}});
const settings={centerName:'مركز',halaqaName:'حلقة',teacher:'معلم',supervisor:'مشرف',centerLogo:'data:image/png;base64,private'};
test('native snapshot includes text and style but no local image bytes',()=>{const s=api().snapshot(draft(),settings);assert.equal(s.schema,'halaqati_certificate_render_v2');assert.equal(s.student_id,'s');assert.equal(s.series_key,'sard');assert.ok(!JSON.stringify(s).includes('base64'));});
test('official issue creates draft once, retries same identity and trusts server number only',async()=>{
 const calls=[];const db={from:()=>({upsert:(row)=>{calls.push(['upsert',row]);return {select:()=>({single:async()=>({data:row})})}}}),rpc:async(n,p)=>{calls.push([n,p]);return {data:{id:'uuid',status:'issued',certificate_number:'HAL-CERT-2026-SRD-00001',render_snapshot:p.p_render_snapshot}}}};
 const a=api(),d=draft();const r=await a.issue(db,d,settings,'u');assert.equal(r.certificate_number,'HAL-CERT-2026-SRD-00001');assert.equal(calls[0][1].status,'draft');assert.equal(calls[1][0],'rc24_issue_certificate');assert.equal(calls[1][1].p_certificate_id,'uuid');
});
test('uses the same independent number series as Android',()=>{const a=api();for(const type of ['monthly','ideal','rank'])assert.equal(a.series({type}),type);});
test('restores Android footer number positions and visibility flags',()=>{const d=api().restore({student_name:'طالب',style:{number_position:'footer_start',show_number:true,show_logos:false,show_stamp:false},source:{}},{style:{}},{id:'c',student_id:'s',series_key:'rank',certificate_number:'OFFICIAL'});assert.ok(['bottom-left','bottom-right'].includes(d.style.numberPosition));assert.equal(d.style.showLogos,false);assert.equal(d.style.showStamp,false);assert.equal(d.type,'rank');});
test('pending draft serialization excludes in-flight promises',()=>{const d=api().serializableDraft({...draft(),_issuing:Promise.resolve({})});assert.ok(!('_issuing' in d));});
test('ambiguous issuance retry reads the committed revision rather than trusting edited input',async()=>{
 const canonical={schema:'halaqati_certificate_render_v2',student_name:'طالب',achievement:'committed'};
 const db={from:t=>t==='certificates'?{upsert:async()=>({})}:{select:()=>({eq(){return this},order(){return this},range:async(from)=>({data:from===0?[{id:'rev',render_snapshot:canonical}]:[]})})},rpc:async()=>({data:{id:'uuid',status:'issued',certificate_number:'OFFICIAL',current_revision_id:'rev'}})};
 const row=await api().issue(db,draft(),settings,'u');assert.equal(row.render_snapshot.achievement,'committed');
});
test('retry of issued record cannot overwrite it back to draft',async()=>{
 const d=draft();d.serverRecord={id:'uuid',status:'issued',student_id:'s',series_key:'sard',issue_date:d.date,certificate_number:'OFFICIAL'};
 const r=await api().issue({from:()=>{throw Error('must not upsert issued record')}},d,settings,'u');assert.equal(r.certificate_number,'OFFICIAL');
});
test('revision prevents changing student, series, or year',async()=>{
 const d=draft();const record={id:'uuid',student_id:'other',series_key:'sard',issue_date:d.date};
 await assert.rejects(()=>api().revise({},record,d,settings,'تصحيح'),/هوية/);
});
test('server error and missing confirmation propagate without local official fallback',async()=>{
 await assert.rejects(()=>api().void({rpc:async()=>({error:{message:'denied'}})},'uuid','reason'),/denied/);
 await assert.rejects(()=>api().void({rpc:async()=>({data:null})},'uuid','reason'),/الخادم/);
});
test('ranking includes students after position 300 and every capped page',async()=>{
 const ids=Array.from({length:321},(_,i)=>'s'+i);const records=ids.map(student_id=>({student_id,points:1}));
 const db={from(){let selected=[];return {select(){return this},in(_k,values){selected=values;return this},gte(){return this},lte(){return this},neq(){return this},eq(){return this},order(){return this},async range(from){return {data:records.filter(r=>selected.includes(r.student_id)).slice(from,from+13)}}}}};
 const out=await api().rankingData(db,ids,{from:'2026-10-01',to:'2026-10-31'},'all');assert.equal(out.recs.length,321);assert.equal(out.bonus.length,321);assert.ok(out.recs.some(x=>x.student_id==='s320'));
});
