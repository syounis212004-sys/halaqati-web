/* Security regression (audit fingerprint offline-outbox-not-bound-to-account-replays-under-next-login) + data-loss guarantees.
   Behaviour tests: the real outbox code of rc27/phases.js and rc53/runtime.js is sliced out of the source and run in a vm with stubbed storage/db. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const rd=p=>fs.readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const slice=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b);assert.ok(i>=0&&j>i,'markers '+a);return s.slice(i,j)};
const DAY=864e5;
function phases(user='A'){
  const code=slice(rd('features/rc27/phases.js'),"const QK='halaqati_phase_outbox_v1'","// ================= native parity");
  const store={},calls=[];let n=0;
  const ctx={state:{user:{id:user},networkVerified:true,offline:false,page:'x'},S:{plans:[],phases:[],states:[],templates:[]},toasts:[],toast(m){ctx.toasts.push(m)},load:async()=>{},render(){},confirm:()=>true,
    navigator:{onLine:true},crypto:{randomUUID:()=>'id'+(++n)},setTimeout:f=>0,setInterval(){},window:{addEventListener(){}},console,Date,JSON,Set,Error,Promise,
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{if(ctx.full)throw new Error('quota');store[k]=String(v)},removeItem:k=>{delete store[k]}},
    db:{from:t=>({upsert:async()=>{if(!ctx.fail)calls.push([t,ctx.state.user.id]);return {error:ctx.fail?{message:ctx.fail}:null}},update:()=>({eq:async()=>({error:null})})}),rpc:async()=>({error:null})}};
  vm.createContext(ctx);vm.runInContext(code+';this.api={send,flush,readQ,writeQ,QK}',ctx);return {ctx,store,calls,q:()=>ctx.api.readQ()};
}
const op=(o={})=>({kind:'upsert',table:'smart_plans',obj:{},onConflict:'id',...o});
test('A queues offline, B logs in: B never sends it, A still has it and sends it under A',async()=>{
  const t=phases('A');t.ctx.navigator.onLine=false;await t.ctx.api.send(op());assert.equal(t.q()[0].u,'A');
  t.ctx.navigator.onLine=true;t.ctx.state.user={id:'B'};await t.ctx.api.flush();assert.equal(t.calls.length,0);assert.equal(t.q().length,1);
  assert.equal(t.ctx.window.rc27PhaseQueueCount(),0,'B sees no pending count for A');
  t.ctx.state.user={id:'A'};assert.equal(t.ctx.window.rc27PhaseQueueCount(),1);await t.ctx.api.flush();assert.deepEqual(t.calls,[['smart_plans','A']]);assert.equal(t.q().length,0)});
test('offline for more than 7 days loses nothing: own and foreign ops survive any age, own op still uploads',async()=>{
  const t=phases('A');t.store[t.ctx.api.QK]=JSON.stringify([op({id:'mine',at:Date.now()-30*DAY,u:'A'}),op({id:'theirs',at:Date.now()-30*DAY,u:'B'})]);
  t.ctx.fail='Failed to fetch';await t.ctx.api.flush();assert.deepEqual(t.q().map(o=>o.id),['mine','theirs'],'kept while the network fails');
  t.ctx.fail=null;await t.ctx.api.flush();assert.deepEqual(t.q().map(o=>o.id),['theirs'],'own op uploaded, foreign op still kept');assert.deepEqual(t.calls,[['smart_plans','A']]);
  t.ctx.state.user={id:'B'};await t.ctx.api.flush();assert.equal(t.q().length,0,'B (owner) uploads its own op after re-login');assert.equal(t.calls[1][1],'B')});
test('a server-rejected op is kept as failed (never silently deleted, not retried blindly) until the user retries or dismisses it',async()=>{
  const t=phases('A');t.store[t.ctx.api.QK]=JSON.stringify([op({id:'x',at:Date.now()-20*DAY,u:'A'})]);
  t.ctx.fail='permission denied';await t.ctx.api.flush();assert.equal(t.q().length,1);assert.equal(t.q()[0].dead,true);assert.equal(t.ctx.window.rc27PhaseIssues().failed,1);assert.equal(t.ctx.window.rc27PhaseQueueCount(),0);
  t.ctx.fail=null;await t.ctx.api.flush();assert.equal(t.calls.length,0,'a failed op is not hammered on every flush');assert.equal(t.q().length,1);
  t.ctx.window.rc27PhaseRetryFailed();await t.ctx.api.flush();assert.equal(t.calls.length,1);assert.equal(t.q().length,0)});
test('a failed op is retried automatically after 10 minutes (transient 5xx / expired token recovers) and is never deleted',async()=>{
  const t=phases('A');t.store[t.ctx.api.QK]=JSON.stringify([op({id:'x',at:Date.now()-20*DAY,u:'A',dead:true,tried:Date.now()-11*60*1000})]);
  await t.ctx.api.flush();assert.equal(t.calls.length,1);assert.equal(t.q().length,0)});
test('an op queued while a flush is awaiting the network is not overwritten by that flush',async()=>{
  const t=phases('A');t.store[t.ctx.api.QK]=JSON.stringify([op({id:'first',u:'A',at:Date.now()})]);
  const orig=t.ctx.db.from;t.ctx.db.from=tb=>{const o=orig(tb);return {...o,upsert:async x=>{t.ctx.navigator.onLine=false;await t.ctx.api.send(op({id:'late'}));t.ctx.navigator.onLine=true;return o.upsert(x)}}};
  await t.ctx.api.flush();assert.equal(t.q().length,1,'only the op queued during the flush remains');assert.equal(t.q()[0].u,'A')});
test('old ops without an owner are inert for every account until explicitly adopted or discarded',async()=>{
  const t=phases('A');t.store[t.ctx.api.QK]=JSON.stringify([{...op({id:'L1',at:Date.now()})}]);t.store['halaqati_phase_snapshot_v1']=JSON.stringify({u:'A'});
  await t.ctx.api.flush();assert.equal(t.calls.length,0,'not even the snapshot owner replays it');assert.equal(t.q().length,1);assert.equal(t.ctx.window.rc27PhaseIssues().orphan,1);
  t.ctx.state.user={id:'B'};await t.ctx.api.flush();assert.equal(t.calls.length,0);
  t.ctx.window.rc27PhaseAdoptOrphans();assert.equal(t.q()[0].u,'B');await t.ctx.api.flush();assert.deepEqual(t.calls,[['smart_plans','B']]);
  t.store[t.ctx.api.QK]=JSON.stringify([{...op({id:'L2'})},op({id:'keep',u:'B',at:Date.now()})]);t.ctx.window.rc27PhaseDiscardOrphans();assert.deepEqual(t.q().map(o=>o.id),['keep'])});
test('ops outside the smart-plan allowlist are never executed, even for their owner, and stay visible as failed',async()=>{
  const t=phases('A');t.store[t.ctx.api.QK]=JSON.stringify([{kind:'update',table:'profiles',obj:{role:'admin'},key:'id',val:'A',id:'1',at:Date.now(),u:'A'},{kind:'rpc',name:'admin_delete_account',args:{},id:'2',at:Date.now(),u:'A'}]);
  await t.ctx.api.flush();assert.equal(t.calls.length,0);assert.ok(t.q().every(o=>o.dead))});
test('if the device cannot store the op it is reported, not silently pretended queued',async()=>{
  const t=phases('A');t.ctx.navigator.onLine=false;t.ctx.full=true;await assert.rejects(()=>t.ctx.api.send(op()),/لم تُحفظ/)});
test('logout/login does not touch the outbox (account switch keeps every pending op)',()=>{
  for(const f of ['core/runtime.js','core/startup.js','features/auth/runtime.js'])assert.doesNotMatch(rd(f),/halaqati_phase_outbox_v1|rc53_visit_queue/,f)});

function visits(user){
  const code=slice(rd('features/rc53/runtime.js'),"const VQ='rc53_visit_queue'","function enqueue(op)");
  const store={},calls=[];
  const ctx={state:{user:{id:user}},B:{at:0},render(){},confirm:()=>true,window:{addEventListener(){}},setTimeout:()=>0,setInterval(){},role:()=>'admin',navigator:{onLine:true},crypto:{randomUUID:()=>'u'},console,JSON,Map,Set,String,
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)}},
    db:{from:()=>({upsert:async r=>{if(!ctx.fail)calls.push([ctx.state.user.id,r.id]);return {error:ctx.fail?{message:ctx.fail}:null}},update:()=>({eq:async()=>({error:null})}),delete:()=>({eq:async()=>({error:null})})})}};
  vm.createContext(ctx);vm.runInContext(code+';this.api={vqFlush,applyQ,vqGet}',ctx);return {ctx,store,calls};
}
test('visit queue: other accounts and ownerless ops are not replayed nor merged into the view; failed ones are kept',async()=>{
  const t=visits('A');const ins=(id,u,x={})=>({t:'ins',row:{id,visit_date:'2026-11-01'},...(u?{u}:{}),...x});
  t.store.rc53_visit_queue=JSON.stringify([ins('mine','A'),ins('theirs','B'),ins('legacy',null)]);
  assert.deepEqual(Array.from(t.ctx.api.applyQ([]),v=>v.id),['mine'],'view shows only this account');
  await t.ctx.api.vqFlush();assert.deepEqual(t.calls,[['A','mine']]);assert.deepEqual(Array.from(t.ctx.api.vqGet(),o=>o.row.id),['theirs','legacy']);
  t.ctx.state.user={id:'B'};await t.ctx.api.vqFlush();assert.deepEqual(t.calls.at(-1),['B','theirs']);assert.equal(t.calls.length,2);
  t.ctx.fail='denied';t.ctx.state.user={id:'A'};t.store.rc53_visit_queue=JSON.stringify([ins('bad','A')]);await t.ctx.api.vqFlush();const q=t.ctx.api.vqGet();assert.equal(q.length,1);assert.equal(q[0].dead,true);
  t.ctx.fail=null;await t.ctx.api.vqFlush();assert.equal(t.ctx.api.vqGet().length,1,'not hammered');t.store.rc53_visit_queue=JSON.stringify([{...q[0],tried:Date.now()-11*60*1000}]);await t.ctx.api.vqFlush();assert.equal(t.ctx.api.vqGet().length,0,'retried after 10 min and uploaded');
  t.ctx.fail='denied';t.store.rc53_visit_queue=JSON.stringify([ins('bad','A')]);await t.ctx.api.vqFlush();
  assert.equal(t.ctx.api.applyQ([]).length,0,'failed visit not merged into the view as if saved')});
