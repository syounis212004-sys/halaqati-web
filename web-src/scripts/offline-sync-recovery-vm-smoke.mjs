import fs from 'node:fs';
import vm from 'node:vm';
function fakeElement(){return {value:'',textContent:'',innerHTML:'',open:false,dataset:{},style:{},classList:{add(){},remove(){},contains(){return false}},addEventListener(){},showModal(){this.open=true},close(){this.open=false}}}
const els=new Map();const document={querySelector(s){if(!els.has(s))els.set(s,fakeElement());return els.get(s)},querySelectorAll(){return []},addEventListener(){},visibilityState:'visible'};
const store=new Map();const calls=[];const USER='11111111-1111-4111-8111-111111111111';const OLD='22222222-2222-4222-8222-222222222222';const NEW='33333333-3333-4333-8333-333333333333';
let sessionCreated=false;
function qb(table){
  const state={op:'idle',payload:null,eqs:{}};
  const q={
    select(){if(state.op==='idle')state.op='select';return q},eq(k,v){state.eqs[k]=v;return q},maybeSingle:async()=>{if(table==='sessions'&&state.eqs.id===OLD&&!sessionCreated)return {data:null,error:null};if(table==='sessions'&&state.eqs.id===NEW)return {data:{id:NEW,halaqa_id:'44444444-4444-4444-8444-444444444444'},error:null};return {data:null,error:null}},
    insert(p){state.op='insert';state.payload=p;return q},upsert(p){state.op='upsert';state.payload=p;return q},update(p){state.op='update';state.payload=p;return q},delete(){state.op='delete';return q},in(){return q},
    single:async()=>{if(table==='sessions'&&state.op==='insert'){sessionCreated=true;calls.push(['session-insert',state.payload]);return {data:{id:NEW,...state.payload},error:null}};return {data:null,error:null}},
    then(resolve){if(state.op==='upsert'){calls.push([table+'-upsert',state.payload]);return Promise.resolve({data:[state.payload],error:null}).then(resolve)}return Promise.resolve({data:[],error:null}).then(resolve)}
  };return q;
}
const db={auth:{getSession:async()=>({data:{session:{user:{id:USER,email:'a@b.c'},access_token:'x',expires_at:Math.floor(Date.now()/1000)+3600}},error:null}),getUser:async()=>({data:{user:{id:USER,email:'a@b.c'}},error:null}),refreshSession:async()=>({data:{session:{user:{id:USER,email:'a@b.c'},access_token:'x',expires_at:Math.floor(Date.now()/1000)+3600}},error:null})},from:qb};
const context={console,document,navigator:{onLine:true},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},fetch:async()=>({ok:true}),setTimeout(){return 1},clearTimeout(){},AbortController,Date,Promise,JSON,Math,Number,String,Array,Object,Map,Set,RegExp,Error,Intl};context.window=context;context.window.supabase={createClient(){return db}};vm.createContext(context);
vm.runInContext(fs.readFileSync('src/core/runtime.js','utf8'),context,{timeout:4000});
vm.runInContext(`state.user={id:'${USER}',email:'a@b.c'};state.profile={role:'admin',active:true,approval_status:'approved'};state.networkVerified=true;state.offline=false;state.sessions=[{id:'${OLD}',halaqa_id:'44444444-4444-4444-8444-444444444444',session_date:'2026-08-29',session_type:'tasmee',title:'جلسة اختبار',status:'open',created_by:'${USER}'}];`,context);
vm.runInContext(`localStorage.setItem(queueKey(),JSON.stringify([{type:'attendance',key:'att:${OLD}:s1',payload:{session_id:'${OLD}',student_id:'55555555-5555-4555-8555-555555555555',status:'present',recorded_by:'${USER}'}}]));captureSyncSessionDependencies();state.sessions=[];`,context);
await vm.runInContext(`syncOfflineQueue({refreshAfter:false})`,context);
const remaining=vm.runInContext('readOfflineQueue().length',context);if(remaining!==0){console.error('queue not cleared',remaining);process.exit(1)}
if(!calls.some(x=>x[0]==='session-insert')){console.error('missing recovered session insert',calls);process.exit(1)}
if(!calls.some(x=>x[0]==='attendance_records-upsert'&&x[1].session_id===NEW)){console.error('attendance was not remapped to recovered session',calls);process.exit(1)}
console.log('OFFLINE_SYNC_RECOVERY_VM_PASS');
