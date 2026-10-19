import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const listeners={};
const elements=new Map();
function makeClassList(){const s=new Set(['hidden']);return {add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x)}}
function makeEl(){return {id:'',className:'',innerHTML:'',classList:makeClassList(),addEventListener(){},querySelector(){return null},appendChild(){}}}
const body=makeEl();body.appendChild=(el)=>{if(el.id)elements.set(el.id,el)};
const document={
  body,documentElement:makeEl(),visibilityState:'visible',
  getElementById:id=>elements.get(id)||null,
  createElement:()=>makeEl(),
  addEventListener:(type,fn)=>{listeners[type]=fn}
};
const storage=new Map();
const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
let ensureCalls=0,quickRenderCalls=0,liveOpened=0;
const ctx={
  console,document,localStorage,navigator:{onLine:true},setTimeout,clearTimeout,Date,Math,JSON,Intl,Promise,
  state:{user:{id:'u1'},profile:{role:'admin'},sessions:[],students:[],sessionRoster:{attendance:[],notes:[],recitations:[]},offlineRosterCache:{},networkVerified:true,offline:false,liveHalaqa:{}},
  roleCanManage:()=>true,
  opsDashboardHome:()=>'<button class="btn" onclick="startTodaySession()">ابدأ جلسة اليوم</button><button class="btn" onclick="openQuickMemorization()">التحفيظ السريع</button>',
  sessionsPage:()=>'<button onclick="openQuickMemorization()">التحفيظ السريع</button>',
  ensureTodaySession:async()=>{ensureCalls++;return {id:'s1',halaqa_id:'h1',session_date:'2026-09-05',status:'open'}},
  prepareSessionForOfflineWork:()=>{},cloneJson:x=>JSON.parse(JSON.stringify(x)),isLocalSessionId:()=>true,
  opsQuickLoadingOverlay:()=>{},opsQuickRender:()=>{quickRenderCalls++},opsCloseOverlay:()=>{},
  toast:()=>{},today:()=> '2026-09-05',activeStudents:()=>[],sortStudentsList:x=>x,opsTrackStudents:()=>[],opsTrackLabel:()=> 'مسار الحفظ العام',
  esc:x=>String(x??''),render:()=>{},saveSessionOfflineFirst:()=>{},saveReportOffline:()=>{},localAttendanceSave:()=>{},offlineUuid:()=> 'x',
  requestAnimationFrame:fn=>setTimeout(fn,0),
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('src/features/live-halaqa/runtime.js','utf8'),ctx,{filename:'live-halaqa/runtime.js'});

const home=ctx.opsDashboardHome();
assert.match(home,/data-halaqati-action="quick-memorization"/);
assert.match(home,/data-halaqati-action="live-halaqa"/);
assert.ok(!home.includes('onclick="openQuickMemorization()"'),'dashboard quick button must not rely on inline global binding');
assert.equal(typeof listeners.click,'function','delegated click handler must be registered');

let prevented=false,stopped=false;
const quickBtn={getAttribute:()=> 'quick-memorization',closest:()=>quickBtn};
listeners.click({target:quickBtn,preventDefault:()=>{prevented=true},stopPropagation:()=>{stopped=true}});
await new Promise(r=>setTimeout(r,0));
assert.ok(prevented&&stopped,'quick tap must be captured');
assert.equal(ensureCalls,1,'quick tap must create/open today session exactly once');
assert.equal(quickRenderCalls,1,'quick tap must render quick memorization immediately from local roster');

const liveBtn={getAttribute:()=> 'live-halaqa',closest:()=>liveBtn};
listeners.click({target:liveBtn,preventDefault(){},stopPropagation(){}});
await new Promise(r=>setTimeout(r,0));
assert.equal(ensureCalls,2,'Live Halaqa tap must create/open today session');
assert.ok(elements.get('liveHalaqaOverlay')&&!elements.get('liveHalaqaOverlay').classList.contains('hidden'),'Live Halaqa overlay must open');

console.log('v2.40.0 runtime VM smoke passed ✅');
