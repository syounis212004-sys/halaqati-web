import fs from 'node:fs';
import vm from 'node:vm';
import { createSmartPlansEngine } from '../src/features/plans/engine.js';

function fakeElement(){
  return {
    value:'', textContent:'', innerHTML:'', dataset:{}, style:{}, checked:false,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    addEventListener(){}, removeEventListener(){}, appendChild(){}, prepend(){},
    querySelector(){return fakeElement()}, querySelectorAll(){return []},
    reset(){}, showModal(){}, close(){}, setAttribute(){}, removeAttribute(){},
  };
}
const elements=new Map();
const document={
  querySelector(sel){if(!elements.has(sel))elements.set(sel,fakeElement());return elements.get(sel)},
  querySelectorAll(){return []},
  getElementById(id){return this.querySelector('#'+id)},
  addEventListener(){}, createElement(){return fakeElement()}, body:fakeElement(), documentElement:fakeElement(), visibilityState:'visible'
};
const q={
  select(){return q}, eq(){return q}, order(){return q}, limit(){return q}, gte(){return q}, lte(){return q}, in(){return q}, is(){return q},
  insert(){return q}, update(){return q}, upsert(){return q}, delete(){return q}, single(){return Promise.resolve({data:null,error:null})},
  then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}
};
const db={
  auth:{
    signInWithPassword:async()=>({data:{},error:null}), signInWithOAuth:async()=>({data:{},error:null}), signUp:async()=>({data:{},error:null}),
    resetPasswordForEmail:async()=>({error:null}), updateUser:async()=>({error:null}), getUser:async()=>({data:{user:null}}), getSession:async()=>({data:{session:null}}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}), signOut:async()=>({error:null})
  },
  from(){return Object.create(q)}, storage:{from(){return {createSignedUrl:async()=>({data:null,error:null})}}}
};
const store=new Map();
const context={
  console, document, navigator:{onLine:true}, location:{protocol:'https:',origin:'https://example.test',pathname:'/',hash:'',search:'',reload(){}}, history:{replaceState(){}},
  localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
  setTimeout(){return 1}, clearTimeout(){}, setInterval(){return 1}, clearInterval(){}, fetch:async()=>({ok:true,json:async()=>({})}), confirm:()=>true,
  URL, URLSearchParams, Date, Promise, Map, Set, JSON, Math, Number, String, Array, Object, RegExp, Error, Intl,
};
context.window=context;
context.window.addEventListener=()=>{};
context.window.open=()=>{};
context.window.supabase={createClient(){return db}};
context.window.HalaqatiSmartPlansEngine=createSmartPlansEngine();
context.globalThis=context;
vm.createContext(context);
const files=[
  'src/core/runtime.js','src/core/navigation.js','src/features/auth/runtime.js','src/features/students/runtime.js',
  'src/features/sessions/runtime.js','src/features/settings/runtime.js','src/legacy/app.js','src/features/plans/runtime.js'
];
for(const file of files){
  try{vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file,timeout:3000})}
  catch(e){console.error('VM runtime failure in',file,e);process.exit(1)}
}
const names=['boot','loginWithGoogle','studentsPage','openStudent','sessionsPage','openSessionRoster','settingsPage','render','navItems','changeMyPassword','plansPage','openPlan','oneTapSmartPlanPrefill'];
for(const name of names){
  const type=vm.runInContext(`typeof ${name}`,context);
  if(type!=='function'){console.error('VM missing function',name,type);process.exit(1)}
}
const version=vm.runInContext('APP_VERSION_NAME+":"+APP_VERSION_CODE',context);
if(version!=='2.18.2:21802'){console.error('VM version mismatch',version);process.exit(1)}
const smartHtml=vm.runInContext(`(()=>{
  state.profile={id:'u1',role:'admin',full_name:'مدير الاختبار'};
  state.user={id:'u1'};
  state.smartPlansAvailable=true;
  state.halaqas=[{id:'h1',name:'حلقة الإتقان'}];
  state.students=[{id:'s1',halaqa_id:'h1',full_name:'أحمد محمود',status:'active'}];
  state.smartPlans=[{id:'p1',scope_type:'student',halaqa_id:'h1',student_id:'s1',plan_type:'hifz',review_tier:'none',title:'خطة اختبار ذكية',goal_unit:'pages',target_units:20,target_pages:20,start_date:'2026-08-01',end_date:'2026-09-30',schedule_weekdays:[0,1,2,3,4],catch_up_weekday:4,max_daily_multiplier:1.5,auto_extend:true,quality_gate_enabled:true,minimum_evaluation:'very_good',range_start_page:221,range_end_page:240,near_revision_pages:7,far_revision_pages:20,milestone_mode:'none',milestone_requires_approval:true,delay_alert_days:3,home_prep_push:true,status:'active',created_at:'2026-08-01T00:00:00Z',updated_at:'2026-08-01T00:00:00Z'}];
  state.smartPlanEvents=[];state.smartPlanRecitations=[];state.smartPlanHalaqa='all';state.smartPlanTab='dashboard';
  return plansPage();
})()`,context);
if(!smartHtml.includes('الخطط الذكية v2.18')||!smartHtml.includes('خطة اختبار ذكية')||!smartHtml.includes('مطلوب اليوم')){console.error('VM smart plans dashboard render failed');process.exit(1)}
console.log('PHASE3_VM_RUNTIME_SMOKE_PASS');
