/* RC27.40 native screens: plans — web twin of PlansScreen / SmartPlanEditorDialog (CoreScreens.kt).
   Replaces plansPage() and the smart-plan editor dialog markup. Plan maths stay in plans/engine.js,
   plans/runtime.js (smartPlanProgress, effectiveSmartPlans, saveSmartPlanLocal …) and window.RC27Phases. */
(function(){'use strict';
if(!window.NX)return;
const NX=window.NX,h=NX.h,ic=NX.icon;
const TYPE_AR={hifz:'حفظ',review:'مراجعة',sard:'سرد',tathbit:'تثبيت'};
const STATUS_AR={draft:'مسودة',active:'فعالة',paused:'موقفة',completed:'مكتملة',archived:'مؤرشفة'};
const HK={blue:'info',green:'success',yellow:'warning',red:'danger'};
const HL={blue:'متقدم',green:'على المسار',yellow:'يحتاج انتباه',red:'يحتاج متابعة'};
const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const LC_AR={scheduled:'مجدولة',active:'جارية',completed:'مكتملة',skipped:'مستثناة'};
const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const plain=v=>{const r=Math.round((Number(v)||0)*100)/100;return String(r)};
const el=id=>document.getElementById(id);
const isGuardian=()=>state.profile?.role==='guardian';
const canManage=()=>typeof roleCanManage==='function'&&roleCanManage();
const desktop=()=>document.documentElement.dataset.view==='desktop';
const nrm=v=>typeof normalizeNameJs==='function'?normalizeNameJs(v):String(v||'').toLowerCase();
const monthLabel=ym=>{const [y,m]=String(ym).split('-');return `${MONTHS[(+m||1)-1]} ${y}`};
const NP=window.NP={};
function S(){const s=state.np=state.np||{};s.track=s.track||'all';s.perf=s.perf||'all';s.open=s.open||{};s.months=s.months||{};s.mgr=s.mgr||'all';s.sel=s.sel||'';return s}
function rerender(){const r=typeof render==='function'?render():null;return Promise.resolve(r)}
function withConfirm(fn){const c=window.confirm;window.confirm=()=>true;try{return fn()}finally{window.confirm=c}}

/* ---------------------------------------------------------------- data helpers */
function rowsFor(students){const out=[];for(const st of students)for(const plan of effectiveSmartPlans(st))out.push({student:st,plan,progress:smartPlanProgress(plan,st.id)});return out}
function rowByKey(key){const [sid,pid]=String(key).split(':');const st=state.students.find(x=>String(x.id)===sid);if(!st)return null;const plan=effectiveSmartPlans(st).find(p=>String(p.id)===pid);if(!plan)return null;return {student:st,plan,progress:smartPlanProgress(plan,st.id)}}
const keyOf=r=>`${r.student.id}:${r.plan.id}`;
function phaseOf(plan,sid){try{const P=window.RC27Phases;if(!P||!P.S||!P.S.phases)return null;const phs=P.S.phases.filter(p=>p.plan_id===plan.id&&p.status!=='archived');if(!phs.length)return null;return P.activePhase(phs.map(P.enginePhase),P.S.states||[],sid,today())}catch(e){return null}}
function isTath(r){return r.student.track_code==='tathbit'||r.plan.plan_type==='tathbit'}
function phaseLabel(r,ph){
  if(isTath(r))return 'التثبيت الآن';
  if(ph)return ph.type==='sard'?'السرد الآن':ph.type==='hifz'?'الحفظ الآن':`${ph.raw?.title||'مرحلة'} الآن`;
  const d=new Date(),last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  if(d.getDate()<=Math.min(22,last))return r.progress.remaining<=.001?'الحفظ مكتمل · السرد يبدأ 23':'الحفظ الآن';
  return 'بانتظار المرحلة الحالية';
}
function core(r){
  const p=r.progress,pl=r.plan,target=Number(pl.target_pages)||0,done=Number(p.completed)||0,req=Number(p.plannedByToday)||0;
  const surplus=Math.max(0,done-target),finished=target>0&&done+.001>=target,early=finished&&String(pl.end_date).slice(0,10)>today();
  const behind=Number(p.behindBy)||0,ahead=Number(p.aheadBy)||0;
  const status=finished?(early?'complete_early':'complete'):(done<=.001&&req<=.001)?'not_started':behind>.001?'behind':ahead>.001?'ahead':'on_track';
  const end=new Date(String(pl.end_date).slice(0,10)+'T00:00:00Z'),now=new Date(today()+'T00:00:00Z');
  return {target,done,req,surplus,completedEarly:early,status,behind,ahead,remaining:Math.max(0,Number(p.remaining)||0),daysLeft:Math.max(0,Math.round((end-now)/864e5))};
}
function assignmentText(a){
  if(!a)return 'لا يوجد مقدار اليوم';
  const kind={hifz:'حفظ',review:'مراجعة',sard:'سرد',tathbit:'إعادة / تثبيت'}[a.kind]||'مقرر';
  const range=a.ayahLabel||(a.startPage||a.endPage?smartPlanRangeText(a.startPage,a.endPage):'لا يوجد مقدار اليوم');
  return `${kind}: ${range}`;
}
function actKindAr(v){return {hifz:'حفظ جديد',new_hifz:'حفظ جديد',review:'مراجعة قريبة',review_near:'مراجعة قريبة',review_far:'تثبيت',tathbit:'تثبيت',sard:'سرد',tilawah:'تلاوة',test:'اختبار'}[v]||v||''}
function scopeLabel(plan){
  if(plan.scope_type==='student')return state.students.find(x=>x.id===plan.student_id)?.full_name||'طالب محدد';
  if(plan.scope_type==='category')return (state.categories||[]).find(x=>x.id===plan.category_id)?.name||'فئة محددة';
  return state.halaqas.find(x=>x.id===plan.halaqa_id)?.name||'الحلقة كلها';
}
function planWhy(r,ph){
  const p=r.progress,c=core(r);
  if(ph&&ph.type==='sard')return 'مرحلة السرد: يتابع المقرر من آخر موضع سرد مسجل لهذه المرحلة، مستقلًا عن موضع الحفظ.';
  if(c.completedEarly)return 'أتم الطالب الهدف الشهري مبكرًا؛ المقرر الحالي استمرار طبيعي من آخر موضع، وما بعد الهدف يُحسب إنجازًا إضافيًا دون رفع هدف الشهر.';
  if(c.surplus>.001)return `الهدف مكتمل، والطالب متقدم +${plain(c.surplus)} ص كإنجاز إضافي؛ يستمر التسلسل من آخر موضع محفوظ.`;
  if(p.assignment?.blockedByRetry)return 'يوجد مقرر سابق يحتاج إعادة؛ بوابة الجودة تمنع التقدم حتى تثبيته.';
  if(p.pauseReason==='sard_week')return 'أسبوع السرد يوقف الحفظ الجديد مؤقتاً.';
  if(c.behind>.01&&Number(p.recoveryShare)>.001)return `أنت متأخر ${plain(c.behind)} ص عن المسار؛ تعويض اليوم +${plain(p.recoveryShare)} ص ضمن الحد اليومي للخطة.`;
  if(c.behind>.01)return `أنت متأخر ${plain(c.behind)} ص عن المسار؛ سيُوزّع التعويض على أيام الخطة القادمة دون تجاوز الحد اليومي.`;
  if(p.assignment?.isCatchUp)return 'هذا يوم تعويض مخصص لاستعادة المتأخر من الأيام السابقة.';
  if(c.ahead>.01)return `الطالب متقدم ${plain(c.ahead)} ص؛ المقرر يحافظ على تسلسل الخطة دون مضاعفة غير لازمة.`;
  if(Number(p.assignment?.pages)<=.001&&p.remaining<=.001)return 'اكتملت الخطة الحالية.';
  if(Number(p.assignment?.pages)<=.001)return 'اليوم ليس يوم دوام للخطة؛ سيظهر المقرر في يوم الخطة التالي.';
  return `المطلوب حتى اليوم ${plain(p.plannedByToday)} ص، والمنجز ${plain(p.completed)} ص؛ ورد اليوم محسوب وفق أيام الدوام والحد اليومي والتقدم الفعلي.`;
}

/* ---------------------------------------------------------------- small components */
function info(title,value,icon){
  const cls=title.startsWith('آخر')?'sec':title.includes('القادم')?'pri':title.startsWith('هذا الأسبوع')?'var':title.startsWith('لماذا')?'ter':'';
  return `<div class="np-info ${cls}">${ic(icon,20)}<div><b>${h(title)}</b><span>${h(value)}</span></div></div>`;
}
const tile=(label,value)=>`<div class="np-tile"><b>${h(value)}</b><span>${h(label)}</span></div>`;
const metric=(label,value)=>`<div class="np-m"><b>${h(value)}</b><span>${h(label)}</span></div>`;
function healthChip(code,count,label){return `<button type="button" class="np-hchip nx-s-${HK[code]}" title="${h(label)}" aria-label="${h(label)}: ${count}" onclick="NP.perf('${h(label)}')"><i></i><b>${count}</b></button>`}
function phaseMini(title,dates,target,active){return `<div class="np-phase ${active?'on':''}"><b>${active?'<i></i>':''}${h(title)}</b><small>${h(dates)}</small><span>${h(target)}</span></div>`}

function cardHtml(r,manage){
  const p=r.progress,c=core(r),ph=phaseOf(r.plan,r.student.id),key=keyOf(r),open=!!S().open[key]&&!desktop(),code=HK[p.health]?p.health:'green',label=HL[code];
  const a=p.assignment||{},tath=isTath(r),end=Number(String(r.plan.end_date).slice(8,10))||30;
  const activeTarget=ph&&ph.type==='sard'?25:(Number(r.plan.target_pages)||0);
  const pct=activeTarget<=.001?0:Math.max(0,Math.min(100,(Number(p.completed)||0)/activeTarget*100));
  const hifzTarget=Number(r.plan.settings?.monthly_hifz_target_pages)>.001?Number(r.plan.settings.monthly_hifz_target_pages):Number(r.plan.target_pages)||0;
  const aText=a.blockedByRetry?`إعادة تثبيت · ${assignmentText(a).split(': ').slice(1).join(': ')||assignmentText(a)}`:(Number(a.pages)<=0?(p.remaining<=0?'تم إكمال الهدف الحالي':'لا يوجد مقرر اليوم'):assignmentText(a));
  const last=typeof smartPlanLastRecitation==='function'?smartPlanLastRecitation(r.student,r.plan):null;
  const lastBlock=last?info(`آخر تسميع · ${smartPlanDateOfRecord(last)||'—'}`,`${actKindAr(last.activity_type)} · ${smartPlanRecitationRangeText(last)} · ${plain(last.pages_count)} ص`,'History'):info('آخر تسميع','لا يوجد تسميع مرتبط بالخطة بعد','History');
  const summary=Number(p.behindBy)>.001?`متأخر ${plain(p.behindBy)} ص`:Number(p.aheadBy)>.001?`متقدم ${plain(p.aheadBy)} ص`:'مطابق للمطلوب حتى اليوم';
  let warn='';
  if(code==='red'||code==='yellow'){const rd=Math.max(1,22-new Date().getDate()),rec=(Number(p.behindBy)||0)/rd;warn=NX.notice(code==='red'?`يحتاج متابعة: متأخر أكثر من 25% عن المطلوب حتى اليوم. للعودة للمسار يحتاج تقريبًا ${plain(rec)} ص إضافية في كل يوم حفظ متبقٍ.`:'يحتاج انتباه: يوجد تأخر عن المسار المتوقع حتى اليوم.',code==='red'?'danger':'warning')}
  const phases=tath?phaseMini('التثبيت',`${String(r.plan.start_date).slice(0,10)} – ${String(r.plan.end_date).slice(0,10)}`,`الهدف ${plain(r.plan.target_pages)} ص`,true):`<div class="np-phases">${phaseMini('الحفظ','1–22',`${plain(hifzTarget)} ص`,(ph&&ph.type==='hifz')||(!ph&&new Date().getDate()<=22))}${phaseMini('السرد',`23–${end}`,'25 ص',!!(ph&&ph.type==='sard'))}</div>`;
  const kind=a.kind==='sard'?'sard':a.kind==='review'?'review':a.kind==='tathbit'?'tathbit':'new_hifz';
  const actions=`<div class="np-act2">${NX.btn('الأرشيف',{kind:'outlined',icon:'History',onclick:`NP.history('${h(r.student.id)}')`})}${NX.btn('التفاصيل',{kind:'outlined',icon:'Info',onclick:`NP.details('${h(key)}')`})}</div>${manage?`<div class="np-act2">${NX.btn('تعديل',{kind:'outlined',icon:'Edit',onclick:`NP.edit('${h(r.plan.id)}','${h(r.student.id)}')`})}${NX.btn('المراحل',{kind:'outlined',icon:'Timeline',onclick:`NP.phases('${h(r.plan.id)}')`})}</div>${NX.btn('تسميع المقرر',{kind:'filled',icon:'RecordVoiceOver',full:true,disabled:!(Number(a.pages)>0),onclick:`NP.recite(this,'${h(r.student.id)}','${h(r.plan.id)}','${kind}')`})}`:''}`;
  return `<article class="np-card ${open?'open':''} ${S().sel===key&&desktop()?'sel':''}" data-key="${h(key)}" data-name="${h(nrm(r.student.full_name)+' '+nrm(r.plan.title||''))}" data-health="${code}">
    <div class="np-card-head" role="button" tabindex="0" aria-expanded="${open}" onclick="NP.pick('${h(key)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();NP.pick('${h(key)}')}">
      <span class="np-dot nx-s-${HK[code]}"><i></i></span>
      <div class="np-card-t"><b class="np-name">${h(r.student.full_name)}</b><small>${h(phaseLabel(r,ph))}</small></div>
      ${NX.pill(h(label),HK[code],{cls:'np-badge'})}
      <span class="nx-iconbtn np-chev">${ic(open?'KeyboardArrowUp':'KeyboardArrowDown',24)}</span>
    </div>
    <div class="np-sum"><b>${plain(p.completed)} / ${plain(activeTarget)} ص</b><span>${h(summary)}</span></div>
    ${NX.progress(pct,{cls:'np-bar'})}
    <div class="np-today">${ic('MenuBook',16)}<span>${h(aText)}</span></div>
    <div class="np-body"><hr class="nx-divider">${phases}${info('مقرر اليوم',aText,'MenuBook')}${lastBlock}${warn}${actions}</div>
  </article>`;
}

function overviewHtml(r){
  const c=core(r),p=r.progress,ph=phaseOf(r.plan,r.student.id);
  const pctSched=c.req<=.001?100:Math.max(0,c.done/c.req*100);
  let band,tone;
  if(c.status==='not_started'){band='لم تبدأ';tone='neutral'}else if(pctSched>110){band='متقدم';tone='primary'}else if(pctSched>=90){band='على المسار';tone='success'}else if(pctSched>=75){band='يحتاج انتباه';tone='warning'}else{band='يحتاج متابعة';tone='warning'}
  const icon={complete:'Verified',complete_early:'Verified',behind:'WarningAmber',ahead:'TrendingUp',not_started:'Schedule'}[c.status]||'TrackChanges';
  const stateText=c.completedEarly?`أتم الخطة مبكرًا${c.surplus>.001?` · +${plain(c.surplus)} ص`:''}`:c.behind>.001?`متأخر ${plain(c.behind)} ص`:c.ahead>.001?`متقدم +${plain(c.ahead)} ص`:c.status==='not_started'?'لم تبدأ الخطة':'على الخطة';
  const req=Math.max(0,Number(p.dailyTarget)||0),done=Math.max(0,Number(p.completedToday)||0),rem=Math.max(0,req-done);
  const wk=typeof smartPlanWeekRequirement==='function'?smartPlanWeekRequirement(r.plan,p,today()):null;
  return `<div class="np-ov">
    <div class="np-ov-head"><span class="np-ov-ic np-tone-${tone}">${ic(icon,24)}</span><div><b>${h(r.student.full_name)}</b><span>${h(r.plan.title||TYPE_AR[r.plan.plan_type]||'')}</span></div></div>
    <div class="np-ov-row"><span class="np-band np-tone-${tone}">${h(band)}</span><small>${h(stateText)}</small></div>
    ${NX.progress(Math.min(100,Number(p.percentage)||0),{cls:'np-bar big'})}
    <div class="np-tiles">${tile('الهدف',`${plain(c.target)} ص`)}${tile('المنجز',`${plain(c.done)} ص`)}${c.surplus>.001?tile('الإنجاز الإضافي',`+${plain(c.surplus)} ص`):tile('المتبقي',`${plain(c.remaining)} ص`)}</div>
    <div class="np-metrics3"><div class="np-m"><b>${plain(req)} ص</b><span>مطلوب اليوم</span></div><div class="np-m"><b>${plain(done)} ص</b><span>المنجز اليوم</span></div><div class="np-m"><b>${plain(rem)} ص</b><span>المتبقي اليوم</span></div></div>
    ${c.completedEarly?`<div class="np-early">${ic('AutoAwesome',22)}<div><b>أتم الخطة مبكرًا</b><span>بقي ${c.daysLeft} يومًا على نهاية الخطة · الإنجاز الإضافي ${c.surplus>.001?`+${plain(c.surplus)} ص`:'يبدأ من التسميع التالي'}</span></div></div>`:''}
    ${wk&&wk.amount>0?`<div class="np-week"><div class="np-week-h">${ic('CalendarMonth',19)}<b>هذا الأسبوع</b><b>${plain(wk.amount)} ص</b></div><small>${h(smartPlanRangeText(wk.startPage,wk.endPage))}</small></div>`:''}
  </div>`;
}
function timelineHtml(r){
  const P=window.RC27Phases;if(!P||!P.S||!P.S.phases)return '';
  const phs=P.S.phases.filter(p=>p.plan_id===r.plan.id&&p.status!=='archived').sort((a,b)=>a.phase_order-b.phase_order);if(!phs.length)return '';
  return `<div class="np-tl"><b>مراحل الخطة</b>${phs.map(p=>{let lc='';try{const st=(P.S.states||[]).find(x=>x.phase_id===p.id&&x.student_id===r.student.id);lc=LC_AR[P.lifecycle(P.enginePhase(p),st,today())]||''}catch(e){}
    return `<div class="np-tl-i"><span class="np-tl-dot"></span><div><b>${p.phase_order}. ${h(p.title||'')}</b><small>${h(String(p.start_date).slice(0,10))} ← ${h(String(p.end_date).slice(0,10))}${p.target_pages!=null?` · ${plain(p.target_pages)} ص`:''}</small></div>${lc?NX.pill(lc,'neutral'):''}</div>`}).join('')}</div>`;
}
function detailHtml(r,withActions){
  const p=r.progress,c=core(r),ph=phaseOf(r.plan,r.student.id),a=p.assignment||{};
  const next=typeof smartPlanNextDuty==='function'?smartPlanNextDuty(r.plan,r.student,today()):null;
  const todayVal=Number(a.pages)>.001?assignmentText(a):c.completedEarly?'أُنجز الهدف الشهري؛ أي تسميع جديد يُحسب إنجازًا إضافيًا':p.remaining<=.001?'الخطة مكتملة':(ph&&ph.type==='sard'?'لا يوجد سرد مقرر اليوم':'لا يوجد حفظ مقرر اليوم');
  const range=typeof smartPlanPlanRangeText==='function'?smartPlanPlanRangeText(r.plan):'';
  const key=keyOf(r),manage=canManage();
  return `<div class="np-detail">${overviewHtml(r)}${timelineHtml(r)}${info('مقرر اليوم',todayVal,'MenuBook')}${next?info(`المقرر القادم · ${next.date}`,assignmentText(next.progress.assignment),'EventAvailable'):''}${info('لماذا هذا المقرر؟',planWhy(r,ph),'Lightbulb')}${info('الحد اليومي',`${plain(p.dailyCap)} صفحة · الحد الأدنى ${plain(p.minimumDaily)} صفحة`,'Speed')}${info('المطلوب حتى اليوم',`${plain(p.plannedByToday)} صفحة · العجز ${plain(p.deficit)} صفحة`,'TrackChanges')}${range?info('النطاق',range.replace(/<[^>]+>/g,''),'AutoStories'):''}${(p.retryPages||[]).length?info('صفحات تحتاج إعادة',p.retryPages.join(', '),'Replay'):''}${r.plan.note?info('ملاحظة الخطة',r.plan.note,'StickyNote2'):''}
  ${withActions?`<div class="np-side-actions">${NX.btn('الأرشيف',{kind:'outlined',icon:'History',onclick:`NP.history('${h(r.student.id)}')`})}${manage?NX.btn('تعديل',{kind:'outlined',icon:'Edit',onclick:`NP.edit('${h(r.plan.id)}','${h(r.student.id)}')`}):''}${manage?NX.btn('المراحل',{kind:'outlined',icon:'Timeline',onclick:`NP.phases('${h(r.plan.id)}')`}):''}${manage?NX.btn('تسميع المقرر',{kind:'filled',icon:'RecordVoiceOver',disabled:!(Number(a.pages)>0),onclick:`NP.recite(this,'${h(r.student.id)}','${h(r.plan.id)}','${a.kind==='sard'?'sard':a.kind==='review'?'review':a.kind==='tathbit'?'tathbit':'new_hifz'}')`}):''}</div>`:''}</div>`;
}

/* ---------------------------------------------------------------- tabs: reports / archived / previous months */
function reportsHtml(rows){
  const best=[...rows].sort((a,b)=>b.progress.percentage-a.progress.percentage).slice(0,8),delayed=rows.filter(x=>x.progress.health!=='green'&&x.progress.health!=='blue').sort((a,b)=>a.progress.percentage-b.progress.percentage);
  const halaqas=(state.halaqas||[]).map(hq=>{const r=rows.filter(x=>x.student.halaqa_id===hq.id),target=r.reduce((s,x)=>s+Number(x.plan.target_pages||0),0),done=r.reduce((s,x)=>s+x.progress.completed,0);return {hq,r,pct:target?done/target*100:0}}).filter(x=>x.r.length);
  const byType=Object.keys(TYPE_AR).map(type=>{const r=rows.filter(x=>x.plan.plan_type===type);return {type,planned:r.reduce((s,x)=>s+x.progress.plannedByToday,0),done:r.reduce((s,x)=>s+x.progress.completed,0)}}).filter(x=>x.planned||x.done);
  const row=(l,sub,r)=>`<div class="np-rrow"><span><b>${l}</b>${sub?`<small>${sub}</small>`:''}</span>${r}</div>`;
  return `<div class="np-reports">
    <section class="nx-card"><h3>أفضل التزام</h3>${best.map((x,i)=>row(`${i+1}. ${h(x.student.full_name)}`,'',`<b class="np-pct">${plain(x.progress.percentage)}%</b>`)).join('')||'<p class="nx-muted">لا توجد بيانات.</p>'}</section>
    <section class="nx-card"><h3>الطلاب المتأخرون</h3>${delayed.map(x=>row(h(x.student.full_name),`${x.progress.consecutiveMissed} أيام متتالية · ${TYPE_AR[x.plan.plan_type]||''}`,NX.pill(h(HL[x.progress.health]||''),HK[x.progress.health]||'neutral'))).join('')||'<p class="nx-muted">كل الخطط ضمن المسار السليم.</p>'}</section>
    <section class="nx-card"><h3>نسبة إنجاز الحلقات</h3>${halaqas.map(x=>`<div class="np-hq"><div><b>${h(x.hq.name)}</b><small>${x.r.length} مسار فعال</small></div>${NX.progress(Math.min(100,x.pct))}<b class="np-pct">${plain(x.pct)}%</b></div>`).join('')||'<p class="nx-muted">لا توجد خطط.</p>'}</section>
    <section class="nx-card"><h3>المخطط مقابل المنجز حتى اليوم</h3>${byType.map(x=>`<div class="np-hq"><div><b>${TYPE_AR[x.type]}</b><small>المخطط ${plain(x.planned)} ص · ${plain(x.done)} منجز</small></div>${NX.progress(Math.min(100,x.planned?x.done/x.planned*100:0))}<b class="np-pct">${plain(x.planned?x.done/x.planned*100:0)}%</b></div>`).join('')||'<p class="nx-muted">لا توجد بيانات.</p>'}</section>
  </div>`;
}
function mgrItem(plan){
  const acts=[['phases','المراحل','Timeline'],['edit','تعديل','Edit']];
  if(plan.scope_type!=='student'&&plan.status!=='archived')acts.push(['override','تجاوز للطالب','PersonAddAlt']);
  if(plan.status==='active')acts.push(['pause','إيقاف','PauseCircle']);else if(['paused','archived','draft'].includes(plan.status))acts.push(['activate',plan.status==='archived'?'استعادة':'تفعيل','PlayCircle']);
  if(plan.status!=='archived')acts.push(['archive','أرشفة','Archive']);
  if(plan.status==='archived'&&canManage())acts.push(['delete','حذف نهائي','DeleteForever']);
  return `<div class="nx-card np-mi"><div class="np-mi-h"><div class="np-grow"><b>${h(plan.title||TYPE_AR[plan.plan_type]||'خطة')}</b><small>${h(scopeLabel(plan))}</small></div><span class="np-spill">${h(STATUS_AR[plan.status]||plan.status)}</span></div>
    <p class="np-mi-l">${h(TYPE_AR[plan.plan_type]||plan.plan_type)} · ${plain(plan.target_pages)} صفحة · من ${h(String(plan.start_date).slice(0,10))} إلى ${h(String(plan.end_date).slice(0,10))}</p>
    <div class="np-mi-a">${acts.map(([k,l,i])=>NX.btn(l,{kind:k==='delete'?'danger':'outlined',icon:i,small:true,onclick:`NP.act('${k}','${h(plan.id)}')`})).join('')}</div></div>`;
}
function archivedHtml(){
  const rows=(state.smartPlans||[]).filter(x=>x.status==='archived'&&(state.smartPlanHalaqa==='all'||x.halaqa_id===state.smartPlanHalaqa)).sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
  if(!rows.length)return NX.empty('لا توجد خطط مؤرشفة في هذا النطاق.',{icon:'Archive'});
  return `<div class="np-list">${rows.map(mgrItem).join('')}</div>`;
}
let ARCH=null,ARCH_BUSY=false;
async function loadArchives(){
  if(ARCH||ARCH_BUSY||!navigator.onLine||typeof db==='undefined')return;ARCH_BUSY=true;
  try{const r=await db.from('smart_plan_month_archives').select('id,source_plan_id,student_id,halaqa_id,period_month,plan_title,target_pages,done_pages').order('period_month',{ascending:false}).limit(2000);ARCH=Array.isArray(r.data)?r.data:[];}catch(e){ARCH=[]}
  ARCH_BUSY=false;const box=el('npPrev');if(box)box.innerHTML=prevInner();
}
function prevInner(){
  const cur=today().slice(0,7),hid=state.smartPlanHalaqa==='all'?null:state.smartPlanHalaqa,list=[],live=new Set();
  for(const p of state.smartPlans||[]){const m=String(p.start_date||'').slice(0,7);if(!m||m>=cur)continue;if(hid&&p.halaqa_id!==hid)continue;live.add(p.id+'|'+m);list.push({key:'p'+p.id,month:m,student:p.student_id||'',title:p.title||'خطة',status:STATUS_AR[p.status]||p.status})}
  const seen=new Set();
  for(const a of ARCH||[]){const m=String(a.period_month||'').slice(0,7);if(!m||m>=cur)continue;if(hid&&a.halaqa_id!==hid)continue;if(a.source_plan_id&&live.has(a.source_plan_id+'|'+m))continue;if(seen.has(a.id))continue;seen.add(a.id);list.push({key:'a'+a.id,month:m,student:a.student_id,title:a.plan_title||'خطة',status:Number(a.target_pages)>.001&&Number(a.done_pages)+.001>=Number(a.target_pages)?'مكتملة':'منتهية'})}
  if(!list.length)return '';
  const groups={};list.forEach(e=>(groups[e.month]=groups[e.month]||[]).push(e));
  const months=Object.keys(groups).sort().reverse(),d=new Date(),prev=new Date(d.getFullYear(),d.getMonth()-1,1),prevKey=`${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
  return `<h3 class="np-sec-t">الأشهر السابقة</h3>${months.map(m=>{const open=S().months[m]??(m===prevKey);return `<button type="button" class="np-mh" aria-expanded="${open}" onclick="NP.month('${m}')"><b>${monthLabel(m)}</b><span>${groups[m].length} خطة</span>${ic(open?'ExpandLess':'ExpandMore',22)}</button>${open?groups[m].map(e=>`<div class="np-hl"><div><b>${h(e.title)}</b><small>${h(state.students.find(s=>s.id===e.student)?.full_name||'')}</small></div><span class="np-spill">${h(e.status)}</span></div>`).join(''):''}`}).join('')}`;
}

/* ---------------------------------------------------------------- page */
function sideEmpty(){return `<div class="np-side-empty">${ic('TrackChanges',34)}<p>اختر خطة من القائمة لعرض تفاصيلها ومقرر اليوم</p></div>`}
function guardPage(title,text){return `<div class="np-page"><div class="np-main">${NX.hero(title,'',{icon:'Timeline'})}<div class="np-gap">${NX.empty(text,{icon:'SearchOff'})}</div></div></div>`}
function dashboard(){
  const s=S(),manage=canManage(),guardian=isGuardian();
  const halaqas=(state.halaqas||[]).filter(x=>x.active!==false);
  const students=activeStudents().filter(st=>state.smartPlanHalaqa==='all'||st.halaqa_id===state.smartPlanHalaqa);
  const rows=rowsFor(students),withPlans=new Set(rows.map(x=>String(x.student.id))),noPlan=manage?students.filter(x=>!withPlans.has(String(x.id))):[];
  const counts={};rows.forEach(x=>{const c=HK[x.progress.health]?x.progress.health:'green';counts[c]=(counts[c]||0)+1});
  const children=guardian?[...new Map(rows.map(x=>[x.student.id,x.student])).values()]:[];
  if(guardian&&(!s.child||!children.some(c=>c.id===s.child)))s.child=children[0]?.id||null;
  const q=nrm(state.smartPlanSearch||'');
  const filtered=rows.filter(x=>(s.track==='all'||(s.track==='tathbit')===(x.student.track_code==='tathbit'))&&(s.perf==='all'||HL[x.progress.health]===s.perf)&&(!guardian||!s.child||x.student.id===s.child)&&(!q||nrm(x.student.full_name).includes(q)||nrm(x.plan.title||'').includes(q)));
  const avg=rows.length?rows.reduce((a,x)=>a+x.progress.percentage,0)/rows.length:0,behind=rows.filter(x=>!['green','blue'].includes(x.progress.health)).length;
  const monthTxt=monthLabel(today().slice(0,7));
  let h1='';
  const heroActions=manage?`${NX.btn('خطة جديدة',{kind:'filled',icon:'Add',onclick:'NP.create()'})}${NX.btn('إدارة الخطط',{kind:'tonal',icon:'Tune',onclick:'NP.actions()'})}`:'';
  h1+=NX.hero(guardian?'خطط الأبناء':'الخطط الذكية',manage?'مقرر يومي شخصي محسوب بالأسطر والآيات حسب هدف كل طالب.':'تابع مقرر اليوم وتقدّم خطة كل ابن.',{icon:'Timeline',actions:heroActions,cls:'np-hero'});
  if(!navigator.onLine)h1+=`<div class="np-gap">${NX.notice('أنت غير متصل — تُعرض آخر بيانات محفوظة على الجهاز وستتزامن التغييرات عند عودة الإنترنت.','warning')}</div>`;
  if(manage){
    h1+=`<div class="np-monthrow">${ic('CalendarMonth',18)}<b>${h(monthTxt)} · <span id="npCount">${filtered.length}</span> خطة</b><span class="np-grow"></span>${NX.btn('ضبط النطاق',{kind:'text',icon:'Tune',small:true,onclick:'NP.rebase()'})}${NX.btn('إدارة الشهر',{kind:'text',icon:'Autorenew',small:true,onclick:'NP.roll()'})}</div>`;
    h1+=`<div class="np-tabs">${NX.chips([['dashboard','لوحة الخطط'],['reports','تقارير الخطط'],['archived','الخطط المؤرشفة']].map(([k,l])=>({label:l,selected:state.smartPlanTab===k,check:false,onclick:`NP.tab('${k}')`})))}</div>`;
  }
  const tab=manage?state.smartPlanTab:'dashboard';
  if(tab==='reports')return wrap(h1+reportsHtml(rows.filter(x=>nrm(x.student.full_name).includes(q))),'reports');
  if(tab==='archived')return wrap(h1+archivedHtml(),'archived');
  if(guardian&&children.length){
    h1+=`<div class="np-kids">${NX.chips(children.map(c=>({label:h(c.full_name),selected:s.child===c.id,check:false,onclick:`NP.child('${h(c.id)}')`})),{wrap:true})}</div>`;
    const f=filtered[0];
    if(f){const p=f.progress,a=p.assignment||{},req=Number(p.dailyTarget)||0,done=Number(p.completedToday)||0,rem=Math.max(0,req-done);
      h1+=`<div class="nx-card np-today-card"><div class="np-tc-h"><b>مقرر اليوم</b><span>${plain(done)}/${plain(req)} ص</span></div><p>${h(a.startPage||a.endPage||a.ayahLabel?`${assignmentText(a)} · ${plain(a.pages)} ص`:Number(a.pages)>0?`${actKindAr(a.kind)} · ${plain(a.pages)} ص`:p.remaining<=0?'اكتملت خطة هذا الشهر':'لا يوجد مقرر اليوم')}</p>${rem>.001?NX.progress(req>.001?done/req*100:0):''}</div>`}
  }
  if(manage){
    h1+=`<div class="np-toolbar">${NX.search(state.smartPlanSearch||'','بحث باسم الطالب أو الخطة',{oninput:'NP.search(this.value)',trailing:NX.iconBtn('FilterAlt',{title:'فلترة الخطط',onclick:'NP.filters()'})})}</div>`;
    if(s.track!=='all'||s.perf!=='all')h1+=`<div class="np-active">${s.track!=='all'?`<button type="button" class="np-assist" onclick="NP.setTrack('all',1)">${s.track==='general_hifz'?'الحفظ العام':'التثبيت'} ×</button>`:''}${s.perf!=='all'?`<button type="button" class="np-assist" onclick="NP.perf('all')">${h(s.perf)} ×</button>`:''}<button type="button" class="np-assist" onclick="NP.clearFilters()">مسح الفلاتر</button></div>`;
    h1+=`<div class="np-health">${healthChip('blue',counts.blue||0,'متقدم')}${healthChip('green',counts.green||0,'على المسار')}${healthChip('yellow',counts.yellow||0,'يحتاج انتباه')}${healthChip('red',counts.red||0,'يحتاج متابعة')}<span class="np-grow"></span>${NX.iconBtn('Tune',{title:'إدارة الخطط',cls:'nx-tile np-tune',onclick:'NP.actions()'})}</div>`;
    h1+=`<div class="np-summary">${NX.metrics([NX.metric('المسارات الفعالة',rows.length,{icon:'TrackChanges'}),NX.metric('متوسط الإنجاز',plain(avg)+'%',{icon:'TrendingUp'}),NX.metric('بحاجة متابعة',behind,{icon:'WarningAmber'}),NX.metric('طلاب بلا خطة',noPlan.length,{icon:'PersonSearch'})],4)}</div>`;
    const ev=(state.smartPlanEvents||[]).filter(x=>x.event_type==='auto_extension').slice(0,3);
    if(ev.length)h1+=`<div class="np-gap np-stack">${ev.map(e=>{const pl=(state.smartPlans||[]).find(x=>x.id===e.plan_id),st=state.students.find(x=>x.id===e.student_id),pay=e.payload||{};return NX.notice(`تم تمديد «${h(pl?.title||'الخطة')}» للطالب ${h(st?.full_name||'—')} من ${h(pay.old_end_date||'—')} إلى ${h(pay.new_end_date||'—')} لأن العجز تجاوز سقف التعويض الآمن.`,'info')}).join('')}</div>`;
  }
  let list;
  if(state.smartPlansAvailable==null&&!rows.length&&!(state.smartPlans||[]).length)list=NX.skeleton(3);
  else{
    const grouped=manage&&state.smartPlanHalaqa==='all'&&halaqas.length>1;
    const mk=rs=>`<div class="np-grid">${rs.map(x=>cardHtml(x,manage)).join('')}</div>`;
    if(grouped){const by={};filtered.forEach(x=>(by[x.student.halaqa_id||x.plan.halaqa_id||'']=by[x.student.halaqa_id||x.plan.halaqa_id||'']||[]).push(x));
      list=Object.entries(by).map(([id,rs])=>[halaqas.find(x=>x.id===id)?.name||'بدون حلقة',rs]).sort((a,b)=>a[0].localeCompare(b[0],'ar')).map(([n,rs])=>`<section class="np-group"><h3 class="np-sec-t">${h(n)} · ${rs.length} خطة</h3>${mk(rs)}</section>`).join('')}
    else list=`<section class="np-group">${mk(filtered)}</section>`;
    list+=`<div id="npEmpty" ${filtered.length?'hidden':''}>${NX.empty('لا توجد خطط فعالة مطابقة',{icon:'SearchOff'})}</div>`;
  }
  let tail='';
  if(manage){
    tail+=`<div id="npPrev" class="np-prev">${prevInner()}</div>`;
    if(noPlan.length)tail+=`<details class="nx-card np-noplan" ${state.smartPlanSearch?'open':''}><summary><b>طلاب بلا خطة فعالة</b><span>${noPlan.length}</span></summary><div>${noPlan.map(st=>`<div class="np-np-row"><span class="np-grow"><b>${h(st.full_name)}</b><small>${h(state.halaqas.find(x=>x.id===st.halaqa_id)?.name||'')}</small></span>${NX.btn('إنشاء خطة',{kind:'tonal',small:true,icon:'Add',onclick:`NP.create('${h(st.id)}')`})}</div>`).join('')}</div></details>`;
  }
  return wrap(h1+`<div class="np-list-wrap">${list}</div>`+tail,'dashboard');
}
function wrap(inner,tab){
  const manage=canManage();
  const ph=window.__npPhasesMarker?`<section class="np-phases" id="npPhasesWrap"><div id="rc27Phases"><div class="nx-muted">جارٍ تحميل مراحل الخطط…</div></div></section>`:'';
  return `<div class="np-page np-tab-${tab}"><div class="np-main">${inner}${tab==='dashboard'?ph:''}</div>${tab==='dashboard'?`<aside class="np-side" id="npSide" aria-label="تفاصيل الخطة">${sideEmpty()}</aside>`:''}</div>`;
}
const prevPage=typeof plansPage==='function'?plansPage:null;
window.plansPage=plansPage=function(){
  if(typeof beginSmartPlanRenderMemo==='function')beginSmartPlanRenderMemo();
  try{
    if(state.smartPlansAvailable===false)return `<div class="np-page"><div class="np-main">${NX.hero('الخطط الذكية','المحرك جاهز، وتبقى تهيئة جدولي الخطط والأحداث على Supabase.',{icon:'Timeline'})}<div class="np-gap">${NX.notice(`<b>طبّق ترحيل قاعدة البيانات أولاً:</b><br>supabase/migrations/20260831_v217_smart_plan_categories_admin_delete.sql${state.smartPlanError?`<br><span class="nx-muted">${h(state.smartPlanError)}</span>`:''}`,'warning')}</div></div></div>`;
    /* run the legacy hook chain (programs gate, RC27 phases section) with an empty student list: cheap, keeps window.rc27… hooks alive */
    let legacy='';
    if(prevPage){const keep=activeStudents;activeStudents=function(){return []};try{legacy=String(prevPage.apply(this,arguments)||'')}catch(e){legacy=''}finally{activeStudents=keep}}
    if(/خاصة بطلاب الحلقات/.test(legacy))return guardPage('الخطط الذكية','الخطط الذكية خاصة بطلاب الحلقات، ولا تُستخدم في البرامج والدورات. اختر حلقة عادية من شريط النطاق لعرض الخطط.');
    window.__npPhasesMarker=legacy.includes('id="rc27Phases"');
    const html=dashboard();
    if(!ARCH&&canManage())setTimeout(loadArchives,50);
    return html;
  }finally{if(typeof endSmartPlanRenderMemo==='function')endSmartPlanRenderMemo()}
};

/* ---------------------------------------------------------------- actions */
NP.tab=t=>{state.smartPlanTab=t;rerender()};
NP.halaqa=id=>{state.smartPlanHalaqa=id;rerender()};
NP.child=id=>{S().child=id;rerender()};
NP.month=m=>{const s=S();s.months[m]=!(s.months[m]??(m===(()=>{const d=new Date(),p=new Date(d.getFullYear(),d.getMonth()-1,1);return `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}`})()));const b=el('npPrev');if(b)b.innerHTML=prevInner()};
NP.search=v=>{state.smartPlanSearch=v;const q=nrm(v);let n=0;document.querySelectorAll('.np-card[data-name]').forEach(c=>{const ok=!q||c.dataset.name.includes(q);c.hidden=!ok;if(ok)n++});document.querySelectorAll('.np-group').forEach(g=>{g.hidden=![...g.querySelectorAll('.np-card')].some(c=>!c.hidden)});const e=el('npEmpty');if(e)e.hidden=n>0;const cnt=el('npCount');if(cnt)cnt.textContent=n};
NP.pick=key=>{
  const s=S();
  if(desktop()){s.sel=key;const r=rowByKey(key),side=el('npSide');document.querySelectorAll('.np-card.sel').forEach(c=>c.classList.remove('sel'));document.querySelectorAll('.np-card').forEach(c=>{if(c.dataset.key===key)c.classList.add('sel')});if(side&&r)side.innerHTML=`<div class="np-side-h"><b>تفاصيل الخطة الذكية</b><small>${h(String(r.plan.start_date).slice(0,10))} ← ${h(String(r.plan.end_date).slice(0,10))}</small></div>${detailHtml(r,true)}`;return}
  s.open[key]=!s.open[key];document.querySelectorAll('.np-card').forEach(c=>{if(c.dataset.key===key){c.classList.toggle('open',!!s.open[key]);const hd=c.querySelector('.np-card-head');hd&&hd.setAttribute('aria-expanded',String(!!s.open[key]));const ch=c.querySelector('.np-chev');if(ch)ch.innerHTML=ic(s.open[key]?'KeyboardArrowUp':'KeyboardArrowDown',24)}});
};
NP.perf=label=>{const s=S();s.perf=(label==='all'||s.perf===label)?'all':label;rerender();if(el('npFilters')?.open)NP.filters()};
NP.setTrack=(v,close)=>{S().track=v;rerender();if(!close&&el('npFilters')?.open)NP.filters()};
NP.clearFilters=()=>{const s=S();s.track='all';s.perf='all';rerender()};
NP.filters=()=>{
  const s=S(),chips=(items,cur,fn)=>NX.chips(items.map(([v,l])=>({label:l,selected:cur===v,check:false,onclick:fn(v)})),{wrap:true});
  NX.dialog('npFilters','فلترة الخطط',`<div class="np-fs"><b>المسار</b>${chips([['all','الكل'],['general_hifz','الحفظ العام'],['tathbit','التثبيت']],s.track,v=>`NP.setTrack('${v}')`)}<b>مستوى المتابعة</b>${chips([['all','الكل'],['متقدم','متقدم'],['على المسار','على المسار'],['يحتاج انتباه','يحتاج انتباه'],['يحتاج متابعة','يحتاج متابعة']],s.perf,v=>`NP.perfSet('${v}')`)}</div>`,{cls:'np-sheet',footer:NX.btn('تطبيق',{kind:'filled',full:true,onclick:"NX.closeDialog('npFilters')"})});
};
NP.perfSet=v=>{S().perf=v;rerender();NP.filters()};
NP.actions=()=>{
  NX.dialog('npActions','إدارة الخطط',`<div class="np-actions">${NX.btn('خطة جديدة',{kind:'filled',icon:'Add',full:true,onclick:"NX.closeDialog('npActions');NP.create()"})}${NX.btn('إدارة وتعديل الخطط',{kind:'tonal',icon:'Inventory2',full:true,onclick:"NX.closeDialog('npActions');NP.manager()"})}${NX.btn('إدارة جماعية للحفظ والسرد',{kind:'tonal',icon:'Groups',full:true,onclick:"NX.closeDialog('npActions');NP.bulk()"})}${NX.btn('تخصيص مراحل طالب/خطة',{kind:'outlined',icon:'Timeline',full:true,onclick:"NX.closeDialog('npActions');NP.phaseChooser()"})}</div>`,{cls:'np-sheet'});
};
NP.manager=()=>{
  const s=S(),items=[['all','الكل'],['active','فعالة'],['paused','موقفة'],['completed','مكتملة'],['archived','الأرشيف']];
  const plans=(state.smartPlans||[]).filter(p=>s.mgr==='all'||p.status===s.mgr).sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
  NX.dialog('npManager','إدارة الخطط',`<p class="np-sub">إنشاء وتعديل وإيقاف وأرشفة واستعادة الخطط</p><div class="np-mgr-bar">${NX.chips(items.map(([v,l])=>({label:l,selected:s.mgr===v,check:false,onclick:`NP.mgrStatus('${v}')`})),{wrap:true})}${NX.iconBtn('Add',{title:'خطة جديدة',cls:'np-addfab',onclick:"NX.closeDialog('npManager');NP.create()"})}</div>${plans.length?`<div class="np-list">${plans.map(mgrItem).join('')}</div>`:NX.empty('لا توجد خطط في هذه الحالة',{icon:'Inventory2'})}`,{cls:'np-wide'});
};
NP.mgrStatus=v=>{S().mgr=v;NP.manager()};
const planById=id=>(state.smartPlans||[]).find(x=>x.id===id);
NP.create=sid=>{NX.closeDialog('npManager');openPlan(sid||'')};
NP.edit=(pid,sid)=>{NX.closeDialog('npManager');NX.closeDialog('npDetails');openPlan(sid||planById(pid)?.student_id||'',pid)};
function setStatus(id,status,msg){const plan=planById(id);if(!plan)return;saveSmartPlanLocal({...plan,status,updated_at:new Date().toISOString()});toast(msg);rerender().then(()=>{if(el('npManager')?.open)NP.manager()})}
NP.act=(k,id)=>{
  const plan=planById(id);if(!plan)return;
  if(k==='phases'){NX.closeDialog('npManager');return NP.phases(id)}
  if(k==='edit')return NP.edit(id,plan.student_id);
  if(k==='override'){NX.closeDialog('npManager');return openSmartPlanOverride(id)}
  if(k==='pause')return setStatus(id,'paused','تم إيقاف الخطة مؤقتاً');
  if(k==='activate')return setStatus(id,'active',plan.status==='archived'?'تمت استعادة الخطة وستتزامن تلقائياً':'تم تفعيل الخطة');
  if(k==='archive')return NX.confirm('أرشفة الخطة',`أرشفة خطة «${h(plan.title||'')}»؟ لن تُحذف سجلات التسميع أو أحداث الخطة.`,'أرشفة',()=>setStatus(id,'archived','تمت أرشفة الخطة'),{danger:true});
  if(k==='delete')return NX.confirm('حذف نهائي',`حذف خطة «${h(plan.title||'')}» نهائياً من قاعدة البيانات؟ لن تُحذف تسميعات الطالب أو الجلسات التاريخية، ولا يمكن استرجاع الخطة.`,'حذف نهائي',()=>{withConfirm(()=>deleteArchivedSmartPlan(id));setTimeout(()=>{if(el('npManager')?.open)NP.manager()},120)},{danger:true});
};
NP.details=key=>{const r=rowByKey(key);if(!r)return toast('تعذر العثور على الخطة');NX.dialog('npDetails','تفاصيل الخطة الذكية',`<p class="np-sub">${h(String(r.plan.start_date).slice(0,10))} ← ${h(String(r.plan.end_date).slice(0,10))}</p>${detailHtml(r,false)}`,{cls:'np-wide',footer:NX.btn('إغلاق التفاصيل',{kind:'filled',icon:'Done',full:true,onclick:"NX.closeDialog('npDetails')"})})};
NP.history=async sid=>{
  const st=state.students.find(x=>String(x.id)===String(sid));
  NX.dialog('npHistory',`أرشيف خطط ${h(st?.full_name||'')}`,`<p class="np-sub">كل شهر محفوظ كما انتهى، ولا يتغير عند بدء الخطة التالية.</p><div id="npHistBody">${NX.skeleton(3)}</div>`,{cls:'np-wide'});
  const box=()=>el('npHistBody');let rows=[],err='';
  try{const r=await db.rpc('student_plan_month_history',{p_student_id:sid});if(r.error)throw r.error;rows=Array.isArray(r.data)?r.data:[]}catch(e){err=e?.message||'تعذر تحميل أرشيف الخطط'}
  if(!box())return;
  if(err){box().innerHTML=NX.notice(h(err),'error');return}
  if(!rows.length){box().innerHTML=NX.empty('لا يوجد شهر مؤرشف بعد؛ سيظهر الأرشيف بعد إغلاق أول خطة شهرية.',{icon:'History'});return}
  box().innerHTML=`<div class="np-list">${rows.map(row=>{
    const month=String(row.period_month||'').slice(0,7).replace('-','/'),t=Number(row.target_pages)||0,d=Number(row.done_pages)||0,st2=Number(row.sard_target_pages)||0,sd=Number(row.sard_done_pages)||0,pct=t>.001?Math.max(0,Math.min(100,d*100/t)):0;
    const complete=d+.001>=t&&(st2<=.001||sd+.001>=st2);
    return `<div class="nx-card np-hist"><div class="np-mi-h"><div class="np-grow"><b>${h(month||'شهر سابق')}</b><small>${h(row.title||(row.plan_type==='tathbit'?'خطة التثبيت':'الخطة الذكية'))}</small></div>${NX.pill(complete?'مكتملة':'منتهية',d+.001>=t?'success':'warning')}</div>
      ${t>.001?`${NX.progress(pct)}<p>${row.plan_type==='tathbit'?'التثبيت':'الحفظ'}: ${plain(d)} / ${plain(t)} ص · ${plain(pct)}٪</p>`:''}${st2>.001||sd>.001?`<p>السرد: ${plain(sd)} / ${plain(st2)} ص</p>`:''}
      <div class="np-tiles">${tile('الحضور',String(row.present??0))}${tile('الغياب',String(row.absent??0))}${tile('الجودة',row.quality!=null?plain(row.quality)+'%':'—')}</div></div>`}).join('')}</div>`;
};
NP.phases=pid=>{
  const open=()=>{const w=el('npPhasesWrap');if(w){w.classList.add('flash');w.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});setTimeout(()=>w.classList.remove('flash'),1600)}else toast('مراحل الخطط غير متاحة في هذا النطاق')};
  if(window.RC27Phases?.load)Promise.resolve(window.RC27Phases.load(false)).then(open,open);else open();
};
NP.phaseChooser=()=>{
  const plans=(state.smartPlans||[]).filter(p=>p.status!=='archived').sort((a,b)=>(b.status==='active')-(a.status==='active'));
  if(!plans.length)return toast('لا توجد خطة يمكن إدارة مراحلها');
  if(plans.length===1)return NP.phases(plans[0].id);
  NX.dialog('npChooser','اختر الخطة لإدارة المراحل',`<p class="np-sub">من هنا تعدّل مرحلة الحفظ، تضيف السرد، وتنهي الحفظ أو تنقل الطلاب للسرد.</p><div class="np-list">${plans.map(p=>NX.btn(`${h(p.title||TYPE_AR[p.plan_type]||'')}<small class="np-chs">${STATUS_AR[p.status]||p.status} · ${h(String(p.start_date).slice(0,10))} ← ${h(String(p.end_date).slice(0,10))}</small>`,{kind:'outlined',icon:'Timeline',full:true,cls:'np-choice-b',onclick:`NX.closeDialog('npChooser');NP.phases('${h(p.id)}')`})).join('')}</div>`,{cls:'np-sheet'});
};
NP.bulk=()=>{if(typeof rc27BulkCycle==='function')rc27BulkCycle();else toast('الإدارة الجماعية غير متاحة')};
NP.rebase=()=>{if(typeof rc27RebaseOpen==='function')rc27RebaseOpen();else toast('ضبط النطاق غير متاح')};
NP.roll=()=>{
  const rows=rowsFor(activeStudents().filter(st=>state.smartPlanHalaqa==='all'||st.halaqa_id===state.smartPlanHalaqa)),seen=new Set(),prev=[];
  for(const r of rows){if(r.student.track_code==='tathbit'||seen.has(r.student.id))continue;seen.add(r.student.id);prev.push(r)}
  const total=new Set(rows.map(r=>r.student.id)).size,pv=prev.slice(0,8);
  NX.dialog('npRoll','بدء دورة شهر جديدة',`<p class="np-p">سيغلق النظام الشهر السابق ويحفظه في أرشيف كل طالب، ثم ينشئ أو يصلح خطة الشهر الحالي لكل طالب بشكل فردي.</p>${NX.notice('الحفظ: 1–22 · هدف كل طالب = هدفه الشخصي السابق. السرد: 23–نهاية الشهر · 25 صفحة للجميع.','info')}${pv.length?`<b class="np-lbl">معاينة الأهداف</b><div class="np-prevlist">${pv.map(r=>`<div><span>${h(r.student.full_name)}</span><b>حفظ ${plain(r.plan.target_pages)} ص · سرد 25 ص</b></div>`).join('')}${total>pv.length?'<small>… وباقي الطلاب حسب أهدافهم الشخصية</small>':''}</div>`:''}<p class="np-small">بعد التنفيذ سيتم فحص كل طالب؛ لن تعتبر العملية ناجحة لمجرد وجود خطة، بل يجب وجود مرحلتي الحفظ والسرد بالتواريخ الصحيحة. طلاب التثبيت يبقون على محرك التثبيت الشهري المستقل.</p>`,{cls:'np-wide',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('npRoll')"})}${NX.btn('تأكيد وإنشاء الشهر',{kind:'filled',onclick:"NX.closeDialog('npRoll');NP.rollGo()"})}`});
};
NP.rollGo=()=>{if(typeof rc27StartMonth==='function')withConfirm(()=>rc27StartMonth());else toast('بدء الشهر غير متاح')};
NP.recite=async(btn,sid,pid,kind)=>{
  const st=state.students.find(x=>String(x.id)===String(sid));if(!st)return;
  const label=btn?.querySelector('span');const old=label?.textContent;if(btn){btn.disabled=true;if(label)label.textContent='جاري التجهيز…'}
  try{
    let se=state.sessions.find(x=>x.status==='open'&&x.halaqa_id===st.halaqa_id&&x.session_date===today())||(typeof latestSession==='function'?latestSession():null);
    if(!se&&typeof ensureTodaySession==='function'){await ensureTodaySession();se=typeof latestSession==='function'?latestSession():null}
    if(!se){toast('لا توجد جلسة مفتوحة اليوم. أنشئ جلسة أولًا.');return}
    NX.closeDialog('npDetails');
    state.page='sessions';state.sessionView=se.id;await render();
    if(typeof oneTapSmartPlanPrefill==='function')await oneTapSmartPlanPrefill(sid,se.id,pid);else if(typeof quickOpenRecitation==='function')await quickOpenRecitation(sid,se.id,kind);
  }catch(e){toast(e?.message||'تعذر تجهيز جلسة التسميع')}
  finally{if(btn){btn.disabled=false;if(label&&old)label.textContent=old}}
};

/* ---------------------------------------------------------------- editor (SmartPlanEditorDialog) */
const seg=(sel,items)=>`<div class="np-seg" data-bind="${sel}">${items.map(([v,l])=>`<button type="button" class="nx-chip" data-v="${h(v)}" aria-pressed="false" onclick="NP.seg('${sel}','${h(v)}')"><span>${l}</span></button>`).join('')}</div>`;
const choiceBtn=(sel,label)=>`<button type="button" class="np-choice" data-sel="${sel}" data-label="${label}" onclick="NP.choice('${sel}','${label}')">${ic('Search',22)}<span class="np-choice-t"><small>${label}</small><b>اختر ${label}</b></span>${ic('ArrowDropDown',24)}</button>`;
const dayChk=DAYS.map((d,i)=>`<label class="np-chk"><input type="checkbox" name="spWeekday" value="${i}" ${i<5?'checked':''}><span>${d}</span></label>`).join('');
const opt=(arr)=>arr.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
function editorHtml(){
  return `<div class="nx-dlg-grab"></div>
  <header class="nx-dlg-head"><h3 id="spDialogTitle">خطة ذكية جديدة</h3><button type="button" class="nx-iconbtn" aria-label="إغلاق" onclick="smartPlanDlg.close()">${ic('Close',22)}</button></header>
  <div class="nx-dlg-content np-ed">
   <input type="hidden" id="spId"><input type="hidden" id="spParentId">
   <div id="npLockNote" class="hidden">${NX.notice('هذه الشاشة تعدّل بيانات الخطة العامة مثل الاسم والسياسات. أهداف الحفظ/السرد والتواريخ والأيام والنطاقات تُعدّل من «مراحل الخطة» بشكل مستقل.','info')}</div>
   <section class="np-es" data-lock>
     <h4>نطاق التطبيق</h4>
     <div id="npOverrideNote" class="hidden">${NX.notice('هذه خطة ابن مرتبطة بالخطة الأصلية. يرث الطالب الإعدادات ويمكن تخصيص هدفه أو نطاقه دون تغيير الخطة الجماعية.','info')}</div>
     <div id="npScopeSeg">${seg('spScope',[['student','طالب'],['category','فئة'],['halaqa','الحلقة']])}</div>
     <div class="np-hid"><select id="spScope" onchange="updateSmartPlanScope()"><option value="student">طالب محدد</option><option value="category">فئة محددة</option><option value="halaqa">الحلقة كلها</option></select><select id="spHalaqa" required onchange="updateSmartPlanStudents();updateSmartPlanCategories()"></select><input id="spStudentSearch" type="search" value=""><select id="spStudent" onchange="refreshSmartPlanSuggestedStart()"></select></div>
     ${choiceBtn('spHalaqa','الحلقة')}
     <div id="spStudentField">${choiceBtn('spStudent','الطالب')}<small id="spStudentSearchHint" class="np-hint"></small></div>
     <label class="nx-field hidden" id="spCategoryField"><span>الفئة</span><select id="spCategory" onchange="previewSmartPlanEstimate()"></select></label>
   </section>
   <section class="np-es" data-lock>
     <h4>نوع الخطة</h4>
     ${seg('spType',[['hifz','حفظ'],['review','مراجعة'],['tathbit','تثبيت'],['sard','سرد (قديم)']])}
     <div class="np-hid"><select id="spType" onchange="updateSmartPlanTypeFields()"><option value="hifz">حفظ جديد</option><option value="review">مراجعة</option><option value="sard">سرد</option><option value="tathbit">تثبيت</option></select></div>
     <small id="npTypeHint" class="np-hint"></small>
   </section>
   <label class="nx-field"><span>عنوان الخطة</span><input id="spTitle" maxlength="160" placeholder="مثال: خطة حفظ شهر أكتوبر"></label>

   <section id="spHifzFields" class="np-es" data-lock>
     <h4>مسار الحفظ</h4>
     <div class="np-anchor"><b>الاستمرار من آخر حفظ</b>
       ${seg('spHifzStartMode',[['auto','تلقائياً من آخر موضع حفظ مقبول'],['manual','تحديد البداية يدوياً']])}
       <div class="np-hid"><select id="spHifzStartMode" onchange="updateSmartPlanHifzStartMode()"><option value="auto">تلقائياً</option><option value="manual">يدوياً</option></select></div>
       <div id="spHifzStartHint" class="np-hint"></div></div>
     <label class="nx-field"><span>المطلوب خلال الخطة بالصفحات</span><input id="spHifzTargetPages" type="number" min="1" max="604" step="any" inputmode="decimal" value="20" oninput="previewSmartPlanEstimate()" onblur="normalizeSmartPlanRequestedPages(this.value,{writeBack:true});previewSmartPlanEstimate()"><small>يمكنك كتابة 20 أو 20.5؛ يُقرّب الهدف للأعلى، وإذا وقع الحد في منتصف آية تُكمل الآية كاملة.</small></label>
     <div class="np-two">
       <label class="nx-field" id="spHifzStartSurahField"><span>سورة البداية</span><select id="spHifzStartSurah" onchange="updateSmartPlanHifzAyahLimit()"></select></label>
       <label class="nx-field" id="spHifzStartAyahField"><span>آية البداية</span><input id="spHifzStartAyah" type="text" inputmode="numeric" pattern="[0-9]*" value="1" oninput="previewSmartPlanEstimate()"></label>
     </div>
     <p class="np-hint">داخل السورة تصعد الآيات من الأصغر إلى الأكبر، ثم ننتقل إلى السورة السابقة رقمًا. في الحفظ: «جيد» فأعلى مقبول، و«إعادة» فقط توقف التقدم.</p>
   </section>

   <section id="spRouteFields" class="np-es hidden" data-lock>
     <h4>اتجاه الحفظ / التقدم</h4>
     ${seg('spRouteDirection',[['reverse_surahs_forward_ayahs','من الناس إلى البقرة'],['forward_surahs_forward_ayahs','من البقرة إلى الناس']])}
     <div class="np-hid"><select id="spRouteDirection" onchange="this.dataset.userSet='1';updateSmartPlanRouteDefaults();previewSmartPlanEstimate()"><option value="forward_surahs_forward_ayahs">نزولاً</option><option value="reverse_surahs_forward_ayahs">صعوداً</option></select></div>
     <label class="nx-field"><span>المطلوب خلال الخطة بالصفحات</span><input id="spRouteTargetPages" type="number" inputmode="decimal" min="0.1" max="604" step="0.1" value="20" oninput="previewSmartPlanEstimate()"></label>
     <div class="np-two">
       <label class="nx-field"><span>سورة البداية</span><select id="spRouteStartSurah" onchange="updateSmartPlanRouteAyahLimit();previewSmartPlanEstimate()"></select></label>
       <label class="nx-field"><span>آية البداية</span><input id="spRouteStartAyah" type="text" inputmode="numeric" pattern="[0-9]*" value="1" oninput="normalizeQuranNumberInput(this);previewSmartPlanEstimate()"></label>
     </div>
     <div id="spRouteHint" class="np-hint"></div>
     <div id="spSardWeekFields" class="np-two hidden">
       <label class="nx-field"><span>يوم السرد الأسبوعي</span><select id="spSardWeekday">${DAYS.map((d,i)=>`<option value="${i}" ${i===5?'selected':''}>${d}</option>`).join('')}</select></label>
       <label class="nx-field"><span>مقدار السرد اليومي في الأسبوع</span><input id="spSardWeekDaily" type="number" min="0.1" max="30" step="0.1" value="7"></label>
       <label class="nx-field"><span>أسبوع سرد مكثف من</span><input id="spSardWeekFrom" type="date"></label>
       <label class="nx-field"><span>إلى</span><input id="spSardWeekTo" type="date"></label>
     </div>
     <div id="spSardWeekNote" class="np-hint">في أسبوع السرد المكثف يتوقف الحفظ الجديد مؤقتاً، ثم يستأنف تلقائياً بعد انتهاء الأسبوع.</div>
   </section>

   <section id="spClassicRangeFields" class="np-es hidden" data-lock>
     <h4>نطاق القرآن</h4>
     ${seg('spGoalUnit',[['pages','صفحات'],['juz','أجزاء'],['rub','أرباع'],['surah','سور'],['ayahs','آيات']])}
     <div class="np-hid"><select id="spGoalUnit" onchange="updateSmartPlanRangeFields()"><option value="pages">صفحات</option><option value="juz">أجزاء</option><option value="rub">أرباع</option><option value="surah">سور</option><option value="ayahs">آيات</option></select></div>
     <div id="spSimpleRange" class="np-two">
       <label class="nx-field"><span id="spRangeStartLabel">من صفحة</span><select id="spRangeStart" onchange="previewSmartPlanEstimate()"></select></label>
       <label class="nx-field"><span id="spRangeEndLabel">إلى صفحة</span><select id="spRangeEnd" onchange="previewSmartPlanEstimate()"></select></label>
     </div>
     <div id="spAyahRange" class="np-two hidden">
       <label class="nx-field"><span>من سورة</span><select id="spStartSurah" onchange="updateSmartPlanAyahLimits('start')"></select></label>
       <label class="nx-field"><span>آية</span><input id="spStartAyah" type="number" min="1" value="1" onchange="previewSmartPlanEstimate()"></label>
       <label class="nx-field"><span>إلى سورة</span><select id="spEndSurah" onchange="updateSmartPlanAyahLimits('end')"></select></label>
       <label class="nx-field"><span>آية</span><input id="spEndAyah" type="number" min="1" value="7" onchange="previewSmartPlanEstimate()"></label>
     </div>
   </section>

   <section id="spReviewFields" class="np-es hidden">
     <h4>مسار المراجعة</h4>
     ${seg('spReviewTier',[['near','قريبة'],['far','بعيدة'],['both','قريبة + بعيدة']])}
     <div class="np-hid"><select id="spReviewTier"><option value="near">قريبة</option><option value="far">بعيدة</option><option value="both">قريبة + بعيدة</option></select></div>
     <div class="np-two"><label class="nx-field"><span>قريبة يومياً</span><input id="spNearPages" type="number" min="0" max="30" step="1" value="7"></label><label class="nx-field"><span>دورة بعيدة</span><input id="spFarPages" type="number" min="0" max="604" step="1" value="20"></label></div>
   </section>

   <section class="np-es" data-lock>
     <h4>المدة</h4>
     <div class="np-two">
       <label class="nx-field"><span>تاريخ البدء</span><input id="spStartDate" type="date" required onchange="NP.startChanged()"></label>
       <label class="nx-field"><span>تاريخ الانتهاء</span><input id="spEndDate" type="date" required onchange="previewSmartPlanEstimate()"></label>
     </div>
     <h4 class="np-h4s">أيام الدوام</h4><div class="np-days">${dayChk}</div>
     <h4 class="np-h4s">يوم الاستدراك</h4>
     ${seg('spCatchUp',[['','بدون'],...DAYS.map((d,i)=>[String(i),d])])}
     <div class="np-hid"><select id="spCatchUp" onchange="previewSmartPlanEstimate()"><option value="">بدون</option>${DAYS.map((d,i)=>`<option value="${i}">${d}</option>`).join('')}</select></div>
     <small class="np-hint">لا يُضاف فيه حفظ جديد؛ يُستخدم لتعويض المتأخرات والمراجعة.</small>
   </section>

   <button type="button" class="nx-btn nx-text np-advbtn" id="npAdvBtn" onclick="NP.adv()"><span>قواعد الخطة الذكية</span>${ic('ExpandMore',20)}</button>
   <section id="npAdv" class="np-es np-adv hidden">
     <h4>أقل تقييم للاجتياز</h4>
     ${seg('spMinEvaluation',[['excellent','ممتاز'],['very_good','جيد جداً'],['good','جيد']])}
     <div class="np-hid"><select id="spMinEvaluation"><option value="excellent">ممتاز</option><option value="very_good">جيد جداً</option><option value="good" selected>جيد</option></select></div>
     <h4 class="np-h4s">أقصى زيادة يومية</h4>
     ${seg('spDailyCap',[['1.25','125%'],['1.5','150%'],['1.75','175%'],['2','200%']])}
     <div class="np-hid"><select id="spDailyCap"><option value="1.25">125%</option><option value="1.5" selected>150%</option><option value="1.75">175%</option><option value="2">200%</option></select></div>
     <label class="nx-field"><span>تنبيه التأخر بعد أيام دوام</span><input id="spDelayDays" type="number" min="1" max="30" value="3"></label>
     <label class="nx-switchrow"><span>لا يتقدم قبل اجتياز التقييم</span><input type="checkbox" class="nx-switch" id="spQualityGate" checked></label>
     <label class="nx-switchrow"><span>تمديد نهاية الخطة تلقائياً</span><input type="checkbox" class="nx-switch" id="spAutoExtend" checked></label>
     <label class="nx-switchrow"><span>تنبيه التحضير المنزلي لولي الأمر</span><input type="checkbox" class="nx-switch" id="spHomePush" checked></label>
     <div class="np-hid"><select id="spMilestone"><option value="none" selected>none</option><option value="hizb">hizb</option><option value="juz">juz</option></select><input type="checkbox" id="spMilestoneApproval"></div>
   </section>

   <div id="spEstimate" class="np-estimate">اختر نطاق الخطة لعرض البداية والنهاية والورد اليومي.</div>
   <label class="nx-field"><span>ملاحظة للمحفّظ وولي الأمر</span><textarea id="spNote" rows="2"></textarea></label>
  </div>
  <footer class="nx-dlg-foot"><button type="button" class="nx-btn nx-text" onclick="smartPlanDlg.close()"><span>إلغاء</span></button><button id="spSaveButton" type="submit" class="nx-btn nx-filled"><span>حفظ الخطة</span></button></footer>`;
}
let editorReady=false;
function initEditor(){
  if(editorReady)return true;
  const dlg=el('smartPlanDlg'),form=el('smartPlanForm');if(!dlg||!form)return false;
  dlg.className='nx-dlg np-editor';form.className='nx-dlg-body np-form';form.innerHTML=editorHtml();
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
  form.addEventListener('change',()=>setTimeout(syncEditor,0));
  editorReady=true;return true;
}
function syncEditor(){
  const form=el('smartPlanForm');if(!form||!editorReady)return;
  const locked=form.classList.contains('np-locked');
  const scope=el('spScope').value,st=state.students.find(x=>String(x.id)===String(el('spStudent').value)),isT=st?.track_code==='tathbit';
  const typeSel=el('spType');
  if(!locked&&scope==='student'&&st){
    if(isT&&typeSel.value!=='tathbit'){typeSel.value='tathbit';if(!el('spId').value&&!el('spRouteDirection').dataset.userSet)el('spRouteDirection').value='forward_surahs_forward_ayahs';updateSmartPlanTypeFields()}
    else if(!isT&&typeSel.value==='tathbit'){typeSel.value='hifz';updateSmartPlanTypeFields()}
  }
  const cur=typeSel.value,legacySard=cur==='sard';
  form.querySelectorAll('.np-seg[data-bind="spType"] [data-v]').forEach(b=>{const v=b.dataset.v;let show;if(scope==='student')show=isT?v==='tathbit':(v==='hifz'||v==='review'||(v==='sard'&&legacySard));else show=v!=='sard'||legacySard;b.hidden=!show});
  form.querySelectorAll('.np-seg').forEach(g=>{const s=el(g.dataset.bind);if(!s)return;g.classList.toggle('dis',!!s.disabled);g.querySelectorAll('[data-v]').forEach(b=>{const on=b.dataset.v===String(s.value);b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))})});
  form.querySelectorAll('.np-choice').forEach(b=>{const s=el(b.dataset.sel);const o=s&&s.selectedOptions&&s.selectedOptions[0];b.querySelector('b').textContent=o&&o.value?o.textContent:`اختر ${b.dataset.label}`});
  const hint=el('npTypeHint');if(hint)hint.textContent=scope==='student'?(isT?'طالب التثبيت يملك خطة تثبيت فقط؛ السرد ليس مساراً مستقلاً.':'طالب الحفظ العام يستخدم الحفظ، ويمكن إضافة السرد كنشاط/مرحلة داخل خطة الحفظ.'):'';
  el('npScopeSeg').classList.toggle('hidden',!!el('spParentId').value&&!el('spId').value);
  el('npOverrideNote').classList.toggle('hidden',!(el('spParentId').value&&!el('spId').value));
  const sc=el('spHalaqa');if(sc&&!sc.options.length)return;
}
NP.seg=(sel,v)=>{const s=el(sel);if(!s||s.disabled)return;s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}));syncEditor()};
NP.startChanged=()=>{const a=el('spStartDate'),b=el('spEndDate');if(a.value&&b.value&&b.value<a.value)b.value=a.value;previewSmartPlanEstimate()};
NP.adv=()=>{const s=el('npAdv'),b=el('npAdvBtn'),open=s.classList.toggle('hidden')===false;b.querySelector('span').textContent=open?'إخفاء قواعد الخطة':'قواعد الخطة الذكية';b.querySelector('svg').style.transform=open?'rotate(180deg)':''};
NP.choice=(selId,label)=>{
  const sel=el(selId);if(!sel||el('smartPlanForm').classList.contains('np-locked'))return;
  let opts;
  if(selId==='spStudent'){const hid=el('spHalaqa').value,parent=planById(el('spParentId').value),catOnly=parent&&parent.scope_type==='category'?parent.category_id:null;opts=activeStudents().filter(x=>x.halaqa_id===hid&&(!catOnly||x.category_id===catOnly)).map(x=>[x.id,x.full_name])}
  else opts=[...sel.options].map(o=>[o.value,o.textContent]);
  window.__npOpts=opts;
  const draw=q=>{const f=opts.filter(([,n])=>!q||nrm(n).includes(nrm(q))).slice(0,100);return f.length?f.map(([id,n])=>`<button type="button" class="np-opt ${String(id)===String(sel.value)?'on':''}" onclick="NP.pickOpt('${selId}','${h(id)}')">${ic(String(id)===String(sel.value)?'CheckCircle':'Circle',19)}<span>${h(n)}</span></button>`).join(''):'<p class="nx-muted">لا توجد نتيجة مطابقة</p>'};
  window.__npDraw=draw;
  NX.dialog('npChoice',`اختيار ${label}`,`${NX.search('',`ابحث عن ${label}`,{oninput:"document.getElementById('npOptList').innerHTML=__npDraw(this.value)"})}<div id="npOptList" class="np-optlist">${draw('')}</div>`,{cls:'np-sheet np-choice-dlg',footer:NX.btn('إغلاق',{kind:'text',onclick:"NX.closeDialog('npChoice')"})});
};
NP.pickOpt=(selId,v)=>{const s=el(selId);if(![...s.options].some(o=>o.value===String(v))){const o=document.createElement('option');o.value=v;o.textContent=(window.__npOpts||[]).find(x=>String(x[0])===String(v))?.[1]||v;s.appendChild(o)}s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}));NX.closeDialog('npChoice');syncEditor()};

function phaseManaged(planId){try{const P=window.RC27Phases;return !!(planId&&P&&P.S&&P.S.phases&&P.S.phases.some(p=>p.plan_id===planId&&p.status!=='archived'))}catch(e){return false}}
function applyLock(locked){
  const form=el('smartPlanForm');form.classList.toggle('np-locked',locked);
  form.querySelectorAll('[data-lock]').forEach(n=>{if(locked)n.setAttribute('inert','');else n.removeAttribute('inert')});
  el('npLockNote').classList.toggle('hidden',!locked);
}
if(typeof openPlan==='function'){
  const baseOpen=openPlan;
  window.openPlan=openPlan=async function(studentId='',planId='',parentPlanId=''){
    if(!initEditor())return baseOpen.apply(this,arguments);
    const locked=phaseManaged(planId);applyLock(false);
    const r=await baseOpen.apply(this,arguments);
    if(!canManage())return r;
    /* native editor forces milestone "none" and no approval */
    el('spMilestone').value='none';el('spMilestoneApproval').checked=false;
    applyLock(locked);
    const t=el('spDialogTitle');if(t)t.textContent=parentPlanId&&!planId?'تجاوز خاص بالطالب':!planId?'خطة ذكية جديدة':locked?'تعديل بيانات الخطة':'تعديل الخطة الذكية';
    const adv=el('npAdv');if(adv&&!adv.classList.contains('hidden'))NP.adv();
    syncEditor();
    return r;
  };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initEditor);else initEditor();
})();
