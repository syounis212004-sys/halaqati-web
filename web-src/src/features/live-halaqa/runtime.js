/* Halaqati v2.40.0 — Live Halaqa
   Daily memorization workflow layered over the stable v2.30 engine.
   Keeps V6, Offline-first, Smart Plan, PDF and notification behavior intact. */
(function(){
  'use strict';
  window.__HALAQATI_LIVE_HALAQA__='2.40.0';

  state.liveHalaqa=state.liveHalaqa||{};
  Object.assign(state.liveHalaqa,{
    sessionId:state.liveHalaqa.sessionId||null,
    index:Number(state.liveHalaqa.index||0),
    mistakes:Number(state.liveHalaqa.mistakes||0),
    prompts:Number(state.liveHalaqa.prompts||0),
    attendance:state.liveHalaqa.attendance||'present',
    absenceReason:state.liveHalaqa.absenceReason||'',
    absencePicker:false,
    searchOpen:false,
    finishOpen:false,
    saving:false,
    wakeLockEnabled:localStorage.getItem('halaqati_live_wakelock')==='1',
    wakeLock:null
  });

  const DRAFT_PREFIX='halaqati_v240_live_drafts_';
  const latin=(value='')=>typeof toAsciiDigits==='function'?toAsciiDigits(String(value)):String(value).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

  function liveDraftKey(){return DRAFT_PREFIX+String(state.user?.id||'guest')+'_'+String(state.liveHalaqa.sessionId||'none')}
  function liveReadDrafts(){try{return JSON.parse(localStorage.getItem(liveDraftKey())||'{}')||{}}catch{return {}}}
  function liveWriteDrafts(rows){try{localStorage.setItem(liveDraftKey(),JSON.stringify(rows||{}))}catch(_e){}}
  function livePersistDraft(){
    const st=liveCurrentStudent();if(!st)return;
    const rows=liveReadDrafts();
    rows[st.id]={mistakes:Number(state.liveHalaqa.mistakes||0),prompts:Number(state.liveHalaqa.prompts||0),attendance:state.liveHalaqa.attendance||'present',absenceReason:state.liveHalaqa.absenceReason||'',savedAt:new Date().toISOString()};
    liveWriteDrafts(rows)
  }
  function liveClearDraft(id){let rows=liveReadDrafts();delete rows[id];liveWriteDrafts(rows)}

  function liveOverlay(){
    let el=document.getElementById('liveHalaqaOverlay');
    if(el)return el;
    el=document.createElement('div');el.id='liveHalaqaOverlay';el.className='live-halaqa-overlay hidden';
    document.body.appendChild(el);return el
  }
  function liveClose({persist=true}={}){
    if(persist)livePersistDraft();
    const el=liveOverlay();el.classList.add('hidden');el.innerHTML='';
    state.liveHalaqa.searchOpen=false;state.liveHalaqa.finishOpen=false;state.liveHalaqa.absencePicker=false;
    liveReleaseWakeLock()
  }

  function liveSession(){return (state.sessions||[]).find(x=>String(x.id)===String(state.liveHalaqa.sessionId))||null}
  function liveStudents(){
    const se=liveSession();
    let rows=typeof opsTrackStudents==='function'?opsTrackStudents():(typeof activeStudents==='function'?activeStudents():state.students||[]);
    if(se?.halaqa_id)rows=rows.filter(s=>String(s.halaqa_id)===String(se.halaqa_id));
    if(typeof sortStudentsList==='function')return sortStudentsList(rows.slice(),state.sessionSort||'alpha');
    return rows.slice().sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'ar'))
  }
  function liveCurrentStudent(){let rows=liveStudents();if(!rows.length)return null;state.liveHalaqa.index=Math.max(0,Math.min(rows.length-1,Number(state.liveHalaqa.index||0)));return rows[state.liveHalaqa.index]}
  function liveAttendance(id){return (state.sessionRoster?.attendance||[]).find(x=>String(x.student_id)===String(id))||null}
  function liveRecs(id){return (state.sessionRoster?.recitations||[]).filter(x=>String(x.student_id)===String(id))}
  function liveIsDone(st){let at=liveAttendance(st.id),recs=liveRecs(st.id);return !!(recs.length||['absent','excused'].includes(at?.status))}
  function liveStats(){
    const rows=liveStudents();let done=0,absent=0,recited=0;
    rows.forEach(st=>{let a=liveAttendance(st.id),r=liveRecs(st.id);if(r.length){recited++;done++}else if(['absent','excused'].includes(a?.status)){absent++;done++}});
    return {total:rows.length,done,remaining:Math.max(0,rows.length-done),absent,recited}
  }
  function liveFirstUnresolved(){let rows=liveStudents(),i=rows.findIndex(st=>!liveIsDone(st));return i<0?0:i}

  function liveLoadStudentState(){
    const st=liveCurrentStudent();if(!st)return;
    const draft=liveReadDrafts()[st.id]||{},at=liveAttendance(st.id);
    state.liveHalaqa.mistakes=Math.max(0,Number(draft.mistakes||0));
    state.liveHalaqa.prompts=Math.max(0,Number(draft.prompts||0));
    state.liveHalaqa.attendance=draft.attendance||at?.status||'present';
    if(!['present','absent','excused'].includes(state.liveHalaqa.attendance))state.liveHalaqa.attendance='present';
    state.liveHalaqa.absenceReason=draft.absenceReason||at?.excuse_reason||'';
    state.liveHalaqa.absencePicker=false
  }

  function livePlanBundle(st){
    try{
      if(typeof opsQuickPlanBundle==='function')return opsQuickPlanBundle(st,liveSession()?.session_date||today());
      return opsPlanBundle(st,liveSession()?.session_date||today())
    }catch{return {plan:null,assignment:null,label:'تعذر حساب المقرر',dueDate:null,dueToday:false}}
  }
  function liveAssignmentMarkup(bundle){
    if(!bundle?.assignment)return `<div class="live-duty empty-duty"><small>الخطة الذكية</small><strong>لا يوجد مقرر ذكي قابل للتسجيل حاليًا</strong></div>`;
    const title=bundle.dueToday===false&&bundle.dueDate?`المقرر القادم · ${bundle.dueDate}`:'مقرر اليوم';
    const text=typeof opsAssignmentText==='function'?opsAssignmentText(bundle.assignment):(bundle.label||'المقرر الذكي');
    return `<div class="live-duty"><small>${esc(title)}</small><strong>${esc(latin(text))}</strong></div>`
  }

  function liveBuildRec(st,bundle){
    const a=bundle?.assignment,p=bundle?.plan,se=liveSession();if(!a||!p||!se)return null;
    const segs=Array.isArray(a.ayahSegments)?a.ayahSegments.filter(Boolean):[],first=segs[0],last=segs.at(-1);
    const sp=Number(a.startPage||a.start_page||p.range_start_page)||null,ep=Number(a.endPage||a.end_page||p.range_end_page)||sp;
    const pages=Math.max(.01,Number(a.pages||a.dailyTarget||a.targetPages||(sp&&ep?Math.abs(ep-sp)+1:0))||0);
    if(!(pages>0))return null;
    const type=p.plan_type==='hifz'?'new_hifz':p.plan_type==='tathbit'?'review_far':p.plan_type==='sard'?'sard':'new_hifz';
    return decorateRecForOffline({
      session_id:se.id,student_id:st.id,activity_type:type,input_method:first?'ayahs':'pages',
      start_surah:first?.surah||null,start_ayah:first?.startAyah||null,end_surah:last?.surah||null,end_ayah:last?.endAyah||null,
      start_page:sp,end_page:ep,pages_count:pages,ayahs_count:0,surahs_count:0,
      mistakes:Number(state.liveHalaqa.mistakes||0),prompts:Number(state.liveHalaqa.prompts||0),teacher_note:null,selected_surahs:[],
      selection_data:{mode:first?'ayahs':'pages',smart_plan_id:p.id,smart_plan_type:p.plan_type,smart_plan_date:bundle.dueDate||se.session_date,smart_plan_actual_session_date:se.session_date,live_halaqa:true},
      created_by:state.user.id
    })
  }

  function liveProgressText(){let s=liveStats();return `${s.done} / ${s.total}`}
  function liveSearchResults(q){
    const box=document.getElementById('liveSearchResults');if(!box)return;
    let n=typeof normalizeNameJs==='function'?normalizeNameJs(q):String(q||'').trim().toLowerCase();
    if(!n){box.innerHTML='';return}
    const rows=liveStudents().map((st,i)=>({st,i})).filter(x=>(typeof normalizeNameJs==='function'?normalizeNameJs(x.st.full_name):String(x.st.full_name).toLowerCase()).includes(n)).slice(0,12);
    box.innerHTML=rows.length?rows.map(x=>`<button type="button" onclick="liveHalaqaJump(${x.i})"><span>${esc(x.st.full_name)}</span><small>${liveIsDone(x.st)?'تم التعامل معه':'متبقي'}</small></button>`).join(''):'<div class="live-search-empty">لا توجد نتائج</div>'
  }

  function liveFinishSheet(){
    if(!state.liveHalaqa.finishOpen)return '';
    const rows=liveStudents(),pending=rows.filter(st=>!liveIsDone(st)),s=liveStats();
    return `<div class="live-sheet-backdrop" onclick="liveHalaqaCancelFinish()"><section class="live-sheet" onclick="event.stopPropagation()"><div class="live-sheet-handle"></div><h3>ملخص جلسة اليوم</h3><div class="live-finish-kpis"><span><b>${s.recited}</b>تم التسميع</span><span><b>${s.absent}</b>غائب</span><span><b>${pending.length}</b>بدون إجراء</span></div>${pending.length?`<div class="live-pending-list"><b>طلاب ما زالوا بحاجة لإجراء</b>${pending.slice(0,6).map(st=>`<span>${esc(st.full_name)}</span>`).join('')}${pending.length>6?`<small>+ ${pending.length-6} آخرين</small>`:''}</div><button class="btn btn-primary" type="button" onclick="liveHalaqaGoFirstPending()">العودة لأول طالب متبقٍ</button><button class="btn btn-ghost" type="button" onclick="liveHalaqaCloseAnyway()">إنهاء رغم وجود طلاب متبقين</button>`:`<div class="live-all-done">✓ تم التعامل مع جميع الطلاب</div><button class="btn btn-primary" type="button" onclick="liveHalaqaCloseAnyway()">إنهاء ورفع الجلسة</button>`}<button class="btn btn-ghost" type="button" onclick="liveHalaqaCancelFinish()">إلغاء</button></section></div>`
  }

  function liveAbsenceSheet(){
    if(!state.liveHalaqa.absencePicker)return '';
    return `<div class="live-sheet-backdrop" onclick="liveHalaqaCancelAbsence()"><section class="live-sheet live-absence-sheet" onclick="event.stopPropagation()"><div class="live-sheet-handle"></div><h3>نوع الغياب</h3><button type="button" onclick="liveHalaqaChooseAbsence('excused')">غائب بعذر</button><button type="button" class="danger" onclick="liveHalaqaChooseAbsence('absent')">غائب بدون عذر</button><button type="button" class="ghost" onclick="liveHalaqaCancelAbsence()">إلغاء</button></section></div>`
  }

  function liveRender(){
    const el=liveOverlay(),rows=liveStudents(),st=liveCurrentStudent(),stats=liveStats();
    if(!rows.length||!st){el.innerHTML='<div class="live-empty"><b>لا يوجد طلاب في هذا المسار</b><button class="btn" type="button" onclick="closeLiveHalaqa()">إغلاق</button></div>';el.classList.remove('hidden');return}
    const bundle=livePlanBundle(st),done=liveIsDone(st),at=liveAttendance(st.id),present=state.liveHalaqa.attendance==='present';
    const absentLabel=state.liveHalaqa.attendance==='excused'?'غائب · بعذر':state.liveHalaqa.attendance==='absent'?'غائب · بدون عذر':'غائب';
    el.innerHTML=`<main class="live-shell" dir="rtl">
      <header class="live-topbar"><button class="live-icon-btn" type="button" aria-label="إغلاق" onclick="closeLiveHalaqa()">✕</button><div class="live-title"><b>جلسة الحلقة</b><span>${esc(typeof opsTrackLabel==='function'?opsTrackLabel():'الحفظ العام')} · ${esc(liveSession()?.session_date||today())}</span></div><button class="live-icon-btn" type="button" aria-label="بحث" onclick="liveHalaqaToggleSearch()">⌕</button></header>
      <div class="live-progress"><div><b>${liveProgressText()}</b><span>المنجز</span></div><div class="live-progress-track"><i style="width:${stats.total?Math.round(stats.done/stats.total*100):0}%"></i></div><small>متبقي ${stats.remaining}</small></div>
      ${state.liveHalaqa.searchOpen?`<div class="live-search"><input id="liveSearchInput" class="input" placeholder="ابحث عن طالب…" oninput="liveHalaqaSearch(this.value)"><div id="liveSearchResults"></div></div>`:''}
      <section class="live-student-card ${done?'is-done':''}"><div class="live-student-status">${done?'✓ تم التعامل معه':(at?.status==='present'?'حاضر · لم يكتمل التسميع':'جاهز')}</div><h1>${esc(st.full_name)}</h1>${liveAssignmentMarkup(bundle)}</section>
      <div class="live-attendance"><button type="button" class="${present?'active':''}" onclick="liveHalaqaSetAttendance('present')">✓ حاضر</button><button type="button" class="${!present?'active danger':''}" onclick="liveHalaqaSetAttendance('absent')">${esc(absentLabel)}</button></div>
      ${present?`<div class="live-counters"><div><span>الأخطاء</span><button type="button" aria-label="إنقاص الأخطاء" onclick="liveHalaqaAdjust('mistakes',-1)">−</button><b>${state.liveHalaqa.mistakes}</b><button type="button" aria-label="زيادة الأخطاء" onclick="liveHalaqaAdjust('mistakes',1)">+</button></div><div><span>النقرات</span><button type="button" aria-label="إنقاص النقرات" onclick="liveHalaqaAdjust('prompts',-1)">−</button><b>${state.liveHalaqa.prompts}</b><button type="button" aria-label="زيادة النقرات" onclick="liveHalaqaAdjust('prompts',1)">+</button></div></div>`:`<div class="live-absence-note">${state.liveHalaqa.attendance==='excused'?'سيُسجل غياب بعذر':'سيُسجل غياب بدون عذر'}.</div>`}
      <div class="live-primary-actions"><button type="button" class="live-nav-btn" onclick="liveHalaqaMove(-1)" ${state.liveHalaqa.index===0?'disabled':''}>السابق</button><button type="button" class="btn btn-primary live-save" onclick="liveHalaqaSaveCurrent()" ${state.liveHalaqa.saving?'disabled':''}>${state.liveHalaqa.saving?'جارٍ الحفظ…':done?'التالي':'✓ حفظ والتالي'}</button><button type="button" class="live-nav-btn" onclick="liveHalaqaMove(1)" ${state.liveHalaqa.index===rows.length-1?'disabled':''}>التالي</button></div>
      <div class="live-secondary-actions"><button type="button" onclick="liveHalaqaOpenFull('${st.id}')">النموذج الكامل</button><button type="button" class="${state.liveHalaqa.wakeLockEnabled?'active':''}" onclick="liveHalaqaToggleWakeLock()">${state.liveHalaqa.wakeLockEnabled?'الشاشة مستيقظة':'إبقاء الشاشة مستيقظة'}</button><button type="button" class="finish" onclick="liveHalaqaFinish()">إنهاء الجلسة</button></div>
      <div class="live-swipe-hint">اسحب يمينًا أو يسارًا للتنقل بين الطلاب</div>
      ${liveAbsenceSheet()}${liveFinishSheet()}
    </main>`;
    el.classList.remove('hidden');
    if(state.liveHalaqa.searchOpen)setTimeout(()=>document.getElementById('liveSearchInput')?.focus(),0)
  }

  async function liveAcquireWakeLock(){
    if(!state.liveHalaqa.wakeLockEnabled||!navigator.wakeLock?.request)return;
    try{state.liveHalaqa.wakeLock=await navigator.wakeLock.request('screen');state.liveHalaqa.wakeLock.addEventListener?.('release',()=>{state.liveHalaqa.wakeLock=null})}catch(e){console.warn('Wake lock unavailable',e)}
  }
  function liveReleaseWakeLock(){try{state.liveHalaqa.wakeLock?.release?.()}catch(_e){}state.liveHalaqa.wakeLock=null}

  async function liveOpen(){
    if(!roleCanManage())return toast('لا تملك صلاحية فتح جلسة الحلقة');
    const el=liveOverlay();el.innerHTML='<div class="live-loading"><i></i><b>جارٍ تجهيز جلسة الحلقة…</b><span>يتم فتح البيانات المحلية أولًا</span></div>';el.classList.remove('hidden');
    try{
      const se=await ensureTodaySession();if(!se){liveClose({persist:false});return}
      state.liveHalaqa.sessionId=se.id;state.sessionView=se.id;
      try{if(typeof prepareSessionForOfflineWork==='function')prepareSessionForOfflineWork(se.id)}catch(_e){}
      state.sessionRoster=cloneJson(state.offlineRosterCache?.[se.id]||{attendance:[],notes:[],recitations:[]});
      state.liveHalaqa.index=liveFirstUnresolved();liveLoadStudentState();liveRender();
      if(state.liveHalaqa.wakeLockEnabled)liveAcquireWakeLock();
      if(!isLocalSessionId(se.id)&&state.networkVerified&&!state.offline&&navigator.onLine){
        loadSessionRosterData(se.id).then(()=>{if(!liveOverlay().classList.contains('hidden')){state.liveHalaqa.index=liveFirstUnresolved();liveLoadStudentState();liveRender()}}).catch(e=>console.warn('Live Halaqa background roster refresh',e))
      }
    }catch(e){console.error('Live Halaqa open failed',e);liveClose({persist:false});toast('تعذر فتح جلسة الحلقة: '+(e?.message||e))}
  }

  window.openLiveHalaqa=liveOpen;
  window.closeLiveHalaqa=function(){return liveClose({persist:true})};
  window.liveHalaqaRender=liveRender;
  window.liveHalaqaAdjust=function(k,d){if(!['mistakes','prompts'].includes(k))return;state.liveHalaqa[k]=Math.max(0,Number(state.liveHalaqa[k]||0)+Number(d||0));livePersistDraft();liveRender()};
  window.liveHalaqaSetAttendance=function(v){
    const st=liveCurrentStudent(),se=liveSession();if(!st||!se)return;
    if(v==='absent'){state.liveHalaqa.absencePicker=true;liveRender();return}
    state.liveHalaqa.attendance='present';state.liveHalaqa.absenceReason='';state.liveHalaqa.absencePicker=false;
    try{localAttendanceSave(st.id,se.id,'present',{excuse_reason:null})}catch(e){console.warn(e)}
    livePersistDraft();liveRender()
  };
  window.liveHalaqaChooseAbsence=function(v){
    const st=liveCurrentStudent(),se=liveSession();if(!st||!se)return;
    const status=v==='excused'?'excused':'absent',reason=status==='excused'?'غياب بعذر':'غياب بدون عذر';
    if(liveRecs(st.id).length){state.liveHalaqa.absencePicker=false;toast('للطالب تسميع مسجل في هذه الجلسة. افتح النموذج الكامل لتعديل الحالة.');liveRender();return}
    state.liveHalaqa.attendance=status;state.liveHalaqa.absenceReason=reason;state.liveHalaqa.absencePicker=false;
    try{localAttendanceSave(st.id,se.id,status,{excuse_reason:status==='excused'?reason:null})}catch(e){console.warn(e)}
    livePersistDraft();liveRender()
  };
  window.liveHalaqaCancelAbsence=function(){state.liveHalaqa.absencePicker=false;liveRender()};
  window.liveHalaqaMove=function(d){livePersistDraft();const rows=liveStudents();state.liveHalaqa.index=Math.max(0,Math.min(rows.length-1,state.liveHalaqa.index+Number(d||0)));liveLoadStudentState();liveRender()};
  window.liveHalaqaJump=function(i){livePersistDraft();state.liveHalaqa.index=Math.max(0,Math.min(liveStudents().length-1,Number(i)||0));state.liveHalaqa.searchOpen=false;liveLoadStudentState();liveRender()};
  window.liveHalaqaToggleSearch=function(){state.liveHalaqa.searchOpen=!state.liveHalaqa.searchOpen;liveRender()};
  window.liveHalaqaSearch=function(q){liveSearchResults(q)};
  window.liveHalaqaOpenFull=async function(id){livePersistDraft();const seId=state.liveHalaqa.sessionId;liveClose();try{await openDailyForStudent(id,seId)}catch(e){toast('تعذر فتح النموذج الكامل')}};

  window.liveHalaqaSaveCurrent=async function(){
    if(state.liveHalaqa.saving)return;
    const st=liveCurrentStudent(),se=liveSession();if(!st||!se)return;
    if(liveIsDone(st)){
      const rows=liveStudents(),next=rows.findIndex((x,i)=>i>state.liveHalaqa.index&&!liveIsDone(x));
      if(next>=0){state.liveHalaqa.index=next;liveLoadStudentState();liveRender()}else window.liveHalaqaFinish();
      return
    }
    state.liveHalaqa.saving=true;liveRender();
    try{
      let attendance={session_id:se.id,student_id:st.id,status:state.liveHalaqa.attendance,excuse_reason:state.liveHalaqa.attendance==='excused'?(state.liveHalaqa.absenceReason||'غياب بعذر'):null,recorded_by:state.user.id};
      let note={session_id:se.id,student_id:st.id,behavior:'normal',behavior_score:3,teacher_comment:null,homework:null,parent_visible:true,created_by:state.user.id},rows=[];
      if(state.liveHalaqa.attendance==='present'){
        const rec=liveBuildRec(st,livePlanBundle(st));
        if(!rec){toast('لا يوجد مقرر ذكي قابل للتسجيل. استخدم النموذج الكامل لهذا الطالب.');state.liveHalaqa.saving=false;liveRender();return}
        if(Number(rec.pages_count)>80){toast('قيمة غير منطقية: أكثر من 80 صفحة.');state.liveHalaqa.saving=false;liveRender();return}
        rows=[{dbId:null,data:rec}]
      }
      saveReportOffline({sessionId:se.id,studentId:st.id,attendance,note,rows,existingRecIds:[]});
      liveClearDraft(st.id);state.liveHalaqa.mistakes=0;state.liveHalaqa.prompts=0;state.liveHalaqa.attendance='present';state.liveHalaqa.absenceReason='';
      const list=liveStudents();
      let next=list.findIndex((x,i)=>i>state.liveHalaqa.index&&!liveIsDone(x));
      if(next<0)next=list.findIndex((x,i)=>i<state.liveHalaqa.index&&!liveIsDone(x));
      if(next>=0){state.liveHalaqa.index=next;liveLoadStudentState()}else state.liveHalaqa.finishOpen=true
    }catch(e){console.error('Live Halaqa save failed',e);toast('تعذر الحفظ: '+(e?.message||e))}
    finally{state.liveHalaqa.saving=false;liveRender()}
  };

  window.liveHalaqaFinish=function(){state.liveHalaqa.finishOpen=true;liveRender()};
  window.liveHalaqaCancelFinish=function(){state.liveHalaqa.finishOpen=false;liveRender()};
  window.liveHalaqaGoFirstPending=function(){const rows=liveStudents(),i=rows.findIndex(st=>!liveIsDone(st));state.liveHalaqa.finishOpen=false;if(i>=0){state.liveHalaqa.index=i;liveLoadStudentState()}liveRender()};
  window.liveHalaqaCloseAnyway=function(){
    const se=liveSession(),s=liveStats();if(!se)return liveClose();
    se.status='closed';try{saveSessionOfflineFirst(se)}catch(e){console.warn(e)}
    try{localStorage.removeItem(liveDraftKey())}catch(_e){}
    liveClose({persist:false});state.liveHalaqa.sessionId=null;state.sessionView=null;state.sessionRoster={attendance:[],notes:[],recitations:[]};
    toast(`تم إنهاء الجلسة · ${s.recited} تسميع · ${s.absent} غياب`);try{render()}catch(_e){}
  };
  window.liveHalaqaToggleWakeLock=async function(){state.liveHalaqa.wakeLockEnabled=!state.liveHalaqa.wakeLockEnabled;localStorage.setItem('halaqati_live_wakelock',state.liveHalaqa.wakeLockEnabled?'1':'0');if(state.liveHalaqa.wakeLockEnabled)await liveAcquireWakeLock();else liveReleaseWakeLock();liveRender()};

  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.liveHalaqa.wakeLockEnabled&&!liveOverlay().classList.contains('hidden'))liveAcquireWakeLock()});

  let touchX=null,touchY=null;
  liveOverlay().addEventListener('touchstart',e=>{const t=e.touches?.[0];if(!t)return;touchX=t.clientX;touchY=t.clientY},{passive:true});
  liveOverlay().addEventListener('touchend',e=>{if(touchX===null)return;const t=e.changedTouches?.[0];if(!t)return;const dx=t.clientX-touchX,dy=t.clientY-touchY;touchX=touchY=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.3)window.liveHalaqaMove(dx<0?1:-1)},{passive:true});

  const liveStart=async function(){return liveOpen()};
  window.startTodaySession=liveStart;try{startTodaySession=liveStart}catch(_e){}

  const stableQuick=async function(){
    if(!roleCanManage())return toast('لا تملك صلاحية التسميع السريع');
    try{
      if(typeof opsQuickLoadingOverlay==='function')opsQuickLoadingOverlay();
      else{let e=opsEnsureOverlay('opsQuickOverlay');e.innerHTML='<div class="ops-quick-shell ops-quick-loading"><b>جارٍ تجهيز التحفيظ السريع…</b></div>';e.classList.remove('hidden')}
      const se=await ensureTodaySession();if(!se){opsCloseOverlay('opsQuickOverlay');return}
      state.opsQuick={sessionId:se.id,index:0,mistakes:0,prompts:0,attendance:'present',absenceReason:'',absencePicker:false,plannedDate:null};state.sessionView=se.id;
      try{if(typeof prepareSessionForOfflineWork==='function')prepareSessionForOfflineWork(se.id)}catch(_e){}
      state.sessionRoster=cloneJson(state.offlineRosterCache?.[se.id]||{attendance:[],notes:[],recitations:[]});
      opsQuickRender();
      if(!isLocalSessionId(se.id)&&state.networkVerified&&!state.offline&&navigator.onLine){loadSessionRosterData(se.id).then(()=>{if(!document.getElementById('opsQuickOverlay')?.classList.contains('hidden'))opsQuickRender()}).catch(e=>console.warn('Quick memorization background refresh',e))}
    }catch(e){console.error('Quick memorization open failed',e);try{opsCloseOverlay('opsQuickOverlay')}catch(_e){}toast('تعذر فتح التحفيظ السريع: '+(e?.message||e))}
  };
  window.openQuickMemorization=stableQuick;try{openQuickMemorization=stableQuick}catch(_e){}

  function liveBindActionMarkup(html){
    return String(html||'')
      .replace(/onclick="startTodaySession\(\)"/g,'data-halaqati-action="live-halaqa"')
      .replace(/onclick="(?:window\.)?openQuickMemorization\(\)"/g,'data-halaqati-action="quick-memorization"');
  }
  try{
    const baseDash=opsDashboardHome;
    opsDashboardHome=function(){return liveBindActionMarkup(baseDash())}
  }catch(_e){}
  try{
    const baseSessions=sessionsPage;
    sessionsPage=function(){return liveBindActionMarkup(baseSessions())}
  }catch(_e){}
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('[data-halaqati-action]');if(!btn)return;
    const action=btn.getAttribute('data-halaqati-action');
    if(action==='quick-memorization'){e.preventDefault();e.stopPropagation();stableQuick()}
    else if(action==='live-halaqa'){e.preventDefault();e.stopPropagation();liveOpen()}
  },true);
})();
