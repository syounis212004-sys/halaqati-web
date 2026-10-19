import {chromium} from 'playwright';import fs from 'node:fs';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});await context.route(/https:\/\//,route=>route.abort());const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept('سبب الاختبار'));
await page.goto(process.env.BASE_URL||'http://localhost:4173/');await page.waitForFunction(()=>!!window.HalaqatiCertificateServer);await page.locator('#rc27Splash').evaluate(e=>e.remove()).catch(()=>{});
await page.evaluate(()=>{
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;state.user={id:id(1)};state.profile={id:id(1),role:'admin',active:true,approval_status:'approved',full_name:'حساب اختبار'};state.halaqas=[{id:id(2),name:'حلقة اختبار',active:true,halaqa_type:'regular'}];state.students=[3,4].map(n=>({id:id(n),halaqa_id:id(2),full_name:'طالب '+n,status:'active',track_code:'general_hifz'}));state.offline=false;state.networkVerified=true;document.getElementById('auth').classList.add('hidden');document.getElementById('app').classList.remove('hidden');
 window.__tables={certificates:[],certificate_revisions:[]};window.__exports=[];window.__prints=[];const copy=x=>JSON.parse(JSON.stringify(x));
 db.from=function(table){const filters=[];let mutation=null,patch=null,options={},start=0,end=Infinity;
  const rows=()=> (window.__tables[table]||[]).filter(r=>filters.every(([k,v])=>r[k]===v));
  const result=()=>{let r=rows();if(mutation==='upsert'){let found=(window.__tables[table]||=[]).find(r=>r.id===patch.id);if(!found){found=copy(patch);window.__tables[table].push(found)}else if(!options.ignoreDuplicates)Object.assign(found,copy(patch));r=[found]}else if(mutation==='update')r.forEach(x=>Object.assign(x,copy(patch)));return {data:copy(r.slice(start,end+1)),error:null}};
  const q={select(){return q},eq(k,v){filters.push([k,v]);return q},neq(){return q},in(){return q},gte(){return q},lte(){return q},order(){return q},limit(){return q},range(a,b){start=a;end=b;return q},upsert(p,o={}){mutation='upsert';patch=p;options=o;return q},update(p){mutation='update';patch=p;return q},single(){const r=result();return Promise.resolve({...r,data:r.data[0]||null})},maybeSingle(){return q.single()},then(a,b){return Promise.resolve(result()).then(a,b)}};return q;
 };
 db.rpc=async function(name,p){
  const tables=window.__tables,records=tables.certificates,revisions=tables.certificate_revisions;let row=records.find(x=>x.id===p.p_certificate_id);
  if(name==='rc24_issue_certificate'){
   if(row.status==='issued')return {data:copy(row)};
   const rid=crypto.randomUUID(),number='HAL-CERT-2026-'+p.p_series_key+'-'+records.length,snap={...p.p_render_snapshot,official_number:number};
   Object.assign(row,{status:'issued',certificate_number:number,current_revision_id:rid,revision_count:1});revisions.push({id:rid,certificate_id:row.id,revision_no:1,render_snapshot:snap});
   if(window.__loseIssueResponse){window.__loseIssueResponse=false;return {error:{message:'simulated lost response'}}}
   return {data:{...copy(row),render_snapshot:snap}};
  }
  if(name==='rc24_void_certificate'){Object.assign(row,{status:'voided',void_reason:p.p_reason});return {data:copy(row)}}
  if(name==='rc24_create_certificate_revision'){const rid=crypto.randomUUID(),rev={id:rid,certificate_id:row.id,revision_no:row.revision_count+1,render_snapshot:{...p.p_render_snapshot,official_number:row.certificate_number}};revisions.push(rev);row.current_revision_id=rid;row.revision_count=rev.revision_no;return {data:copy(rev)}}
  return {data:[],error:null};
 };
 window.__realExport=window.HalaqatiCertificatePdf.saveElement;
 window.HalaqatiCertificatePdf.saveElement=async function(paper,filename){if(window.__failExportOnce){window.__failExportOnce=false;throw Error('simulated PDF failure')}window.__exports.push({text:paper.textContent,filename});return {filename,bytes:10}};
 window.HalaqatiVectorPdf.printElement=async paper=>window.__prints.push(paper.textContent);
 go('certificates');
});
// An ambiguous RPC success must restore the committed text before printing.
await page.evaluate(async()=>{certReset('sard');certSet('achievement','النص الرسمي الأصلي');window.__loseIssueResponse=true;await certIssueToArchive();certSet('achievement','نص غير محفوظ على الخادم');await certIssueToArchive();await certSavePdf()});
assert.equal(await page.evaluate(()=>__tables.certificates.length),1);assert.ok((await page.evaluate(()=>__exports.at(-1).text)).includes('النص الرسمي الأصلي'));assert.ok(!(await page.evaluate(()=>__exports.at(-1).text)).includes('نص غير محفوظ'));
// A void on the same device or another device blocks official export.
await page.evaluate(async()=>{await certRefreshCentral();await certVoidCentral(__tables.certificates[0].id);await certPrint()});assert.equal(await page.evaluate(()=>__prints.length),0);
// Batch renders independently of the batch tab and produces one PDF per selected student.
await page.evaluate(async()=>{certReset('monthly');certTab('batch');for(const s of state.students)certBatchToggle(s.id,true);await certBatchIssue()});
assert.equal(await page.evaluate(()=>__tables.certificates.length),3);assert.equal(await page.evaluate(()=>__exports.length),3);
// Retrying a failed PDF export reuses the already issued official identity.
await page.evaluate(async()=>{certReset('ideal');certSet('reason','اختبار إعادة المحاولة');certTab('batch');certBatchToggle(state.students[0].id,true);window.__failExportOnce=true;await certBatchIssue()});
const count=await page.evaluate(()=>__tables.certificates.length);await page.evaluate(async()=>await certBatchIssue());assert.equal(await page.evaluate(()=>__tables.certificates.length),count);assert.equal(await page.evaluate(()=>__exports.length),4);
// Exercise the actual local Arabic PDF engine as well as the isolated server-contract fixtures.
const out=process.env.ARTIFACTS_DIR||'.artifacts';fs.mkdirSync(out,{recursive:true});
const downloaded=page.waitForEvent('download');
await page.evaluate(async()=>{certReset('rank');certTab('issue');certSet('achievement','نص اختبار تصدير شهادة باللغة العربية');window.HalaqatiCertificatePdf.saveElement=window.__realExport;await certSavePdf()});
const file=await downloaded;await file.saveAs(out+'/halaqati-arabic-fixture.pdf');assert.ok(fs.statSync(out+'/halaqati-arabic-fixture.pdf').size>10000);
// Dirty local work blocks reload; installation helper remains available without prompt support.
assert.equal(await page.evaluate(()=>{const f=document.getElementById('loginForm');f.dataset.dirty='1';const d=document.createElement('dialog');d.appendChild(f);document.body.appendChild(d);d.showModal();return halaqatiHasPendingWork()}),true);
assert.deepEqual(errors,[]);console.log('Browser behavior: canonical issue retry, void protection, batch PDF creation, idempotent PDF retry, and dirty-work update guard PASS');await browser.close();
