/* RC27.40 native screens: phases — web twin of SmartPlanPhasesUi.kt / SmartPlanBulkCycleUi.kt / PlanRangeRebaseDialog.kt.
   Engine, writes and offline outbox stay in rc27/phases.js (window.RC27Phases); this file only rebuilds the UI layer with the NX kit
   and re-assigns the same global handlers that rc27/plans.js defined (rc27PhaseForm/State/Transition/Complete/Archive/Templates,
   rc27BulkCycle/BulkSave, rc27StartMonth, rc27RebaseOpen/Apply, rc27GapCheck, rc27RefreshPhases…).
   The phases section of the plans page (#rc27Phases) is re-painted whenever the legacy code (re)writes it.
   Public hooks for the plans page: NXPhases.planHtml(plan) · NXPhases.paint(box) · NXPhases.openManager(planId). */
(function(){
  'use strict';
  if(!window.NX||!window.RC27Phases)return;
  const NX=window.NX,h=NX.h,ic=NX.icon;
  const P=()=>window.RC27Phases,S=()=>P().S;
  const iso=d=>d.toISOString().slice(0,10),T0=()=>iso(new Date());
  const addDays=(s,n)=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return iso(d)};
  const n1=v=>String(Math.round((Number(v)||0)*10)/10);
  const TYPE_AR={hifz:'حفظ',sard:'سرد',tathbit:'تثبيت'};
  const ST_AR={draft:'مسودة',active:'جارية',completed:'مكتملة',archived:'مؤرشفة'};
  const PS_AR={not_started:'لم تبدأ',active:'جارية',completed:'مكتملة',skipped:'مستثناة'};
  const LC_AR={scheduled:'مجدولة',active:'جارية',ended:'انتهت',completed:'مكتملة',skipped:'مستثناة'};
  const LC_KIND={scheduled:'info',active:'success',ended:'warning',completed:'neutral',skipped:'neutral'};
  const LC_ICON={scheduled:'Schedule',active:'PlayArrow',ended:'Event',completed:'CheckCircle',skipped:''};
  const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const ROUTE_NAS='reverse_surahs_forward_ayahs',ROUTE_BAQ='forward_surahs_forward_ayahs';
  const routeLabel=r=>r===ROUTE_NAS?'من الناس باتجاه البقرة':'من البقرة باتجاه الناس';
  const START_AR={last_sard:'آخر سرد (قديم)',last_activity:'آخر تسميع معتمد',manual:'تحديد يدوي',range_start:'بداية نطاق',plan_start:'بداية الخطة'};
  const typeIcon=t=>t==='sard'?'RecordVoiceOver':'MenuBook';
  const canWrite=()=>typeof roleCanManage==='function'&&roleCanManage();
  const stuOf=sid=>(window.RC27?.master?.students||state.students||[]).find(s=>s.id===sid);
  const sName=sid=>stuOf(sid)?.full_name||'طالب';
  const val=id=>document.getElementById(id)?.value??'';
  const num=id=>{const v=String(val(id)).trim();return v===''?null:Number(v)};
  const D10=v=>String(v||'').slice(0,10);
  const sur=s=>(window.surahs||[])[s-1]||('سورة '+s);
  const locLabel=l=>l?`${sur(l.s)} ${l.a}`:'—';
  const phaseTitle=p=>(p.title||'').trim()||(p.phase_type==='sard'?'مرحلة السرد':p.phase_type==='tathbit'?'مرحلة التثبيت':'مرحلة الحفظ');
  const toastMsg=m=>{try{toast(m)}catch(_e){}};
  async function guard(fn){try{await fn()}catch(e){toastMsg(e.message||String(e))}}
  const DID='nxPh',DID2='nxPh2';
  const dlg=(title,body,o)=>NX.dialog(DID,title,body,o);
  const closeDlg=()=>{NX.closeDialog(DID2);NX.closeDialog(DID)};
  const cancelBtn=(label,id)=>NX.btn(label||'إلغاء',{kind:'text',onclick:`NX.closeDialog('${id||DID}')`});
  const loadRecsFor=async ids=>{try{await P().loadRecs(ids)}catch(_e){}};

  // ---------- small form widgets ----------
  const opt=(g,v,label,on,multi,extra)=>`<button type="button" class="nx-chip nph-opt ${on?'on':''} ${extra||''}" data-g="${g}" data-v="${h(v)}" aria-pressed="${on?'true':'false'}" onclick="nxPhOpt(this,${multi?'true':'false'})">${label}</button>`;
  const grid=(cols,inner)=>`<div class="nph-grid" style="--c:${cols}">${inner}</div>`;
  const picked=(root,g)=>[...(root||document).querySelectorAll(`[data-g="${g}"].on`)].map(x=>x.dataset.v);
  const lab=t=>`<div class="nph-lab">${t}</div>`;
  const dateF=(id,label,value)=>`<label class="nx-field nph-datef"><span>${label}</span><div class="nph-datewrap">${ic('CalendarMonth',18)}<input type="date" id="${id}" value="${h(value||'')}"></div></label>`;
  const surahSel=(id,v)=>`<select id="${id}"><option value="">—</option>${(window.surahs||[]).map((n,i)=>`<option value="${i+1}" ${+v===i+1?'selected':''}>${i+1}. ${h(n)}</option>`).join('')}</select>`;
  const dayChips=(g,sel)=>grid(3,DAYS.map((n,i)=>opt(g,i,n,sel.includes(i),true)).join(''));
  window.nxPhOpt=function(el,multi){
    const root=el.closest('.nph-form'),g=el.dataset.g;
    if(multi)el.classList.toggle('on');
    else{(root||document).querySelectorAll(`[data-g="${g}"]`).forEach(x=>{x.classList.remove('on');x.setAttribute('aria-pressed','false')});el.classList.add('on')}
    el.setAttribute('aria-pressed',el.classList.contains('on')?'true':'false');
    if(root){if(!multi)root.dataset[g]=el.dataset.v;window.nxPhChanged(root,g)}
  };

  // ---------- quran helpers (same math as rc27/plans.js) ----------
  let pageIdx=null;
  function layoutOf(){return typeof smartPlanQuranLayout==='function'?smartPlanQuranLayout():null}
  function pageRanges(layout){if(pageIdx)return pageIdx;const m=new Map;for(let g=1;g<layout.page.length;g++){const pg=layout.page[g];if(!pg)continue;const r=m.get(pg);if(!r)m.set(pg,[g,g]);else r[1]=g}return pageIdx=m}
  const locOfGlobal=g=>{let s=1;while(s<114&&ayahPrefix[s]<g)s++;return {s,a:g-ayahPrefix[s-1]}};
  function endpointOfLine(key,preferLast){
    const layout=layoutOf(),m=/^(\d+):(\d+)$/.exec(key);if(!layout||!m)return null;const r=pageRanges(layout).get(+m[1]);if(!r)return null;const line=+m[2],c=[];
    for(let g=r[0];g<=r[1];g++){const f=Number(layout.first?.[g]||0),l=Number(layout.last?.[g]||f);if(line>=f&&line<=l)c.push(g)}
    const g=preferLast?c.at(-1):c[0];return g?locOfGlobal(g):null;
  }
  function pageStartLoc(page){const l=layoutOf();if(!l)return null;for(let g=1;g<l.page.length;g++)if(l.page[g]===page)return locOfGlobal(g);return null}
  function orderedLines(from,to,route){
    const layout=layoutOf();if(!layout)return null;const out=[],seen=new Set,step=route===ROUTE_NAS?-1:1;
    for(let s=from.s;step<0?s>=to.s:s<=to.s;s+=step){const a0=s===from.s?from.a:1,a1=s===to.s?to.a:ayahCounts[s-1];for(let a=a0;a<=a1;a++)for(const k of smartPlanAyahLineKeys(s,a,layout)){if(!seen.has(k)){seen.add(k);out.push(k)}}}
    return out;
  }
  const posR=(s,a,route)=>((route===ROUTE_NAS?200-s:s)*1000)+a;
  const termOf=route=>{const s=route!==ROUTE_NAS?114:2;return {s,a:ayahCounts[s-1]}};
  const routeOf=plan=>plan.settings?.route_direction||(plan.plan_type==='hifz'?ROUTE_NAS:ROUTE_BAQ);
  const passingEv=ev=>!['repeat','weak','إعادة','ضعيف'].includes(String(ev||'').toLowerCase());
  function nextLoc(e,route){if(e.a<ayahCounts[e.s-1])return {s:e.s,a:e.a+1};const n=route===ROUTE_NAS?e.s-1:e.s+1;return (n<1||n>114)?null:{s:n,a:1}}
  const recKey=r=>String(r.session_date||'')+'|'+String(r.created_at||'');

  // ---------- data ----------
  function plansForScope(){
    const ids=new Set((state.students||[]).filter(s=>s.status!=='withdrawn').map(s=>s.id)),t=T0();
    return S().plans.filter(p=>p.scope_type==='student'&&p.status==='active'&&ids.has(p.student_id)&&D10(p.end_date)>=t&&D10(p.start_date)<=t);
  }
  const phasesOfPlan=pid=>S().phases.filter(p=>p.plan_id===pid&&p.status!=='archived').sort((a,b)=>a.phase_order-b.phase_order);
  const stateOf=(pid,sid)=>S().states.find(x=>x.phase_id===pid&&x.student_id===sid);
  const isTathbitPlan=plan=>plan.plan_type==='tathbit'||stuOf(plan.student_id)?.track_code==='tathbit';
  function snapOf(plan){try{return P().snapshot(plan,T0())}catch(_e){return null}}

  // ---------- daily duty (ورد اليوم) ----------
  function dutyCard(title,body,sid,kind,next,icon){
    const btn=(kind&&canWrite())?NX.btn('سمّع الآن',{kind:'tonal',small:true,icon:'RecordVoiceOver',onclick:`rc27DutyNow('${sid}','${kind}')`}):'';
    return `<div class="nph-duty"><span class="nph-duty-ic">${ic(icon||'MenuBook',22)}</span><div class="nph-duty-t"><b>${title}</b><p>${body}</p>${next?`<small>${next}</small>`:''}</div>${btn}</div>`;
  }
  function actDutyHtml(plan,t){
    const A=window.RC27PhaseActivities,sn=P().snapshot?P().snapshot(plan,t):null;if(!A||!sn)return null;
    const acts=A(plan,sn,t);if(!acts.length)return null;
    const lab=a=>{const ln=a.lineKeys||[];if(!ln.length)return '';const e=endpointOfLine(ln.at(-1),true);return e?`من ${h(sur(a.start.s))}:${a.start.a} إلى ${h(sur(e.s))}:${e.a} · ≈ ${n1(a.pages)} ص`:''};
    const sid=plan.student_id;
    return acts.map(x=>{
      const kind=x.key==='sard'?'sard':x.key==='review'?'review':'new_hifz';
      let body;
      if(x.assignment)body=lab(x.assignment);
      else if(x.needsStart)body='لا يوجد تسميع سرد سابق ولا نقطة بداية محددة. حدّد بداية المرحلة أو سجّل أول تسميع.';
      else if(x.extraAssignment)body='ليس يوم دوام · ورد إضافي: '+lab(x.extraAssignment);
      else body=x.scheduledToday?'لا مقرر إضافي اليوم':'ليس يوم دوام لهذه الخطة';
      const nx=x.nextDuty?`التالي ${h(D10(x.nextDuty.date))}: ${lab(x.nextDuty.assignment)}`:'';
      return dutyCard(`ورد اليوم (${h(x.label||x.key)})`,body,sid,x.assignment?kind:null,nx,x.key==='sard'?'RecordVoiceOver':x.key==='review'?'Replay':'MenuBook');
    }).join('');
  }
  function dutyHtml(plan,phs){
    try{const r=actDutyHtml(plan,T0());if(r)return r}catch(_e){}
    try{
      const t=T0(),sid=plan.student_id,act=P().activePhase(phs.map(P().enginePhase),S().states,sid,t);if(!act)return '';
      try{
        const sn=P().snapshot?P().snapshot(plan,t):null;
        if(sn&&sn.raw&&sn.plan&&typeof decorateSmartPlanAssignment==='function'){
          const a=decorateSmartPlanAssignment({...sn.plan,plan_type:sn.plan.plan_type},sn.raw,sid,t);
          if(a&&a.ayahLabel&&Number(a.pages||a.scheduledPages||0)>0)return dutyCard(`ورد اليوم (${TYPE_AR[sn.plan.plan_type]||''})`,`${typeof smartPlanAssignmentLabel==='function'?h(smartPlanAssignmentLabel(a)):h(a.ayahLabel)} · ≈ ${n1(a.pages||a.scheduledPages)} ص`,sid,sn.plan.plan_type==='sard'?'sard':'new_hifz');
        }
      }catch(_e){}
      const raw=phs.find(x=>x.id===act.id),st=stateOf(act.id,sid),done=P().completedPages(plan,raw,sid,st),pr=P().progress(act,done,t,st);
      if(pr.complete&&pr.suggested==null)return '';
      const recs=S().recs.get(sid)||[];
      if(raw.phase_type==='hifz'){
        const rt=routeOf(plan),terminal=termOf(rt),ends=recs.filter(r=>['new_hifz','hifz'].includes(String(r.activity_type).toLowerCase())&&r.end_surah&&r.end_ayah&&passingEv(r.evaluation)).sort((a,b)=>recKey(a)<recKey(b)?-1:1),last=ends.at(-1);
        const msg=last&&posR(+last.end_surah,+last.end_ayah,rt)>=posR(terminal.s,terminal.a,rt)?'أتمّ الطالب مسار الحفظ كاملًا ووصل إلى نهايته. أنشئ له خطة مراجعة أو تثبيت أو غيّر مساره.':!last?'لا يوجد تسميع حفظ سابق لتحديد نقطة البداية. سجّل أول تسميع للطالب ليظهر المقرر.':'لم يُحسب مقدار الحفظ لهذا اليوم. راجع هدف الخطة وأيام الدوام.';
        return dutyCard('ورد اليوم (الحفظ)',h(msg),sid,null);
      }
      const route=raw.phase_type==='sard'?(raw.settings?.route_direction||routeOf(plan)):routeOf(plan),typeOk=a=>raw.phase_type==='sard'?String(a).toLowerCase()==='sard':['new_hifz','hifz'].includes(String(a).toLowerCase());
      const last=recs.filter(r=>String(r.session_date)<=t&&typeOk(r.activity_type)&&r.end_surah&&r.end_ayah).sort((a,b)=>recKey(a)<recKey(b)?-1:1).at(-1);
      let start=null;
      if(last&&!(raw.start_mode==='manual'||raw.start_mode==='range_start'))start=nextLoc({s:+last.end_surah,a:+last.end_ayah},route);
      else if(raw.range_start_surah&&raw.range_start_ayah)start={s:raw.range_start_surah,a:raw.range_start_ayah};
      else if(raw.phase_type==='hifz'&&plan.range_start_surah&&plan.range_start_ayah)start={s:plan.range_start_surah,a:plan.range_start_ayah};
      else if(raw.phase_type==='sard')start=route===ROUTE_NAS?{s:114,a:1}:{s:1,a:1};
      const pages=pr.suggested;
      if(!start||pages==null||pages<=0)return dutyCard(`ورد اليوم (${TYPE_AR[raw.phase_type]})`,pages===0?'لا مقرر إضافي اليوم':'يُحدَّد من المعلّم',sid,null,'',typeIcon(raw.phase_type));
      const all=orderedLines(start,termOf(route),route)||[];if(!all.length)return '';
      const lines=all.slice(0,Math.max(1,Math.round(pages*15))),end=endpointOfLine(lines.at(-1),true);if(!end)return '';
      return dutyCard(`ورد اليوم (${TYPE_AR[raw.phase_type]})`,`من ${h(sur(start.s))}:${start.a} إلى ${h(sur(end.s))}:${end.a} · ≈ ${n1(pages)} ص`,sid,raw.phase_type==='sard'?'sard':'new_hifz',null,typeIcon(raw.phase_type));
    }catch(_e){return ''}
  }

  // ---------- timeline (PlanPhaseTimelineInline) ----------
  function timelineHtml(plan,phs,sn){
    const t=T0(),active=sn?.phase||null,pp=sn?.phaseProgress||null;
    let pill='';
    if(active){
      const actually=!!pp,txt=actually?(active.phase_type==='sard'?'السرد نشط':'الحفظ نشط'):(t<D10(active.start_date)?'المرحلة القادمة':'آخر مرحلة');
      pill=`<span class="nph-secpill">${ic(typeIcon(active.phase_type),17)}<span>${txt}</span></span>`;
    }
    const chips=phs.map((p,i)=>{
      const on=active&&active.id===p.id;
      return `<div class="nph-step ${on?'on':''}"><b>${i+1}. ${h(phaseTitle(p))}</b><small>${D10(p.start_date)} ← ${D10(p.end_date)}</small></div>${i<phs.length-1?`<span class="nph-arrow">${ic('ArrowBack',20)}</span>`:''}`;
    }).join('');
    let prog='';
    if(pp){
      const goal=pp.target!=null?`${n1(pp.completed)} / ${n1(pp.target)} ص`:`سرد مفتوح · ${n1(pp.completed)} ص منجزة`;
      prog+=`<div class="nph-goal">${goal}</div>`;
      if(pp.suggested!=null&&pp.suggested>.001)prog+=`<div class="nph-sub">المقترح اليوم ${n1(pp.suggested)} ص · توزيع ${active.distribution_mode==='equal'?'متساوٍ':'مرن'}</div>`;
      if(active.phase_type==='sard'){
        try{
          const sa=(window.RC27PhaseActivities?window.RC27PhaseActivities(plan,sn,t):[]).find(x=>x.key==='sard');
          const last=sa?.lastRecitation;
          if(last){const anchor=last.end_surah&&last.end_ayah?`${sur(+last.end_surah)} ${last.end_ayah}`:last.end_page?('ص '+last.end_page):'—';prog+=`<div class="nph-sub">آخر سرد: ${h(anchor)} · ${h(D10(last.session_date))}</div>`}
          if(sa?.needsStart)prog+=`<div class="nph-err">يلزم تحديد نقطة بداية السرد لأن آخر Sard Anchor غير متاح.</div>`;
        }catch(_e){}
      }
    }
    return `<div class="nph-tl"><div class="nph-tl-head">${ic('Timeline',22)}<b>الخط الزمني للخطة</b><span class="nph-grow"></span>${pill}</div><div class="nph-tl-row">${chips}</div>${prog}</div>`;
  }

  // ---------- phase card ----------
  function goalText(p){
    const m=p.goal_mode;
    if(m==='open')return 'الهدف: سرد مفتوح';
    if(m==='juz')return `الهدف: ${n1(p.target_units??((p.target_pages||0)/20))} جزء`;
    if(m==='quran_range')return 'الهدف: نطاق قرآني · '+(p.target_pages!=null?n1(p.target_pages)+' ص':'حسب النطاق');
    return `الهدف: ${n1(p.target_pages||0)} صفحة`;
  }
  function phaseCard(plan,p,i,phs){
    const t=T0(),sid=plan.student_id,en=P().enginePhase(p),st=stateOf(p.id,sid),lc=P().lifecycle(en,st,t),done=P().completedPages(plan,p,sid,st),pr=P().progress(en,done,t,st),next=phs[i+1];
    const w=canWrite(),sard=p.phase_type==='sard',pid=h(plan.id),phid=h(p.id);
    const days=[...(p.schedule_weekdays||[])].sort((a,b)=>a-b).map(d=>DAYS[d]||'—').join('، ');
    const meta=`الأيام: ${days||'—'} · البداية: ${START_AR[p.start_mode]||START_AR.plan_start} · ${p.distribution_mode==='equal'?'متساوٍ':'مرن'}`;
    const pills=[NX.pill(TYPE_AR[p.phase_type]||p.phase_type,'info',{icon:typeIcon(p.phase_type)}),NX.pill(LC_AR[lc],LC_KIND[lc],{icon:LC_ICON[lc]})];
    if(p.status!=='active')pills.push(NX.pill(ST_AR[p.status]||p.status,'neutral'));
    const bar=pr.target!=null
      ?`<div class="nph-prog"><div class="nph-prog-row"><span>منجز ${n1(pr.completed)} / ${n1(pr.target)} ص${st?.carry_shortfall_pages>0?` · مرحَّل ${n1(st.carry_shortfall_pages)}`:''}</span><b>${pr.percentage??0}%</b></div>${NX.progress(pr.percentage||0)}${pr.suggested!=null&&lc==='active'?`<small>المقترح اليوم ${n1(pr.suggested)} ص</small>`:''}</div>`
      :`<div class="nph-prog"><div class="nph-prog-row"><span>منجز ${n1(pr.completed)} ص</span></div></div>`;
    const surplusOk=sard&&lc==='active'&&pr.complete&&p.allow_surplus!==false&&st?.settings?.continue_surplus!==true;
    let actions='',kebab='';
    if(w){
      const done_=lc==='completed';
      const primary=done_?'':next
        ?NX.btn(p.phase_type==='hifz'&&next.phase_type==='sard'?'إنهاء الحفظ':'إنهاء والانتقال',{kind:'tonal',icon:'DoneAll',onclick:`rc27PhaseTransition('${pid}','${phid}','${h(next.id)}')`})
        :NX.btn(sard?'إنهاء السرد':'إكمال المرحلة',{kind:sard?'filled':'tonal',icon:'DoneAll',onclick:`rc27PhaseComplete('${pid}','${phid}')`});
      actions=`<div class="nph-actions">${primary}${surplusOk?NX.btn('استمرار إضافي',{kind:'text',onclick:`rc27PhaseSurplus('${phid}','${h(sid)}')`}):''}${NX.btn('تعديل إعدادات المرحلة',{kind:'outlined',icon:'Edit',onclick:`rc27PhaseForm('${pid}','${phid}')`})}</div>`;
      kebab=NX.kebab([
        {label:'تعديل المرحلة',icon:'Edit',onclick:()=>rc27PhaseForm(plan.id,p.id)},
        {label:'حالة الطالب',icon:'Person',onclick:()=>rc27PhaseState(p.id,sid)},
        {label:'أرشفة',icon:'Archive',danger:true,onclick:()=>rc27PhaseArchive(p.id)}
      ]);
    }
    return `<div class="nph-phase ${lc==='active'?'now':''}"><div class="nph-phase-head"><span class="nph-type-ic">${ic(typeIcon(p.phase_type),22)}</span><div class="nph-grow"><b class="nph-ttl">${h(phaseTitle(p))}</b><small>المرحلة #${p.phase_order} · ${TYPE_AR[p.phase_type]||''}</small></div>${kebab}</div><div class="nph-pills">${pills.join('')}</div><div class="nph-line"><b>${D10(p.start_date)} ← ${D10(p.end_date)} · ${goalText(p)}</b></div><div class="nph-meta">${h(meta)}</div>${bar}${actions}</div>`;
  }

  // ---------- plan card ----------
  function tathbitMonthly(plan,sn){
    const rs=plan.range_start_surah,re=plan.range_end_surah;
    const range=rs&&re?`${sur(rs)} ${plan.range_start_ayah||1} ← ${sur(re)} ${plan.range_end_ayah||''}`.trim():plan.range_start_page&&plan.range_end_page?`ص ${plan.range_start_page} ← ص ${plan.range_end_page}`:'غير محدد';
    const days=[...(plan.schedule_weekdays||[])].sort((a,b)=>a-b).map(d=>DAYS[d]).join('، ')||'—';
    const target=Number(plan.target_pages)||0,done=Number(sn?.completed)||0,pct=target>0?Math.max(0,Math.min(100,done/target*100)):0;
    return `<div class="nph-tath"><div class="nph-tl-head">${ic('Timeline',22)}<b>خطة التثبيت الشهرية</b></div><p class="nph-sub">المسار دائم (تثبيت) والخطة شهرية. عند نهاية الشهر تُجمَّد نتيجتها للتقارير وتبدأ خطة الشهر التالي تلقائيًا.</p><div class="nph-kv"><span>المدة</span><b>${D10(plan.start_date)} ← ${D10(plan.end_date)}</b><span>نطاق التثبيت</span><b>${h(range)}</b><span>الهدف</span><b>${n1(target)} صفحة</b><span>أيام التسميع</span><b>${h(days)}</b></div>${NX.progress(pct)}<div class="nph-sub">المنجز ${n1(done)} ص · المتبقي ${n1(Math.max(0,target-done))} ص · ${n1(pct)}٪</div></div>`;
  }
  function planCard(plan){
    const phs=phasesOfPlan(plan.id),eng=phs.map(P().enginePhase),issues=(()=>{try{return P().validateTimeline(eng)}catch(_e){return []}})();
    const tath=isTathbitPlan(plan),w=canWrite(),sn=snapOf(plan),pid=h(plan.id);
    const hasH=phs.some(p=>p.phase_type==='hifz'),hasS=phs.some(p=>p.phase_type==='sard'),hasT=phs.some(p=>p.phase_type==='tathbit');
    const menu=[];
    if(w){
      if(tath){if(!hasT)menu.push({label:'إضافة مرحلة تثبيت',icon:'Add',onclick:()=>rc27PhaseForm(plan.id,null,'tathbit')})}
      else{
        if(!hasH)menu.push({label:'إضافة الحفظ',icon:'MenuBook',onclick:()=>rc27PhaseForm(plan.id,null,'hifz')});
        if(!hasS)menu.push({label:'إضافة السرد',icon:'RecordVoiceOver',onclick:()=>rc27PhaseForm(plan.id,null,'sard')});
        if(!phs.length)menu.push({label:'إنشاء حفظ + سرد (25 صفحة)',icon:'AutoAwesome',onclick:()=>rc27PhaseQuickCreate(plan.id)});
        menu.push({label:'قوالب المراحل',icon:'BookmarkAdd',onclick:()=>rc27PhaseTemplates(plan.id)});
      }
    }
    const head=`<div class="nph-plan-head">${NX.avatar(sName(plan.student_id))}<div class="nph-grow"><b class="nph-name">${h(sName(plan.student_id))}</b><small>${D10(plan.start_date)} ← ${D10(plan.end_date)}</small></div>${menu.length?NX.kebab(menu):''}</div>`;
    let body='';
    if(tath&&!phs.length)body=tathbitMonthly(plan,sn);
    else{
      if(phs.length)body+=timelineHtml(plan,phs,sn);
      if(issues.length){const blocking=issues.some(i=>i.blocking);body+=NX.insight(blocking?'danger':'warning',blocking?'ErrorOutline':'Warning','تحقق الخط الزمني','',{body:`<ul class="nph-issues">${issues.map(i=>`<li>${h(i.code==='gap'?('تنبيه: '+i.message+'؛ الخطة ستبقى ظاهرة لكن لن يُولد مقرر تلقائي في هذه الفجوة.'):i.message)}</li>`).join('')}</ul>`})}
      body+=dutyHtml(plan,phs);
      if(!phs.length){
        body+=`<div class="nph-init"><b>تهيئة الخطة كمراحل</b><p>سيتم إنشاء مرحلة حفظ ثم مرحلة سرد. السرد الافتراضي: 25 صفحة، توزيع مرن، والبداية من آخر سرد مستقل لكل طالب.</p>${w&&!tath?NX.btn('إنشاء حفظ + سرد (25 صفحة)',{kind:'filled',icon:'AutoAwesome',full:true,onclick:`rc27PhaseQuickCreate('${pid}')`}):''}</div>`;
        const tpls=S().templates.filter(tp=>!plan.halaqa_id||tp.halaqa_id===plan.halaqa_id).slice(0,6);
        if(w&&!tath&&tpls.length)body+=`<div class="nph-tpls"><b>قوالب الحلقة</b>${tpls.map(tp=>NX.btn(`${h(tp.name)} · ${({dates:'بالتاريخ',weeks:'بالأسابيع',manual:'يدوي'})[tp.template_mode]||''}`,{kind:'outlined',icon:'ContentPasteGo',full:true,onclick:`rc27ApplyTpl('${pid}','${h(tp.id)}')`})).join('')}</div>`;
      }else body+=`<div class="nph-phases">${phs.map((p,i)=>phaseCard(plan,p,i,phs)).join('')}</div>`;
      if(w&&phs.length){
        const add=[];
        if(tath){if(!hasT)add.push(NX.btn('إضافة مرحلة تثبيت',{kind:'outlined',icon:'Add',onclick:`rc27PhaseForm('${pid}',null,'tathbit')`}))}
        else{
          if(!hasH)add.push(NX.btn('إضافة الحفظ',{kind:'outlined',icon:'MenuBook',onclick:`rc27PhaseForm('${pid}',null,'hifz')`}));
          if(!hasS)add.push(NX.btn('إضافة السرد',{kind:'filled',icon:'RecordVoiceOver',onclick:`rc27PhaseForm('${pid}',null,'sard')`}));
        }
        if(add.length)body+=`<div class="nph-actions">${add.join('')}</div>`;
      }
    }
    return NX.card(`${head}<div class="nph-plan-body">${body}</div>`,{cls:'nph-plan nx-emph',dataId:plan.id});
  }

  // ---------- section (#rc27Phases) ----------
  function sectionHtml(){
    const w=canWrite(),q=typeof rc27PhaseQueueCount==='function'?rc27PhaseQueueCount():0;
    if(S().err&&!S().phases.length)return NX.insight('danger','Storage','تعذر تحميل مراحل الخطط',h(S().err),{body:'<p class="nph-sub">تحقق من الاتصال ثم أعد المحاولة.</p>'+NX.btn('تحديث',{kind:'tonal',icon:'Refresh',onclick:'rc27RefreshPhases()'})});
    const plans=plansForScope();
    const tools=w?`<div class="nph-tools">${NX.btn('إدارة جماعية للحفظ والسرد',{kind:'tonal',icon:'Groups',onclick:'rc27BulkCycle()'})}${NX.btn('قوالب المراحل',{kind:'tonal',icon:'BookmarkAdd',onclick:'rc27PhaseTemplates()'})}${NX.btn('بدء دورة شهر جديد',{kind:'tonal',icon:'CalendarMonth',onclick:'rc27StartMonth()'})}${NX.btn('ضبط نطاق الخطط',{kind:'tonal',icon:'Tune',onclick:'rc27RebaseOpen()'})}</div>`:'';
    const queue=q?NX.notice(`<div class="nph-queue">${ic('CloudUpload',20)}<span>${q} عملية على المراحل بانتظار الرفع</span>${navigator.onLine?NX.btn('رفع الآن',{kind:'text',small:true,onclick:'RC27Phases.flush()'}):''}</div>`,'warning'):'';
    return `${NX.section('مراحل الخطط',NX.iconBtn('Refresh',{title:'تحديث',onclick:'rc27RefreshPhases()'}))}${queue}${tools}${plans.length?`<div class="nph-plans">${plans.map(planCard).join('')}</div>`:NX.empty('لا توجد خطط فعّالة لطلاب هذا النطاق.',{icon:'Timeline'})}`;
  }
  let ready=false;
  function paint(box){
    box=box||document.getElementById('rc27Phases');if(!box)return;
    let html;try{html=ready?sectionHtml():NX.skeleton(2)}catch(e){console.error('nph paint',e);html=NX.notice('تعذر عرض مراحل الخطط','danger')}
    box.innerHTML=`<div class="nph-root">${html}</div>`;
  }
  async function refresh(box){
    try{
      await P().load(false);
      if(!(S().err&&!S().phases.length))await loadRecsFor(plansForScope().map(p=>p.student_id));
    }catch(_e){}
    ready=true;
    const cur=document.getElementById('rc27Phases');if(cur){cur.__nph=true;paint(cur)}
  }
  let sched=false;
  function check(){
    const box=document.getElementById('rc27Phases');if(!box)return;
    if(box.querySelector(':scope > .nph-root')){if(!box.__nph){box.__nph=true;refresh(box)}return}
    paint(box);
    if(!box.__nph){box.__nph=true;refresh(box)}
  }
  new MutationObserver(()=>{if(sched)return;sched=true;requestAnimationFrame(()=>{sched=false;try{check()}catch(e){console.error(e)}})}).observe(document.body,{childList:true,subtree:true});
  window.rc27RefreshPhases=async function(){await P().load(true);ready=true;if(document.getElementById('rc27Phases'))paint();if(typeof render==='function')render()};
  window.NXPhases={paint,planHtml:planCard,sectionHtml,openManager:planId=>rc27PhaseTemplates(planId)};
  window.rc27ClosePhaseDlg=closeDlg;

  // ---------- archive / quick create / surplus ----------
  window.rc27PhaseArchive=function(id){
    NX.confirm('أرشفة المرحلة','أرشفة هذه المرحلة؟ لن تُحذف التسميعات المرتبطة بها.','أرشفة',()=>guard(async()=>{await P().setPhaseStatus(id,'archived');toastMsg('تمت أرشفة المرحلة');rc27RefreshPhases()}),{danger:true});
  };
  window.rc27PhaseSurplus=function(phaseId,sid){guard(async()=>{
    const ex=stateOf(phaseId,sid)||{};
    await P().upsertState(phaseId,sid,{status:'active',carry:ex.carry_shortfall_pages??0,settings:{...(ex.settings||{}),continue_surplus:true}});
    toastMsg(`سيستمر ${sName(sid)} بسرد إضافي`);rc27RefreshPhases();
  })};
  window.rc27PhaseQuickCreate=function(planId){guard(async()=>{
    const plan=S().plans.find(p=>p.id===planId);if(!plan)throw new Error('الخطة غير موجودة');
    const start=D10(plan.start_date),end=D10(plan.end_date);
    const ss=addDays(end,-6)>addDays(start,1)?addDays(end,-6):addDays(start,1),he0=addDays(ss,-1),he=he0<start?start:he0;
    const wd=(plan.schedule_weekdays||[]).length?plan.schedule_weekdays:[0,1,2,3,4];
    await P().savePhase({planId,phaseOrder:1,phaseType:'hifz',title:'مرحلة الحفظ',startDate:start,endDate:he,weekdays:wd,goalMode:'pages',goalUnit:'pages',targetPages:plan.target_pages,distributionMode:'flexible',startMode:'plan_start',rangeStartPage:plan.range_start_page,rangeEndPage:plan.range_end_page,rangeStartSurah:plan.range_start_surah,rangeStartAyah:plan.range_start_ayah,rangeEndSurah:plan.range_end_surah,rangeEndAyah:plan.range_end_ayah,status:'active'});
    await P().savePhase({planId,phaseOrder:2,phaseType:'sard',title:'مرحلة السرد',startDate:ss,endDate:end,weekdays:[0,1,2,3,4,5],goalMode:'pages',goalUnit:'pages',targetPages:25,distributionMode:'flexible',startMode:'last_activity',settings:{route_direction:ROUTE_NAS},status:'active'});
    toastMsg('تم تجهيز المرحلتين محليًا وسيتم رفعهما بالمزامنة.');rc27RefreshPhases();
  })};

  // ================= phase editor (PhaseEditorDialog) =================
  const showErr=m=>{const e=document.getElementById('nphErr');if(e){e.textContent=m;e.hidden=false;e.scrollIntoView?.({block:'nearest'})}else toastMsg(m)};
  const formRoot=()=>document.querySelector(`#${DID} .nph-form[data-kind="phase"]`);
  function previewState(root){
    const plan=S().plans.find(p=>p.id===root.dataset.plan),type=root.dataset.type,goal=root.dataset.goal,sm=root.dataset.start;
    const route=type==='sard'?(picked(root,'route')[0]||ROUTE_NAS):(plan.settings?.route_direction||ROUTE_NAS);
    const startDate=val('nphStart'),sid=plan.student_id;
    const act=type==='sard'?['sard']:type==='tathbit'?['tathbit']:['new_hifz','hifz'];
    let latest=null;
    if(sm==='last_activity'){
      latest=(S().recs.get(sid)||[]).filter(r=>act.includes(String(r.activity_type).toLowerCase())&&r.end_surah&&r.end_ayah&&passingEv(r.evaluation)&&(!startDate||String(r.session_date).slice(0,10)<startDate)).sort((a,b)=>recKey(a)<recKey(b)?-1:1).at(-1)||null;
    }
    const ss=num('nphSS'),sa=num('nphSA'),es=num('nphES'),ea=num('nphEA'),sp=num('nphSP');
    let start=null;
    if(sm==='last_activity')start=latest?nextLoc({s:+latest.end_surah,a:+latest.end_ayah},route):null;
    else if(ss&&sa)start={s:ss,a:sa};
    else if(sp)start=pageStartLoc(sp);
    else if(sm==='plan_start'){
      if(plan.range_start_surah&&plan.range_start_ayah)start={s:plan.range_start_surah,a:plan.range_start_ayah};
      else if(plan.range_start_page)start=pageStartLoc(plan.range_start_page);
    }
    const numeric=num('nphTarget'),tp=goal==='pages'?numeric:goal==='juz'?(numeric!=null?numeric*20:null):null;
    let res=null;
    try{
      if(goal==='quran_range'&&ss&&sa&&es&&ea){const keys=window.rc27RouteLineKeys({s:ss,a:sa},{s:es,a:ea},route);if(keys&&keys.length)res={start:{s:ss,a:sa},end:{s:es,a:ea},pages:keys.length/15}}
      else if(start&&tp>0){const pv=P().previewPagesFrom(start,tp,route);if(pv&&pv.lineKeys.length)res={start:pv.start,end:pv.end,pages:pv.lineKeys.length/15}}
    }catch(_e){}
    return {plan,type,goal,sm,route,latest,start,res};
  }
  function updatePreview(root){
    const ps=previewState(root),an=document.getElementById('nphAnchor'),pv=document.getElementById('nphPrev'),cap=document.getElementById('nphRouteCap');
    if(cap)cap.textContent=ps.route===ROUTE_NAS?'الافتراضي لمسار الحفظ العام: من الناس باتجاه البقرة.':'اتجاه مخصص: من البقرة باتجاه الناس.';
    if(an){
      if(ps.sm!=='last_activity')an.innerHTML='';
      else{
        const lb=ps.type==='sard'?'آخر سرد':ps.type==='tathbit'?'آخر تثبيت':'آخر حفظ';
        an.innerHTML=`<div class="nph-tint"><b>آخر موضع معتمد قبل بداية المرحلة</b>${ps.latest
          ?`<p>${lb}: ${h(ps.latest.start_surah?locLabel({s:+ps.latest.start_surah,a:+ps.latest.start_ayah}):'—')} ← ${h(locLabel({s:+ps.latest.end_surah,a:+ps.latest.end_ayah}))}</p><small>التاريخ: ${h(D10(ps.latest.session_date))}</small>${ps.start?`<p><b>بداية المرحلة التالية: ${h(locLabel(ps.start))}</b></p>`:'<p class="nph-err">لا يوجد موضع تالٍ في الاتجاه المختار.</p>'}`
          :`<p class="nph-sub">لا يوجد موضع سابق معتمد لهذا الطالب قبل بداية المرحلة؛ سيستخدم النظام بداية الخطة إن كانت محددة.</p>${NX.btn('تحديد البداية يدويًا',{kind:'text',small:true,onclick:"nxPhOptV('start','manual')"})}`}</div>`;
      }
    }
    if(pv){
      let body;
      if(ps.goal==='open')body=`<p>سرد مفتوح: لا توجد نهاية محددة. سيبدأ من ${h(ps.start?locLabel(ps.start):'النقطة التي تحددها')}.</p>`;
      else if(ps.res)body=`<p><b>المطلوب: ${h(locLabel(ps.res.start))} ← ${h(locLabel(ps.res.end))}</b></p><small>الحجم المحسوب: ${n1(ps.res.pages)} صفحة · الاتجاه: ${routeLabel(ps.route)}</small>`;
      else if(ps.sm==='last_activity'&&!ps.latest)body='<p class="nph-sub">لا يوجد Anchor سابق معتمد؛ سيستخدم النظام بداية الخطة أو البداية اليدوية.</p>';
      else body='<p class="nph-sub">حدد بداية صحيحة وهدفًا حتى يظهر النطاق المتوقع.</p>';
      pv.innerHTML=`<div class="nph-prev-h">${ic('Preview',22)}<b>معاينة نطاق المرحلة قبل الحفظ</b></div>${body}`;
    }
  }
  window.nxPhOptV=function(g,v){const root=formRoot();if(!root)return;const el=root.querySelector(`[data-g="${g}"][data-v="${v}"]`);if(el)window.nxPhOpt(el,false)};
  const TYPE_DEF=(t,plan,hf,ps,pe)=>{
    const def24=ps.slice(0,7)+'-24';
    return {title:t==='sard'?'مرحلة السرد':t==='tathbit'?'مرحلة التثبيت':'مرحلة الحفظ',goal:'pages',target:t==='sard'?'25':n1(plan.target_pages),start:t==='sard'?'last_activity':'plan_start',days:t==='sard'?[0,1,2,3,4,5]:((plan.schedule_weekdays||[]).length?plan.schedule_weekdays:[0,1,2,3,4]),
      from:t==='sard'&&hf?addDays(D10(hf.end_date),1):ps,to:t==='sard'?pe:(def24>pe?pe:def24<ps?ps:def24),order:t==='sard'?2:1};
  };
  window.nxPhChanged=function(root,g){
    if(root.dataset.kind==='phase'){
      if(g==='type'&&!root.dataset.edit){
        const plan=S().plans.find(p=>p.id===root.dataset.plan),t=root.dataset.type,hf=phasesOfPlan(plan.id).find(p=>p.phase_type==='hifz'),d=TYPE_DEF(t,plan,hf,D10(plan.start_date),D10(plan.end_date));
        const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v};
        set('nphTitle',d.title);set('nphTarget',d.target);set('nphStart',d.from);set('nphEnd',d.to);set('nphOrder',d.order);
        root.dataset.goal=d.goal;root.dataset.start=d.start;root.dataset.dist='flexible';
        root.querySelectorAll('[data-g="days"]').forEach(x=>{x.classList.toggle('on',d.days.includes(+x.dataset.v))});
        ['goal','start','dist'].forEach(k=>root.querySelectorAll(`[data-g="${k}"]`).forEach(x=>x.classList.toggle('on',x.dataset.v===root.dataset[k])));
      }
      if(g==='goal'){
        const t=root.dataset.goal;if(t==='quran_range'){root.dataset.start='range_start';root.querySelectorAll('[data-g="start"]').forEach(x=>x.classList.toggle('on',x.dataset.v==='range_start'))}
        if(t==='pages'&&num('nphTarget')==null){const e=document.getElementById('nphTarget');if(e)e.value=root.dataset.type==='sard'?'25':n1(S().plans.find(p=>p.id===root.dataset.plan)?.target_pages)}
        const lb=document.getElementById('nphTargetLab');if(lb)lb.textContent=t==='juz'?'عدد الأجزاء':'الهدف بالصفحات';
      }
      updatePreview(root);
    }else if(root.dataset.kind==='bulk')bulkSummary(root);
    else if(root.dataset.kind==='rebase')rebaseCount(root);
    else if(root.dataset.kind==='tpl'){const m=val('rctMode');root.dataset.mode=m}
  };
  function phaseFormBody(plan,ex,t,editing){
    const phs=phasesOfPlan(plan.id),ps=D10(plan.start_date),pe=D10(plan.end_date),hf=phs.find(p=>p.phase_type==='hifz');
    const df=TYPE_DEF(t,plan,hf,ps,pe);
    const d=ex?{title:ex.title,goal:ex.goal_mode,target:String(ex.target_units??ex.target_pages??(ex.phase_type==='sard'?25:plan.target_pages)),start:ex.start_mode==='last_sard'?'last_activity':ex.start_mode,days:ex.schedule_weekdays||[],from:D10(ex.start_date),to:D10(ex.end_date),order:ex.phase_order,dist:ex.distribution_mode,status:ex.status,surplus:ex.allow_surplus!==false}:{...df,dist:'flexible',status:'active',surplus:true,order:df.order};
    const target=ex?(ex.goal_mode==='juz'?(ex.target_units??((ex.target_pages||0)/20)):(ex.target_units??ex.target_pages??(ex.phase_type==='sard'?25:plan.target_pages))):d.target;
    const route=ex?.settings?.route_direction||plan.settings?.sard_route_direction||(plan.plan_type==='hifz'?ROUTE_NAS:ROUTE_BAQ);
    const sard=t==='sard';
    const typeChips=t==='tathbit'?grid(1,opt('type','tathbit','تثبيت',true,false,'nph-lock')):grid(2,opt('type','hifz','حفظ',t==='hifz',false,ex?'nph-lock':'')+opt('type','sard','سرد',t==='sard',false,ex?'nph-lock':''));
    const goals=[['pages','صفحات'],['juz','أجزاء'],['quran_range','نطاق قرآني'],['open','سرد مفتوح']];
    const latestLbl=sard?'آخر سرد':t==='tathbit'?'آخر تثبيت':'آخر تسميع حفظ';
    const starts=[['last_activity',latestLbl],['plan_start','بداية الخطة'],['manual','تحديد يدوي'],['range_start','بداية نطاق']];
    const rg=(k)=>ex?.[k]??'';
    return `<div class="nph-form" data-kind="phase" data-plan="${h(plan.id)}" data-type="${t}" data-goal="${h(d.goal)}" data-start="${h(d.start)}" data-dist="${h(d.dist)}" ${editing?'data-edit="1"':''} oninput="nxPhChanged(this)" onchange="nxPhChanged(this)">
      <p class="nph-sub">عدّل الإعدادات ثم راجع المعاينة قبل الاعتماد.</p>
      <section>${lab('نوع المرحلة')}${typeChips}${ex?'<small class="nph-sub">نوع المرحلة ثابت بعد إنشائها لحماية التسميعات المرتبطة بها.</small>':''}</section>
      ${NX.field('اسم المرحلة',{id:'nphTitle',value:d.title})}
      <section>${lab('الفترة')}<div class="nph-two">${dateF('nphStart','البداية',d.from)}${dateF('nphEnd','النهاية',d.to)}</div></section>
      <section>${lab('أيام المرحلة')}${dayChips('days',d.days)}</section>
      <section>${lab('نوع الهدف')}${grid(2,goals.map(([v,l])=>opt('goal',v,l,d.goal===v,false,v==='open'?'nph-sard-only':'')).join(''))}</section>
      <div class="nph-if-target">${NX.field(`<span id="nphTargetLab">${d.goal==='juz'?'عدد الأجزاء':'الهدف بالصفحات'}</span>`,{id:'nphTarget',type:'number',value:target,min:0,hint:sard?'الافتراضي في RC11.3 هو 25 صفحة':''}).replace('type="number"','type="number" step="0.01" inputmode="decimal"')}</div>
      <section>${lab('نقطة بداية المرحلة')}${grid(2,starts.map(([v,l])=>opt('start',v,l,d.start===v)).join(''))}</section>
      <div id="nphAnchor"></div>
      <div class="nph-range">
        <div class="nph-tint">${lab('البداية / النطاق القرآني')}
          <div class="nph-two">${NX.field('سورة البداية',{html:surahSel('nphSS',rg('range_start_surah'))})}${NX.field('آية البداية',{id:'nphSA',type:'number',value:rg('range_start_ayah'),min:1})}</div>
          <div class="nph-two nph-if-end">${NX.field('سورة النهاية',{html:surahSel('nphES',rg('range_end_surah'))})}${NX.field('آية النهاية',{id:'nphEA',type:'number',value:rg('range_end_ayah'),min:1})}</div>
          <details class="nph-more"><summary>أو بالصفحات</summary><div class="nph-two">${NX.field('صفحة البداية',{id:'nphSP',type:'number',value:rg('range_start_page'),min:1,max:604})}${NX.field('صفحة النهاية',{id:'nphEP',type:'number',value:rg('range_end_page'),min:1,max:604})}</div></details>
        </div>
      </div>
      <div class="nph-sard-only"><div class="nph-tint">${lab('اتجاه السرد')}<div class="nph-two">${opt('route',ROUTE_NAS,'من الناس إلى البقرة',route===ROUTE_NAS)}${opt('route',ROUTE_BAQ,'من البقرة إلى الناس',route===ROUTE_BAQ)}</div><p class="nph-ok" id="nphRouteCap"></p><small class="nph-sub">داخل كل سورة تبقى الآيات تصاعدية 1 ← آخر آية؛ التغيير يكون في ترتيب السور فقط.</small></div></div>
      <div id="nphPrev" class="nph-prev"></div>
      <section>${lab('التوزيع')}${grid(2,opt('dist','equal','متساوٍ',d.dist==='equal')+opt('dist','flexible','مرن',d.dist==='flexible'))}</section>
      ${NX.switchRow('استمرار إضافي بعد إكمال الهدف',d.surplus,null,{id:'nphSurplus'})}
      <details class="nph-more"><summary>خيارات متقدمة</summary><div class="nph-two">${NX.field('الترتيب',{id:'nphOrder',type:'number',value:d.order,min:1})}${NX.select('حالة المرحلة',Object.entries(ST_AR).map(([v,l])=>({value:v,label:l})),{id:'nphStatus',value:d.status})}</div></details>
      <div class="nx-notice nx-s-danger" id="nphErr" hidden></div>
    </div>`;
  }
  window.rc27PhaseForm=async function(planId,phaseId,type){
    const plan=S().plans.find(p=>p.id===planId);if(!plan)return;
    await loadRecsFor([plan.student_id]);
    const ex=phaseId?S().phases.find(p=>p.id===phaseId):null,t=ex?.phase_type||type||(isTathbitPlan(plan)?'tathbit':'hifz');
    const title=ex?'تعديل المرحلة':(t==='sard'?'إعداد مرحلة السرد':'إضافة مرحلة');
    dlg(`${title} — ${h(sName(plan.student_id))}`,phaseFormBody(plan,ex,t,!!ex),{cls:'nph-wide',footer:`${cancelBtn('إلغاء')}${NX.btn(ex?'معاينة التعديل':'اعتماد المرحلة',{kind:'filled',icon:ex?'Preview':'Check',onclick:`rc27PhaseSave('${h(planId)}','${h(phaseId||'')}','${t}')`})}`});
    const root=formRoot();if(root)updatePreview(root);
  };
  let PEND=null;
  function readDraft(planId,phaseId){
    const root=formRoot();if(!root)throw new Error('النموذج غير متاح');
    const ex=phaseId?S().phases.find(p=>p.id===phaseId):null,type=root.dataset.type,goal=root.dataset.goal;
    const startDate=val('nphStart'),endDate=val('nphEnd');
    if(!startDate||!endDate||endDate<startDate)throw new Error('الفترة غير صالحة');
    const weekdays=picked(root,'days').map(Number);if(!weekdays.length)throw new Error('اختر أيام المرحلة');
    const numeric=num('nphTarget');
    if(!['open','quran_range'].includes(goal)&&!(numeric>0))throw new Error('حدد الهدف');
    const ss=num('nphSS'),sa=num('nphSA'),es=num('nphES'),ea=num('nphEA');
    if(goal==='quran_range'&&!(ss&&sa&&es&&ea))throw new Error('حدد النطاق القرآني كاملًا');
    const pv=previewState(root);
    const pages=goal==='juz'?(numeric!=null?numeric*20:null):goal==='open'?null:goal==='quran_range'?(pv.res?Math.round(pv.res.pages*100)/100:numeric):numeric;
    const units=goal==='juz'?numeric:goal==='open'?null:goal==='quran_range'?pages:numeric;
    const settings={...(ex?.settings||{})};if(type==='sard')settings.route_direction=picked(root,'route')[0]||ROUTE_NAS;
    return {id:phaseId||null,planId,expectedRevision:ex?.revision,phaseOrder:Number(val('nphOrder'))||ex?.phase_order||1,phaseType:type,title:val('nphTitle'),startDate,endDate,weekdays,goalMode:goal,goalUnit:{juz:'juz',quran_range:'range',open:'open'}[goal]||'pages',targetPages:pages,targetUnits:units,distributionMode:root.dataset.dist,startMode:root.dataset.start,rangeStartPage:num('nphSP'),rangeEndPage:num('nphEP'),rangeStartSurah:ss,rangeStartAyah:sa,rangeEndSurah:es,rangeEndAyah:ea,allowSurplus:document.getElementById('nphSurplus').checked,status:val('nphStatus')||ex?.status||'active',settings};
  }
  async function commit(){
    const d=PEND;if(!d)return;
    try{await P().savePhase(d);closeDlg();toastMsg('تم حفظ المرحلة');rc27RefreshPhases()}
    catch(e){NX.closeDialog(DID2);showErr(e.message||String(e))}
  }
  window.rc27PhaseCommit=commit;
  window.rc27PhaseSave=function(planId,phaseId){
    let d;try{d=readDraft(planId,phaseId)}catch(e){showErr(e.message||String(e));return}
    const err=document.getElementById('nphErr');if(err)err.hidden=true;
    PEND=d;if(!phaseId)return commit();
    const plan=S().plans.find(p=>p.id===planId),src=S().phases.find(p=>p.id===phaseId);
    const stateCount=S().states.filter(x=>x.phase_id===phaseId&&['active','completed'].includes(x.status)).length;
    const sid=plan.student_id,st=stateOf(phaseId,sid),completed=P().completedPages(plan,src,sid,st);
    const newTarget=d.targetPages??(d.goalMode==='juz'&&d.targetUnits!=null?d.targetUnits*20:null);
    const today=T0(),first=today>d.startDate?today:d.startDate;let remDays=0;
    if(first<=d.endDate)for(let x=first;x<=d.endDate;x=addDays(x,1))if(d.weekdays.includes(new Date(x+'T00:00:00Z').getUTCDay()))remDays++;
    const rem=newTarget!=null?Math.max(0,newTarget-completed):null;
    const body=`<p class="nph-p">الفترة الجديدة: ${d.startDate} ← ${d.endDate}</p><p class="nph-p">الهدف الجديد: ${newTarget!=null?n1(newTarget)+' ص':'مفتوح'}</p><p class="nph-p">هناك ${stateCount} طالب لديهم حالة منفذة/نشطة في هذه المرحلة.</p>${completed!=null?`<p class="nph-p">مثال: ${h(sName(sid))} أنجز ${n1(completed)} ص.</p>`:''}${rem!=null?`<p class="nph-p">المتبقي للمثال: ${n1(rem)} ص · الأيام المجدولة المتبقية: ${remDays}</p>${remDays>0?`<p class="nph-p">المقترح بعد التعديل ≈ ${n1(rem/remDays)} ص/يوم، ثم يعاد توزيعه حسب الإنجاز.</p>`:''}`:''}<small class="nph-sub">التسميعات المنفذة لا تُحذف؛ يعاد حساب المقرر القادم فقط.</small>`;
    NX.dialog(DID2,'معاينة تأثير التعديل',body,{cls:'nx-small-dlg',footer:`${cancelBtn('رجوع للتعديل',DID2)}${NX.btn('اعتماد التعديل',{kind:'filled',onclick:'rc27PhaseCommit()'})}`});
  };

  // ================= student state / complete / transition =================
  const numField=(id,label,v,o={})=>NX.field(label,{id,type:'number',value:v,min:0,hint:o.hint}).replace('type="number"','type="number" step="0.01" inputmode="decimal"');
  window.rc27PhaseState=function(phaseId,sid){
    const ph=S().phases.find(p=>p.id===phaseId),st=stateOf(phaseId,sid)||{};
    const cur=st.status||'not_started';
    dlg(`حالة ${h(sName(sid))} في «${h(phaseTitle(ph))}»`,`<div class="nph-form" data-kind="state" data-st="${cur}">${lab('الحالة')}${grid(2,Object.entries(PS_AR).map(([v,l])=>opt('st',v,l,cur===v)).join(''))}
      <div class="nph-two">${numField('rcsTarget','هدف خاص (صفحات)',st.target_pages_override??'')}${numField('rcsCarry','عجز مرحَّل (صفحات)',st.carry_shortfall_pages??0)}</div>
      <div class="nph-two">${dateF('rcsStart','بداية خاصة',st.start_date_override?D10(st.start_date_override):'')}${dateF('rcsEnd','نهاية خاصة',st.end_date_override?D10(st.end_date_override):'')}</div>
      <div class="nx-notice nx-s-danger" id="nphErr" hidden></div></div>`,{footer:`${cancelBtn()}${NX.btn('حفظ',{kind:'filled',icon:'Check',onclick:`rc27PhaseStateSave('${h(phaseId)}','${h(sid)}')`})}`});
  };
  window.rc27PhaseStateSave=function(phaseId,sid){guard(async()=>{
    const s=val('rcsStart')||null,e=val('rcsEnd')||null;
    try{if(s&&e&&e<s)throw new Error('نهاية الطالب تسبق بدايته');
      await P().upsertState(phaseId,sid,{status:document.querySelector(`#${DID} [data-g="st"].on`)?.dataset.v||'not_started',targetOverride:num('rcsTarget'),startOverride:s,endOverride:e,carry:num('rcsCarry')??0});
      closeDlg();toastMsg('تم حفظ حالة الطالب');rc27RefreshPhases();
    }catch(err){showErr(err.message||String(err))}
  })};
  function figures(plan,phaseId){
    const ph=S().phases.find(p=>p.id===phaseId),st=stateOf(phaseId,plan.student_id),done=P().completedPages(plan,ph,plan.student_id,st),pr=P().progress(P().enginePhase(ph),done,T0(),st);
    return {ph,st,done,target:pr.target,pct:pr.target>0.001?done/pr.target*100:0};
  }
  const statsRow=f=>NX.metrics([NX.metric('الهدف',f.target!=null?n1(f.target):'—',{subtitle:'صفحة'}),NX.metric('المنجز',n1(f.done),{subtitle:'صفحة'}),NX.metric('نسبة الإنجاز',n1(f.pct)+'%')],3);
  window.rc27PhaseComplete=async function(planId,phaseId){
    const plan=S().plans.find(p=>p.id===planId);await loadRecsFor([plan.student_id]);const f=figures(plan,phaseId),sard=f.ph.phase_type==='sard';
    dlg(sard?'إنهاء مرحلة السرد':`إكمال «${h(phaseTitle(f.ph))}»`,`<div class="nph-form" data-kind="complete"><p class="nph-name2">${h(sName(plan.student_id))}</p>${statsRow(f)}<p class="nx-confirm-text">${sard?'سيتم تجميد النتيجة ولن يُولد مقرر جديد.':'سيُجمَّد إنجاز الطالب وهدفه. راجع الأرقام قبل الاعتماد.'}</p><div class="nph-two">${numField('rccDone','المنجز (صفحات)',f.done)}${numField('rccTarget','الهدف (صفحات)',f.target??'')}</div><div class="nx-notice nx-s-danger" id="nphErr" hidden></div></div>`,{footer:`${cancelBtn()}${NX.btn(sard?'إنهاء المرحلة':'اعتماد',{kind:'filled',icon:'DoneAll',onclick:`rc27PhaseCompleteSave('${h(planId)}','${h(phaseId)}')`})}`});
  };
  window.rc27PhaseCompleteSave=function(planId,phaseId){guard(async()=>{const plan=S().plans.find(p=>p.id===planId);
    try{await P().completePhaseForStudent(plan,phaseId,plan.student_id,num('rccDone')||0,num('rccTarget'));closeDlg();toastMsg('تم إكمال المرحلة');rc27RefreshPhases()}catch(e){showErr(e.message||String(e))}})};
  window.rc27PhaseTransition=async function(planId,fromId,toId){
    const plan=S().plans.find(p=>p.id===planId);await loadRecsFor([plan.student_id]);const f=figures(plan,fromId),to=S().phases.find(p=>p.id===toId),sard=to.phase_type==='sard',hifzEnd=f.ph.phase_type==='hifz';
    let lastLine='';
    if(hifzEnd){const last=(S().recs.get(plan.student_id)||[]).filter(r=>['new_hifz','hifz'].includes(String(r.activity_type).toLowerCase())&&r.end_surah&&r.end_ayah).sort((a,b)=>recKey(a)<recKey(b)?-1:1).at(-1);if(last)lastLine=`<p class="nph-p">آخر حفظ: ${h(locLabel({s:+last.end_surah,a:+last.end_ayah}))}</p>`}
    dlg(hifzEnd?'إنهاء مرحلة الحفظ':`انتقال إلى «${h(phaseTitle(to))}»`,`<div class="nph-form" data-kind="transition"><p class="nph-name2">${h(sName(plan.student_id))}</p>${statsRow(f)}${lastLine}<p class="nph-p">تاريخ الإنهاء: ${T0()}</p><p class="nx-confirm-text">${hifzEnd&&sard?'بعد الاعتماد يتجمّد إنجاز الحفظ ويبدأ Sard Anchor المستقل.':`يُجمَّد إنجاز «${h(phaseTitle(f.ph))}» ثم تبدأ المرحلة التالية في عملية واحدة.`}</p><div class="nph-two">${numField('rctDone','المنجز (صفحات)',f.done)}${numField('rctTarget','الهدف (صفحات)',f.target??'')}</div>${numField('rctCarry','ترحيل نقص السرد السابق (اختياري)',0,{hint:'الافتراضي تجاهل.'})}${sard?numField('rctOverride','هدف سرد خاص (اختياري)',''):''}<div class="nx-notice nx-s-danger" id="nphErr" hidden></div></div>`,{footer:`${cancelBtn()}${NX.btn(hifzEnd?'اعتماد وإنهاء الحفظ':'اعتماد الانتقال',{kind:'filled',icon:'DoneAll',onclick:`rc27PhaseTransitionSave('${h(planId)}','${h(fromId)}','${h(toId)}')`})}`});
  };
  window.rc27PhaseTransitionSave=function(planId,fromId,toId){guard(async()=>{const plan=S().plans.find(p=>p.id===planId);
    try{await P().transition(planId,fromId,toId,[{studentId:plan.student_id,completed:num('rctDone')||0,target:num('rctTarget'),carry:num('rctCarry')||0,sardOverride:num('rctOverride')}]);closeDlg();toastMsg('تم الانتقال');rc27RefreshPhases()}catch(e){showErr(e.message||String(e))}})};

  // ================= bulk Hifz → Sard cycle (SmartPlanBulkCycleSheet) =================
  const bulkRoot=()=>document.querySelector(`#${DID} .nph-form[data-kind="bulk"]`);
  const bn=v=>{v=Number(v)||0;return Math.abs(v-Math.round(v))<.005?String(Math.round(v)):v.toFixed(1)};
  function bulkReqs(){
    const root=bulkRoot(),items=window.__rc27BulkItems||[],days=picked(root,'rcb').map(Number);
    const picks=[...root.querySelectorAll('.rcb-pick:checked')].map(x=>+x.dataset.n);
    let invalid=0;const reqs=[];
    picks.forEach(n=>{
      const i=items[n],o=k=>val('rcbi'+n+k),wd=picked(root,'rcbw'+n).map(Number);
      const r={planId:i.plan.id,studentId:i.plan.student_id,hifzCompleted:i.done,hifzTarget:i.target,hifzStart:o('HS')||val('rcbHS'),hifzEnd:o('HE')||val('rcbHE'),sardStart:o('SS')||val('rcbSS'),sardEnd:o('SE')||val('rcbSE'),sardTarget:(o('T')!==''?Number(o('T')):num('rcbT')),route:o('R')||val('rcbR'),weekdays:wd.length?wd:days,carry:0};
      const ok=r.hifzStart&&r.hifzEnd&&r.sardStart&&r.sardEnd&&r.hifzEnd>=r.hifzStart&&r.sardStart>r.hifzEnd&&r.sardEnd>=r.sardStart&&r.sardTarget>0&&r.weekdays.length;
      if(ok)reqs.push(r);else invalid++;
    });
    return {reqs,invalid,picks,days};
  }
  function bulkSummary(root){
    const items=window.__rc27BulkItems||[],b=bulkReqs(),sel=b.picks.map(n=>items[n]);
    const done=sel.reduce((x,i)=>x+(i.done||0),0),tgt=sel.reduce((x,i)=>x+Math.max(0,i.target||0),0);
    const noPh=sel.filter(i=>!i.hf&&!i.sard).length,inSard=sel.filter(i=>i.sard&&['active','completed'].includes(stateOf(i.sard.id,i.plan.student_id)?.status)).length;
    const el=document.getElementById('nphBulkSum');
    if(el)el.innerHTML=`<b>المعاينة العامة</b><p>المحدد: ${sel.length} من ${items.length} طالب</p><p>الحفظ الحالي: ${bn(done)} / ${bn(tgt)} صفحة</p>${noPh?`<p class="nph-ok">${noPh} خطة بدون مراحل: سيتم إنشاء مرحلتي الحفظ والسرد تلقائيًا.</p>`:''}${inSard?`<small class="nph-sub">${inSard} طالب لديهم سرد نشط/مكتمل؛ لن تُفقد حالتهم، وأي إعادة تشغيل ستكون idempotent.</small>`:''}`;
    const sat=document.getElementById('nphSat');if(sat)sat.hidden=!b.days.includes(6);
    const commonOk=val('rcbHE')>=val('rcbHS')&&val('rcbSS')>val('rcbHE')&&val('rcbSE')>=val('rcbSS')&&num('rcbT')>0&&b.days.length>0&&val('rcbHS')&&val('rcbSS');
    const btn=document.getElementById('nphBulkGo');if(btn)btn.disabled=!(commonOk&&sel.length);
    root.querySelectorAll('.nph-brow').forEach(r=>{
      const n=r.dataset.n,any=['HS','HE','SS','SE','T','R'].some(k=>val('rcbi'+n+k)!=='')||picked(root,'rcbw'+n).length>0;
      r.classList.toggle('cust',any);const t=r.querySelector('.nph-cust-btn span');if(t)t.textContent=any?'مخصص':'تخصيص';
      r.classList.toggle('off',!r.querySelector('.rcb-pick').checked);
    });
  }
  window.nxBulkSearch=function(q){q=String(q||'').trim().toLowerCase();document.querySelectorAll(`#${DID} .nph-brow`).forEach(r=>{r.hidden=!!q&&!r.dataset.name.toLowerCase().includes(q)})};
  window.nxBulkAll=function(on){document.querySelectorAll(`#${DID} .rcb-pick`).forEach(x=>{if(!x.closest('.nph-brow').hidden)x.checked=on});const r=bulkRoot();if(r)bulkSummary(r)};
  window.nxBulkCust=function(n){const r=document.querySelector(`#${DID} .nph-brow[data-n="${n}"]`);if(r)r.classList.toggle('open')};
  window.nxBulkReset=function(n){
    ['HS','HE','SS','SE','T','R'].forEach(k=>{const e=document.getElementById('rcbi'+n+k);if(e)e.value=''});
    document.querySelectorAll(`#${DID} [data-g="rcbw${n}"]`).forEach(x=>x.classList.remove('on'));const r=bulkRoot();if(r)bulkSummary(r);
  };
  window.rc27BulkCycle=async function(){
    await P().load(true);await loadRecsFor(plansForScope().map(p=>p.student_id));
    const t=T0(),next=addDays(t,1),eom=iso(new Date(Date.UTC(+t.slice(0,4),+t.slice(5,7),0)));
    const rows=plansForScope().filter(p=>stuOf(p.student_id)?.track_code!=='tathbit'&&p.plan_type!=='tathbit');
    const items=rows.map(plan=>{const phs=S().phases.filter(p=>p.plan_id===plan.id&&p.status!=='archived'),hf=phs.find(p=>p.phase_type==='hifz'),st=hf?stateOf(hf.id,plan.student_id):null,done=hf?P().completedPages(plan,hf,plan.student_id,st):0,target=hf?(P().progress(P().enginePhase(hf),done,t,st).target):plan.target_pages;return {plan,hf,done,target,sard:phs.find(p=>p.phase_type==='sard')}})
      .sort((a,b)=>sName(a.plan.student_id).localeCompare(sName(b.plan.student_id),'ar'));
    if(!items.length)return toastMsg('لا توجد خطط حفظ فعّالة لإدارتها جماعيًا');
    window.__rc27BulkItems=items;
    const starts=items.map(i=>D10(i.hf?.start_date||i.plan.start_date)),cnt=new Map;starts.forEach(s=>cnt.set(s,(cnt.get(s)||0)+1));
    const mostStart=[...cnt.entries()].sort((a,b)=>b[1]-a[1])[0][0];
    const routeSel=(id,blank)=>NX.select(blank?'اتجاه السرد':'اتجاه السرد',(blank?[{value:'',label:'كالموحد'}]:[]).concat([{value:ROUTE_NAS,label:'من الناس إلى البقرة'},{value:ROUTE_BAQ,label:'من البقرة إلى الناس'}]),{id,value:blank?'':ROUTE_NAS});
    const rowsHtml=items.map((i,n)=>{
      const nm=sName(i.plan.student_id),sSt=i.sard?stateOf(i.sard.id,i.plan.student_id):null,hSt=i.hf?stateOf(i.hf.id,i.plan.student_id):null;
      const hLbl=hSt?.status==='completed'?'مكتملة':hSt?.status==='active'?'نشطة':'حسب الخطة الحالية',sLbl=({completed:'مكتملة',active:'نشطة',not_started:'مجدولة'})[sSt?.status]||'لم تبدأ';
      const sT=sSt?.target_pages_override??i.sard?.target_pages??25;
      return `<div class="nx-card nph-brow" data-n="${n}" data-name="${h(nm)}"><div class="nph-brow-h"><input type="checkbox" class="nph-check rcb-pick" data-n="${n}" checked aria-label="${h(nm)}"><div class="nph-grow"><b class="nph-name">${h(nm)}</b>${!i.hf&&!i.sard?'<small class="nph-ok">لا توجد مراحل بعد · سيتم إنشاؤها عند الاعتماد</small>':''}</div><button type="button" class="nx-btn nx-text nx-small nph-cust-btn" onclick="nxBulkCust(${n})">${ic('Tune',18)}<span>تخصيص</span></button></div>
        <div class="nph-two"><div class="nph-mini a"><b>مرحلة الحفظ</b><span>${bn(i.done)} / ${bn(i.target??0)} ص</span><small>${hLbl}</small></div><div class="nph-mini b"><b>مرحلة السرد</b><span>${bn(sT)} ص</span><small>${sLbl}</small></div></div>
        <div class="nph-cust">${NX.divider()}<b class="nph-lab">تخصيص هذا الطالب فقط</b><div class="nph-two">${dateF(`rcbi${n}HS`,'بداية الحفظ','')}${dateF(`rcbi${n}HE`,'نهاية الحفظ','')}</div><div class="nph-two">${dateF(`rcbi${n}SS`,'بداية السرد','')}${dateF(`rcbi${n}SE`,'نهاية السرد','')}</div><div class="nph-two">${numField(`rcbi${n}T`,'هدف سرد خاص','')}${routeSel(`rcbi${n}R`,true)}</div>${lab('أيام السرد لهذا الطالب (اتركها فارغة للموحد)')}${dayChips('rcbw'+n,[])}${NX.btn('إزالة التخصيص والعودة للإعداد الموحد',{kind:'text',small:true,onclick:`nxBulkReset(${n})`})}</div></div>`;
    }).join('');
    dlg('إدارة جماعية للحفظ والسرد',`<div class="nph-form" data-kind="bulk" oninput="nxPhChanged(this)" onchange="nxPhChanged(this)">
      <p class="nph-sub">أغلق مرحلة الحفظ وابدأ/جدول السرد لجميع الطلاب مرة واحدة، مع تخصيص أي طالب عند الحاجة.</p>
      <div class="nx-card nph-common"><b class="nph-card-t">الإعداد الموحد</b>
        <div class="nph-two">${dateF('rcbHS','بداية الحفظ',mostStart)}${dateF('rcbHE','نهاية الحفظ',t)}</div>
        <div class="nph-two">${dateF('rcbSS','بداية السرد',next)}${dateF('rcbSE','نهاية السرد',eom<next?next:eom)}</div>
        ${numField('rcbT','هدف السرد الموحد بالصفحات',25,{hint:'الافتراضي 25 صفحة. هدف الحفظ يبقى مختلفًا لكل طالب.'})}
        ${routeSel('rcbR',false)}
        ${lab('أيام السرد')}${dayChips('rcb',[0,1,2,3,4,5])}
        <p class="nph-err" id="nphSat" hidden>تنبيه: السبت إجازة ثابتة في الحلقة؛ اختره فقط إذا أردت مرحلة استثنائية.</p>
      </div>
      ${NX.search('','بحث باسم الطالب',{oninput:'nxBulkSearch(this.value)'})}
      <div class="nx-card nph-sum"><div id="nphBulkSum"></div><div class="nph-actions">${NX.btn('تحديد الكل',{kind:'text',small:true,onclick:'nxBulkAll(true)'})}${NX.btn('إلغاء الكل',{kind:'text',small:true,onclick:'nxBulkAll(false)'})}</div></div>
      <div class="nph-brows">${rowsHtml}</div>
      <div class="nx-notice nx-s-danger" id="nphErr" hidden></div></div>`,
      {cls:'nph-wide',footer:`${cancelBtn()}${NX.btn('معاينة وإعتماد الانتقال الجماعي',{kind:'filled',icon:'RecordVoiceOver',id:'nphBulkGo',onclick:'rc27BulkPreview()'})}`});
    const r=bulkRoot();if(r)bulkSummary(r);
  };
  window.rc27BulkPreview=function(){
    const root=bulkRoot();if(!root)return;const b=bulkReqs();
    if(!b.picks.length)return showErr('لم يتم تحديد أي طالب');
    if(!b.days.length)return showErr('اختر يوم سرد واحدًا على الأقل');
    const custom=b.picks.filter(n=>root.querySelector(`.nph-brow[data-n="${n}"]`)?.classList.contains('cust')).length;
    const body=`<p class="nph-p"><b>سيتم تحديث ${b.reqs.length} طالب في عملية واحدة.</b></p><p class="nph-p">لكل طالب سيُجمّد إنجاز الحفظ وهدفه الحالي، ثم تُنشأ/تُحدّث مرحلة السرد حسب التواريخ والهدف والاتجاه المحدد.</p><p class="nph-p">الاتجاه الموحد الافتراضي: ${val('rcbR')===ROUTE_NAS?'من الناس إلى البقرة':'من البقرة إلى الناس'}.</p>${custom?`<p class="nph-p">هناك ${custom} تخصيصات فردية.</p>`:''}${b.invalid?`<p class="nph-err">${b.invalid} طالب لديهم تواريخ/هدف غير صالح ولن يتم الإرسال حتى تصحيحهم.</p>`:''}<p class="nph-ok"><b>لن يتغير هدف الحفظ الفردي لأي طالب.</b></p>`;
    NX.dialog(DID2,'اعتماد دورة الحفظ ← السرد',body,{cls:'nx-small-dlg',footer:`${cancelBtn('رجوع',DID2)}${NX.btn('اعتماد وتنفيذ',{kind:'filled',id:'nphBulkOk',disabled:!b.reqs.length||b.invalid>0,onclick:'rc27BulkSave()'})}`});
  };
  window.rc27BulkSave=function(){guard(async()=>{
    const b=bulkReqs();if(!b.reqs.length||b.invalid)return;
    const ok=document.getElementById('nphBulkOk');if(ok){ok.disabled=true;ok.querySelector('span').textContent='جاري الاعتماد…'}
    try{await P().bulkCycles(b.reqs);closeDlg();toastMsg('تم اعتماد دورة الحفظ والسرد');rc27RefreshPhases()}
    catch(e){NX.closeDialog(DID2);showErr(e.message||String(e))}
  })};

  // ================= templates =================
  window.rc27PhaseTemplates=async function(planId){
    await P().load(true);
    const plan=planId?S().plans.find(p=>p.id===planId):null,hid=plan?.halaqa_id||(typeof rc27Scope==='function'?rc27Scope()?.selectedId:null)||state.halaqas?.[0]?.id,list=S().templates.filter(t=>!hid||t.halaqa_id===hid);
    const w=canWrite(),phs=plan?phasesOfPlan(plan.id):[];
    const modeAr={dates:'بالتاريخ',weeks:'بالأسابيع',manual:'يدوي'};
    const items=list.map(t=>`<div class="nph-tpl">${ic('ContentPasteGo',22)}<div class="nph-grow"><b>${h(t.name)}</b></div>${NX.pill(modeAr[t.template_mode]||'','info')}${plan&&w&&!phs.length?NX.btn('تطبيق',{kind:'tonal',small:true,onclick:`rc27ApplyTpl('${h(plan.id)}','${h(t.id)}')`}):''}</div>`).join('');
    const saveCur=(plan&&phs.length&&w)?`<div class="nx-card"><b class="nph-card-t">قالب الحلقة</b><p class="nph-sub">احفظ دورة الحفظ ← السرد بالتاريخ أو بالأسابيع أو يدويًا.</p><div class="nph-actions">${[['dates','بالتاريخ'],['weeks','بالأسابيع'],['manual','يدوي']].map(([m,l])=>NX.btn(l,{kind:'outlined',icon:'BookmarkAdd',onclick:`rc27SaveTplFromPlan('${h(plan.id)}','${m}')`})).join('')}</div></div>`:'';
    const form=w?`<div class="nx-card nph-tplform"><b class="nph-card-t">قالب جديد</b><div class="nph-form" data-kind="tpl" data-mode="weeks" oninput="nxPhChanged(this)" onchange="nxPhChanged(this)">
      <div class="nph-two">${NX.field('الاسم',{id:'rctName',value:'خطة الحفظ الشهرية'})}${NX.select('النوع',[{value:'weeks',label:'بالأسابيع'},{value:'dates',label:'بالتواريخ'}],{id:'rctMode',value:'weeks'})}</div>
      <div class="nph-two nph-tpl-w">${numField('rctHW','أسابيع الحفظ',3)}${numField('rctSW','أسابيع السرد',1)}</div>
      <div class="nph-two nph-tpl-d">${numField('rctHS','يوم بداية الحفظ',1)}${numField('rctHE','يوم نهاية الحفظ',24)}${numField('rctSS','يوم بداية السرد',25)}${numField('rctSE','يوم نهاية السرد (0 = نهاية الشهر)',0)}</div>
      <div class="nph-two">${numField('rctST','هدف السرد (صفحات)',25)}${NX.select('اتجاه السرد',[{value:ROUTE_NAS,label:'من الناس إلى البقرة'},{value:ROUTE_BAQ,label:'من البقرة إلى الناس'}],{id:'rctSR',value:ROUTE_NAS})}</div>
      ${NX.btn('حفظ القالب',{kind:'filled',icon:'Check',full:true,onclick:`rc27SaveTpl('${h(hid||'')}')`})}</div></div>`:'';
    dlg('قوالب المراحل',`<p class="nph-sub">قالب جاهز مثل: 3 أسابيع حفظ + أسبوع سرد.${plan?` اختر قالبًا لتطبيقه على ${h(sName(plan.student_id))}.`:''}</p>${plan&&phs.length?NX.notice('هذه الخطة تحتوي مراحل بالفعل؛ لا يمكن تطبيق قالب عليها.','info'):''}${items?`<div class="nph-tpls">${items}</div>`:NX.empty('لا توجد قوالب لهذه الحلقة.',{icon:'BookmarkAdd'})}${saveCur}${form}`,{footer:cancelBtn('إغلاق')});
  };
  window.rc27SaveTpl=function(hid){guard(async()=>{
    const mode=val('rctMode'),def={hifz_distribution:'flexible',sard_distribution:'flexible',sard_goal_mode:'pages',sard_target_pages:num('rctST')||25,sard_start_mode:'last_activity',sard_route_direction:val('rctSR')};
    if(mode==='weeks'){def.hifz_weeks=num('rctHW')||3;def.sard_weeks=num('rctSW')||1}else{def.hifz_start_day=num('rctHS')||1;def.hifz_end_day=num('rctHE')||24;def.sard_start_day=num('rctSS')||25;def.sard_end_day=num('rctSE')||0}
    await P().saveTemplate(hid,val('rctName'),mode,def);toastMsg('تم حفظ القالب');rc27PhaseTemplates();
  })};
  window.rc27SaveTplFromPlan=function(planId,mode){guard(async()=>{
    const plan=S().plans.find(p=>p.id===planId),ordered=phasesOfPlan(planId),hf=ordered.find(p=>p.phase_type==='hifz'),sd=ordered.find(p=>p.phase_type==='sard');
    const d0=D10(plan.start_date),off=s=>Math.round((Date.parse(D10(s))-Date.parse(d0))/864e5);
    const sardBase={sard_goal_mode:sd?.goal_mode||'pages',sard_target_units:sd?.target_units??null,sard_target_pages:sd?.target_pages??25,sard_distribution:sd?.distribution_mode||'flexible',sard_start_mode:sd?.start_mode||'last_activity',sard_route_direction:sd?.settings?.route_direction||ROUTE_NAS};
    const def=mode==='dates'?{hifz_start_offset_days:hf?off(hf.start_date):0,hifz_end_offset_days:hf?off(hf.end_date):23,sard_start_offset_days:sd?off(sd.start_date):24,sard_end_offset_days:sd?off(sd.end_date):off(plan.end_date),...sardBase}
      :mode==='weeks'?{hifz_weeks:3,sard_weeks:Math.max(1,Math.ceil((sd?(off(sd.end_date)-off(sd.start_date)+1):7)/7)),...sardBase}
      :{phases:ordered.map(p=>({phase_order:p.phase_order,phase_type:p.phase_type,title:p.title,start_offset_days:off(p.start_date),end_offset_days:off(p.end_date),schedule_weekdays:p.schedule_weekdays,goal_mode:p.goal_mode,goal_unit:p.goal_unit,target_units:p.target_units??null,target_pages:p.target_pages??null,distribution_mode:p.distribution_mode,start_mode:p.start_mode,allow_surplus:p.allow_surplus,settings:p.settings||{},range_start_page:p.range_start_page??null,range_end_page:p.range_end_page??null,range_start_surah:p.range_start_surah??null,range_start_ayah:p.range_start_ayah??null,range_end_surah:p.range_end_surah??null,range_end_ayah:p.range_end_ayah??null}))};
    await P().saveTemplate(plan.halaqa_id,`${plan.title||'خطة'} · ${({dates:'بالتاريخ',weeks:'بالأسابيع',manual:'يدوي'})[mode]}`,mode,def);
    toastMsg(`تم حفظ القالب ${({dates:'بالتاريخ',weeks:'بالأسابيع',manual:'يدوي'})[mode]}`);rc27PhaseTemplates(planId);
  })};
  window.rc27ApplyTpl=function(planId,tplId){guard(async()=>{const plan=S().plans.find(p=>p.id===planId),tpl=S().templates.find(t=>t.id===tplId);await P().applyTemplate(plan,tpl);closeDlg();toastMsg('تم تطبيق القالب');rc27RefreshPhases()})};
  window.rc27StartMonth=function(){
    NX.confirm('بدء دورة شهر جديد','بدء دورة الشهر الحالي: إنشاء/إصلاح خطط الشهر لكل الطلاب (الحفظ فردي والسرد 25 صفحة). متابعة؟','متابعة',()=>{
      guard(async()=>{const r=await P().startMonth();toastMsg('تم بدء دورة الشهر');if(r&&typeof r==='object'){const n=Object.entries(r).filter(([,v])=>typeof v==='number').map(([k,v])=>`${k}: ${v}`).join(' · ');if(n)toastMsg(n)}rc27RefreshPhases()});
    });
  };

  // ================= plan range rebase (PlanRangeRebaseDialog) =================
  const rebaseRoot=()=>document.querySelector(`#${DID} .nph-form[data-kind="rebase"]`);
  function rebaseCount(root){const n=root.querySelectorAll('.nph-rb-pick:checked').length,b=document.getElementById('nphRbGo');if(b){b.disabled=!n;const s=b.querySelector('span');if(s)s.textContent=`تطبيق (${n})`}}
  const RB_TITLE='إعادة ضبط نطاق الشهر';
  window.rc27RebaseOpen=async function(){
    dlg(RB_TITLE,NX.skeleton(2),{footer:cancelBtn('إلغاء')});
    try{
      const sc=typeof rc27Scope==='function'?rc27Scope():{},prevs=await window.rc27RebasePreviews(sc?.selectedId||null);window.__rc27Rebase=prevs;
      const st={STALE_END:'تجاوز نهاية نطاقه القديم',ROUTE_COMPLETE:'أتمّ مسار الحفظ',START_MISMATCH:'بداية النطاق لا تطابق آخر حفظ',NO_ANCHOR:'بداية النطاق لا تطابق آخر حفظ'};
      const rows=prevs.map((p,i)=>`<label class="nx-card nph-rb ${p.patch?'':'dis'}"><input type="checkbox" class="nph-check nph-rb-pick" data-i="${i}" ${p.patch&&p.status==='STALE_END'?'checked':''} ${p.patch?'':'disabled'}><div class="nph-grow"><b>${h(p.studentName)}</b>${NX.pill(st[p.status]||st.START_MISMATCH,p.status==='ROUTE_COMPLETE'?'success':'info')}<small>آخر حفظ: ${h(p.latestLabel)}</small><small>الحالي: ${h(p.oldLabel)}</small><small class="${p.patch?'nph-ok':''}">${p.patch?`الجديد: ${h(p.newLabel)}`:p.status==='ROUTE_COMPLETE'?'وصل نهاية مسار الحفظ فلا نطاق جديد للحفظ. أنشئ له خطة مراجعة أو تثبيت أو غيّر مساره.':'لا يمكن الحساب: لا يوجد حفظ سابق'}</small></div></label>`).join('');
      const can=prevs.some(p=>p.patch);
      dlg(RB_TITLE,`<div class="nph-form" data-kind="rebase" oninput="nxPhChanged(this)" onchange="nxPhChanged(this)"><p class="nph-sub">تظهر هنا الخطط التي نطاقها القديم لا يطابق موضع الطالب الفعلي. يُعاد حساب النطاق من آخر حفظ قبل الشهر مع إبقاء هدف الصفحات. لا يتغير شيء قبل «تطبيق».</p>${prevs.length?`<div class="nph-rbs">${rows}</div>`:NX.empty('كل الخطط سليمة، لا حاجة لإعادة الضبط.',{icon:'CheckCircle'})}<div class="nx-notice nx-s-danger" id="nphErr" hidden></div></div>`,{footer:`${cancelBtn('إلغاء')}${can?NX.btn('تطبيق (0)',{kind:'filled',id:'nphRbGo',onclick:'rc27RebaseApply()'}):''}`});
      const r=rebaseRoot();if(r)rebaseCount(r);
    }catch(e){dlg(RB_TITLE,NX.notice(h(e.message||e),'danger'),{footer:cancelBtn('إغلاق')})}
  };
  window.rc27RebaseApply=function(){guard(async()=>{
    const prevs=window.__rc27Rebase||[],chosen=[...document.querySelectorAll(`#${DID} .nph-rb-pick:checked`)].map(x=>prevs[Number(x.dataset.i)]).filter(p=>p&&p.patch);
    if(!chosen.length)throw new Error('لم يتم تحديد أي خطة');
    const b=document.getElementById('nphRbGo');if(b){b.disabled=true;b.querySelector('span').textContent='جارٍ التطبيق…'}
    let ok=0;const fails=[];
    for(const p of chosen){const {data,error}=await db.from('smart_plans').update({...p.patch,updated_at:new Date().toISOString()}).eq('id',p.planId).select('id');if(error)fails.push(`${p.studentName}: ${error.message}`);else if(!data||!data.length)fails.push(`${p.studentName}: لم يُعدَّل أي صف (صلاحيات)`);else ok++}
    if(!ok&&fails.length){if(b){b.disabled=false;b.querySelector('span').textContent=`تطبيق (${chosen.length})`}showErr(fails.join('؛ '));return}
    closeDlg();toastMsg(`تم ضبط ${ok} خطة`);rc27RefreshPhases();
  })};

  // ================= gap check (RecitationGapRules) — reported as a snackbar, never blocks the save =================
  function snack(msg){
    let s=document.getElementById('nphSnack');if(!s){s=document.createElement('div');s.id='nphSnack';s.className='nph-snack';s.setAttribute('role','status');document.body.appendChild(s)}
    s.innerHTML=`${ic('Info',22)}<span>${h(msg)}</span><button type="button" class="nx-iconbtn" aria-label="إغلاق" onclick="this.parentNode.classList.remove('show')">${ic('Close',20)}</button>`;
    s.classList.add('show');clearTimeout(s.__t);s.__t=setTimeout(()=>s.classList.remove('show'),9000);
  }
  window.rc27GapCheck=function(data){
    try{
      if(!data.start_surah||!data.start_ayah||typeof smartPlanAllRecitations!=='function')return;
      const route=(S().plans.find(p=>p.student_id===data.student_id&&p.scope_type==='student'&&p.status==='active')?.settings?.route_direction)||ROUTE_NAS,ord=s=>route===ROUTE_NAS?200-s:s;
      const prev=smartPlanAllRecitations().filter(r=>r.student_id===data.student_id&&r.activity_type==='new_hifz'&&r.end_surah&&r.end_ayah&&String(r.session_id)!==String(data.session_id)).sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||''))).at(-1);
      if(!prev)return;
      const between=ord(Number(data.start_surah))-ord(Number(prev.end_surah))-1;
      if(between>=1)setTimeout(()=>snack(`ملاحظة: بين آخر حفظ (${prev.end_surah}:${prev.end_ayah}) وهذا التسميع (${data.start_surah}:${data.start_ayah}) ${between} سورة لم تُسجَّل. تأكد أنه لم تضع جلسة.`),1800);
    }catch(_e){}
  };
})();
