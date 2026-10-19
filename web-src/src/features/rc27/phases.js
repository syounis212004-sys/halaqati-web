/* Halaqati v2.63.22 — smart plan phases (port of the native SmartPlanPhaseEngine + phase repository writes).
   Same tables and RPCs as the Android app (smart_plan_phases, smart_plan_phase_states, smart_plan_phase_templates,
   rc112_update_plan_phase, rc112_transition_plan_students, rc113_bulk_configure_plan_cycles, rc19_start_month).
   No schema change: every payload mirrors HalaqatiRepository.kt. All writes need a verified connection. */
(function(){
  const h=v=>typeof esc==='function'?esc(v):String(v==null?'':v);
  const fm=v=>typeof fmt==='function'?fmt(v):v;
  const R=(v,d=2)=>{const p=Math.pow(10,d);return Math.round((Number(v)||0)*p)/p};
  const iso=d=>d.toISOString().slice(0,10);
  const T0=()=>iso(new Date());
  const parse=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3])):null};
  const addDays=(s,n)=>{const d=parse(s);d.setUTCDate(d.getUTCDate()+n);return iso(d)};
  const wd=s=>parse(s).getUTCDay();                      // 0 = Sunday (same as native weekday())
  const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const ROUTE_NAS='reverse_surahs_forward_ayahs',ROUTE_BAQ='forward_surahs_forward_ayahs';
  const TYPE_AR={hifz:'حفظ',sard:'سرد',tathbit:'تثبيت'},ST_AR={draft:'مسودة',active:'جارية',completed:'مكتملة',archived:'مؤرشفة'},PS_AR={not_started:'لم تبدأ',active:'جارية',completed:'مكتملة',skipped:'مستثناة'};
  const GOAL_AR={pages:'صفحات',juz:'أجزاء',quran_range:'نطاق من القرآن',open:'مفتوح'};
  const S={plans:[],phases:[],states:[],templates:[],recs:new Map,at:0,loading:null,err:null};

  // ================= engine (SmartPlanPhaseEngine) =================
  function enginePhase(p){return {id:p.id,planId:p.plan_id,order:p.phase_order,type:p.phase_type,start:String(p.start_date).slice(0,10),end:String(p.end_date).slice(0,10),weekdays:new Set(p.schedule_weekdays||[]),goalMode:p.goal_mode,targetPages:p.target_pages!=null?Number(p.target_pages):null,targetUnits:p.target_units!=null?Number(p.target_units):null,distribution:p.distribution_mode,startMode:p.start_mode,allowSurplus:p.allow_surplus!==false,status:p.status,raw:p}}
  function scheduledDates(ph,from,to){const s=from&&from>ph.start?from:ph.start,e=to&&to<ph.end?to:ph.end;const out=[];if(s>e)return out;for(let d=s;d<=e;d=addDays(d,1))if(ph.weekdays.has(wd(d)))out.push(d);return out}
  function resolvedTarget(ph,st){
    if(st&&Number(st.target_pages_override)>0)return R(st.target_pages_override);
    if(ph.targetPages>0)return R(ph.targetPages);
    if(ph.goalMode==='juz'&&ph.targetUnits>0)return R(ph.targetUnits*20);
    return null;
  }
  function progress(ph,completedPages,today,st){
    const base=resolvedTarget(ph,st),carried=Math.max(0,Number(st?.carry_shortfall_pages)||0);
    const target=base!=null?R(base+carried):(carried>0.001?R(carried):null);
    const completed=st&&st.frozen_completed_pages!=null?Number(st.frozen_completed_pages):Math.max(0,completedPages);
    const all=scheduledDates(ph),remDates=all.filter(d=>d>=today&&d<=ph.end).length,remaining=target!=null?Math.max(0,target-completed):null;
    const complete=target!=null&&remaining<=0.001;
    let suggested=null;
    if(target!=null){if(complete)suggested=ph.allowSurplus?0:null;else if(remDates<=0)suggested=remaining;else if(ph.distribution==='equal')suggested=R(target/Math.max(1,all.length));else suggested=R(remaining/remDates)}
    return {target,completed:R(completed),remaining:remaining!=null?R(remaining):null,percentage:target>0.001?R(Math.max(0,completed/target*100),1):null,scheduledDays:all.length,remainingDays:remDates,suggested,surplus:target!=null?R(Math.max(0,completed-target)):0,complete,completedEarly:complete&&today<ph.end};
  }
  function effective(ph,states,sid){const st=states.find(x=>x.phase_id===ph.id&&x.student_id===sid);const s=st?.start_date_override?String(st.start_date_override).slice(0,10):ph.start,e=st?.end_date_override?String(st.end_date_override).slice(0,10):ph.end;return {...ph,start:s,end:e<s?s:e}}
  function activePhase(phases,states,sid,today){
    const by=new Map(states.filter(x=>x.student_id===sid).map(x=>[x.phase_id,x]));
    return phases.filter(p=>p.status==='active').map(p=>effective(p,states,sid)).filter(p=>today>=p.start&&today<=p.end).filter(p=>!['completed','skipped'].includes(by.get(p.id)?.status)).sort((a,b)=>a.order-b.order)[0]||null;
  }
  function lifecycle(ph,st,today){
    if(st?.status==='skipped')return 'skipped';
    if(st?.status==='completed'||st?.frozen_completed_pages!=null)return 'completed';
    const s=st?.start_date_override?String(st.start_date_override).slice(0,10):ph.start,e=st?.end_date_override?String(st.end_date_override).slice(0,10):ph.end;
    return today<s?'scheduled':today>e?'ended':'active';
  }
  function validateTimeline(phases){
    const act=phases.filter(p=>p.status!=='archived').sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:a.order-b.order),out=[];
    if(act.filter(p=>p.type==='hifz').length>1)out.push({code:'multiple_hifz',message:'الخطة الشهرية تدعم مرحلة حفظ واحدة فقط في RC11.2',blocking:true});
    if(act.filter(p=>p.type==='sard').length>1)out.push({code:'multiple_sard',message:'الخطة الشهرية تدعم مرحلة سرد واحدة فقط في RC11.2',blocking:true});
    const tc=act.filter(p=>p.type==='tathbit').length;
    if(tc>0&&act.some(p=>p.type==='hifz'||p.type==='sard'))out.push({code:'tathbit_mixed',message:'خطة التثبيت تحتوي مراحل تثبيت فقط؛ لا يجوز خلطها بحفظ أو سرد',blocking:true});
    if(tc>1)out.push({code:'multiple_tathbit',message:'الخطة تدعم مرحلة تثبيت واحدة فعّالة',blocking:true});
    for(let i=0;i+1<act.length;i++){const a=act[i],b=act[i+1];
      if(b.start<=a.end)out.push({code:'overlap',message:`تداخل بين ${a.start}–${a.end} و${b.start}–${b.end}`,blocking:true});
      else if(b.start>addDays(a.end,1))out.push({code:'gap',message:`يوجد فراغ زمني من ${addDays(a.end,1)} إلى ${addDays(b.start,-1)}`,blocking:false})}
    const hf=act.find(p=>p.type==='hifz'),sd=act.find(p=>p.type==='sard');
    if(hf&&sd&&sd.order<=hf.order)out.push({code:'order',message:'مرحلة السرد يجب أن تأتي بعد مرحلة الحفظ',blocking:true});
    return out;
  }

  // ================= completed pages (HifzSpanRules + SmartPlanEngine.isPassing) =================
  const pos=(s,a,route)=>((route===ROUTE_NAS?200-s:s)*1000)+a;
  function passing(r){
    let ev=String(r.evaluation||'').toLowerCase();
    if(!ev||ev==='not_rated'){const pages=Number(r.pages_count)||0;if(pages>0){const dens=((Number(r.mistakes)||0)+(Number(r.prompts)||0)*.25)/Math.max(1,pages),safety=Math.max(0,Math.min(100,100-dens*15));ev=safety>85?'excellent':safety>=75?'very_good':safety>=70?'good':'repeat'}}
    return !['repeat','weak','إعادة','ضعيف'].includes(ev);
  }
  function lineKeysAlong(from,to,route){
    // all ayahs from `from` to `to` along the route, as QCF line keys
    const keys=new Set,layout=typeof smartPlanQuranLayout==='function'?smartPlanQuranLayout():null;if(!layout)return null;
    const step=route===ROUTE_NAS?-1:1;
    for(let s=from.s;step<0?s>=to.s:s<=to.s;s+=step){
      const a0=s===from.s?from.a:1,a1=s===to.s?to.a:ayahCounts[s-1];
      for(let a=a0;a<=a1;a++)smartPlanAyahLineKeys(s,a,layout).forEach(k=>keys.add(k));
    }
    return keys;
  }
  function hifzSpanPages(recs,route){
    const ayah=recs.filter(r=>passing(r)&&r.start_surah&&r.start_ayah&&r.end_surah&&r.end_ayah),loose=recs.filter(r=>!(r.start_surah&&r.start_ayah&&r.end_surah&&r.end_ayah)).reduce((x,r)=>x+Math.max(0,Number(r.pages_count)||0),0);
    if(!ayah.length)return loose;
    const sum=recs.reduce((x,r)=>x+Math.max(0,Number(r.pages_count)||0),0);
    let base=ayah.map(r=>({s:+r.start_surah,a:+r.start_ayah})).sort((x,y)=>pos(x.s,x.a,route)-pos(y.s,y.a,route))[0],frontier=null;const covered=new Set;
    for(const r of ayah.slice().sort((x,y)=>String(x.session_date).localeCompare(String(y.session_date))||String(x.created_at).localeCompare(String(y.created_at)))){
      const end={s:+r.end_surah,a:+r.end_ayah};if(frontier&&pos(end.s,end.a,route)<=pos(frontier.s,frontier.a,route))continue;
      const keys=lineKeysAlong(frontier||base,end,route);if(!keys)return sum;keys.forEach(k=>covered.add(k));frontier=end;
    }
    return covered.size/15+loose;
  }
  function phaseRecs(plan,ph,sid){
    const rows=(S.recs.get(sid)||[]);
    const pt=ph.phase_type||ph.type,typeOk=a=>pt==='hifz'?a==='new_hifz':pt==='sard'?a==='sard':['review_far','tathbit'].includes(a);
    return rows.filter(r=>{const d=String(r.session_date||'').slice(0,10);if(d<plan.start_date||d>plan.end_date)return false;const tagged=r.phase_id||r.selection_data?.smart_plan_phase_id;if(tagged)return tagged===ph.id;return typeOk(r.activity_type)});
  }
  function completedPages(plan,ph,sid,st){
    // native: frozen result first; else the active phase's engine progress; else (non-sard) the parent plan's progress
    if(st&&st.frozen_completed_pages!=null)return Number(st.frozen_completed_pages);
    const sn=snapshot(plan,T0()),pt=ph.phase_type||ph.type;
    if(sn.phase&&sn.phase.id===ph.id&&sn.phaseProgress)return R(sn.phaseProgress.completed);
    if(pt==='sard')return 0;
    if(sn.phase&&sn.phase.phase_type==='sard')return 0;
    return R((sn.phaseProgress?sn.phaseProgress.completed:sn.raw?.completed)||0);
  }

  // ================= durable outbox (writes made offline replay in order when the connection returns) =================
  const QK='halaqati_phase_outbox_v1',SK='halaqati_phase_snapshot_v1';
  const readQ=()=>{try{return JSON.parse(localStorage.getItem(QK)||'[]')}catch(_e){return []}};
  const writeQ=q=>{try{localStorage.setItem(QK,JSON.stringify(q))}catch(_e){}};
  const isOnline=()=>navigator.onLine&&state.networkVerified!==false&&!state.offline;
  async function exec(op){
    let r;
    if(op.kind==='upsert')r=await db.from(op.table).upsert(op.obj,{onConflict:op.onConflict});
    else if(op.kind==='update')r=await db.from(op.table).update(op.obj).eq(op.key,op.val);
    else if(op.kind==='rpc')r=await db.rpc(op.name,op.args);
    if(r&&r.error)throw r.error;
    return r&&r.data;
  }
  const isNetErr=e=>/Failed to fetch|NetworkError|network|timeout|load failed/i.test(String(e?.message||e));
  async function send(op){
    if(!isOnline()){const q=readQ();q.push({...op,id:crypto.randomUUID(),at:Date.now()});writeQ(q);S.queued=q.length;toast('حُفظ على الجهاز وسيُرفع عند عودة الاتصال');return {queued:true}}
    try{return {data:await exec(op)}}catch(e){if(isNetErr(e)){const q=readQ();q.push({...op,id:crypto.randomUUID(),at:Date.now()});writeQ(q);S.queued=q.length;toast('انقطع الاتصال؛ حُفظت العملية وستُرفع تلقائيًا');return {queued:true}}throw e}
  }
  let flushing=false;
  async function flush(){
    if(flushing||!isOnline())return;const q=readQ();if(!q.length)return;flushing=true;
    try{
      const left=[];let failed=false;
      for(const op of q){
        if(failed){left.push(op);continue}
        try{await exec(op)}catch(e){if(isNetErr(e)){failed=true;left.push(op)}else{console.warn('phase op dropped',op.kind,op.name||op.table,e);op.error=String(e.message||e);op.dead=true;left.push(op)}}
      }
      writeQ(left.filter(o=>!o.dead||true));S.queued=left.filter(o=>!o.dead).length;
      if(left.length!==q.length){await load(true);if(typeof render==='function'&&state.page==='plans')render()}
    }finally{flushing=false}
  }
  window.addEventListener('online',()=>setTimeout(flush,800));setInterval(flush,30000);
  function saveSnap(){try{localStorage.setItem(SK,JSON.stringify({u:state.user?.id,plans:S.plans,phases:S.phases,states:S.states,templates:S.templates}))}catch(_e){}}
  function loadSnap(){try{const j=JSON.parse(localStorage.getItem(SK)||'null');if(j&&(!state.user||j.u===state.user.id)){S.plans=j.plans||[];S.phases=j.phases||[];S.states=j.states||[];S.templates=j.templates||[]}}catch(_e){}}
  loadSnap();
  window.rc27PhaseQueueCount=()=>readQ().filter(o=>!o.dead).length;

  // ================= native parity: phase-aware plan + engine progress (HalaqatiRepository.phaseAwarePlan) =================
  const eng=()=>window.HalaqatiSmartPlansEngine;
  const MAXAYAH=s=>ayahCounts[s-1];
  const layoutOf=()=>typeof smartPlanQuranLayout==='function'?smartPlanQuranLayout():null;
  const pageOfAyah=(s,a)=>{const l=layoutOf();return l?Number(l.page?.[globalAyah(s,a)]||0):0};
  function routeLines(from,to,route){
    const layout=layoutOf();if(!layout)return null;const out=[],seen=new Set,step=route===ROUTE_NAS?-1:1;
    for(let s=from.s;step<0?s>=to.s:s<=to.s;s+=step){const a0=s===from.s?from.a:1,a1=s===to.s?to.a:MAXAYAH(s);for(let a=a0;a<=a1;a++)for(const k of smartPlanAyahLineKeys(s,a,layout))if(!seen.has(k)){seen.add(k);out.push(k)}}
    return out;
  }
  window.rc27RouteLineKeys=routeLines;
  function previewPagesFrom(start,targetPages,route){
    const layout=layoutOf();if(!layout||!(targetPages>0))return null;const need=Math.max(1,Math.ceil(targetPages*15-1e-9)),keys=new Set,order=[];let end=start;
    const step=route===ROUTE_NAS?-1:1;
    outer:for(let s=start.s;step<0?s>=1:s<=114;s+=step){for(let a=(s===start.s?start.a:1);a<=MAXAYAH(s);a++){for(const k of smartPlanAyahLineKeys(s,a,layout))if(!keys.has(k)){keys.add(k);order.push(k)}end={s,a};if(keys.size>=need)break outer}}
    return {start,end,lineKeys:order,startPage:Number(order[0]?.split(':')[0])||pageOfAyah(start.s,start.a),endPage:Number(order.at(-1)?.split(':')[0])||pageOfAyah(end.s,end.a)};
  }
  function exactRange(start,end,route){const keys=routeLines(start,end,route);if(!keys||!keys.length)return null;return {start,end,lineKeys:keys,startPage:Number(keys[0].split(':')[0]),endPage:Number(keys.at(-1).split(':')[0])}}
  const tagOf=r=>{const v=r.selection_data?.smart_plan_phase_id||r.phase_id;return v&&!['null','undefined'].includes(String(v).trim().toLowerCase())?String(v).trim():null};
  const typeMatches=(pt,a)=>pt==='hifz'?['new_hifz','hifz'].includes(a):pt==='review'?['review','review_near','review_far'].includes(a):pt==='sard'?a==='sard':pt==='tathbit'?['tathbit','review_far'].includes(a):false;
  const defaultRoute=type=>type==='hifz'?ROUTE_NAS:ROUTE_BAQ;
  function nextLoc(e,route){if(e.a<MAXAYAH(e.s))return {s:e.s,a:e.a+1};const n=route===ROUTE_NAS?e.s-1:e.s+1;return (n<1||n>114)?null:{s:n,a:1}}
  const recDate=r=>String(r.session_date||r.sessions?.session_date||'').slice(0,10);
  function materialized(plan){const st=studentOf(plan.student_id);try{return typeof materializeSmartPlan==='function'?(materializeSmartPlan(plan,st)||plan):plan}catch(_e){return plan}}
  function phaseAwarePlan(parent,phaseRow,state,studentRecs){
    const base=materialized(parent);if(!phaseRow)return {plan:base,ph:null};
    const ph=enginePhase(phaseRow),eff=effective(ph,state?[state]:[],state?.student_id),phase={...ph,start:eff.start,end:eff.end};
    const resolvedT=resolvedTarget(phase,state||null),effTarget=Math.max(0,(resolvedT||0)+(Number(state?.carry_shortfall_pages)||0));
    const pRoute=phase.type==='sard'?([ROUTE_NAS,ROUTE_BAQ].includes(phaseRow.settings?.route_direction)?phaseRow.settings.route_direction:(parent.settings?.sard_route_direction||defaultRoute(parent.plan_type))):(base.settings?.route_direction||defaultRoute(phase.type==='tathbit'?'tathbit':'hifz'));
    const cfgStart=()=>phaseRow.range_start_surah&&phaseRow.range_start_ayah?{s:phaseRow.range_start_surah,a:phaseRow.range_start_ayah}:phaseRow.range_start_page?pageStartLoc(phaseRow.range_start_page):parent.range_start_surah&&parent.range_start_ayah?{s:parent.range_start_surah,a:parent.range_start_ayah}:parent.range_start_page?pageStartLoc(parent.range_start_page):null;
    const explicitEnd=phaseRow.range_end_surah&&phaseRow.range_end_ayah?{s:phaseRow.range_end_surah,a:phaseRow.range_end_ayah}:phaseRow.range_end_page?pageEndLoc(phaseRow.range_end_page):null;
    const parentTerm=parent.range_end_surah&&parent.range_end_ayah?{s:parent.range_end_surah,a:parent.range_end_ayah}:parent.range_end_page?pageEndLoc(parent.range_end_page):null;
    let hist=null;
    if(phase.startMode==='last_activity'||(phase.type==='sard'&&phase.startMode==='last_sard')){
      const act=phase.type==='sard'?'sard':phase.type==='tathbit'?'tathbit':'hifz',okAct=a=>act==='hifz'?['new_hifz','hifz'].includes(a):act==='sard'?a==='sard':a==='tathbit';
      const acc=studentRecs.filter(r=>recDate(r)<phase.start&&passing(r)&&okAct(String(r.activity_type).toLowerCase())&&r.end_surah&&r.end_ayah).sort((a,b)=>(recDate(a)+String(a.created_at||''))<(recDate(b)+String(b.created_at||''))?-1:1).at(-1);
      if(acc)hist=nextLoc({s:+acc.end_surah,a:+acc.end_ayah},pRoute);
    }
    const start=hist||cfgStart(),hardTerm=explicitEnd||parentTerm,reverse=pRoute===ROUTE_NAS;
    const reachable=(s,tm)=>reverse?(s.s>tm.s||(s.s===tm.s&&s.a<=tm.a)):(globalAyah(s.s,s.a)<=globalAyah(tm.s,tm.a)),passesT=(c,tm)=>reverse?(c.s<tm.s||(c.s===tm.s&&c.a>tm.a)):(globalAyah(c.s,c.a)>globalAyah(tm.s,tm.a));
    let gen=null;
    if(phase.type==='hifz'&&start){
      if(phase.goalMode==='quran_range'&&explicitEnd)gen=exactRange(start,explicitEnd,pRoute);
      else if(effTarget>0.001){const pv=previewPagesFrom(start,effTarget,pRoute);if(pv){gen=(hardTerm&&pv.end&&reachable(start,hardTerm)&&passesT(pv.end,hardTerm))?(exactRange(start,hardTerm,pRoute)||pv):pv}}
    }
    const lineKeys=phase.type!=='hifz'?[]:gen?gen.lineKeys:(phase.startMode==='plan_start'&&!phaseRow.range_start_page&&!phaseRow.range_start_surah?(base.settings?.memorization_line_keys||[]):[]);
    const startPage=start?pageOfAyah(start.s,start.a):null,fallbackEnd=phase.type==='hifz'?explicitEnd:hardTerm,endPage=gen?.endPage??(fallbackEnd?pageOfAyah(fallbackEnd.s,fallbackEnd.a):null);
    const rsp=gen?.startPage??startPage??phaseRow.range_start_page??(phase.type==='hifz'?parent.range_start_page:null),rep=endPage??phaseRow.range_end_page??(phase.type==='hifz'&&phase.goalMode==='quran_range'?parent.range_end_page:null);
    const plan={...base,plan_type:phase.type,target_pages:effTarget,start_date:phase.start,end_date:phase.end,schedule_weekdays:[...phase.weekdays],catch_up_weekday:null,range_start_page:rsp??null,range_end_page:rep??null,milestone_mode:phase.type==='hifz'?base.milestone_mode:'none',milestone_requires_approval:phase.type==='hifz'&&!!base.milestone_requires_approval,settings:{...(base.settings||{}),memorization_line_keys:lineKeys,route_direction:pRoute}};
    return {plan,ph:phase,state};
  }
  function pageStartLoc(page){const l=layoutOf();if(!l)return null;for(let g=1;g<l.page.length;g++)if(l.page[g]===page)return locOfGlobalA(g);return null}
  function pageEndLoc(page){const l=layoutOf();if(!l)return null;let last=null;for(let g=1;g<l.page.length;g++){if(l.page[g]===page)last=g;else if(last&&l.page[g]>page)break}return last?locOfGlobalA(last):null}
  const locOfGlobalA=g=>{let s=1;while(s<114&&ayahPrefix[s]<g)s++;return {s,a:g-ayahPrefix[s-1]}};
  // snapshot = what the native app computes for one student's monthly plan today
  function snapshot(plan,today){
    const sid=plan.student_id,parent=plan,phRows=S.phases.filter(p=>p.plan_id===plan.id&&p.status!=='archived').filter(p=>plan.plan_type==='tathbit'?p.phase_type==='tathbit':p.phase_type!=='tathbit'),states=S.states.filter(x=>x.student_id===sid&&phRows.some(p=>p.id===x.phase_id));
    const recs=(S.recs.get(sid)||[]).map(r=>({...r,session_date:recDate(r)})),events=(window.state?.smartPlanEvents||[]).filter(e=>e.plan_id===plan.id&&(!e.student_id||e.student_id===sid));
    const act=activePhase(phRows.map(enginePhase),states,sid,today),actRow=act?phRows.find(p=>p.id===act.id):null,actState=actRow?states.find(x=>x.phase_id===actRow.id):null;
    const pa=phaseAwarePlan(parent,actRow,actState,recs),plan2=pa.plan;
    const inDates=r=>recDate(r)>=String(plan2.start_date).slice(0,10)&&recDate(r)<=String(plan2.end_date).slice(0,10);
    const pr=recs.filter(r=>{const tag=tagOf(r);return actRow&&tag===actRow.id?inDates(r):actRow&&tag==null?inDates(r)&&typeMatches(plan2.plan_type,String(r.activity_type)):actRow?false:inDates(r)&&typeMatches(plan2.plan_type,String(r.activity_type))}).map(r=>actRow&&tagOf(r)===actRow.id?{...r,selection_data:{...(r.selection_data||{}),smart_plan_id:plan2.id}}:r);
    let raw=null;try{raw=eng().calculateProgress({plan:plan2,studentId:sid,recitations:pr,sessions:state.sessions||[],events,today})}catch(e){console.warn('rc27 engine',e)}
    const phaseProgress=act&&raw?progress(act,raw.completed,today,actState):null;
    return {phase:actRow,phaseState:actState,raw,phaseProgress,completed:raw?raw.completed:0,plan:plan2};
  }
  window.RC27PhaseSnapshot=snapshot;
  // ================= data =================
  async function load(force){
    if(!isOnline())return;
    if(!force&&S.loading)return S.loading;
    if(!force&&Date.now()-S.at<60000&&S.phases.length)return;
    S.loading=(async()=>{
      try{
        const month=T0().slice(0,8)+'01',since=addDays(month,-40);
        const [pl,ph,ps,tp]=await Promise.all([
          db.from('smart_plans').select('*').neq('status','archived').gte('end_date',since).limit(2000),
          db.from('smart_plan_phases').select('*').order('plan_id').order('phase_order').limit(3000),
          db.from('smart_plan_phase_states').select('*').order('updated_at',{ascending:false}).limit(8000),
          db.from('smart_plan_phase_templates').select('*').eq('active',true).order('updated_at',{ascending:false}).limit(500)]);
        if(ph.error)throw ph.error;
        S.plans=pl.data||[];S.phases=ph.data||[];S.states=ps.data||[];S.templates=tp.data||[];S.err=null;S.at=Date.now();saveSnap();
      }catch(e){S.err=e.message||String(e)}finally{S.loading=null}
    })();
    return S.loading;
  }
  async function loadRecs(studentIds){
    const need=studentIds.filter(id=>!S.recs.has(id));if(!need.length)return;
    const since=addDays(T0().slice(0,8)+'01',-190);
    for(let i=0;i<need.length;i+=15){
      const chunk=need.slice(i,i+15);
      const {data}=await db.from('recitation_entries').select('id,student_id,activity_type,pages_count,start_surah,start_ayah,end_surah,end_ayah,evaluation,mistakes,prompts,created_at,phase_id,selection_data,sessions!inner(session_date)').in('student_id',chunk).gte('sessions.session_date',since).limit(10000);
      chunk.forEach(id=>S.recs.set(id,[]));
      (data||[]).forEach(r=>S.recs.get(r.student_id).push({...r,session_date:r.sessions?.session_date}));
    }
  }
  window.rc27PhasesPreload=()=>{if(navigator.onLine&&state.networkVerified&&state.user)load(false)};

  // ================= writes (mirror HalaqatiRepository) =================
  const needOnline=()=>{};
  const planOf=id=>S.plans.find(p=>p.id===id);
  const phasesOf=pid=>S.phases.filter(p=>p.plan_id===pid&&p.status!=='archived').sort((a,b)=>a.phase_order-b.phase_order);
  const stateOf=(pid,sid)=>S.states.find(x=>x.phase_id===pid&&x.student_id===sid);
  const studentOf=id=>(window.RC27?.master?.students||state.students).find(s=>s.id===id);

  function localApplyPhase(obj,isNew){const i=S.phases.findIndex(x=>x.id===obj.id);if(i>=0)S.phases[i]={...S.phases[i],...obj};else S.phases.push(obj);saveSnap()}
  function localApplyTransition(planId,fromId,toId,rows){
    const to=S.phases.find(p=>p.id===toId),starts=!to||String(to.start_date).slice(0,10)<=T0(),now=new Date().toISOString();
    rows.forEach(r=>{
      const up=(phaseId,o)=>{const i=S.states.findIndex(x=>x.phase_id===phaseId&&x.student_id===r.studentId);if(i>=0)S.states[i]={...S.states[i],...o};else S.states.push({phase_id:phaseId,student_id:r.studentId,settings:{},carry_shortfall_pages:0,...o})};
      up(fromId,{status:'completed',frozen_completed_pages:r.completed,frozen_target_pages:r.target??null,completion_percent:r.target>0.001?R(r.completed/r.target*100,1):null,completed_at:now});
      up(toId,{status:starts?'active':'not_started',target_pages_override:r.sardOverride??null,carry_shortfall_pages:Math.max(0,r.carry||0)});
    });saveSnap();
  }
  async function syncParent(planId){
    const rows=phasesOf(planId);if(!rows.length)return;
    const start=rows.map(p=>String(p.start_date).slice(0,10)).sort()[0],end=rows.map(p=>String(p.end_date).slice(0,10)).sort().at(-1),hf=rows.find(p=>p.phase_type==='hifz');
    const obj={start_date:start,end_date:end,updated_at:new Date().toISOString()};
    if(hf){
      if(hf.target_pages!=null){obj.target_pages=hf.target_pages;obj.target_units=hf.target_pages}
      obj.schedule_weekdays=hf.schedule_weekdays;
      let sp=hf.range_start_page,ep=hf.range_end_page;if(sp!=null&&ep!=null&&sp>ep)[sp,ep]=[ep,sp];
      obj.range_start_page=sp??null;obj.range_end_page=ep??null;obj.range_start_surah=hf.range_start_surah??null;obj.range_start_ayah=hf.range_start_ayah??null;obj.range_end_surah=hf.range_end_surah??null;obj.range_end_ayah=hf.range_end_ayah??null;
    }
    await send({kind:'update',table:'smart_plans',obj,key:'id',val:planId});
  }
  async function savePhase(d){
    needOnline();
    if(!d.planId)throw new Error('الخطة الأم غير صالحة');
    if(!(d.phaseOrder>0))throw new Error('ترتيب المرحلة غير صالح');
    if(!['hifz','sard','tathbit'].includes(d.phaseType))throw new Error('نوع المرحلة غير صالح');
    const parent=planOf(d.planId);
    if(parent){const trk=studentOf(parent.student_id)?.track_code,tp=parent.plan_type==='tathbit'||(parent.scope_type==='student'&&trk==='tathbit');
      if(tp&&d.phaseType!=='tathbit')throw new Error('خطة التثبيت تقبل مرحلة تثبيت فقط');
      if(!tp&&d.phaseType==='tathbit')throw new Error('مرحلة التثبيت لخطط مسار التثبيت فقط')}
    if(!['pages','juz','quran_range','open'].includes(d.goalMode))throw new Error('نوع هدف المرحلة غير صالح');
    if(!['equal','flexible'].includes(d.distributionMode))throw new Error('طريقة توزيع الهدف غير صالحة');
    if(!['last_sard','last_activity','manual','range_start','plan_start'].includes(d.startMode))throw new Error('بداية المرحلة غير صالحة');
    if(!['draft','active','completed','archived'].includes(d.status))throw new Error('حالة المرحلة غير صالحة');
    if(!parse(d.startDate))throw new Error('تاريخ بداية المرحلة غير صالح');if(!parse(d.endDate))throw new Error('تاريخ نهاية المرحلة غير صالح');
    if(d.endDate<d.startDate)throw new Error('تاريخ نهاية المرحلة يسبق البداية');
    const weekdays=[...new Set(d.weekdays)].filter(x=>x>=0&&x<=6);if(!weekdays.length)throw new Error('اختر يوم مرحلة واحدًا على الأقل');
    const keepStart=['manual','range_start'].includes(d.startMode)||d.goalMode==='quran_range',keepEnd=d.goalMode==='quran_range';
    const n=v=>(v==null||v===''||Number.isNaN(Number(v)))?null:Number(v);
    const rs={page:keepStart?n(d.rangeStartPage):null,surah:keepStart?n(d.rangeStartSurah):null,ayah:keepStart?n(d.rangeStartAyah):null},re={page:keepEnd?n(d.rangeEndPage):null,surah:keepEnd?n(d.rangeEndSurah):null,ayah:keepEnd?n(d.rangeEndAyah):null};
    if(d.goalMode!=='open'&&!((d.targetPages??d.targetUnits??0)>0))throw new Error('حدد هدف المرحلة');
    if(['manual','range_start'].includes(d.startMode)&&!((rs.surah&&rs.ayah)||rs.page))throw new Error(d.phaseType==='sard'?'حدد نقطة بداية السرد':'حدد نقطة بداية المرحلة');
    if(d.goalMode==='quran_range'){if(!((rs.surah&&rs.ayah)||rs.page))throw new Error('حدد بداية النطاق القرآني');if(!((re.surah&&re.ayah)||re.page))throw new Error('حدد نهاية النطاق القرآني')}
    const current=phasesOf(d.planId),existing=d.id?current.find(p=>p.id===d.id):null;
    if(existing){if(existing.phase_type!==d.phaseType)throw new Error('لا يمكن تغيير نوع مرحلة بدأ استخدامها؛ أنشئ مرحلة جديدة بدلًا من ذلك')}
    else if(current.some(p=>p.phase_type===d.phaseType))throw new Error(d.phaseType==='hifz'?'RC11.2 يدعم مرحلة حفظ واحدة فقط':'RC11.2 يدعم مرحلة سرد واحدة فقط');
    const id=d.id||crypto.randomUUID(),settings={...(d.settings||{})};
    if(d.phaseType==='sard'&&!settings.route_direction)settings.route_direction=parent?.settings?.sard_route_direction||(parent?.plan_type==='hifz'?ROUTE_NAS:ROUTE_BAQ);
    const proposed={id,planId:d.planId,order:d.phaseOrder,type:d.phaseType,start:d.startDate,end:d.endDate,status:d.status};
    const issues=validateTimeline([...current.filter(p=>p.id!==id).map(enginePhase),proposed]).filter(x=>x.blocking);
    if(issues.length)throw new Error(issues.map(x=>x.message).join('؛ '));
    const now=new Date().toISOString(),expected=d.expectedRevision??existing?.revision??1;
    const obj={id,plan_id:d.planId,phase_order:d.phaseOrder,phase_type:d.phaseType,title:(d.title||'').trim()||(d.phaseType==='sard'?'مرحلة السرد':d.phaseType==='tathbit'?'مرحلة التثبيت':'مرحلة الحفظ'),start_date:d.startDate,end_date:d.endDate,schedule_weekdays:weekdays,goal_mode:d.goalMode,goal_unit:d.goalUnit,target_units:d.targetUnits??null,target_pages:d.targetPages??null,distribution_mode:d.distributionMode,start_mode:d.startMode,range_start_page:rs.page,range_end_page:re.page,range_start_surah:rs.surah,range_start_ayah:rs.ayah,range_end_surah:re.surah,range_end_ayah:re.ayah,allow_surplus:d.allowSurplus!==false,status:d.status,settings,revision:existing?expected+1:1,updated_at:now};
    if(!existing){obj.created_by=state.user.id;await send({kind:'upsert',table:'smart_plan_phases',obj,onConflict:'id'})}
    else{const patch={...obj};delete patch.id;delete patch.plan_id;await send({kind:'rpc',name:'rc112_update_plan_phase',args:{p_phase_id:id,p_expected_revision:expected,p_patch:patch}})}
    localApplyPhase(obj,!existing);await load(true);await syncParent(d.planId);return id;
  }
  async function setPhaseStatus(id,status){
    needOnline();if(!['draft','active','completed','archived'].includes(status))throw new Error('حالة المرحلة غير صالحة');
    await send({kind:'update',table:'smart_plan_phases',obj:{status,updated_at:new Date().toISOString()},key:'id',val:id});const ph=S.phases.find(x=>x.id===id);if(ph)ph.status=status;saveSnap();await load(true);
  }
  async function upsertState(phaseId,studentId,o){
    needOnline();
    if(!['not_started','active','completed','skipped'].includes(o.status))throw new Error('حالة الطالب داخل المرحلة غير صالحة');
    if(o.carry!=null&&o.carry<0)throw new Error('العجز المرحل غير صالح');
    const ex=stateOf(phaseId,studentId),now=new Date().toISOString();
    const obj={phase_id:phaseId,student_id:studentId,status:o.status,target_pages_override:o.targetOverride??ex?.target_pages_override??null,start_date_override:o.startOverride??ex?.start_date_override??null,end_date_override:o.endOverride??ex?.end_date_override??null,frozen_completed_pages:o.frozenCompleted??ex?.frozen_completed_pages??null,frozen_target_pages:o.frozenTarget??ex?.frozen_target_pages??null,completion_percent:o.percent??ex?.completion_percent??null,carry_shortfall_pages:o.carry??ex?.carry_shortfall_pages??0,settings:o.settings||ex?.settings||{},updated_at:now,updated_by:state.user.id};
    if(ex?.id)obj.id=ex.id;
    if(o.status==='completed')obj.completed_at=ex?.completed_at||now;else if(ex?.completed_at)obj.completed_at=ex.completed_at;
    await send({kind:'upsert',table:'smart_plan_phase_states',obj,onConflict:'phase_id,student_id'});const i=S.states.findIndex(x=>x.phase_id===phaseId&&x.student_id===studentId);if(i>=0)S.states[i]={...S.states[i],...obj};else S.states.push(obj);saveSnap();
  }
  async function planEvent(planId,studentId,type,payload){
    const cid=crypto.randomUUID(),obj={id:crypto.randomUUID(),client_event_id:cid,plan_id:planId,student_id:studentId,event_type:type,event_date:T0(),payload,created_by:state.user.id};
    if(payload.phase_id)obj.phase_id=payload.phase_id;
    await send({kind:'upsert',table:'smart_plan_events',obj,onConflict:'client_event_id'});
  }
  async function completePhaseForStudent(plan,phaseId,sid,done,target){
    const pct=target>0.001?R(done/target*100,1):null;
    await upsertState(phaseId,sid,{status:'completed',frozenCompleted:done,frozenTarget:target,percent:pct});
    await planEvent(plan.id,sid,'phase_completed',{phase_id:phaseId,completed_pages:done,target_pages:target??null,completion_percent:pct});
  }
  async function transition(planId,fromId,toId,rows){
    needOnline();if(!rows.length)throw new Error('لا يوجد طلاب للانتقال');
    const payload=rows.map(r=>({student_id:r.studentId,completed_pages:Math.max(0,r.completed),target_pages:r.target??null,completion_percent:r.target>0.001?R(r.completed/r.target*100,1):null,carry_shortfall_pages:Math.max(0,r.carry||0),sard_target_pages_override:r.sardOverride??null}));
    await send({kind:'rpc',name:'rc112_transition_plan_students',args:{p_plan_id:planId,p_from_phase_id:fromId,p_to_phase_id:toId,p_rows:payload}});localApplyTransition(planId,fromId,toId,rows);await load(true);
  }
  async function bulkCycles(rows){
    needOnline();if(!rows.length)throw new Error('لا يوجد طلاب لتحديث دورة الحفظ والسرد');
    const payload=rows.map(r=>{
      if(r.hifzEnd<r.hifzStart)throw new Error('نهاية الحفظ يجب ألا تسبق بدايته');if(!(r.sardStart>r.hifzEnd))throw new Error('بداية السرد يجب أن تكون بعد نهاية الحفظ للطالب');if(r.sardEnd<r.sardStart)throw new Error('نهاية السرد يجب ألا تسبق بدايته');
      if(!(r.sardTarget>0))throw new Error('هدف السرد يجب أن يكون أكبر من صفر');if(![ROUTE_NAS,ROUTE_BAQ].includes(r.route))throw new Error('اتجاه السرد غير صالح');
      return {plan_id:r.planId,student_id:r.studentId,hifz_completed_pages:Math.max(0,r.hifzCompleted),hifz_target_pages:r.hifzTarget??null,hifz_completion_percent:r.hifzTarget>0.001?R(Math.max(0,r.hifzCompleted)/r.hifzTarget*100,1):null,hifz_start_date:r.hifzStart,hifz_end_date:r.hifzEnd,sard_start_date:r.sardStart,sard_end_date:r.sardEnd,sard_target_pages:r.sardTarget,sard_route_direction:r.route,sard_weekdays:[...new Set(r.weekdays)].filter(x=>x>=0&&x<=6),carry_shortfall_pages:Math.max(0,r.carry||0)};
    });
    await send({kind:'rpc',name:'rc113_bulk_configure_plan_cycles',args:{p_rows:payload}});await load(true);
  }
  async function saveTemplate(halaqaId,name,mode,definition,id){
    needOnline();if(!['dates','weeks','manual'].includes(mode))throw new Error('نوع قالب المراحل غير صالح');
    const obj={id:id||crypto.randomUUID(),halaqa_id:halaqaId,name:(name||'').trim()||'خطة الحفظ الشهرية',template_mode:mode,definition,active:true,updated_at:new Date().toISOString(),created_by:state.user.id};
    await send({kind:'upsert',table:'smart_plan_phase_templates',obj,onConflict:'id'});S.templates=[obj,...S.templates.filter(x=>x.id!==obj.id)];saveSnap();await load(true);return obj.id;
  }
  async function applyTemplate(plan,tpl){
    needOnline();
    if(tpl.halaqa_id!==plan.halaqa_id)throw new Error('القالب لا يخص هذه الحلقة');
    if(phasesOf(plan.id).length)throw new Error('الخطة تحتوي مراحل بالفعل');
    const ps=String(plan.start_date).slice(0,10),pe=String(plan.end_date).slice(0,10),def=tpl.definition||{},month=ps.slice(0,7);
    const clamp=d=>d<ps?ps:d>pe?pe:d,dim=new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).getUTCDate();
    const monthDay=day=>{if(day<=0)return clamp(`${month}-${String(dim).padStart(2,'0')}`);return clamp(`${month}-${String(Math.min(Math.max(day,1),dim)).padStart(2,'0')}`)};
    const defs=[],days=Math.round((parse(pe)-parse(ps))/864e5)+1;
    const pair=(hs,he,ss,se)=>{
      const sHs=clamp(hs),sHe=clamp(he<sHs?sHs:he),sSs=clamp(ss<addDays(sHe,1)?addDays(sHe,1):ss),sSe=clamp(se<sSs?sSs:se);
      defs.push({planId:plan.id,phaseOrder:1,phaseType:'hifz',title:'مرحلة الحفظ',startDate:sHs,endDate:sHe,weekdays:(plan.schedule_weekdays||[]).length?plan.schedule_weekdays:[0,1,2,3,4],goalMode:'pages',goalUnit:'pages',targetPages:plan.target_pages,distributionMode:def.hifz_distribution||'flexible',startMode:'plan_start',rangeStartPage:plan.range_start_page,rangeEndPage:plan.range_end_page,rangeStartSurah:plan.range_start_surah,rangeStartAyah:plan.range_start_ayah,rangeEndSurah:plan.range_end_surah,rangeEndAyah:plan.range_end_ayah,status:'active'});
      const mode=['pages','juz','quran_range','open'].includes(def.sard_goal_mode)?def.sard_goal_mode:'pages';
      const units=mode==='open'?null:Number(def.sard_target_units??(mode==='juz'?1:25));
      const pages=mode==='open'?null:mode==='juz'?units*20:(Number(def.sard_target_pages??units??25)>0?Number(def.sard_target_pages??units??25):null);
      defs.push({planId:plan.id,phaseOrder:2,phaseType:'sard',title:'مرحلة السرد',startDate:sSs,endDate:sSe,weekdays:[0,1,2,3,4,5],goalMode:mode,goalUnit:{juz:'juz',quran_range:'range',open:'open'}[mode]||'pages',targetUnits:units,targetPages:pages,distributionMode:def.sard_distribution||'flexible',startMode:def.sard_start_mode||'last_sard',settings:{route_direction:[ROUTE_NAS,ROUTE_BAQ].includes(def.sard_route_direction)?def.sard_route_direction:(plan.plan_type==='hifz'?ROUTE_NAS:ROUTE_BAQ)},status:'active'});
    };
    const off=k=>def[k]!=null?Number(def[k]):null;
    if(tpl.template_mode==='dates'){
      const hs=off('hifz_start_offset_days')!=null?clamp(addDays(ps,off('hifz_start_offset_days'))):monthDay(Number(def.hifz_start_day??1)),he=off('hifz_end_offset_days')!=null?clamp(addDays(ps,off('hifz_end_offset_days'))):monthDay(Number(def.hifz_end_day??24));
      const ss=off('sard_start_offset_days')!=null?clamp(addDays(ps,off('sard_start_offset_days'))):monthDay(Number(def.sard_start_day??(Number(he.slice(8))+1))),se=off('sard_end_offset_days')!=null?clamp(addDays(ps,off('sard_end_offset_days'))):(Number(def.sard_end_day??0)<=0?pe:monthDay(Number(def.sard_end_day)));
      pair(hs,he,ss,se);
    }else if(tpl.template_mode==='weeks'){
      const hw=Math.max(1,Number(def.hifz_weeks??3)),sw=Math.max(1,Number(def.sard_weeks??1));
      if(days<(hw+sw)*7)throw new Error(`مدة الخطة أقصر من قالب ${hw} أسابيع حفظ + ${sw} أسبوع سرد`);
      const ss=addDays(pe,-(sw*7-1)),minHe=addDays(ps,hw*7-1);if(addDays(ss,-1)<minHe)throw new Error('قالب الأسابيع يسبب تداخلًا بين الحفظ والسرد');
      pair(ps,addDays(ss,-1),ss,pe);
    }else{
      const arr=Array.isArray(def.phases)?def.phases:[];
      arr.forEach((row,i)=>{
        const order=Math.max(1,Number(row.phase_order??i+1)),type=row.phase_type||(order===1?'hifz':'sard');
        const st=row.start_offset_days!=null?clamp(addDays(ps,Number(row.start_offset_days))):clamp(String(row.start_date||ps).slice(0,10)),en0=row.end_offset_days!=null?clamp(addDays(ps,Number(row.end_offset_days))):clamp(String(row.end_date||pe).slice(0,10)),mode=row.goal_mode||'pages',units=row.target_units!=null?Number(row.target_units):null;
        const pages=row.target_pages!=null?Number(row.target_pages):type==='hifz'?plan.target_pages:(type==='sard'&&mode==='pages'?25:null);
        defs.push({planId:plan.id,phaseOrder:order,phaseType:type,title:row.title||(type==='sard'?'مرحلة السرد':'مرحلة الحفظ'),startDate:st,endDate:en0<st?st:en0,weekdays:row.schedule_weekdays||(type==='sard'?[0,1,2,3,4,5]:plan.schedule_weekdays||[0,1,2,3,4]),goalMode:mode,goalUnit:row.goal_unit||{juz:'juz',quran_range:'range',open:'open'}[mode]||'pages',targetUnits:units,targetPages:pages,distributionMode:row.distribution_mode||'flexible',startMode:row.start_mode||(type==='sard'?'last_sard':'plan_start'),rangeStartPage:row.range_start_page,rangeEndPage:row.range_end_page,rangeStartSurah:row.range_start_surah,rangeStartAyah:row.range_start_ayah,rangeEndSurah:row.range_end_surah,rangeEndAyah:row.range_end_ayah,allowSurplus:row.allow_surplus!==false,settings:row.settings||(type==='sard'?{route_direction:plan.plan_type==='hifz'?ROUTE_NAS:ROUTE_BAQ}:{}),status:'active'});
      });
      if(!defs.length)throw new Error('القالب اليدوي لا يحتوي مراحل');
    }
    for(const d of defs.sort((a,b)=>a.phaseOrder-b.phaseOrder))await savePhase(d);
  }
  async function startMonth(){
    if(!isOnline())throw new Error('يلزم اتصال بالإنترنت لبدء دورة شهر جديدة');const m=T0().slice(0,8)+'01';
    const {data,error}=await db.rpc('rc19_start_month',{p_month_start:m});if(error)throw error;S.recs.clear();await load(true);return data;
  }
  window.RC27Phases={S,snapshot,previewPagesFrom,load,loadRecs,flush,savePhase,setPhaseStatus,upsertState,completePhaseForStudent,transition,bulkCycles,saveTemplate,applyTemplate,startMonth,progress,activePhase,validateTimeline,enginePhase,completedPages,lifecycle,hifzSpanPages};

  // ================= recitation tagging (native: tathbit never carries a phase) =================
  window.rc27TagPhase=function(data){
    try{
      if(!S.phases.length||data.activity_type==='tathbit'||data.activity_type==='review_far'&&studentOf(data.student_id)?.track_code==='tathbit')return;
      const se=state.sessions.find(x=>String(x.id)===String(data.session_id)),date=se?.session_date||T0();
      const plan=S.plans.find(p=>p.student_id===data.student_id&&p.scope_type==='student'&&p.status==='active'&&String(p.start_date).slice(0,10)<=date&&String(p.end_date).slice(0,10)>=date);if(!plan)return;
      const ph=activePhase(phasesOf(plan.id).map(enginePhase),S.states,data.student_id,date);if(!ph)return;
      const okType=ph.type==='hifz'?data.activity_type==='new_hifz':ph.type==='sard'?data.activity_type==='sard':false;if(!okType)return;
      data.phase_id=ph.id;data.selection_data=Object.assign({},data.selection_data,{smart_plan_phase_id:ph.id});
    }catch(_e){}
  };
  setInterval(()=>window.rc27PhasesPreload(),120000);
  setTimeout(()=>window.rc27PhasesPreload(),9000);
})();
