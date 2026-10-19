import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const src=fs.readFileSync(new URL('../src/features/master-data/runtime.js',import.meta.url),'utf8');
let queue=[];
const ctx={
  console, setTimeout:()=>0,
  navigator:{onLine:false},
  state:{user:{id:crypto.randomUUID()},networkVerified:false,halaqas:[],categories:[],students:[],sessions:[],offlineRosterCache:{},guardianAccounts:[],pendingSync:0},
  cloneJson:v=>JSON.parse(JSON.stringify(v)),
  offlineUuid:()=>crypto.randomUUID(),
  normalizeOfflineOperation:o=>({...o,id:o.id||crypto.randomUUID(),dedupeKey:o.dedupeKey||o.key,status:o.status||'pending',attempts:o.attempts||0,order:o.order||Date.now()}),
  readOfflineQueue:()=>queue,
  writeOfflineQueue:q=>{queue=q.map(x=>({...x}));ctx.state.pendingSync=queue.length},
  enqueueOffline:o=>{let x=ctx.normalizeOfflineOperation(o),i=queue.findIndex(q=>q.dedupeKey===x.dedupeKey);if(i>=0){x.id=queue[i].id;x.baseUpdatedAt=x.baseUpdatedAt??queue[i].baseUpdatedAt;queue[i]=x}else queue.push(x);ctx.state.pendingSync=queue.length;return x},
  cacheSnapshot:()=>{}, updateSyncBadge:()=>{}, syncOfflineQueue:()=>{}, toast:()=>{}, render:()=>{}, renderSyncStatusDialog:()=>{}, loadAll:async()=>{},
  sessionIdForOfflineOp:op=>op?.payload?.session_id||op?.payload?.sessionId||op?.localId||null,
  db:{from:()=>({}),rpc:async()=>({error:null}),storage:{from:()=>({remove:async()=>({}),upload:async()=>({error:null})})}},
  serverWriteReady:async()=>false
};
vm.createContext(ctx);vm.runInContext(src,ctx,{filename:'master-data/runtime.js'});
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};
const h=await ctx.saveMasterLocal('halaqa','',{name:'حلقة اختبار',description:null,location:null,schedule_text:null,supervisor_id:null,active:true});
const c=await ctx.saveMasterLocal('category','',{halaqa_id:h.id,name:'ناشئة',min_age:10,max_age:14,description:null,active:true,created_by:ctx.state.user.id});
for(let i=0;i<100;i++)await ctx.saveMasterLocal('student','',{halaqa_id:h.id,full_name:`طالب ${i+1}`,category_id:c.id,status:'active',enrollment_date:'2026-08-30',target_pages_weekly:7});
must(ctx.state.halaqas.length===1&&ctx.state.categories.length===1&&ctx.state.students.length===100,'local master rows not created');
must(queue.length===102,'expected 102 deduped master upserts');
let sid=ctx.state.students[0].id;await ctx.saveMasterLocal('student',sid,{phone:'0590000001'});await ctx.saveMasterLocal('student',sid,{phone:'0590000002'});
must(queue.length===102,'student edits must dedupe');
must(queue.find(x=>x.entity==='student'&&x.entityId===sid).payload.phone==='0590000002','latest edit not kept');
let ordered=[...queue].sort((a,b)=>ctx.masterOfflinePriority(a)-ctx.masterOfflinePriority(b));
must(ordered[0].entity==='halaqa'&&ordered[1].entity==='category'&&ordered[2].entity==='student','dependency ordering incorrect');
await ctx.deleteMasterLocal('halaqa',h.id,{cascade:true});
must(ctx.state.halaqas.length===0&&ctx.state.categories.length===0&&ctx.state.students.length===0,'local cascade delete failed');
must(queue.length===0,'never-synced halaqa cascade must leave no server tombstone');
// Existing student: withdraw + permanent delete keeps update before tombstone.
const h2={id:crypto.randomUUID(),name:'حلقة خادم',updated_at:'2026-08-30T05:00:00.000Z'};ctx.state.halaqas.push(h2);
const s2={id:crypto.randomUUID(),halaqa_id:h2.id,full_name:'طالب خادم',status:'active',updated_at:'2026-08-30T05:00:00.000Z'};ctx.state.students.push(s2);
await ctx.saveMasterLocal('student',s2.id,{status:'withdrawn',withdrawn_at:'2026-08-30T06:00:00.000Z',withdrawn_by:ctx.state.user.id});
await ctx.deleteMasterLocal('student',s2.id);
must(queue.some(x=>x.type==='master_upsert'&&x.entity==='student'&&x.entityId===s2.id),'withdraw upsert lost before delete');
must(queue.some(x=>x.type==='master_delete'&&x.entity==='student'&&x.entityId===s2.id),'student delete tombstone missing');
must(ctx.masterSameStamp('2026-08-30T05:00:00.000Z','2026-08-30T05:00:00.000Z'),'equal timestamp comparison failed');
must(!ctx.masterSameStamp('2026-08-30T05:00:00.000Z','2026-08-30T05:00:00.300Z'),'different server timestamps must conflict');
console.log('MASTER_OFFLINE_V2141_MODEL_SMOKE_PASS');
