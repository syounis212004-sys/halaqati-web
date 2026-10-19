/* Halaqati v2.63.22 — smart plan phases UI (timeline, phase editor, transition, bulk Hifz→Sard cycle, templates, month start).
   Engine + writes live in phases.js; every action below needs a verified connection, like the native app's phase writes. */
(function(){
  const P=()=>window.RC27Phases,S=()=>P().S;
  const h=v=>typeof esc==='function'?esc(v):String(v==null?'':v);
  const fm=v=>typeof fmt==='function'?fmt(v):v;
  const iso=d=>d.toISOString().slice(0,10),T0=()=>iso(new Date());
  const TYPE_AR={hifz:'حفظ',sard:'سرد',tathbit:'تثبيت'},ST_AR={draft:'مسودة',active:'جارية',completed:'مكتملة',archived:'مؤرشفة'},PS_AR={not_started:'لم تبدأ',active:'جارية',completed:'مكتملة',skipped:'مستثناة'},LC_AR={scheduled:'مجدولة',active:'جارية',ended:'انتهت',completed:'مكتملة',skipped:'مستثناة'};
  const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const ROUTE_NAS='reverse_surahs_forward_ayahs',ROUTE_BAQ='forward_surahs_forward_ayahs';
  const GOAL_AR={pages:'صفحات',juz:'أجزاء',quran_range:'نطاق من القرآن',open:'مفتوح'};
  const D=()=>{let d=document.getElementById('rc27Dlg');if(!d){d=document.createElement('dialog');d.id='rc27Dlg';d.className='rc27-dlg';document.body.appendChild(d)}return d};
  const open=html=>{const d=D();d.innerHTML=html;if(!d.open)d.showModal();return d};
  const close=()=>{const d=document.getElementById('rc27Dlg');if(d?.open)d.close()};
  const val=(id)=>document.getElementById(id)?.value??'';
  const num=(id)=>{const v=val(id).trim();return v===''?null:Number(v)};
  const canWrite=()=>typeof roleCanManage==='function'&&roleCanManage();
  const dayBoxes=(pfx,sel)=>`<div class="rc27-days">${DAYS.map((n,i)=>`<label><input type="checkbox" data-d="${pfx}" value="${i}" ${sel.includes(i)?'checked':''}> ${n}</label>`).join('')}</div>`;
  const readDays=pfx=>[...document.querySelectorAll(`input[data-d="${pfx}"]:checked`)].map(x=>Number(x.value));
  async function guard(fn){try{await fn()}catch(e){toast(e.message||String(e))}}
  const monthStart=()=>T0().slice(0,8)+'01';
  const sName=sid=>h((window.RC27?.master?.students||state.students).find(s=>s.id===sid)?.full_name||'طالب');

  // ---------------- section ----------------
  function plansForScope(){
    const ids=new Set((state.students||[]).filter(s=>s.status!=='withdrawn').map(s=>s.id)),t=T0();
    return S().plans.filter(p=>p.scope_type==='student'&&p.status==='active'&&ids.has(p.student_id)&&String(p.end_date).slice(0,10)>=t&&String(p.start_date).slice(0,10)<=t);
  }

  // ورد اليوم حسب المرحلة الفعّالة: بداية من آخر نشاط (مرساة) أو من بداية النطاق، والمقدار من المقترح اليومي للمرحلة
  function dutyHtml(plan,phs){
    try{
      const t=T0(),sid=plan.student_id,act=P().activePhase(phs.map(P().enginePhase),S().states,sid,t);if(!act)return '';
      const raw=phs.find(x=>x.id===act.id),st=S().states.find(x=>x.phase_id===act.id&&x.student_id===sid),done=P().completedPages(plan,raw,sid,st),pr=P().progress(act,done,t,st);
      if(pr.complete&&pr.suggested==null)return '';
      const route=raw.phase_type==='sard'?(raw.settings?.route_direction||routeOf(plan)):routeOf(plan),recs=(S().recs.get(sid)||[]).filter(r=>String(r.session_date)<=t),typeOk=a=>raw.phase_type==='sard'?String(a).toLowerCase()==='sard':['new_hifz','hifz'].includes(String(a).toLowerCase());
      const last=recs.filter(r=>typeOk(r.activity_type)&&r.end_surah&&r.end_ayah).sort((a,b)=>(String(a.session_date)+String(a.created_at))<(String(b.session_date)+String(b.created_at))?-1:1).at(-1);
      let start=null;
      if(last&&!(raw.start_mode==='manual'||raw.start_mode==='range_start')&&(raw.phase_type==='sard'||true)){const e={s:+last.end_surah,a:+last.end_ayah};if(e.a<ayahCounts[e.s-1])start={s:e.s,a:e.a+1};else{const n=route===ROUTE_NAS?e.s-1:e.s+1;start=(n<1||n>114)?null:{s:n,a:1}}}
      else if(raw.range_start_surah&&raw.range_start_ayah)start={s:raw.range_start_surah,a:raw.range_start_ayah};
      else if(raw.phase_type==='hifz'&&plan.range_start_surah&&plan.range_start_ayah)start={s:plan.range_start_surah,a:plan.range_start_ayah};
      else if(raw.phase_type==='sard')start=route===ROUTE_NAS?{s:114,a:1}:{s:1,a:1};
      const pages=pr.suggested;if(!start||pages==null||pages<=0)return `<div class="muted">ورد اليوم: ${pages===0?'لا مقرر إضافي اليوم':'يُحدَّد من المعلّم'}</div>`;
      const all=orderedLines(start,termOf(route),route)||[];if(!all.length)return '';
      const n=Math.max(1,Math.round(pages*15)),lines=all.slice(0,n),end=endpointOfLine(lines.at(-1),true);if(!end)return '';
      const kind=raw.phase_type==='sard'?'sard':'new_hifz';
      return `<div class="notice" style="margin-top:8px"><b>ورد اليوم (${TYPE_AR[raw.phase_type]})</b><div>من ${h(surahs[start.s-1])}:${start.a} إلى ${h(surahs[end.s-1])}:${end.a} · ≈ ${fm(pages)} ص</div>${canWrite()?`<button class="mini" onclick="rc27DutyNow('${sid}','${kind}')">سمّع الآن</button>`:''}</div>`;
    }catch(_e){return ''}
  }
  window.rc27DutyNow=async function(sid,type){
    try{const se=typeof latestSession==='function'?latestSession():null;if(!se){toast('لا توجد جلسة مفتوحة اليوم. أنشئ جلسة أولًا.');return}
      state.page='sessions';state.sessionView=se.id;await render();if(typeof quickOpenRecitation==='function')await quickOpenRecitation(sid,se.id,type)}catch(e){toast(e.message||String(e))}
  };
  function planCard(plan){
    const t=T0(),phs=S().phases.filter(p=>p.plan_id===plan.id&&p.status!=='archived').sort((a,b)=>a.phase_order-b.phase_order),eng=phs.map(P().enginePhase),issues=P().validateTimeline(eng);
    const rows=phs.map((p,i)=>{
      const st=S().states.find(x=>x.phase_id===p.id&&x.student_id===plan.student_id),lc=P().lifecycle(P().enginePhase(p),st,t),done=P().completedPages(plan,p,plan.student_id,st),pr=P().progress(P().enginePhase(p),done,t,st),next=phs[i+1];
      const acts=canWrite()?`<button class="mini" onclick="rc27PhaseForm('${plan.id}','${p.id}')">تعديل</button><button class="mini" onclick="rc27PhaseState('${p.id}','${plan.student_id}')">حالة الطالب</button>${next&&lc!=='completed'?`<button class="mini" onclick="rc27PhaseTransition('${plan.id}','${p.id}','${next.id}')">إنهاء والانتقال ←</button>`:''}${!next&&lc!=='completed'?`<button class="mini" onclick="rc27PhaseComplete('${plan.id}','${p.id}')">إكمال المرحلة</button>`:''}<button class="mini red" onclick="rc27PhaseArchive('${p.id}')">أرشفة</button>`:'';
      return `<div class="rc27-phase ${lc==='active'?'now':''}"><div><b>${p.phase_order}. ${h(p.title)}</b> <span class="badge">${TYPE_AR[p.phase_type]||p.phase_type}</span> <span class="badge">${LC_AR[lc]}</span>${p.status!=='active'?` <span class="badge">${ST_AR[p.status]||p.status}</span>`:''}</div><div class="muted">${h(String(p.start_date).slice(0,10))} → ${h(String(p.end_date).slice(0,10))} · ${GOAL_AR[p.goal_mode]||''}${pr.target!=null?` · الهدف ${fm(pr.target)} ص`:''}${st?.carry_shortfall_pages>0?` (مرحَّل ${fm(st.carry_shortfall_pages)})`:''}</div>${pr.target!=null?`<div class="plan-bar"><div class="plan-label"><span>منجز ${fm(pr.completed)} / ${fm(pr.target)} ص${pr.suggested!=null&&lc==='active'?` · المقترح اليوم ${fm(pr.suggested)}`:''}</span><b>${pr.percentage??0}%</b></div><div class="progress"><i style="width:${Math.min(100,pr.percentage||0)}%"></i></div></div>`:`<div class="muted">منجز ${fm(pr.completed)} ص</div>`}${acts?`<div class="actions">${acts}</div>`:''}</div>`;
    }).join('');
    const hasH=phs.some(p=>p.phase_type==='hifz'),hasS=phs.some(p=>p.phase_type==='sard'),hasT=phs.some(p=>p.phase_type==='tathbit'),tath=plan.plan_type==='tathbit'||(window.RC27?.master?.students||state.students).find(s=>s.id===plan.student_id)?.track_code==='tathbit';
    const add=canWrite()?`<div class="actions">${tath?(hasT?'':`<button class="mini" onclick="rc27PhaseForm('${plan.id}',null,'tathbit')">+ مرحلة تثبيت</button>`):`${hasH?'':`<button class="mini" onclick="rc27PhaseForm('${plan.id}',null,'hifz')">+ مرحلة حفظ</button>`}${hasS?'':`<button class="mini" onclick="rc27PhaseForm('${plan.id}',null,'sard')">+ مرحلة سرد</button>`}${!phs.length?`<button class="mini" onclick="rc27PhaseTemplates('${plan.id}')">تطبيق قالب</button>`:''}`}</div>`:'';
    return `<div class="card"><b>${sName(plan.student_id)}</b> <span class="muted">${h(String(plan.start_date).slice(0,10))} → ${h(String(plan.end_date).slice(0,10))}</span>${issues.map(i=>`<div class="notice" style="margin-top:6px">${h(i.message)}</div>`).join('')}${dutyHtml(plan,phs)}${rows||'<div class="muted" style="margin-top:6px">لا توجد مراحل لهذه الخطة بعد.</div>'}${add}</div>`;
  }
  async function fill(){
    const box=document.getElementById('rc27Phases');if(!box)return;
    await P().load(false);
    if(S().err){if(box.isConnected)box.innerHTML=`<div class="notice">تعذر تحميل مراحل الخطط: ${h(S().err)}</div>`;return}
    const plans=plansForScope();
    await window.RC27Phases.S.recs&&await loadRecsFor(plans.map(p=>p.student_id));
    if(!box.isConnected)return;
    const tools=canWrite()?`<div class="actions" style="margin-bottom:8px"><button class="btn btn-soft" onclick="rc27BulkCycle()">إدارة جماعية للحفظ والسرد</button><button class="btn btn-soft" onclick="rc27PhaseTemplates()">قوالب المراحل</button><button class="btn btn-soft" onclick="rc27StartMonth()">بدء دورة شهر جديد</button><button class="btn btn-soft" onclick="rc27RebaseOpen()">ضبط نطاق الخطط</button></div>`:'';
    box.innerHTML=`<div class="section-head"><h3>مراحل الخطط</h3></div>${tools}${plans.map(planCard).join('')||'<div class="empty">لا توجد خطط فعّالة لطلاب هذا النطاق.</div>'}`;
  }
  async function loadRecsFor(ids){try{await window.RC27Phases.loadRecs(ids)}catch(_e){}}
  window.rc27RefreshPhases=async function(){await P().load(true);if(typeof render==='function')render()};

  // ---------------- phase form ----------------
  window.rc27PhaseForm=function(planId,phaseId,type){
    const plan=S().plans.find(p=>p.id===planId),ex=phaseId?S().phases.find(p=>p.id===phaseId):null,t=ex?.phase_type||type||'hifz';
    const phs=S().phases.filter(p=>p.plan_id===planId&&p.status!=='archived'),ps=String(plan.start_date).slice(0,10),pe=String(plan.end_date).slice(0,10),hf=phs.find(p=>p.phase_type==='hifz');
    const month=ps.slice(0,7),def24=`${month}-24`;
    const d=ex?{...ex,start:String(ex.start_date).slice(0,10),end:String(ex.end_date).slice(0,10)}:{
      phase_order:t==='sard'?2:1,title:t==='sard'?'مرحلة السرد':t==='tathbit'?'مرحلة التثبيت':'مرحلة الحفظ',
      start:t==='sard'&&hf?iso(new Date(Date.parse(String(hf.end_date).slice(0,10))+864e5)):ps,end:t==='sard'?pe:(def24>pe?pe:def24<ps?ps:def24),
      schedule_weekdays:t==='sard'?[0,1,2,3,4,5]:(plan.schedule_weekdays?.length?plan.schedule_weekdays:[0,1,2,3,4]),goal_mode:'pages',goal_unit:'pages',target_pages:t==='sard'?25:plan.target_pages,target_units:null,
      distribution_mode:'flexible',start_mode:t==='sard'?'last_activity':'plan_start',allow_surplus:true,status:'active',settings:{},
      range_start_page:plan.range_start_page,range_end_page:plan.range_end_page,range_start_surah:plan.range_start_surah,range_start_ayah:plan.range_start_ayah,range_end_surah:plan.range_end_surah,range_end_ayah:plan.range_end_ayah};
    const route=d.settings?.route_direction||plan.settings?.sard_route_direction||(plan.plan_type==='hifz'?ROUTE_NAS:ROUTE_BAQ);
    const sel=(id,opts,cur)=>`<select id="${id}">${opts.map(([v,l])=>`<option value="${v}" ${String(cur)===String(v)?'selected':''}>${l}</option>`).join('')}</select>`;
    open(`<form onsubmit="event.preventDefault();rc27PhaseSave('${planId}','${phaseId||''}','${t}')"><div class="card"><h3>${ex?'تعديل':'إضافة'} مرحلة ${TYPE_AR[t]} — ${sName(plan.student_id)}</h3></div><div class="form-grid">
      <label class="field"><span>العنوان</span><input id="rcpTitle" class="input" value="${h(d.title)}"></label>
      <label class="field"><span>الترتيب</span><input id="rcpOrder" class="input" type="number" min="1" value="${d.phase_order}"></label>
      <label class="field"><span>من تاريخ</span><input id="rcpStart" class="input" type="date" value="${d.start}" required></label>
      <label class="field"><span>إلى تاريخ</span><input id="rcpEnd" class="input" type="date" value="${d.end}" required></label>
      <label class="field"><span>نوع الهدف</span>${sel('rcpGoal',Object.entries(GOAL_AR),d.goal_mode)}</label>
      <label class="field"><span>الهدف (صفحات)</span><input id="rcpPages" class="input" type="number" step="0.01" min="0" value="${d.target_pages??''}"></label>
      <label class="field"><span>الهدف (أجزاء)</span><input id="rcpUnits" class="input" type="number" step="0.01" min="0" value="${d.target_units??''}"></label>
      <label class="field"><span>توزيع الهدف</span>${sel('rcpDist',[['flexible','مرن'],['equal','متساوٍ']],d.distribution_mode)}</label>
      <label class="field"><span>نقطة البداية</span>${sel('rcpStartMode',[['plan_start','بداية الخطة'],['last_activity','آخر نشاط'],['manual','يدوي'],['range_start','بداية النطاق']],d.start_mode==='last_sard'?'last_activity':d.start_mode)}</label>
      ${t==='sard'?`<label class="field"><span>اتجاه السرد</span>${sel('rcpRoute',[[ROUTE_NAS,'من الناس إلى البقرة'],[ROUTE_BAQ,'من البقرة إلى الناس']],route)}</label>`:''}
      <label class="field"><span>حالة المرحلة</span>${sel('rcpStatus',Object.entries(ST_AR),d.status)}</label></div>
      <div class="card"><b>أيام المرحلة</b>${dayBoxes('rcp',d.schedule_weekdays||[])}</div>
      <div class="card"><b>النطاق القرآني (عند «نطاق» أو بداية يدوية)</b><div class="form-grid"><label class="field"><span>صفحة البداية</span><input id="rcpSP" class="input" type="number" min="1" max="604" value="${d.range_start_page??''}"></label><label class="field"><span>صفحة النهاية</span><input id="rcpEP" class="input" type="number" min="1" max="604" value="${d.range_end_page??''}"></label><label class="field"><span>سورة البداية (1–114)</span><input id="rcpSS" class="input" type="number" min="1" max="114" value="${d.range_start_surah??''}"></label><label class="field"><span>آية البداية</span><input id="rcpSA" class="input" type="number" min="1" value="${d.range_start_ayah??''}"></label><label class="field"><span>سورة النهاية</span><input id="rcpES" class="input" type="number" min="1" max="114" value="${d.range_end_surah??''}"></label><label class="field"><span>آية النهاية</span><input id="rcpEA" class="input" type="number" min="1" value="${d.range_end_ayah??''}"></label></div></div>
      <label class="settings-row"><div><b>السماح بالإنجاز الإضافي</b></div><input id="rcpSurplus" type="checkbox" ${d.allow_surplus!==false?'checked':''}></label>
      <div class="form-actions"><button class="btn btn-primary">حفظ المرحلة</button><button class="btn btn-ghost" type="button" onclick="rc27ClosePhaseDlg()">إلغاء</button></div></form>`);
  };
  window.rc27ClosePhaseDlg=close;
  window.rc27PhaseSave=function(planId,phaseId,type){guard(async()=>{
    const ex=phaseId?S().phases.find(p=>p.id===phaseId):null,goal=val('rcpGoal');
    const settings={...(ex?.settings||{})};if(type==='sard')settings.route_direction=val('rcpRoute');
    await P().savePhase({id:phaseId||null,planId,expectedRevision:ex?.revision,phaseOrder:Number(val('rcpOrder'))||1,phaseType:type,title:val('rcpTitle'),startDate:val('rcpStart'),endDate:val('rcpEnd'),weekdays:readDays('rcp'),goalMode:goal,goalUnit:{juz:'juz',quran_range:'range',open:'open'}[goal]||'pages',targetPages:goal==='juz'&&num('rcpUnits')?num('rcpUnits')*20:num('rcpPages'),targetUnits:goal==='open'?null:num('rcpUnits'),distributionMode:val('rcpDist'),startMode:val('rcpStartMode'),rangeStartPage:num('rcpSP'),rangeEndPage:num('rcpEP'),rangeStartSurah:num('rcpSS'),rangeStartAyah:num('rcpSA'),rangeEndSurah:num('rcpES'),rangeEndAyah:num('rcpEA'),allowSurplus:document.getElementById('rcpSurplus').checked,status:val('rcpStatus'),settings});
    close();toast('تم حفظ المرحلة');rc27RefreshPhases();
  })};
  window.rc27PhaseArchive=function(id){if(!confirm('أرشفة هذه المرحلة؟'))return;guard(async()=>{await P().setPhaseStatus(id,'archived');toast('تمت أرشفة المرحلة');const p=S().phases.find(x=>x.id===id);rc27RefreshPhases();})};

  // ---------------- student state / complete / transition ----------------
  window.rc27PhaseState=function(phaseId,sid){
    const ph=S().phases.find(p=>p.id===phaseId),st=S().states.find(x=>x.phase_id===phaseId&&x.student_id===sid)||{};
    open(`<form onsubmit="event.preventDefault();rc27PhaseStateSave('${phaseId}','${sid}')"><div class="card"><h3>حالة ${sName(sid)} في «${h(ph.title)}»</h3></div><div class="form-grid"><label class="field"><span>الحالة</span><select id="rcsStatus">${Object.entries(PS_AR).map(([v,l])=>`<option value="${v}" ${(st.status||'not_started')===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="field"><span>هدف خاص (صفحات)</span><input id="rcsTarget" class="input" type="number" step="0.01" min="0" value="${st.target_pages_override??''}"></label><label class="field"><span>بداية خاصة</span><input id="rcsStart" class="input" type="date" value="${st.start_date_override?String(st.start_date_override).slice(0,10):''}"></label><label class="field"><span>نهاية خاصة</span><input id="rcsEnd" class="input" type="date" value="${st.end_date_override?String(st.end_date_override).slice(0,10):''}"></label><label class="field"><span>عجز مرحَّل (صفحات)</span><input id="rcsCarry" class="input" type="number" step="0.01" min="0" value="${st.carry_shortfall_pages??0}"></label></div><div class="form-actions"><button class="btn btn-primary">حفظ</button><button class="btn btn-ghost" type="button" onclick="rc27ClosePhaseDlg()">إلغاء</button></div></form>`);
  };
  window.rc27PhaseStateSave=function(phaseId,sid){guard(async()=>{
    const s=val('rcsStart')||null,e=val('rcsEnd')||null;if(s&&e&&e<s)throw new Error('نهاية الطالب تسبق بدايته');
    await P().upsertState(phaseId,sid,{status:val('rcsStatus'),targetOverride:num('rcsTarget'),startOverride:s,endOverride:e,carry:num('rcsCarry')??0});
    close();toast('تم حفظ حالة الطالب');rc27RefreshPhases();
  })};
  function figures(plan,phaseId){
    const ph=S().phases.find(p=>p.id===phaseId),st=S().states.find(x=>x.phase_id===phaseId&&x.student_id===plan.student_id),eng=P().enginePhase(ph),done=P().completedPages(plan,ph,plan.student_id,st),pr=P().progress(eng,done,T0(),st);
    return {ph,st,done,target:pr.target};
  }
  window.rc27PhaseComplete=async function(planId,phaseId){
    const plan=S().plans.find(p=>p.id===planId);await loadRecsFor([plan.student_id]);const f=figures(plan,phaseId);
    open(`<form onsubmit="event.preventDefault();rc27PhaseCompleteSave('${planId}','${phaseId}')"><div class="card"><h3>إكمال «${h(f.ph.title)}» — ${sName(plan.student_id)}</h3><div class="muted">سيُجمَّد إنجاز الطالب وهدفه. راجع الأرقام قبل الاعتماد.</div></div><div class="form-grid"><label class="field"><span>المنجز (صفحات)</span><input id="rccDone" class="input" type="number" step="0.01" min="0" value="${f.done}"></label><label class="field"><span>الهدف (صفحات)</span><input id="rccTarget" class="input" type="number" step="0.01" min="0" value="${f.target??''}"></label></div><div class="form-actions"><button class="btn btn-primary">اعتماد</button><button class="btn btn-ghost" type="button" onclick="rc27ClosePhaseDlg()">إلغاء</button></div></form>`);
  };
  window.rc27PhaseCompleteSave=function(planId,phaseId){guard(async()=>{const plan=S().plans.find(p=>p.id===planId);await P().completePhaseForStudent(plan,phaseId,plan.student_id,num('rccDone')||0,num('rccTarget'));close();toast('تم إكمال المرحلة');rc27RefreshPhases()})};
  window.rc27PhaseTransition=async function(planId,fromId,toId){
    const plan=S().plans.find(p=>p.id===planId);await loadRecsFor([plan.student_id]);const f=figures(plan,fromId),to=S().phases.find(p=>p.id===toId),sard=to.phase_type==='sard';
    open(`<form onsubmit="event.preventDefault();rc27PhaseTransitionSave('${planId}','${fromId}','${toId}')"><div class="card"><h3>انتقال ${sName(plan.student_id)} إلى «${h(to.title)}»</h3><div class="muted">يُجمَّد إنجاز «${h(f.ph.title)}» ثم تبدأ المرحلة التالية في عملية واحدة.</div></div><div class="form-grid"><label class="field"><span>المنجز (صفحات)</span><input id="rctDone" class="input" type="number" step="0.01" min="0" value="${f.done}"></label><label class="field"><span>الهدف (صفحات)</span><input id="rctTarget" class="input" type="number" step="0.01" min="0" value="${f.target??''}"></label><label class="field"><span>عجز مرحَّل إلى المرحلة التالية (اختياري)</span><input id="rctCarry" class="input" type="number" step="0.01" min="0" value="0"></label>${sard?`<label class="field"><span>هدف سرد خاص (اختياري)</span><input id="rctOverride" class="input" type="number" step="0.01" min="0"></label>`:''}</div><div class="form-actions"><button class="btn btn-primary">اعتماد الانتقال</button><button class="btn btn-ghost" type="button" onclick="rc27ClosePhaseDlg()">إلغاء</button></div></form>`);
  };
  window.rc27PhaseTransitionSave=function(planId,fromId,toId){guard(async()=>{const plan=S().plans.find(p=>p.id===planId);await P().transition(planId,fromId,toId,[{studentId:plan.student_id,completed:num('rctDone')||0,target:num('rctTarget'),carry:num('rctCarry')||0,sardOverride:num('rctOverride')}]);close();toast('تم الانتقال');rc27RefreshPhases()})};

  // ---------------- bulk Hifz → Sard cycle ----------------
  window.rc27BulkCycle=async function(){
    await P().load(true);await loadRecsFor(plansForScope().map(p=>p.student_id));
    const t=T0(),next=iso(new Date(Date.parse(t)+864e5)),eom=iso(new Date(Date.UTC(+t.slice(0,4),+t.slice(5,7),0)));
    const rows=plansForScope().filter(p=>(window.RC27?.master?.students||state.students).find(s=>s.id===p.student_id)?.track_code!=='tathbit'&&p.plan_type!=='tathbit');
    const items=rows.map(plan=>{const phs=S().phases.filter(p=>p.plan_id===plan.id&&p.status!=='archived'),hf=phs.find(p=>p.phase_type==='hifz'),st=hf?S().states.find(x=>x.phase_id===hf.id&&x.student_id===plan.student_id):null,done=hf?P().completedPages(plan,hf,plan.student_id,st):0,target=hf?(P().progress(P().enginePhase(hf),done,t,st).target):plan.target_pages;return {plan,hf,done,target,sard:phs.find(p=>p.phase_type==='sard')}});
    if(!items.length)return toast('لا توجد خطط حفظ فعّالة لإدارتها جماعيًا');
    window.__rc27BulkItems=items;
    const mostStart=items.map(i=>String(i.hf?.start_date||i.plan.start_date).slice(0,10)).sort((a,b)=>items.filter(x=>String(x.hf?.start_date||x.plan.start_date).slice(0,10)===b).length-items.filter(x=>String(x.hf?.start_date||x.plan.start_date).slice(0,10)===a).length)[0];
    open(`<form onsubmit="event.preventDefault();rc27BulkSave()"><div class="card"><h3>إدارة جماعية للحفظ والسرد</h3><div class="muted">أغلق مرحلة الحفظ وابدأ/جدول السرد لجميع الطلاب مرة واحدة. هدف الحفظ يبقى فرديًا.</div></div><div class="card"><b>الإعداد الموحد</b><div class="form-grid"><label class="field"><span>بداية الحفظ</span><input id="rcbHS" class="input" type="date" value="${mostStart}"></label><label class="field"><span>نهاية الحفظ</span><input id="rcbHE" class="input" type="date" value="${t}"></label><label class="field"><span>بداية السرد</span><input id="rcbSS" class="input" type="date" value="${next}"></label><label class="field"><span>نهاية السرد</span><input id="rcbSE" class="input" type="date" value="${eom<next?next:eom}"></label><label class="field"><span>هدف السرد الموحد بالصفحات</span><input id="rcbT" class="input" type="number" step="0.01" min="0" value="25"></label><label class="field"><span>اتجاه السرد</span><select id="rcbR"><option value="${ROUTE_NAS}">من الناس إلى البقرة</option><option value="${ROUTE_BAQ}">من البقرة إلى الناس</option></select></label></div><b>أيام السرد</b>${dayBoxes('rcb',[0,1,2,3,4,5])}<div class="muted">تنبيه: السبت إجازة ثابتة في الحلقة؛ اختره فقط إذا أردت سردًا فيه.</div></div><div class="card"><b>الطلاب (${items.length})</b><div class="actions"><button type="button" class="mini" onclick="document.querySelectorAll('.rcb-pick').forEach(x=>x.checked=true)">تحديد الكل</button><button type="button" class="mini" onclick="document.querySelectorAll('.rcb-pick').forEach(x=>x.checked=false)">إلغاء الكل</button></div>${items.map((i,n)=>`<label class="settings-row"><div><b>${sName(i.plan.student_id)}</b><div class="muted">الحفظ ${fm(i.done)} / ${fm(i.target??0)} ص${i.hf?'':' · بلا مراحل: ستُنشأ عند الاعتماد'}${i.sard&&['active','completed'].includes(S().states.find(x=>x.phase_id===i.sard.id&&x.student_id===i.plan.student_id)?.status)?' · لديه سرد نشط/مكتمل':''}</div></div><input type="checkbox" class="rcb-pick" data-n="${n}" checked></label>`).join('')}</div><div class="form-actions"><button class="btn btn-primary">اعتماد دورة الحفظ ← السرد</button><button class="btn btn-ghost" type="button" onclick="rc27ClosePhaseDlg()">إلغاء</button></div></form>`);
  };
  window.rc27BulkSave=function(){guard(async()=>{
    const items=window.__rc27BulkItems||[],picks=[...document.querySelectorAll('.rcb-pick:checked')].map(x=>items[Number(x.dataset.n)]);
    if(!picks.length)throw new Error('لم يتم تحديد أي طالب');
    const days=readDays('rcb');if(!days.length)throw new Error('اختر يوم سرد واحدًا على الأقل');
    if(!confirm(`سيتم تحديث ${picks.length} طالب في عملية واحدة. لكل طالب سيُجمَّد إنجاز الحفظ وهدفه الحالي، ثم تُنشأ/تُحدَّث مرحلة السرد. متابعة؟`))return;
    await P().bulkCycles(picks.map(i=>({planId:i.plan.id,studentId:i.plan.student_id,hifzCompleted:i.done,hifzTarget:i.target,hifzStart:val('rcbHS'),hifzEnd:val('rcbHE'),sardStart:val('rcbSS'),sardEnd:val('rcbSE'),sardTarget:num('rcbT'),route:val('rcbR'),weekdays:days,carry:0})));
    close();toast('تم اعتماد دورة الحفظ والسرد');rc27RefreshPhases();
  })};

  // ---------------- templates ----------------
  window.rc27PhaseTemplates=async function(planId){
    await P().load(true);
    const plan=planId?S().plans.find(p=>p.id===planId):null,hid=plan?.halaqa_id||(rc27Scope?.().selectedId)||state.halaqas[0]?.id,list=S().templates.filter(t=>!hid||t.halaqa_id===hid);
    open(`<div class="card"><h3>قوالب المراحل</h3><div class="muted">قالب جاهز مثل: 3 أسابيع حفظ + أسبوع سرد.${plan?` اختر قالبًا لتطبيقه على ${sName(plan.student_id)}.`:''}</div></div>${list.map(t=>`<div class="card"><b>${h(t.name)}</b> <span class="badge">${{dates:'بالتواريخ',weeks:'بالأسابيع',manual:'يدوي'}[t.template_mode]}</span>${plan?`<div class="actions"><button class="mini" onclick="rc27ApplyTpl('${plan.id}','${t.id}')">تطبيق</button></div>`:''}</div>`).join('')||'<div class="empty">لا توجد قوالب لهذه الحلقة.</div>'}${canWrite()?`<form onsubmit="event.preventDefault();rc27SaveTpl('${hid}')"><div class="card"><b>قالب جديد</b><div class="form-grid"><label class="field"><span>الاسم</span><input id="rctName" class="input" value="خطة الحفظ الشهرية"></label><label class="field"><span>النوع</span><select id="rctMode" onchange="document.getElementById('rctW').style.display=this.value==='weeks'?'':'none';document.getElementById('rctD').style.display=this.value==='dates'?'':'none'"><option value="weeks">بالأسابيع</option><option value="dates">بالتواريخ</option></select></label></div><div id="rctW" class="form-grid"><label class="field"><span>أسابيع الحفظ</span><input id="rctHW" class="input" type="number" min="1" value="3"></label><label class="field"><span>أسابيع السرد</span><input id="rctSW" class="input" type="number" min="1" value="1"></label></div><div id="rctD" class="form-grid" style="display:none"><label class="field"><span>يوم بداية الحفظ</span><input id="rctHS" class="input" type="number" min="1" max="31" value="1"></label><label class="field"><span>يوم نهاية الحفظ</span><input id="rctHE" class="input" type="number" min="1" max="31" value="24"></label><label class="field"><span>يوم بداية السرد</span><input id="rctSS" class="input" type="number" min="1" max="31" value="25"></label><label class="field"><span>يوم نهاية السرد (0 = نهاية الشهر)</span><input id="rctSE" class="input" type="number" min="0" max="31" value="0"></label></div><div class="form-grid"><label class="field"><span>هدف السرد (صفحات)</span><input id="rctST" class="input" type="number" min="1" value="25"></label><label class="field"><span>اتجاه السرد</span><select id="rctSR"><option value="${ROUTE_NAS}">من الناس إلى البقرة</option><option value="${ROUTE_BAQ}">من البقرة إلى الناس</option></select></label></div><button class="btn btn-primary">حفظ القالب</button></div></form>`:''}<div class="form-actions"><button class="btn btn-ghost" onclick="rc27ClosePhaseDlg()">إغلاق</button></div>`);
  };
  window.rc27SaveTpl=function(hid){guard(async()=>{
    const mode=val('rctMode'),def={hifz_distribution:'flexible',sard_distribution:'flexible',sard_goal_mode:'pages',sard_target_pages:num('rctST')||25,sard_start_mode:'last_activity',sard_route_direction:val('rctSR')};
    if(mode==='weeks'){def.hifz_weeks=num('rctHW')||3;def.sard_weeks=num('rctSW')||1}else{def.hifz_start_day=num('rctHS')||1;def.hifz_end_day=num('rctHE')||24;def.sard_start_day=num('rctSS')||25;def.sard_end_day=num('rctSE')||0}
    await P().saveTemplate(hid,val('rctName'),mode,def);toast('تم حفظ القالب');rc27PhaseTemplates();
  })};
  window.rc27ApplyTpl=function(planId,tplId){guard(async()=>{const plan=S().plans.find(p=>p.id===planId),tpl=S().templates.find(t=>t.id===tplId);await P().applyTemplate(plan,tpl);close();toast('تم تطبيق القالب');rc27RefreshPhases()})};
  window.rc27StartMonth=function(){
    if(!confirm('بدء دورة الشهر الحالي: إنشاء/إصلاح خطط الشهر لكل الطلاب (الحفظ فردي والسرد 25 صفحة). متابعة؟'))return;
    guard(async()=>{const r=await P().startMonth();toast('تم بدء دورة الشهر');if(r&&typeof r==='object'){const n=Object.entries(r).filter(([,v])=>typeof v==='number').map(([k,v])=>`${k}: ${v}`).join(' · ');if(n)toast(n)}rc27RefreshPhases()})
  };

  // ---------------- plans page hook ----------------
  if(typeof plansPage==='function'){
    const base=plansPage;
    plansPage=function(){
      const r=base.apply(this,arguments);
      if(state.profile?.role==='guardian'||typeof roleCanManage!=='function'||!roleCanManage())return r;
      if(/^<div class="hero"><h2>الخطط الذكية<\/h2><p>الخطط الذكية خاصة/.test(r))return r;
      setTimeout(fill,0);return r+'<div id="rc27Phases"><div class="muted">جارٍ تحميل مراحل الخطط…</div></div>';
    };
  }

  // native RecitationGapRules: a new hifz that jumps over whole surahs is reported (never blocks the save)
  window.rc27GapCheck=function(data){
    try{
      if(!data.start_surah||!data.start_ayah||typeof smartPlanAllRecitations!=='function')return;
      const route=(S().plans.find(p=>p.student_id===data.student_id&&p.scope_type==='student'&&p.status==='active')?.settings?.route_direction)||ROUTE_NAS,ord=s=>route===ROUTE_NAS?200-s:s;
      const prev=smartPlanAllRecitations().filter(r=>r.student_id===data.student_id&&r.activity_type==='new_hifz'&&r.end_surah&&r.end_ayah&&String(r.session_id)!==String(data.session_id)).sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||''))).at(-1);
      if(!prev)return;
      const between=ord(Number(data.start_surah))-ord(Number(prev.end_surah))-1;
      if(between>=1)setTimeout(()=>toast(`ملاحظة: بين آخر حفظ (${prev.end_surah}:${prev.end_ayah}) وهذا التسميع (${data.start_surah}:${data.start_ayah}) ${between} سورة لم تُسجَّل. تأكد أنه لم تضع جلسة.`),1800);
    }catch(_e){}
  };

  // ================= plan range rebase (native PlanRangeRebaseRules + repository.planRangeRebasePreviews) =================
  const ayahPref=()=>ayahPrefix;
  const posR=(s,a,route)=>((route===ROUTE_NAS?200-s:s)*1000)+a;
  const locOfGlobal=g=>{let s=1;while(s<114&&ayahPrefix[s]<g)s++;return {s,a:g-ayahPrefix[s-1]}};
  let pageIndex=null;
  function pageRanges(layout){if(pageIndex)return pageIndex;const m=new Map;for(let g=1;g<layout.page.length;g++){const pg=layout.page[g];if(!pg)continue;const r=m.get(pg);if(!r)m.set(pg,[g,g]);else r[1]=g}return pageIndex=m}
  function orderedLines(from,to,route){
    const layout=smartPlanQuranLayout();if(!layout)return null;const out=[],seen=new Set,step=route===ROUTE_NAS?-1:1;
    for(let s=from.s;step<0?s>=to.s:s<=to.s;s+=step){const a0=s===from.s?from.a:1,a1=s===to.s?to.a:ayahCounts[s-1];for(let a=a0;a<=a1;a++)for(const k of smartPlanAyahLineKeys(s,a,layout)){if(!seen.has(k)){seen.add(k);out.push(k)}}}
    return out;
  }
  function endpointOfLine(key,preferLast){
    const layout=smartPlanQuranLayout(),m=/^(\d+):(\d+)$/.exec(key);if(!layout||!m)return null;const pg=+m[1],line=+m[2],r=pageRanges(layout).get(pg);if(!r)return null;
    const cands=[];for(let g=r[0];g<=r[1];g++){const f=Number(layout.first?.[g]||0),l=Number(layout.last?.[g]||f);if(line>=f&&line<=l)cands.push(g)}
    const g=preferLast?cands.at(-1):cands[0];return g?locOfGlobal(g):null;
  }
  const normPages=(a,b)=>a!=null&&b!=null&&a>b?[b,a]:[a,b];
  const routeOf=plan=>plan.settings?.route_direction||(plan.plan_type==='hifz'?ROUTE_NAS:ROUTE_BAQ);
  const termOf=route=>{const s=route!==ROUTE_NAS?114:2;return {s,a:ayahCounts[s-1]}};
  const passingEv=ev=>!['repeat','weak','إعادة','ضعيف'].includes(String(ev||'').toLowerCase());
  function diagnose(recs,planStart,route,rs,re,terminal){
    const ends=recs.filter(r=>['new_hifz','hifz'].includes(String(r.activity_type).toLowerCase())&&r.end_surah&&r.end_ayah&&passingEv(r.evaluation)),key=r=>String(r.session_date)+'|'+String(r.created_at||'');
    const latest=ends.slice().sort((a,b)=>key(a)<key(b)?-1:1).at(-1),latestEnd=latest?{s:+latest.end_surah,a:+latest.end_ayah}:null;
    let expected=null;const before=ends.filter(r=>r.session_date<planStart).sort((a,b)=>key(a)<key(b)?-1:1).at(-1);
    if(before){const e={s:+before.end_surah,a:+before.end_ayah};if(e.a<ayahCounts[e.s-1])expected={s:e.s,a:e.a+1};else{const n=route===ROUTE_NAS?e.s-1:e.s+1;expected=(n<1||n>114)?null:{s:n,a:1}}}
    else{const first=ends.filter(r=>r.session_date>=planStart).sort((a,b)=>key(a)<key(b)?-1:1)[0];if(first&&first.start_surah&&first.start_ayah)expected={s:+first.start_surah,a:+first.start_ayah}}
    if(terminal&&latestEnd&&posR(latestEnd.s,latestEnd.a,route)>=posR(terminal.s,terminal.a,route))return {status:'ROUTE_COMPLETE',latestEnd,expected};
    if(terminal&&expected&&posR(expected.s,expected.a,route)>posR(terminal.s,terminal.a,route))return {status:'ROUTE_COMPLETE',latestEnd,expected};
    if(re&&latestEnd&&posR(latestEnd.s,latestEnd.a,route)>=posR(re.s,re.a,route))return {status:expected?'STALE_END':'NO_ANCHOR',latestEnd,expected};
    if(expected&&rs&&(expected.s!==rs.s||expected.a!==rs.a))return {status:'START_MISMATCH',latestEnd,expected};
    return {status:'OK',latestEnd,expected};
  }
  function rebasedRange(plan,start,route,cover){
    const target=Number(plan.target_pages)||0;if(target<=0)return null;
    const terminal=termOf(route),wanted=Math.max(1,Math.ceil(target*15));
    const covered=(cover&&posR(cover.s,cover.a,route)>=posR(start.s,start.a,route))?(orderedLines(start,cover,route)||[]).length:0;
    const all=orderedLines(start,terminal,route);if(!all||!all.length)return null;
    const lines=all.slice(0,wanted+Math.max(0,covered));const end=endpointOfLine(lines.at(-1),true);if(!end)return null;
    return {lines,end};
  }
  const label=(s,a,e,b)=>(s&&a&&e&&b)?`من ${surahs[s-1]}:${a} إلى ${surahs[e-1]}:${b}`:'غير محدد';
  async function rebasePreviews(halaqaId){
    if(!navigator.onLine||!state.networkVerified)throw new Error('يلزم اتصال بالإنترنت لفحص نطاق الخطط');
    await P().load(true);
    const t=T0(),plans=S().plans.filter(p=>p.plan_type==='hifz'&&p.status==='active'&&p.scope_type==='student'&&p.student_id&&(!halaqaId||p.halaqa_id===halaqaId)&&String(p.start_date).slice(0,10)<=t&&String(p.end_date).slice(0,10)>=t);
    if(!plans.length)return [];
    const since=iso(new Date(Date.now()-120*864e5)),byStudent=new Map;
    const ids=[...new Set(plans.map(p=>p.student_id))];
    for(let i=0;i<ids.length;i+=40){const {data,error}=await db.from('recitation_entries').select('student_id,activity_type,start_surah,start_ayah,end_surah,end_ayah,evaluation,created_at,sessions!inner(session_date)').eq('activity_type','new_hifz').in('student_id',ids.slice(i,i+40)).gte('sessions.session_date',since).order('created_at',{ascending:true}).limit(5000);if(error)throw error;(data||[]).forEach(r=>(byStudent.get(r.student_id)||byStudent.set(r.student_id,[]).get(r.student_id)).push({...r,session_date:r.sessions?.session_date}))}
    const out=[];
    for(const plan of plans){
      const recs=byStudent.get(plan.student_id)||[],route=routeOf(plan),rs=plan.range_start_surah&&plan.range_start_ayah?{s:plan.range_start_surah,a:plan.range_start_ayah}:null,re=plan.range_end_surah&&plan.range_end_ayah?{s:plan.range_end_surah,a:plan.range_end_ayah}:null,terminal=termOf(route);
      const dg=diagnose(recs,String(plan.start_date).slice(0,10),route,rs,re,terminal);if(dg.status==='OK')continue;
      const computed=dg.status==='ROUTE_COMPLETE'?null:(dg.expected?rebasedRange(plan,dg.expected,route,dg.latestEnd):null);
      let patch=null;
      if(dg.expected&&computed){const pgs=normPages(Number(computed.lines[0].split(':')[0]),Number(computed.lines.at(-1).split(':')[0]));patch={range_start_surah:dg.expected.s,range_start_ayah:dg.expected.a,range_end_surah:computed.end.s,range_end_ayah:computed.end.a,range_start_page:pgs[0]??null,range_end_page:pgs[1]??null}}
      out.push({planId:plan.id,studentId:plan.student_id,studentName:(window.RC27?.master?.students||state.students).find(s=>s.id===plan.student_id)?.full_name||'طالب',status:dg.status,oldLabel:label(plan.range_start_surah,plan.range_start_ayah,plan.range_end_surah,plan.range_end_ayah),newLabel:dg.expected&&computed?label(dg.expected.s,dg.expected.a,computed.end.s,computed.end.a):'غير متاح',latestLabel:dg.latestEnd?`${surahs[dg.latestEnd.s-1]}:${dg.latestEnd.a}`:'لا يوجد',patch});
    }
    return out;
  }
  window.rc27RebaseOpen=async function(){
    open('<div class="card"><h3>إعادة ضبط نطاق الشهر</h3><div class="muted">جارٍ الفحص…</div></div>');
    try{
      const sc=typeof rc27Scope==='function'?rc27Scope():{},prevs=await rebasePreviews(sc.selectedId||null);window.__rc27Rebase=prevs;
      const st={STALE_END:'تجاوز نهاية نطاقه القديم',ROUTE_COMPLETE:'أتمّ مسار الحفظ',START_MISMATCH:'بداية النطاق لا تطابق آخر حفظ',NO_ANCHOR:'بداية النطاق لا تطابق آخر حفظ'};
      open(`<div class="card"><h3>إعادة ضبط نطاق الشهر</h3><div class="muted">تظهر هنا الخطط التي نطاقها القديم لا يطابق موضع الطالب الفعلي. يُعاد حساب النطاق من آخر حفظ مقبول مع بقاء هدف الشهر.</div></div>${prevs.length?prevs.map((p,i)=>`<label class="card rc27-rb"><input type="checkbox" class="rc27-rbpick" data-i="${i}" ${p.patch?'checked':'disabled'}><div><b>${h(p.studentName)}</b><div class="muted">${st[p.status]||''}</div><div class="muted">آخر حفظ: ${h(p.latestLabel)}</div><div class="muted">الحالي: ${h(p.oldLabel)}</div><div class="muted">${p.patch?`الجديد: ${h(p.newLabel)}`:p.status==='ROUTE_COMPLETE'?'وصل نهاية مسار الحفظ فلا نطاق جديد للحفظ. أنشئ له خطة مراجعة أو تثبيت أو غيّر مساره.':'لا يمكن الحساب: لا يوجد حفظ سابق'}</div></div></label>`).join(''):'<div class="empty">كل الخطط سليمة، لا حاجة لإعادة الضبط.</div>'}<div class="form-actions">${prevs.some(p=>p.patch)?'<button class="btn btn-primary" onclick="rc27RebaseApply()">تطبيق المحدد</button>':''}<button class="btn btn-ghost" onclick="rc27ClosePhaseDlg()">إغلاق</button></div>`);
    }catch(e){open(`<div class="card"><h3>إعادة ضبط نطاق الشهر</h3><div class="notice">${h(e.message||e)}</div></div><div class="form-actions"><button class="btn btn-ghost" onclick="rc27ClosePhaseDlg()">إغلاق</button></div>`)}
  };
  window.rc27RebaseApply=function(){guard(async()=>{
    const prevs=window.__rc27Rebase||[],chosen=[...document.querySelectorAll('.rc27-rbpick:checked')].map(x=>prevs[Number(x.dataset.i)]).filter(p=>p&&p.patch);
    if(!chosen.length)throw new Error('لم يتم تحديد أي خطة');let ok=0;const fails=[];
    for(const p of chosen){const {data,error}=await db.from('smart_plans').update({...p.patch,updated_at:new Date().toISOString()}).eq('id',p.planId).select('id');if(error)fails.push(`${p.studentName}: ${error.message}`);else if(!data||!data.length)fails.push(`${p.studentName}: لم يُعدَّل أي صف (صلاحيات)`);else ok++}
    if(!ok&&fails.length)throw new Error(fails.join('؛ '));
    close();toast(`تم ضبط ${ok} خطة`);rc27RefreshPhases();
  })};
  // native healUndersizedPlanRanges: once a day, only for plans without phases whose range is far smaller than the target
  async function healUndersized(){
    try{
      if(!canWrite()||!navigator.onLine||!state.networkVerified||!state.user)return;
      const k='halaqati_range_heal_'+state.user.id,t=T0();if(localStorage.getItem(k)===t)return;localStorage.setItem(k,t);
      await P().load(true);
      const under=(lines,target)=>{if(lines==null||target<=0)return false;const wanted=Math.ceil(target*15);return lines<Math.max(1,Math.floor(wanted/2))};
      const cand=S().plans.filter(p=>['hifz','tathbit'].includes(p.plan_type)&&p.status==='active'&&p.scope_type==='student'&&p.student_id&&p.range_start_surah&&p.range_start_ayah&&String(p.start_date).slice(0,10)<=t&&String(p.end_date).slice(0,10)>=t&&under((p.settings?.memorization_line_keys||[]).length||((p.range_start_page&&p.range_end_page)?(Math.abs(p.range_end_page-p.range_start_page)+1)*15:null),Number(p.target_pages)||0));
      const phased=new Set(S().phases.filter(x=>x.status!=='archived').map(x=>x.plan_id));
      for(const p of cand.filter(x=>!phased.has(x.id))){
        const route=routeOf(p),start={s:p.range_start_surah,a:p.range_start_ayah},terminal=termOf(route),all=orderedLines(start,terminal,route);if(!all||!all.length)continue;
        const lines=all.slice(0,Math.max(1,Math.ceil(Number(p.target_pages)*15))),end=endpointOfLine(lines.at(-1),true);if(!end)continue;
        const pgs=normPages(Number(lines[0].split(':')[0]),Number(lines.at(-1).split(':')[0]));
        await db.from('smart_plans').update({range_end_surah:end.s,range_end_ayah:end.a,range_start_page:pgs[0]??null,range_end_page:pgs[1]??null,settings:{...(p.settings||{}),memorization_line_keys:lines},updated_at:new Date().toISOString()}).eq('id',p.id).select('id');
      }
    }catch(_e){}
  }
  setTimeout(healUndersized,20000);
})();
