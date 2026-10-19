/* Halaqati v2.63.22 — the app's home dashboard (DashboardViewModel + DailyOperationStateEngine + FollowUpRules +
   HomeMessages + OrgAttention / OrgInsight rules), replacing the older web "لوحة اليوم" for admin, supervisor and teacher. */
(function(){
  const h=v=>typeof esc==='function'?esc(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const T0=()=>new Date().toISOString().slice(0,10);
  const P=()=>window.RC27Phases,S=()=>P().S;
  const freshD=()=> ({loaded:false,busy:false,at:0,errors:{},daily:null,heard:0,pages:0,expected:new Set,notHeard:[],absentLate:[],attention:[],review:[],overTarget:[],alerts:[],todaySessions:0,plansHealthy:null});let D=freshD();
  let dashboardOwner=null;
  function dashboardKey(){const sc=window.rc27Scope?.()||{};return [state.user?.id,state.profile?.role,sc.selectedId,sc.kind].join('|')}
  function ensureDashboardOwner(){const key=dashboardKey();if(key!==dashboardOwner){dashboardOwner=key;D=freshD();O=freshO()}return {key,daily:D,org:O}}
  const prefs=()=>{try{return JSON.parse(localStorage.getItem('halaqati_display_v1')||'{}')}catch(_e){return {}}};
  const isProgramMode=()=>typeof rc27Scope==='function'&&rc27Scope().kind==='program';
  const showPlans=()=>!isProgramMode();

  // ================= DailyOperationStateEngine =================
  const ACT={HIFZ:'HIFZ',SARD:'SARD',REVIEW:'REVIEW',TATHBIT:'TATHBIT',TEST:'TEST',OTHER:'OTHER'};
  const actOf=t=>({tasmee:ACT.HIFZ,hifz:ACT.HIFZ,new_hifz:ACT.HIFZ,sard:ACT.SARD,review:ACT.REVIEW,tathbit:ACT.TATHBIT,test:ACT.TEST})[String(t).toLowerCase()]||ACT.OTHER;
  const ACT_AR={HIFZ:'الحفظ',SARD:'السرد',REVIEW:'المراجعة',TATHBIT:'التثبيت',TEST:'الاختبار'};
  function modeFor(a){return a.size>1?'MIXED_DAY':a.has(ACT.HIFZ)?'HIFZ_DAY':a.has(ACT.SARD)?'SARD_DAY':a.has(ACT.TATHBIT)?'TATHBIT_DAY':a.has(ACT.REVIEW)?'REVIEW_DAY':a.size?'OTHER_ACTIVITY_DAY':'OFF_DAY'}
  const MODE_TITLE={OFF_DAY:'اليوم إجازة',NO_SESSION_YET:'جلسة اليوم لم تبدأ بعد',HIFZ_DAY:'يوم حفظ',SARD_DAY:'يوم سرد',REVIEW_DAY:'يوم مراجعة',TATHBIT_DAY:'يوم تثبيت',MIXED_DAY:'أنشطة اليوم',OTHER_ACTIVITY_DAY:'نشاط اليوم'};
  function actSubtitle(acts,waiting){const names=[...acts].map(a=>ACT_AR[a]).filter(Boolean),j=names.length===0?'النشاط المقرر':names.length===1?names[0]:names.join(' و');return waiting?`${j} مقرر اليوم، وتبدأ العدادات بعد فتح الجلسة.`:`${j} هو النشاط الفعلي لليوم.`}
  function evaluateDay(activeIds,scheduled,sessions){
    const elig=sessions.filter(s=>String(s.status).toLowerCase()!=='cancelled'),started=elig.filter(s=>!['planned','draft'].includes(String(s.status).toLowerCase()));
    const schedActs=new Set(scheduled.map(x=>x.activity)),startedActs=new Set(started.map(s=>actOf(s.type)));
    const acts=schedActs.size?schedActs:startedActs;
    const expected=scheduled.length?new Set(scheduled.map(x=>x.studentId).filter(id=>activeIds.has(id))):(started.length?new Set(activeIds):new Set);
    if(!acts.size&&!elig.length)return {mode:'OFF_DAY',acts:new Set,expected:new Set,started:false,count:false,title:'اليوم إجازة',subtitle:'لا توجد جلسة حفظ أو سرد أو مراجعة مقررة اليوم.'};
    if(!started.length)return {mode:'NO_SESSION_YET',acts,expected,started:false,count:false,title:'جلسة اليوم لم تبدأ بعد',subtitle:actSubtitle(acts,true)};
    const use=acts.size?acts:startedActs,mode=modeFor(use);
    return {mode,acts:use,expected,started:true,count:true,title:MODE_TITLE[mode],subtitle:actSubtitle(use,false)};
  }
  function scheduledDay(date,start,end,weekdays,catchUp,pauses,intensiveRange,intensiveDays,intensiveOn){
    if(date<start||date>end)return false;
    if(pauses.some(p=>date>=p.from&&date<=p.to))return false;
    const wd=new Date(date+'T00:00:00Z').getUTCDay();
    if(wd===catchUp)return false;
    const intensive=intensiveOn&&intensiveRange&&date>=intensiveRange[0]&&date<=intensiveRange[1];
    return intensive?intensiveDays.includes(wd):weekdays.includes(wd);
  }
  const enabledActs=(type,stored)=>{if(type==='tathbit')return ['tathbit'];const clean=[...new Set((stored||[]).map(x=>String(x).trim().toLowerCase()).filter(x=>['hifz','sard','review'].includes(x)))];return clean.length?clean:(type==='sard'?['sard']:type==='review'?['review']:['hifz'])};

  // ================= plan snapshots for every active student (native planSnapshots) =================
  function effectivePlans(plans,student,date){
    const cands=plans.filter(p=>{
      const scope=p.scope_type==='halaqa'?true:p.scope_type==='category'?(p.category_id&&p.category_id===student.category_id):p.scope_type==='student'?p.student_id===student.id:false;
      const tr=student.track_code==='tathbit'?p.plan_type==='tathbit':p.plan_type!=='tathbit';
      return tr&&p.status==='active'&&p.halaqa_id===student.halaqa_id&&date>=String(p.start_date).slice(0,10)&&date<=String(p.end_date).slice(0,10)&&scope;
    }),prio={halaqa:1,category:2,student:3};
    return ['hifz','review','sard','tathbit'].map(t=>cands.filter(p=>p.plan_type===t).sort((a,b)=>(prio[a.scope_type]||0)-(prio[b.scope_type]||0)||String(a.updated_at||a.created_at||'').localeCompare(String(b.updated_at||b.created_at||'')))[0]).filter(Boolean);
  }
  function planSnapshots(students,today){
    const out=[];
    students.forEach(st=>{
      effectivePlans(S().plans,st,today).forEach(plan=>{
        try{const sn=P().snapshot(plan,today,st.id);if(sn&&sn.raw)out.push({student:st,plan,sn})}catch(e){console.warn('rc27 dash snapshot',e)}
      });
    });
    return out;
  }
  function planScheduledOn(item,today){
    const sn=item.sn,p=sn.plan,parent=item.plan;if(parent.status!=='active')return false;
    const settings=p.settings||{},pauses=(settings.pause_ranges||[]).map(r=>({from:String(r.from||r[0]||'').slice(0,10),to:String(r.to||r[1]||'').slice(0,10)})).filter(r=>r.from&&r.to);
    const iFrom=settings.intensive_week_from,iTo=settings.intensive_week_to,range=iFrom&&iTo?[String(iFrom).slice(0,10),String(iTo).slice(0,10)]:null;
    return scheduledDay(today,String(p.start_date).slice(0,10),String(p.end_date).slice(0,10),p.schedule_weekdays||[],parent.catch_up_weekday??null,pauses,range,settings.intensive_weekdays||[],p.plan_type==='sard');
  }

  // ================= load =================
  window.addEventListener('halaqati:sessionchange',()=>{D.loaded=false;D.at=0});
  async function refresh(force){
    const cache=ensureDashboardOwner(),D=cache.daily;
    if(D.busy)return;if(!force&&D.loaded&&Date.now()-D.at<60000)return;
    D.busy=true;const errors={},today=T0();
    try{
      const students=(state.students||[]).filter(s=>s.status==='active'),activeIds=new Set(students.map(s=>s.id));
      const online=navigator.onLine&&state.networkVerified!==false&&!state.offline;
      if(online){try{await P().load(true)}catch(e){errors.plans=e.message||String(e)}}
      let recs=[];
      if(online){
        try{const r=await window.HalaqatiData.result(()=>db.from('recitation_entries').select('id,session_id,student_id,activity_type,pages_count,mistakes,prompts,evaluation,safety_percentage,created_at,sessions!inner(session_date)').gte('sessions.session_date',new Date(Date.now()-190*864e5).toISOString().slice(0,10)).order('created_at',{ascending:false}).order('id'),()=>state.user?.id);if(r.error)throw r.error;recs=r.data||[];D.recs=recs}catch(e){errors.recitations=e.message||String(e);recs=D.recs||[]}
        try{if(showPlans())await P().loadRecsBulk(students.map(s=>s.id),190)}catch(e){errors.plans=e.message||String(e)}
      }else recs=D.recs||[];
      const snaps=showPlans()?planSnapshots(students,today):[];
      const sessionsToday=(state.sessions||[]).filter(s=>s.session_date===today&&String(s.status).toLowerCase()!=='cancelled');
      const scheduled=[];
      snaps.filter(it=>activeIds.has(it.student.id)&&planScheduledOn(it,today)).forEach(it=>enabledActs(it.sn.plan.plan_type,it.sn.plan.settings?.enabled_activities).forEach(k=>scheduled.push({studentId:it.student.id,activity:{sard:ACT.SARD,review:ACT.REVIEW,tathbit:ACT.TATHBIT}[k]||ACT.HIFZ})));
      const uniq=new Map;scheduled.forEach(x=>uniq.set(x.studentId+'|'+x.activity,x));
      const daily=evaluateDay(activeIds,[...uniq.values()],sessionsToday.map(s=>({type:s.session_type,status:s.status})));
      const startedIds=new Set(sessionsToday.filter(s=>!['planned','draft'].includes(String(s.status).toLowerCase())).map(s=>s.id));
      // heard today + pages
      const heard=new Set;let pages=0;
      if(daily.count)recs.forEach(r=>{if(!startedIds.has(r.session_id))return;if(daily.expected.has(r.student_id))heard.add(r.student_id);pages+=Number(r.pages_count)||0});
      const notHeard=daily.count?students.filter(s=>daily.expected.has(s.id)&&!heard.has(s.id)).map(s=>({studentId:s.id,studentName:s.full_name,reason:'لم يسمّع اليوم'})):[];
      // absence today
      let absentLate=D.absentLate;
      if(!daily.count)absentLate=[];
      else{
        try{
          if(!online)throw new Error('offline');
          const ids=[...startedIds],byId=new Map(students.map(s=>[s.id,s]));
          const r=ids.length?await window.HalaqatiData.result(()=>db.from('attendance_records').select('id,session_id,student_id,status').in('session_id',ids).order('session_id').order('student_id'),()=>state.user?.id):{data:[]};if(r.error)throw r.error;
          const seen=new Map;(r.data||[]).forEach(row=>{const st=byId.get(row.student_id);if(st&&daily.expected.has(row.student_id)&&['absent','excused'].includes(String(row.status).toLowerCase()))seen.set(st.id,{studentId:st.id,studentName:st.full_name,reason:'غائب اليوم'})});
          absentLate=[...seen.values()];
        }catch(e){if(e.message!=='offline')errors.attendance=e.message||String(e)}
      }
      // plan follow-up lists
      const attention=snaps.filter(it=>Number(it.sn.raw.behindBy)>0.01).map(it=>({studentId:it.student.id,studentName:it.student.full_name,reason:`متأخر عن الخطة · ${(Math.round(it.sn.raw.behindBy*10)/10).toFixed(1)} ص`}));
      const overTarget=snaps.filter(it=>Number(it.sn.raw.aheadBy)>0.01).map(it=>({studentId:it.student.id,studentName:it.student.full_name,reason:`تجاوز هدفه · +${(Math.round(it.sn.raw.aheadBy*10)/10).toFixed(1)} ص`}));
      const dedupe=a=>{const m=new Map;a.forEach(x=>{if(!m.has(x.studentId))m.set(x.studentId,x)});return [...m.values()]};
      const latestSafety=new Map;recs.forEach(r=>{if(r.student_id&&!latestSafety.has(r.student_id))latestSafety.set(r.student_id,r.safety_percentage==null?100:Number(r.safety_percentage))});
      const byStu=new Map(students.map(s=>[s.id,s]));
      const review=[...latestSafety.entries()].filter(([,v])=>v<78).map(([sid,v])=>byStu.has(sid)?{studentId:sid,studentName:byStu.get(sid).full_name,reason:`يحتاج مراجعة · ${v.toFixed(0)}%`}:null).filter(Boolean);
      Object.assign(D,{daily,heard:heard.size,pages,expected:daily.expected,notHeard,absentLate,attention:dedupe(attention),overTarget:dedupe(overTarget),review,alerts:snaps.filter(it=>Number(it.sn.raw.consecutiveMissed)>0).map(it=>`${it.student.full_name}: ${it.sn.raw.healthLabel}`),todaySessions:(state.sessions||[]).filter(s=>s.session_date===today&&s.status!=='cancelled').length,errors,loaded:true,at:Date.now()});
    }catch(e){D.errors={dashboard:e.message||String(e)};D.loaded=true}
    finally{D.busy=false}
    if(state.page==='home'||state.page==='follow_up'){const c=document.getElementById('content');if(c&&state.page==='home')render();else if(state.page==='follow_up')render()}
  }
  window.rc27DashRefresh=()=>refresh(true);

  // ================= FollowUpRules.group =================
  function followUpGroups(){
    ensureDashboardOwner();
    const sources=[['متأخرون عن الخطة',D.attention],['جودة التسميع',D.review],['غياب متكرر / اليوم',D.absentLate],['لم يسمّع',D.notHeard]];
    const counts=new Map;sources.forEach(([,l])=>l.forEach(x=>counts.set(x.studentId,(counts.get(x.studentId)||0)+1)));
    const urgent=[];const seenU=new Set;sources.forEach(([,l])=>l.forEach(x=>{if((counts.get(x.studentId)||0)>=2&&!seenU.has(x.studentId)){seenU.add(x.studentId);urgent.push(x)}}));
    const used=new Set(urgent.map(x=>x.studentId)),out=[];
    if(urgent.length)out.push({title:'متابعة عاجلة',items:urgent});
    sources.forEach(([title,l])=>{const m=new Map;l.filter(x=>!used.has(x.studentId)).forEach(x=>{if(!m.has(x.studentId))m.set(x.studentId,x)});const uniq=[...m.values()];if(uniq.length){out.push({title,items:uniq});uniq.forEach(x=>used.add(x.studentId))}});
    return out;
  }

  // ================= HomeMessages =================
  const HON=new Set(['dr','prof','د','أ','م','الشيخ','الأستاذ','الأستاذة','الدكتور','الدكتورة','المعلم','المعلمة','الحاج']);
  function displayName(full){const parts=String(full||'').trim().split(/\s+/).filter(Boolean);if(!parts.length)return 'بك';const first=parts[0],isT=HON.has(first.replace(/\.+$/,'').toLowerCase());return isT&&parts.length>=2?`${first} ${parts[1]}`:isT?'بك':first}
  function homeState(loaded,off,waiting,heard,wait){return !loaded?'LOADING':off?'OFF_DAY':waiting?'WAITING':(heard>0&&wait===0)?'DONE':'ACTIVE'}
  function pickMsg(teacher,st,seed,waiting,absent,heard){
    const M=(t,s,i)=>({title:t,subtitle:s,icon:i});
    const lists={
      LOADING:[M('نجهّز يومك','نعرض آخر بيانات محفوظة ريثما تكتمل المزامنة.','sync')],
      OFF_DAY:teacher?[M('يوم راحة مبارك','اليوم إجازة، وسجلات الأيام السابقة بين يديك متى شئت.','rest'),M('استرح قليلًا','لا جلسة اليوم؛ يمكنك مراجعة الخطط وتجهيز المقررات القادمة.','rest'),M('تجديد النشاط','إجازة اليوم فرصة لمراجعة متابعات الطلاب بهدوء.','rest')]:[M('إجازة اليوم','لا جلسات اليوم، والتقارير والخطط متاحة للمراجعة.','rest'),M('يوم هادئ','فرصة لمراجعة الحلقات والخطط والشهادات.','rest')],
      WAITING:teacher?[M('جلسة اليوم بانتظارك','افتح الجلسة، سجّل الحضور، ثم ابدأ التسميع.','play'),M('يوم جديد مع كتاب الله','الحضور أولًا ثم التسميع، والبقية تتبعه بإذن الله.','book'),M('بارك الله في وقتك','ثلاث خطوات اليوم: الحضور، التسميع، المتابعة.','play'),M('ابدأ على بركة الله','المقررات جاهزة، والعدادات تبدأ بعد فتح الجلسة.','play')]:[M('متابعة اليوم','لم تبدأ جلسات اليوم بعد؛ العدادات تبدأ مع أول جلسة.','play'),M('صباح العمل','راجع الخطط المتأخرة قبل أن تبدأ الجلسات.','book'),M('نظرة على الحلقات','الخطط والمتابعات جاهزة للمراجعة.','book')],
      ACTIVE:teacher?[M(waiting>0?`بقي ${waiting} من طلابك`:'الجلسة جارية','أكمل تسميع من بقي، وبارك الله في جهدك.','book'),M('أحسنت المتابعة',`سمّع ${heard} طالبًا حتى الآن`+(absent>0?`، وهناك ${absent} بحاجة لمتابعة غياب.`:'.'),'check'),M('واصل بثبات','كل تسميع اليوم أثر يبقى في صدر طالب.','book')]:[M('الجلسات جارية',`أتمّ ${heard} طالبًا التسميع`+(waiting>0?`، وبقي ${waiting}.`:'.'),'check'),M('متابعة مباشرة','تابع الحضور والتسميع من لوحة واحدة.','check')],
      DONE:[M('أتممتم تسميع اليوم',`أنجز ${heard} طالبًا اليوم، جزاك الله خيرًا.`,'star'),M('يوم موفّق','اكتمل تسميع الحاضرين؛ راجع المتابعات إن بقي شيء.','star'),M('ما شاء الله','لا أحد بانتظار التسميع الآن.','star')]
    }[st];
    return lists[((seed%lists.length)+lists.length)%lists.length];
  }

  // ================= org cards =================
  const freshO=()=> ({noPlan:[],noGuardian:[],routeDone:[],streaks:[],missingHalaqas:null,compare:null,at:0});let O=freshO();
  const guardianMsg=(name,count,halaqa)=>`السلام عليكم ورحمة الله وبركاته، نودّ الاطمئنان على الطالب ${name}، فقد غاب عن ${count} جلسات متتالية${halaqa?` في ${halaqa}`:''}. نرجو إفادتنا بالسبب وحرصكم على انتظامه. جزاكم الله خيرًا.`;
  window.rc27SendGuardian=function(sid,count){
    const st=(window.RC27?.master?.students||state.students).find(s=>s.id===sid);if(!st)return;
    const hq=(state.halaqas||[]).find(x=>x.id===st.halaqa_id),msg=guardianMsg(st.full_name,count,hq?.name),phone=String(st.guardian_phone||'').replace(/[^\d+]/g,'');
    const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
    if(phone)window.open(mobile?`sms:${phone}?body=${encodeURIComponent(msg)}`:`https://wa.me/${phone.replace(/^\+/,'')}?text=${encodeURIComponent(msg)}`,'_blank');
    else if(navigator.share)navigator.share({text:msg}).catch(()=>{});else{navigator.clipboard?.writeText(msg);toast('تم نسخ رسالة ولي الأمر')}
  };
  async function loadOrg(){
    const cache=ensureDashboardOwner(),O=cache.org;
    if(Date.now()-O.at<300000)return;O.at=Date.now();
    const today=T0(),role=state.profile?.role,online=navigator.onLine&&state.networkVerified!==false&&!state.offline,students=(state.students||[]).filter(s=>s.status==='active');
    const progIds=new Set((window.RC27?.master?.halaqas||state.halaqas||[]).filter(x=>rc27IsProgram(x)).map(x=>x.id));
    // org attention
    const covers=(p,s)=>['active','paused','draft'].includes(p.status)&&today>=String(p.start_date).slice(0,10)&&(!p.end_date||today<=String(p.end_date).slice(0,10))&&(p.scope_type==='category'?(p.category_id&&p.category_id===s.category_id):p.scope_type==='halaqa'?(p.halaqa_id&&p.halaqa_id===s.halaqa_id):p.student_id===s.id);
    O.noPlan=S().plans.length||S().at?students.filter(s=>!progIds.has(s.halaqa_id)).filter(s=>!S().plans.some(p=>covers(p,s))).map(s=>s.full_name):[];
    if(online&&role!=='teacher'){try{const r=await db.from('student_guardians').select('student_id').limit(5000);if(!r.error){const linked=new Set((r.data||[]).map(x=>x.student_id));O.noGuardian=linked.size?students.filter(s=>!linked.has(s.id)).map(s=>s.full_name):[]}}catch(_e){}}else O.noGuardian=[];
    // route complete (rebase previews)
    O.routeDone=[];
    if(online&&showPlans()&&typeof rc27RebasePreviews==='function'){try{if(typeof rc27HealRanges==='function')await rc27HealRanges();O.routeDone=(await rc27RebasePreviews()).filter(p=>p.status==='ROUTE_COMPLETE').map(p=>p.studentName)}catch(_e){}}
    // absence streaks
    O.streaks=[];
    if(online){
      try{
        const from=new Date(Date.now()-60*864e5).toISOString().slice(0,10);
        const r=await window.HalaqatiData.result(()=>db.from('attendance_records').select('student_id,status,sessions!inner(session_date,status)').gte('sessions.session_date',from).order('session_id').order('student_id'),()=>state.user?.id);if(r.error)throw r.error;
        const by=new Map;(r.data||[]).forEach(o=>{if(o.sessions?.status==='cancelled')return;(by.get(o.student_id)||by.set(o.student_id,[]).get(o.student_id)).push({date:o.sessions.session_date,status:o.status})});
        const byId=new Map(students.map(s=>[s.id,s]));
        by.forEach((rows,sid)=>{if(!byId.has(sid))return;let c=0,last=null;for(const x of rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)))){if(x.status==='absent'){c++;if(!last)last=x.date}else if(x.status==='excused')continue;else break}if(c>=3)O.streaks.push({sid,count:c,last,name:byId.get(sid).full_name})});
        O.streaks.sort((a,b)=>b.count-a.count||String(b.last).localeCompare(String(a.last)));
      }catch(_e){}
    }
    // halaqa today + comparison (admin / supervisor)
    O.missingHalaqas=null;O.compare=null;
    if(online&&(role==='admin'||role==='supervisor')){
      try{
        const hs=(window.RC27?.master?.halaqas||state.halaqas||[]).filter(x=>x.active!==false&&!rc27IsProgram(x)),done=new Set((window.RC27?.master?.sessions||state.sessions||[]).filter(s=>String(s.session_date).startsWith(today)&&s.status!=='cancelled').map(s=>s.halaqa_id));
        O.missingHalaqas={total:hs.length,names:hs.filter(x=>!done.has(x.id)).map(x=>x.name)};
        if(false){
          const from=today.slice(0,8)+'01';
          const [se,at,rc]=await Promise.all([window.HalaqatiData.result(()=>db.from('sessions').select('id,halaqa_id,session_date,status').gte('session_date',from).order('id'),()=>state.user?.id),window.HalaqatiData.result(()=>db.from('attendance_records').select('status,sessions!inner(session_date,halaqa_id,status)').gte('sessions.session_date',from).order('session_id').order('student_id'),()=>state.user?.id),window.HalaqatiData.result(()=>db.from('recitation_entries').select('activity_type,pages_count,evaluation,sessions!inner(session_date,halaqa_id,status)').gte('sessions.session_date',from).order('id'),()=>state.user?.id)]);
          const POOR=['repeat','weak','إعادة','ضعيف'],REVIEW=['review_near','review_far','tathbit','sard'];
          const stuBy={};(window.RC27?.master?.students||state.students).filter(s=>s.status==='active').forEach(s=>{stuBy[s.halaqa_id]=(stuBy[s.halaqa_id]||0)+1});
          O.compare=hs.map(x=>{
            const a=(at.data||[]).filter(o=>o.sessions?.halaqa_id===x.id&&o.sessions?.status!=='cancelled'),pr=a.filter(o=>o.status==='present'||o.status==='late').length,ab=a.filter(o=>o.status==='absent').length,
              r=(rc.data||[]).filter(o=>o.sessions?.halaqa_id===x.id&&o.sessions?.status!=='cancelled'),hifz=r.filter(o=>o.activity_type==='new_hifz').reduce((s,o)=>s+(Number(o.pages_count)||0),0),rev=r.filter(o=>REVIEW.includes(o.activity_type)).reduce((s,o)=>s+(Number(o.pages_count)||0),0),n=stuBy[x.id]||0;
            return {id:x.id,name:x.name,students:n,sessions:(se.data||[]).filter(s=>s.halaqa_id===x.id&&s.status!=='cancelled').length,att:pr+ab>0?Math.round(pr*100/(pr+ab)):null,hifz,rev,ppS:n>0?(hifz+rev)/n:0,quality:r.length?Math.round(r.filter(o=>!POOR.includes(String(o.evaluation||'').toLowerCase())).length*100/r.length):null};
          }).sort((a,b)=>b.ppS-a.ppS);
        }
      }catch(_e){}
    }
    if(state.page==='home')render();
  }
  // ================= org cards (InsightCardShell via NX) =================
  const names=(l,n)=>l.slice(0,n).join('، ')+(l.length>n?` … +${l.length-n}`:'');
  window.rc27InsToggle=function(k){O['open_'+k]=!O['open_'+k];if(!window.nhRerender())render()};
  const IC=(n,s)=>typeof mi==='function'?mi(n,s):'';
  function orgCards(){
    const role=state.profile?.role,out=[],X=window.RC27Insights?.parts||{};
    const mgr=role==='admin'||role==='supervisor';
    // PlansNeedAttentionCard
    if(showPlans()&&O.routeDone.length)out.push(NX.insight('warning','EmojiEvents','أتمّوا مسار الحفظ',h(names(O.routeDone,3)+' — أنشئ لهم خطة مراجعة أو تثبيت.'),{count:O.routeDone.length,onclick:"go('plans')"}));
    // AbsenceStreakCard
    if(O.streaks.length){
      const open=!!O.open_abs;
      out.push(NX.insight('danger','EventBusy','غياب متكرر',h(open?'غابوا 3 جلسات متتالية فأكثر':names(O.streaks.map(x=>x.name),4).replace(/ … \+\d+$/,' …')),{count:O.streaks.length,expanded:open,onclick:"rc27InsToggle('abs')",
        body:open?O.streaks.slice(0,15).map(x=>`<div class="nh-irow"><div class="nh-irow-t"><b>${h(x.name)}</b><small>غاب ${x.count} جلسات متتالية</small></div>${NX.btn('رسالة للولي',{kind:'text',cls:'nh-tb',onclick:`event.stopPropagation();rc27SendGuardian('${x.sid}',${x.count})`})}</div>`).join(''):''}));
    }
    // InactiveStudentsCard
    if(X.inactive)out.push(X.inactive());
    if(role==='teacher'&&X.seasons)out.push(X.seasons(false));
    // OrgAttentionCard
    if(showPlans()&&O.noPlan.length)out.push(NX.insight('info','AssignmentLate','طلاب بلا خطة هذا الشهر',h(names(O.noPlan,3)),{count:O.noPlan.length,onclick:"go('plans')"}));
    if(showPlans()&&role!=='teacher'&&O.noGuardian.length)out.push(NX.insight('info','FamilyRestroom','طلاب بلا ولي أمر مرتبط',h(names(O.noGuardian,3)),{count:O.noGuardian.length,onclick:"go('students')"}));
    // AdminHalaqaTodayCard, HalaqaComparisonCard, SeasonsCard(manage)
    if(mgr&&O.missingHalaqas&&O.missingHalaqas.total>=2){
      const m=O.missingHalaqas,none=!m.names.length;
      out.push(NX.insight(none?'success':'warning',none?'EventAvailable':'EventBusy',none?'كل الحلقات سجّلت جلسة اليوم':'حلقات لم تسجّل جلسة اليوم',h(none?`${m.total} من ${m.total}`:m.names.slice(0,6).join('، ')+(m.names.length>6?' …':'')),{count:none?null:m.names.length,onclick:"go('sessions')"}));
    }
    if(mgr&&X.cmp)out.push(X.cmp());
    if(mgr&&X.seasons)out.push(X.seasons(true));
    return out.filter(Boolean).join('');
  }

  // ================= page =================
  const TONE={danger:'danger',warning:'warning',info:'info',success:'success'};
  const bucketCard=(kind,title,items,key)=>{
    const ic=kind==='danger'?'Warning':kind==='success'?'EmojiEvents':'Info';
    return `<div class="nh-bucket nx-s-${TONE[kind]||'info'}"><div class="nh-bucket-h">${IC(ic,20)}<b>${items.length}</b></div><b class="nh-bucket-t">${h(title)}</b>${items.slice(0,2).map(i=>`<span class="nh-bucket-n">${h(i.studentName)}</span>`).join('')}${items.length?'':'<span class="nh-bucket-n">لا يوجد</span>'}<button type="button" class="nh-bucket-b" onclick="rc27OpenBucket('${key}')">عرض القائمة كاملة (${items.length})</button></div>`;
  };
  const BUCKETS=()=>({nh:['لم يسمّع اليوم',D.notHeard],ab:['غائب اليوم',D.absentLate],at:['متأخر عن الخطة',D.attention],rv:['يحتاج مراجعة',D.review],ot:['تجاوز هدفه',D.overTarget]});
  window.rc27OpenBucket=function(k){
    const [title,items]=BUCKETS()[k];
    const body=items.length?`<div class="nh-list">${items.map(i=>`<button type="button" class="nh-li" onclick="NX.closeDialog('nhBucket');studentProfile('${i.studentId}')"><span class="nh-li-t"><b>${h(i.studentName)}</b><small>${h(i.reason)}</small></span>${IC('ChevronLeft',22)}</button>`).join('')}</div>`:NX.empty('لا توجد عناصر في هذه القائمة');
    NX.dialog('nhBucket',h(title),body,{cls:'nh-bucket-dlg'});
  };
  window.rc27OpenToday=async function(){
    try{const se=typeof ensureTodaySession==='function'?await ensureTodaySession():null;if(se){state.sessionView=se.id;state.page='sessions';render()}}catch(e){toast(e.message||String(e))}
  };
  function followItem(i){return `<button type="button" class="nh-fu" onclick="studentProfile('${i.studentId}')">${IC('PersonSearch',19)}<span class="nh-fu-t"><b>${h(i.studentName)}</b><small>${h(i.reason)}</small></span>${IC('ChevronLeft',20)}</button>`}
  const HOME_ICON={play:'PlayCircle',book:'MenuBook',check:'TaskAlt',star:'EmojiEvents',rest:'Weekend',sync:'Sync'};
  const nhTitle=t=>`<h3 class="nh-title">${t}</h3>`;
  function homeHtml(){
    ensureDashboardOwner();
    const p=state.profile,compact=prefs().homeStyle==='compact',d=D.daily;
    const off=d?.mode==='OFF_DAY',waiting=d?.mode==='NO_SESSION_YET',exp=d?D.expected.size:0,present=d?.count?Math.max(0,exp-D.absentLate.length):0,wait=d?.count?Math.max(0,present-D.heard):0;
    const hs=homeState(D.loaded,off,waiting,D.heard,wait),seed=Math.floor(Date.now()/864e5),msg=pickMsg(p.role==='teacher',hs,seed,wait,D.absentLate.length,D.heard);
    const groups=followUpGroups(),all=[...new Map(groups.flatMap(g=>g.items).map(i=>[i.studentId,i])).values()];
    const analytic=['admin','supervisor','teacher'].includes(p.role);
    // --- top: hero + actions
    let top=compact?NX.card(`<b class="nh-compact-t">${h(msg.title)}</b>${msg.subtitle?`<small class="nh-compact-s">${h(msg.subtitle)}</small>`:''}`,{cls:'nh-compact'}):NX.hero(h(msg.title),h(msg.subtitle),{icon:HOME_ICON[msg.icon]||'Sync',cls:'nh-hero'});
    let acts=NX.btn(off?'اليوم إجازة':waiting?'ابدأ جلسة اليوم':'فتح جلسة اليوم',{kind:'filled',icon:'PlayArrow',full:true,cls:'nh-act',disabled:!D.loaded||off,onclick:'rc27OpenToday()'});
    if(showPlans())acts+=NX.btn('التحفيظ السريع',{kind:'tonal',full:true,cls:'nh-act nh-act2',onclick:'openQuickMemorization()'});
    top+=`<div class="nh-actions">${acts}</div>`;
    const showMore=!compact||O.showMore;
    if(compact)top+=NX.btn(O.showMore?'إخفاء المؤشرات الإضافية':'عرض المؤشرات الإضافية',{kind:'text',full:true,onclick:'rc27ToggleMore()'});
    // --- side: insight cards
    const side=(showMore&&analytic)?`<div class="nh-cards">${orgCards()}</div>`:'';
    // --- rest
    let rest='';
    const errs=Object.values(D.errors).slice(0,1);
    errs.forEach(m=>{rest+=NX.notice('بقيت البيانات السابقة ظاهرة. '+h(m),'warning')});
    if(!D.loaded)rest+=NX.skeleton(2);
    else rest+=NX.metrics([NX.metric('حاضر اليوم',present,{icon:'HowToReg',onclick:'rc27OpenToday()'}),NX.metric('أتمّ التسميع',D.heard,{icon:'TaskAlt',onclick:"go('reports')"}),NX.metric('بانتظارك',wait,{icon:'HourglassTop',onclick:"go('follow_up')"})],3);
    rest+=nhTitle('المتابعة اليومية');
    if(!D.loaded)rest+=NX.skeleton(1);
    else if(off||waiting)rest+=NX.card(`<div class="nh-banner"><b class="nh-banner-t">${h(d.title)}</b><span class="nh-banner-s">${h(d.subtitle)}</span><span class="nh-banner-n ${off?'':'sm'}">${off?'لم يسمّع اليوم: 0 · غائب اليوم: 0':'لن يُحسب أي طالب كـ«لم يسمّع» أو «غائب» قبل بدء الجلسة.'}</span></div>`,{cls:'nh-bannercard'});
    else rest+=`<div class="nh-bgrid nh-b2">${bucketCard('danger','لم يسمّع اليوم',D.notHeard,'nh')}${bucketCard('warning','غائب اليوم',D.absentLate,'ab')}</div>`;
    if(showPlans())rest+=nhTitle('متابعة الخطة')+`<div class="nh-bgrid nh-b3">${bucketCard('warning','متأخر عن الخطة',D.attention,'at')}${bucketCard('info','يحتاج مراجعة',D.review,'rv')}${bucketCard('success','تجاوز هدفه',D.overTarget,'ot')}</div>`;
    rest+=`<div class="nh-titlerow">${nhTitle('طلاب يحتاجون متابعة')}${all.length?NX.btn('فتح المتابعة',{kind:'text',onclick:"go('follow_up')"}):''}</div>`;
    groups.forEach(g=>{rest+=`<div class="nh-grp">${h(g.title)}</div><div class="nh-fulist">${g.items.slice(0,compact?2:4).map(followItem).join('')}</div>`});
    if(!all.length&&D.loaded)rest+=NX.empty('لا توجد تنبيهات متابعة حاليًا',{icon:'TaskAlt'});
    rest+=NX.btn('الإحصائيات والترتيب',{kind:'outlined',full:true,cls:'nh-wide',onclick:"go('ranking')"});
    const pend=typeof readOfflineQueue==='function'?readOfflineQueue().length:0;
    if(pend)rest+=NX.btn(`مزامنة ${pend} عملية معلقة`,{kind:'outlined',full:true,cls:'nh-wide',onclick:'openSyncStatusDialog()'});
    return `<div class="nh nh-home ${side?'':'nh-solo'}"><div class="nh-top">${top}</div>${side?`<aside class="nh-side">${side}</aside>`:''}<div class="nh-rest">${rest}</div></div>`;
  }
  window.rc27ToggleMore=()=>{O.showMore=!O.showMore;if(!window.nhRerender())render()};
  window.nhRerender=function(){
    const el=document.querySelector('.nh-home');
    if(!el||state.page!=='home'||!['admin','supervisor','teacher'].includes(state.profile?.role))return false;
    const tmp=document.createElement('div');tmp.innerHTML=homeHtml();el.replaceWith(tmp.firstElementChild);return true;
  };
  function followHtml(){
    ensureDashboardOwner();
    const groups=followUpGroups(),q=(O.fq||'').trim(),sel=O.fsel||'الكل',labels=['الكل',...groups.map(g=>g.title)];
    const match=r=>!q||r.studentName.includes(q)||r.reason.includes(q),vis=sel==='الكل'?groups:groups.filter(g=>g.title===sel),total=new Set(groups.flatMap(g=>g.items.map(i=>i.studentId))).size;
    const head=`<div class="nh-fhead">${NX.iconBtn('ArrowBack',{title:'رجوع',onclick:"go('home')"})}<div class="nh-fhead-t"><b>متابعة الطلاب</b><small>${total} طالب يحتاج متابعة</small></div>${NX.iconBtn('Refresh',{title:'تحديث',onclick:'rc27DashRefresh()'})}</div>`;
    const search=NX.search(q,'ابحث باسم الطالب أو سبب المتابعة',{onchange:'O_fq(this.value)',oninput:'O_fqLive(this)'});
    const chips=NX.chips(labels.map(l=>({label:h(l),selected:l===sel,onclick:`O_fsel('${h(l).replace(/'/g,"\\'")}')`})));
    let body;
    if(!D.loaded)body=NX.skeleton(5);
    else if(!groups.length)body=NX.empty('لا توجد حالات متابعة حاليًا',{icon:'TaskAlt'});
    else body=vis.map(g=>{const rows=g.items.filter(match);return rows.length?`<div class="nh-titlerow nh-fsec"><h3 class="nh-title m">${h(g.title)}</h3><b class="nh-count">${rows.length}</b></div><div class="nh-fulist">${rows.map(followItem).join('')}</div>`:''}).join('')||NX.empty('لا توجد نتائج مطابقة للبحث');
    return `<div class="nh nh-follow">${head}${search}${chips}<div class="nh-fbody">${body}</div></div>`;
  }
  window.O_fq=v=>{O.fq=v;render()};window.O_fsel=v=>{O.fsel=v;render()};
  window.O_fqLive=el=>{clearTimeout(O._ft);O._ft=setTimeout(()=>{O.fq=el.value;const b=document.querySelector('.nh-fbody');if(b){const f=document.createElement('div');f.innerHTML=followHtml();b.replaceWith(f.querySelector('.nh-fbody'))}},250)};

  // ================= wiring =================
  if(typeof homePage==='function'){
    const baseHome=homePage;
    homePage=function(){
      ensureDashboardOwner();
      if(!['admin','supervisor','teacher'].includes(state.profile?.role))return baseHome.apply(this,arguments);
      setTimeout(()=>{refresh(false);loadOrg();window.RC27Insights?.load()},0);
      return homeHtml();
    };
  }
  if(typeof render==='function'){
    const baseRender=render;
    render=async function(){
      const r=await baseRender.apply(this,arguments);
      try{
        const c=document.getElementById('content'),p=state.profile;
        if(state.page==='follow_up'&&c){c.innerHTML=followHtml();document.getElementById('pageTitle').textContent='متابعة الطلاب';setTimeout(()=>refresh(false),0)}
        if(state.page==='home'&&p&&['admin','supervisor','teacher'].includes(p.role)){
          const t=document.getElementById('pageTitle'),k=document.getElementById('roleLabel');
          if(t)t.textContent=`أهلًا، ${displayName(p.full_name)}`;if(k)k.textContent=`لوحة اليوم · ${T0()} · متابعة الحلقة`;
        }
      }catch(e){console.warn('rc27 dashboard',e)}
      return r;
    };
  }
})();
