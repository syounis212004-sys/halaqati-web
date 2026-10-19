import fs from 'node:fs';import vm from 'node:vm';
const store=new Map();
const ctx={console,Date,Intl,Blob,URL,FileReader:function(){},confirm:()=>true,
  window:null,state:{user:{id:'u1'},profile:{role:'admin'},students:[{id:'s1',full_name:'محمود أسامة رضوان',status:'active',track_code:'general_hifz',category_id:'c1',halaqa_id:'h1'}],categories:[{id:'c1',name:'السنابل',active:true}],halaqas:[{id:'h1',name:'حلقة معاوية'}]},
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
  today:()=> '2026-09-06',monthStart:ym=>`${ym||'2026-09'}-01`,monthEnd:ym=>`${ym||'2026-09'}-30`,
  activeStudents:()=>[{id:'s1',full_name:'محمود أسامة رضوان',status:'active',track_code:'general_hifz',category_id:'c1',halaqa_id:'h1'}],
  esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),fmt:v=>String(v),offlineUuid:()=>`id-${Math.random()}`,roleCanManage:()=>true,studentTrackAr:{general_hifz:'مسار الحفظ العام'},render:()=>{},toast:()=>{},$ :()=>null,
  categoryName:s=>s.category_id==='c1'?'السنابل':'',db:{from(){throw new Error('network must not be called in page render')}}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/features/certificates/runtime.js','utf8'),ctx);
if(!ctx.HalaqatiCertificates)throw new Error('certificate runtime did not load');
const page=ctx.certificatesPage();
for(const text of ['مركز الشهادات','إصدار شهادة','PDF','أرشيف محلي','Cairo','إتمام سرد جزء / أجزاء'])if(!page.includes(text))throw new Error('UI missing '+text);
if(ctx.HalaqatiCertificates.idealScore({ethics:100,discipline:100,attendance:100,memorization:100})!==100)throw new Error('ideal score weighting failed');
const a=ctx.HalaqatiCertificates.nextCertificateNumber(true);if(a!=='HAL-CERT-2026-0001')throw new Error('certificate number peek failed: '+a);
const b=ctx.HalaqatiCertificates.nextCertificateNumber();if(b!=='HAL-CERT-2026-0001')throw new Error('certificate number commit failed: '+b);
const c=ctx.HalaqatiCertificates.nextCertificateNumber(true);if(c!=='HAL-CERT-2026-0002')throw new Error('certificate sequence failed: '+c);
console.log('v2.41.1 certificate VM smoke passed ✅');
