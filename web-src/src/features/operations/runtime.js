/* Halaqati v2.19.0 — Operations Suite */
state.opsProgramTrack=state.opsProgramTrack||'general_hifz';
state.opsAttendance=state.opsAttendance||[]; state.opsNotes=state.opsNotes||[]; state.opsAudit=state.opsAudit||[];
state.opsLoadedAt=state.opsLoadedAt||0; state.opsLoading=false; state.opsAuditAvailable=true;
state.opsPendingSessionDeletes=state.opsPendingSessionDeletes||{};
state.opsQuick={sessionId:null,index:0,mistakes:0,prompts:0,attendance:'present'};
const OPS_CACHE_TTL=5*60*1000, OPS_LOOKBACK_DAYS=120, OPS_DELETE_UNDO_MS=15000;

function opsDateDaysAgo(n){let d=new Date();d.setDate(d.getDate()-Number(n||0));return localDateKey(d)}
function opsDateDiff(a,b){return Math.round((new Date(`${a}T12:00:00`)-new Date(`${b}T12:00:00`))/86400000)}
function opsSessionDate(r){let n=Array.isArray(r?.sessions)?r.sessions[0]:r?.sessions;return String(r?.session_date||n?.session_date||state.sessions.find(s=>String(s.id)===String(r?.session_id))?.session_date||r?.created_at||'').slice(0,10)}
function opsTrackLabel(t=state.opsProgramTrack){return t==='tathbit'?'مسار التثبيت':'مسار الحفظ العام'}
function opsStudentProgramTrack(s){return s?.track_code==='tathbit'?'tathbit':'general_hifz'}
function opsStudentInTrack(s,t=state.opsProgramTrack){return opsStudentProgramTrack(s)===(t==='tathbit'?'tathbit':'general_hifz')}
function opsTrackStudents(t=state.opsProgramTrack){return activeStudents().filter(s=>opsStudentInTrack(s,t))}
function opsSetProgramTrack(t){state.opsProgramTrack=t==='tathbit'?'tathbit':'general_hifz';state.reportTrack=state.opsProgramTrack;render()}
function opsTrackSegment(){return state.profile?.role==='guardian'?'':`<div class="ops-track-seg"><button class="${state.opsProgramTrack==='general_hifz'?'active':''}" onclick="opsSetProgramTrack('general_hifz')">الحفظ العام</button><button class="${state.opsProgramTrack==='tathbit'?'active':''}" onclick="opsSetProgramTrack('tathbit')">التثبيت</button></div>`}
function opsAllRecitations(){try{return typeof smartPlanAllRecitations==='function'?smartPlanAllRecitations():[]}catch{return []}}
function opsStudentRecitations(id){return opsAllRecitations().filter(r=>String(r.student_id)===String(id)).sort((a,b)=>String(opsSessionDate(b)).localeCompare(String(opsSessionDate(a))))}
function opsStudentAttendance(id){return (state.opsAttendance||[]).filter(a=>String(a.student_id)===String(id)).sort((a,b)=>String(opsSessionDate(b)).localeCompare(String(opsSessionDate(a))))}
function opsStudentNotes(id){return (state.opsNotes||[]).filter(a=>String(a.student_id)===String(id)).sort((a,b)=>String(opsSessionDate(b)).localeCompare(String(opsSessionDate(a))))}
function opsAcceptedRec(r){let e=r?.evaluation||r?.rating;return !['repeat','needs_attention'].includes(e)}
function opsRecSafety(r){return Number(r?.safety_percentage??(typeof computeRecitationV6==='function'?computeRecitationV6(r):computeRecitationV5(r?.pages_count,r?.mistakes,r?.prompts)).safety_percentage)||0}
function opsIsTathbitRec(r){return r?.selection_data?.smart_plan_type==='tathbit'||r?.smart_plan_type==='tathbit'||r?.activity_type==='review_far'}
function opsIsCoreRec(r,st){return opsStudentProgramTrack(st)==='tathbit'?opsIsTathbitRec(r):r?.activity_type==='new_hifz'}
function opsPlanBundle(st,date=today()){try{let ps=effectiveSmartPlans(st,date)||[],p=ps.find(x=>x.plan_type===(opsStudentProgramTrack(st)==='tathbit'?'tathbit':'hifz'))||ps.find(x=>['hifz','tathbit'].includes(x.plan_type))||ps[0];if(!p)return {plan:null,progress:null,assignment:null,label:'لا توجد خطة فعالة'};let progress=smartPlanProgress(p,st.id,date),assignment=progress?.assignment;return {plan:p,progress,assignment,label:smartPlanAssignmentLabel(assignment)}}catch{return {plan:null,progress:null,assignment:null,label:'تعذر حساب المقرر'}}}
function opsRangeText(r){return recitationRangeText(r)}

function opsWeekStats(id,from,to){let recs=opsStudentRecitations(id).filter(r=>{let d=opsSessionDate(r);return d>=from&&d<=to&&opsAcceptedRec(r)}),pages=recs.reduce((s,r)=>s+Number(r.pages_count||0),0),errors=recs.reduce((s,r)=>s+Number(r.mistakes||0),0),safety=recs.length?recs.reduce((s,r)=>s+opsRecSafety(r),0)/recs.length:0;return {recs,pages,errors,safety,density:pages?errors/pages:errors}}
function opsStudentSignals(st){let now=today(),cur=opsWeekStats(st.id,opsDateDaysAgo(6),now),prev=opsWeekStats(st.id,opsDateDaysAgo(13),opsDateDaysAgo(7)),recs=opsStudentRecitations(st.id),lastDate=recs.map(opsSessionDate).filter(Boolean).sort().at(-1),atts=opsStudentAttendance(st.id).filter(a=>opsSessionDate(a)>=opsDateDaysAgo(13)),abs=atts.filter(a=>['absent','excused'].includes(a.status)).length,plan=opsPlanBundle(st),reasons=[],score=0;if(plan.progress?.health==='red'||Number(plan.progress?.behindBy||plan.progress?.deficit||0)>=1){reasons.push('متأخر عن الخطة');score+=4}else if(plan.progress?.health==='yellow'){reasons.push('الخطة تحتاج انتباه');score+=2}if(abs>=2){reasons.push(`تكرر الغياب ${abs} مرات خلال أسبوعين`);score+=3}if(prev.recs.length&&cur.recs.length&&cur.safety+7<prev.safety){reasons.push(`جودة الحفظ انخفضت ${fmt(prev.safety)}% ← ${fmt(cur.safety)}%`);score+=3}if(prev.recs.length&&cur.errors>=2&&cur.density>prev.density*1.25){reasons.push('الأخطاء أعلى من الأسبوع الماضي');score+=2}let gap=lastDate?opsDateDiff(now,lastDate):999;if(gap>=3){reasons.push(lastDate?`لم يسمّع منذ ${gap} أيام`:'لا يوجد تسميع حديث');score+=gap>=7?4:2}let last=recs[0];if(last&&opsRecSafety(last)<75){reasons.push(`آخر تسميع يحتاج مراجعة (${fmt(opsRecSafety(last))}%)`);score+=2}return {student:st,reasons,score,lastDate,absence:abs,plan,needsReview:!!last&&opsRecSafety(last)<78,behind:!!plan.progress&&plan.progress.health!=='green',exceeded:!!plan.progress&&Number(plan.progress.aheadBy||0)>.01}}
function opsFollowupRows(t=state.opsProgramTrack){return opsTrackStudents(t).map(opsStudentSignals).filter(x=>x.reasons.length).sort((a,b)=>b.score-a.score||String(a.student.full_name).localeCompare(String(b.student.full_name),'ar'))}
function opsHealth(t=state.opsProgramTrack){let sts=opsTrackStudents(t),ids=new Set(sts.map(s=>String(s.id))),from=opsDateDaysAgo(29),atts=state.opsAttendance.filter(a=>ids.has(String(a.student_id))&&opsSessionDate(a)>=from),present=atts.filter(a=>['present','late'].includes(a.status)).length,attendance=atts.length?present/atts.length*100:100,plans=sts.map(s=>opsPlanBundle(s).progress).filter(Boolean).map(p=>Math.max(0,Math.min(100,Number(p.percentage)||0))),plan=plans.length?plans.reduce((a,b)=>a+b,0)/plans.length:100,recs=opsAllRecitations().filter(r=>ids.has(String(r.student_id))&&opsSessionDate(r)>=from&&opsAcceptedRec(r)),quality=recs.length?recs.reduce((a,r)=>a+opsRecSafety(r),0)/recs.length:100,regular=sts.filter(s=>opsStudentRecitations(s.id).some(r=>opsSessionDate(r)>=opsDateDaysAgo(3))).length,regularity=sts.length?regular/sts.length*100:100,total=Math.round((attendance*.25+plan*.30+quality*.25+regularity*.20)*10)/10,label=total>=90?'ممتاز':total>=80?'جيد جدًا':total>=70?'جيد':total>=60?'يحتاج متابعة':'بحاجة تدخل',parts=[['الحضور',attendance],['تحقيق الخطط',plan],['جودة الحفظ',quality],['انتظام التسميع',regularity]].sort((a,b)=>a[1]-b[1]);return {total,label,attendance,plan,quality,regularity,weakest:parts[0][0]}}
function opsHealthCard(){let h=opsHealth();return `<div class="card ops-health-card"><div class="ops-health-score"><strong>${fmt(h.total)}%</strong><span>${h.label}</span></div><div class="grow"><h3>مؤشر صحة الحلقة · ${opsTrackLabel()}</h3><div class="muted">أضعف عنصر حاليًا: ${h.weakest}</div><div class="ops-health-parts"><span>الحضور <b>${fmt(h.attendance)}%</b></span><span>الخطط <b>${fmt(h.plan)}%</b></span><span>الجودة <b>${fmt(h.quality)}%</b></span><span>الانتظام <b>${fmt(h.regularity)}%</b></span></div></div></div>`}
function opsMiniList(rows,limit=2,key=null){return rows.length?`<div class="ops-mini-list">${rows.slice(0,limit).map(x=>{let s=x.student||x;return `<button onclick="studentProfile('${s.id}')"><span>${esc(s.full_name)}</span>${x.reasons?.[0]?`<small>${esc(x.reasons[0])}</small>`:''}</button>`}).join('')}${rows.length>limit?key?`<button class="ops-more" onclick="opsOpenDailyList('${key}')">+ ${rows.length-limit} آخرين</button>`:`<small>+ ${rows.length-limit} آخرين</small>`:''}</div>`:'<div class="ops-empty-inline">لا يوجد</div>'}
const opsDailyListTitles={notRecited:'لم يسمّع اليوم',absent:'غائب اليوم',behind:'متأخر عن الخطة',review:'يحتاج مراجعة',exceeded:'تجاوز هدفه'};
function opsOpenDailyList(key){
  if(!roleCanManage()||!opsDailyListTitles[key])return;
  let overlay=opsEnsureOverlay('opsDailyListOverlay');
  state.opsDailyListKey=key;state.opsDailyListReturnFocus=document.activeElement;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','opsDailyListTitle');
  overlay.innerHTML=`<div class="ops-overlay-shell ops-daily-shell"><header><div><h2 id="opsDailyListTitle">${opsDailyListTitles[key]}</h2><small>${esc(today())} · ${esc(opsTrackLabel())}</small></div><button class="mini" onclick="opsCloseDailyList()" aria-label="إغلاق القائمة">إغلاق</button></header><label for="opsDailyListSearch">البحث باسم الطالب</label><input id="opsDailyListSearch" type="search" placeholder="اكتب اسم الطالب" oninput="opsRenderDailyList(this.value)"><div id="opsDailyListCount" role="status"></div><div id="opsDailyListRows"></div></div>`;
  overlay.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();opsCloseDailyList()}if(e.key==='Tab'){let a=[...overlay.querySelectorAll('button,input')].filter(x=>!x.disabled),first=a[0],last=a.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};
  overlay.classList.remove('hidden');opsRenderDailyList('');overlay.querySelector('input').focus();
}
function opsCloseDailyList(){opsCloseOverlay('opsDailyListOverlay');state.opsDailyListReturnFocus?.focus();state.opsDailyListReturnFocus=null}
function opsDailyListStudent(id){opsCloseDailyList();studentProfile(id)}
function opsRenderDailyList(query=''){
  let rows=opsDailyOverview()[state.opsDailyListKey]||[],q=normalizeNameJs(query.trim()),filtered=rows.filter(x=>normalizeNameJs((x.student||x).full_name).includes(q));
  $('#opsDailyListCount').textContent=`${filtered.length} من ${rows.length} طالب`;
  $('#opsDailyListRows').innerHTML=filtered.map(x=>{let st=x.student||x,sig=x.student?x:opsStudentSignals(st),last=opsStudentRecitations(st.id)[0],p=sig.plan?.progress;return `<article class="ops-daily-detail"><h3>${esc(st.full_name)}</h3><p>${esc((sig.reasons||[]).join(' · ')||opsDailyListTitles[state.opsDailyListKey])}</p><dl><div><dt>آخر تسميع</dt><dd>${last?esc(opsSessionDate(last)+' · '+opsRangeText(last)):'لا يوجد تسميع مسجل'}</dd></div><div><dt>الخطة</dt><dd>${esc(sig.plan?.plan?.title||'لا توجد خطة فعالة')}</dd></div>${p?`<div><dt>الإنجاز</dt><dd>${fmt(p.completed)} من ${fmt(p.plan.target_pages)} صفحة</dd></div>`:''}</dl><button class="mini" onclick="opsDailyListStudent('${st.id}')">فتح ملف الطالب والتفاصيل</button></article>`}).join('')||'<div class="empty">لا يوجد طلاب مطابقون.</div>';
}
function opsDailyOverview(){let sts=opsTrackStudents(),ids=new Set(sts.map(s=>String(s.id))),date=today(),recs=opsAllRecitations().filter(r=>ids.has(String(r.student_id))&&opsSessionDate(r)===date),recited=new Set(recs.map(r=>String(r.student_id))),atts=state.opsAttendance.filter(a=>ids.has(String(a.student_id))&&opsSessionDate(a)===date),absIds=new Set(atts.filter(a=>['absent','excused'].includes(a.status)).map(a=>String(a.student_id))),signals=sts.map(opsStudentSignals);return {notRecited:sts.filter(s=>!recited.has(String(s.id))&&!absIds.has(String(s.id))),absent:sts.filter(s=>absIds.has(String(s.id))),behind:signals.filter(x=>x.behind),review:signals.filter(x=>x.needsReview),exceeded:signals.filter(x=>x.exceeded)}}
function opsDashboardHome(){let d=opsDailyOverview(),f=opsFollowupRows();return `<div class="hero ops-home-hero"><div><h2>لوحة اليوم</h2><p>${today()} · ${opsTrackLabel()} · كل ما يحتاج تدخلًا في شاشة واحدة.</p></div><div class="ops-hero-actions"><button class="btn btn-primary" onclick="startTodaySession()">ابدأ جلسة اليوم</button><button class="btn" onclick="openQuickMemorization()">التحفيظ السريع</button></div></div>${opsTrackSegment()}${opsHealthCard()}<div class="ops-daily-grid"><section class="ops-kpi danger"><b>${d.notRecited.length}</b><span>لم يسمّع اليوم</span>${opsMiniList(d.notRecited,2,'notRecited')}<button class="ops-view-all" onclick="opsOpenDailyList('notRecited')">عرض القائمة كاملة (${d.notRecited.length})</button></section><section class="ops-kpi warn"><b>${d.absent.length}</b><span>غائب اليوم</span>${opsMiniList(d.absent,2,'absent')}<button class="ops-view-all" onclick="opsOpenDailyList('absent')">عرض القائمة كاملة (${d.absent.length})</button></section><section class="ops-kpi warn"><b>${d.behind.length}</b><span>متأخر عن الخطة</span>${opsMiniList(d.behind,2,'behind')}<button class="ops-view-all" onclick="opsOpenDailyList('behind')">عرض القائمة كاملة (${d.behind.length})</button></section><section class="ops-kpi info"><b>${d.review.length}</b><span>يحتاج مراجعة</span>${opsMiniList(d.review,2,'review')}<button class="ops-view-all" onclick="opsOpenDailyList('review')">عرض القائمة كاملة (${d.review.length})</button></section><section class="ops-kpi success"><b>${d.exceeded.length}</b><span>تجاوز هدفه</span>${opsMiniList(d.exceeded,2,'exceeded')}<button class="ops-view-all" onclick="opsOpenDailyList('exceeded')">عرض القائمة كاملة (${d.exceeded.length})</button></section></div><div class="section-head"><h3>طلاب يحتاجون متابعة</h3><button class="mini" onclick="go('supervision')">فتح المتابعة</button></div>${f.slice(0,8).map(x=>`<div class="card ops-follow-row"><div class="row"><div class="avatar">${esc(x.student.full_name[0])}</div><div class="grow"><b>${esc(x.student.full_name)}</b><div class="muted">${x.reasons.map(esc).join(' · ')}</div></div><span class="badge ${x.score>=5?'red':x.score>=3?'warn':'blue'}">${x.score>=5?'عاجل':'متابعة'}</span></div></div>`).join('')||'<div class="empty">لا توجد تنبيهات متابعة حاليًا.</div>'}`}
const opsBaseHomePage=homePage; homePage=function(){return state.profile?.role==='guardian'?opsBaseHomePage():opsDashboardHome()};
const opsBaseSupervisionPage=supervisionPage; supervisionPage=function(){if(!roleCanManage())return opsBaseSupervisionPage();let rows=opsFollowupRows();return `<div class="hero"><h2>المتابعة والإنذار المبكر</h2><p>تأخر الخطة، الغياب المتكرر، انخفاض الجودة، زيادة الأخطاء والانقطاع عن التسميع.</p></div>${opsTrackSegment()}${opsHealthCard()}<div class="grid stats">${stat('يحتاجون متابعة',rows.length)}${stat('عاجل',rows.filter(x=>x.score>=5).length)}${stat('متأخرون',rows.filter(x=>x.behind).length)}</div>${rows.map(x=>`<div class="card ops-follow-card"><div class="row"><div class="avatar">${esc(x.student.full_name[0])}</div><div class="grow"><b>${esc(x.student.full_name)}</b><div class="muted">آخر تسميع: ${x.lastDate||'—'} · غياب: ${x.absence}</div></div><span class="badge ${x.score>=5?'red':'warn'}">درجة ${x.score}</span></div><div class="ops-reasons">${x.reasons.map(r=>`<span>${esc(r)}</span>`).join('')}</div><div class="actions"><button class="mini" onclick="studentProfile('${x.student.id}')">ملف الطالب</button><button class="mini" onclick="opsNewRecitation('${x.student.id}')">تسميع جديد</button><button class="mini" onclick="openPlan('${x.student.id}')">الخطة</button></div></div>`).join('')||'<div class="empty">الوضع مستقر.</div>'}`};

function opsSessionForToday(hid){return (state.sessions||[]).filter(s=>s.session_date===today()&&s.status!=='cancelled'&&(!hid||s.halaqa_id===hid)&&['tasmee','review','sard'].includes(s.session_type)).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))[0]||null}
function opsPreferredHalaqa(){let sts=opsTrackStudents(),c={};sts.forEach(s=>c[s.halaqa_id]=(c[s.halaqa_id]||0)+1);return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0]||state.halaqas[0]?.id||null}
async function ensureTodaySession(){if(!roleCanManage())return null;let hid=opsPreferredHalaqa();if(!hid)return toast('أنشئ حلقة أولاً'),null;let se=opsSessionForToday(hid);if(!se){let id=offlineUuid();se={id,halaqa_id:hid,session_date:today(),session_type:'tasmee',title:`جلسة اليوم — ${opsTrackLabel()}`,status:'open',created_by:state.user.id,created_at:new Date().toISOString(),_offline:true,activity_data:{program_track:state.opsProgramTrack,quick_start:true}};state.offlineRosterCache[id]={attendance:[],notes:[],recitations:[]};saveSessionOfflineFirst(se);opsAudit('session.quick_start','session',id,{halaqa_id:hid,track:state.opsProgramTrack})}return se}
async function startTodaySession(){let se=await ensureTodaySession();if(!se)return;state.sessionView=se.id;await openSessionRoster(se.id)}
const opsBaseSessionsPage=sessionsPage; sessionsPage=function(){let b=opsBaseSessionsPage();return roleCanManage()?`<div class="card ops-session-launch"><div><b>جلسة اليوم</b><div class="muted">إنشاء أو فتح جلسة اليوم بنقرة واحدة.</div></div><div class="actions"><button class="btn btn-primary" onclick="startTodaySession()">ابدأ جلسة اليوم</button><button class="btn" onclick="openQuickMemorization()">التحفيظ السريع</button></div></div>${opsTrackSegment()}${b}`:b};

function opsMonthBounds(offset=0){let d=new Date();d.setDate(1);d.setMonth(d.getMonth()+offset);let ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;return {from:`${ym}-01`,to:monthEnd(ym)}}
function opsMonthCompare(st){let calc=b=>{let recs=opsStudentRecitations(st.id).filter(r=>{let d=opsSessionDate(r);return d>=b.from&&d<=b.to&&opsAcceptedRec(r)}),atts=opsStudentAttendance(st.id).filter(a=>{let d=opsSessionDate(a);return d>=b.from&&d<=b.to});return {pages:recs.filter(r=>opsIsCoreRec(r,st)).reduce((s,r)=>s+Number(r.pages_count||0),0),absence:atts.filter(a=>['absent','excused'].includes(a.status)).length,safety:recs.length?recs.reduce((s,r)=>s+opsRecSafety(r),0)/recs.length:0,recs:recs.length}};return {cur:calc(opsMonthBounds(0)),prev:calc(opsMonthBounds(-1))}}
function opsTrend(cur,prev,inverse=false){let d=Number(cur||0)-Number(prev||0);if(Math.abs(d)<.01)return ['→','flat','0'];let good=inverse?d<0:d>0;return [d>0?'↑':'↓',good?'good':'bad',`${d>0?'+':''}${fmt(d)}`]}
function opsBadges(st){let out=[],atts=opsStudentAttendance(st.id).filter(a=>opsSessionDate(a)>=opsDateDaysAgo(10)).slice(0,7);if(atts.length>=7&&!atts.some(a=>['absent','excused'].includes(a.status)))out.push(['✓','7 أيام بلا غياب']);let c=opsMonthCompare(st);if(c.cur.pages>=20)out.push(['20','إتمام 20 صفحة']);let r=opsStudentRecitations(st.id).filter(opsAcceptedRec).slice(0,5);if(r.length===5&&r.every(x=>(x.evaluation||(typeof computeRecitationV6==='function'?computeRecitationV6(x):computeRecitationV5(x.pages_count,x.mistakes,x.prompts)).evaluation)==='excellent'))out.push(['★','5 ممتاز متتالية']);let done=(state.smartPlans||[]).some(p=>{try{return (p.student_id===st.id||p.scope_type!=='student')&&(p.status==='completed'||smartPlanProgress(p,st.id).percentage>=100)}catch{return false}});if(done)out.push(['◆','إنهاء خطة كاملة']);let peers=opsTrackStudents(opsStudentProgramTrack(st)).map(s=>{let x=opsMonthCompare(s);return [s.id,x.cur.pages-x.prev.pages]}).sort((a,b)=>b[1]-a[1]);if(peers[0]?.[0]===st.id&&peers[0][1]>0)out.push(['↗','أفضل تطور في الشهر']);return out}
function opsProfileRank(st){if(state.profile?.role==='guardian'&&typeof guardianDashboardRankMetric==='function'){let t=opsStudentProgramTrack(st)==='tathbit'?'review':'hifz',r=guardianDashboardRankMetric(st,t);return Number(r?.halaqa_rank)||null}let ids=new Set(opsTrackStudents(opsStudentProgramTrack(st)).map(s=>String(s.id))),track=opsStudentProgramTrack(st)==='tathbit'?'review':'hifz',rows=(state.leaderMonthly||[]).filter(x=>ids.has(String(x.student_id))&&x.track===track).sort((a,b)=>Number(b.points||0)-Number(a.points||0));let i=rows.findIndex(x=>String(x.student_id)===String(st.id));return i<0?null:i+1}
function opsWeeklyBars(st){let recs=opsStudentRecitations(st.id).filter(opsAcceptedRec),weeks=[3,2,1,0].map(off=>{let to=opsDateDaysAgo(off*7),from=opsDateDaysAgo(off*7+6),p=recs.filter(r=>opsSessionDate(r)>=from&&opsSessionDate(r)<=to).reduce((s,r)=>s+Number(r.pages_count||0),0);return p}),max=Math.max(1,...weeks);return `<div class="ops-bars">${weeks.map((p,i)=>`<div><span style="height:${Math.max(4,Math.round(p/max*88))}px"></span><b>${fmt(p)}</b><small>${i===3?'هذا الأسبوع':`قبل ${3-i} أ`}</small></div>`).join('')}</div>`}
function opsComparisonHtml(st){let c=opsMonthCompare(st),rows=[['الصفحات',c.cur.pages,c.prev.pages,false,' ص'],['الغياب',c.cur.absence,c.prev.absence,true,''],['السلامة',c.cur.safety,c.prev.safety,false,'%']];return `<div class="card"><h3>هذا الشهر مقابل الشهر الماضي</h3><div class="ops-compare">${rows.map(([l,a,b,inv,suf])=>{let t=opsTrend(a,b,inv);return `<div><span>${l}</span><b>${fmt(b)}${suf} ← ${fmt(a)}${suf}</b><em class="${t[1]}">${t[0]} ${t[2]}</em></div>`}).join('')}</div></div>`}
function opsNextDutyLabel(st,planBundle){try{let p=planBundle?.plan,cur=planBundle?.assignment;if(!p)return 'لا توجد خطة فعالة';if(Number(cur?.pages||0)>0)return smartPlanAssignmentLabel(cur);let next=typeof smartPlanNextDuty==='function'?smartPlanNextDuty(p,st,today()):null;return next?`${next.date} · ${smartPlanAssignmentLabel(next.progress.assignment)}`:'لا يوجد مقرر تالٍ'}catch{return planBundle?.label||'—'}}
function opsStudentProfileHtml(st){let recs=opsStudentRecitations(st.id),last=recs[0],plan=opsPlanBundle(st),m=opsMonthBounds(0),mr=recs.filter(r=>opsSessionDate(r)>=m.from&&opsSessionDate(r)<=m.to),atts=opsStudentAttendance(st.id).filter(a=>opsSessionDate(a)>=m.from&&opsSessionDate(a)<=m.to),safe=mr.length?mr.reduce((s,r)=>s+opsRecSafety(r),0)/mr.length:0,pages=mr.filter(r=>opsIsCoreRec(r,st)).reduce((s,r)=>s+Number(r.pages_count||0),0),rank=opsProfileRank(st),badges=opsBadges(st),p=plan.progress,nextDuty=opsNextDutyLabel(st,plan),g=(state.goals||[]).find(x=>String(x.student_id)===String(st.id)&&String(x.period_start||'').slice(0,7)===m.from.slice(0,7));return `<div class="card ops-profile-head"><div class="row">${avatarHtml(st,'photo-lg')}<div class="grow"><h2>${esc(st.full_name)}</h2><div class="muted">${esc(studentTrackAr[st.track_code]||opsTrackLabel(opsStudentProgramTrack(st)))}</div><div class="ops-badges">${badges.map(b=>`<span><i>${b[0]}</i>${esc(b[1])}</span>`).join('')||'<small class="muted">لا توجد شارات بعد</small>'}</div></div>${canManageStudents()?`<button class="mini" onclick="openStudent('${st.id}')">تعديل الملف</button>`:''}</div></div><div class="ops-profile-actions">${roleCanManage()?`<button class="btn btn-primary" onclick="opsNewRecitation('${st.id}')">تسميع جديد</button><button class="btn" onclick="openPlan('${st.id}')">تعديل الخطة</button><button class="btn" onclick="opsAddNote('${st.id}')">إضافة ملاحظة</button>`:''}<button class="btn" onclick="openParentReport('${st.id}','month')">تقرير ولي الأمر</button></div><div class="grid stats">${stat('صفحات الشهر',fmt(pages)+' ص')}${stat('الحضور',atts.filter(a=>['present','late'].includes(a.status)).length)}${stat('الغياب',atts.filter(a=>['absent','excused'].includes(a.status)).length)}${stat('V6',mr.length?fmt(safe)+'%':'—')}${stat('الترتيب',rank?`#${rank}`:'—')}</div><div class="ops-profile-grid"><div class="card"><h3>موضع الحفظ والمقرر</h3><div class="detail"><span>آخر موضع</span><b>${last?esc(opsRangeText(last)):'لا يوجد'}</b></div><div class="detail"><span>المقرر القادم</span><b>${esc(nextDuty)}</b></div><div class="detail"><span>الخطة الذكية</span><b>${esc(plan.plan?.title||'—')}</b></div><div class="detail"><span>خطة الشهر</span><b>${g?`${fmt(opsStudentProgramTrack(st)==='tathbit'?(g.target_review_pages||0):(g.target_hifz_pages||0))} صفحة`:'—'}</b></div>${p?`<div class="smart-progress-track"><i style="width:${Math.min(100,Number(p.percentage)||0)}%"></i></div><div class="muted">${fmt(p.completed)} / ${fmt(p.plan.target_pages)} ص · ${fmt(p.percentage)}%</div>`:''}</div><div class="card"><h3>الجودة</h3><div class="detail"><span>الأخطاء</span><b>${mr.reduce((s,r)=>s+Number(r.mistakes||0),0)}</b></div><div class="detail"><span>النقرات</span><b>${mr.reduce((s,r)=>s+Number(r.prompts||0),0)}</b></div><div class="detail"><span>السلامة</span><b>${mr.length?fmt(safe)+'%':'—'}</b></div></div></div><div class="card"><h3>تقدم آخر 4 أسابيع</h3>${opsWeeklyBars(st)}</div>${opsComparisonHtml(st)}`}
const opsBaseStudentProfile=studentProfile; studentProfile=function(id){let st=state.students.find(x=>String(x.id)===String(id));if(!st)return opsBaseStudentProfile(id);if(state.profile?.role==='guardian'&&!state.students.some(x=>String(x.id)===String(id)))return opsBaseStudentProfile(id);$('#content').innerHTML=opsStudentProfileHtml(st)+`<button class="btn btn-ghost" onclick="go(state.profile.role==='guardian'?'profile':'students')">رجوع</button>`};
async function opsNewRecitation(id){let se=await ensureTodaySession();if(se)openDailyForStudent(id,se.id)}
async function opsAddNote(id){let se=await ensureTodaySession();if(!se)return;await openDailyForStudent(id,se.id);setTimeout(()=>{$('#rpComment')?.focus()},100)}

const opsBaseRankingPage=rankingPage; rankingPage=function(){if(state.profile?.role==='guardian')return opsBaseRankingPage();let ids=new Set(opsTrackStudents().map(s=>String(s.id))),period=state.rankPeriod==='day'?state.leaderDaily:state.leaderMonthly,effectiveTrack=state.opsProgramTrack==='tathbit'?'review':state.rankTrack,rows=period.filter(x=>ids.has(String(x.student_id))&&x.track===effectiveTrack).sort((a,b)=>Number(b.points||0)-Number(a.points||0)||Number(b.pages||0)-Number(a.pages||0));return `<div class="hero"><h2>الترتيب والإحصائيات</h2><p>فصل كامل بين الحفظ العام والتثبيت.</p></div>${opsTrackSegment()}<div class="seg"><button class="${state.rankPeriod==='day'?'active':''}" onclick="setRankPeriod('day')">اليوم</button><button class="${state.rankPeriod==='month'?'active':''}" onclick="setRankPeriod('month')">الشهر</button></div>${state.opsProgramTrack==='tathbit'?'<div class="tabs" style="margin-top:12px"><button class="tab active">التثبيت</button></div>':`<div class="tabs" style="margin-top:12px"><button class="tab ${state.rankTrack==='hifz'?'active':''}" onclick="setRankTrack('hifz')">الحفظ</button><button class="tab ${state.rankTrack==='review'?'active':''}" onclick="setRankTrack('review')">المراجعة</button><button class="tab ${state.rankTrack==='sard'?'active':''}" onclick="setRankTrack('sard')">السرد</button></div>`}${rows.map((x,i)=>`<div class="card rank-row"><div class="rank">${i+1}</div><div class="grow"><b>${esc(x.full_name)}</b><div class="muted">${fmt(x.pages)} ص · ${x.mistakes||0} أخطاء · ${x.prompts||0} نقرات</div></div><b>${fmt(x.points)}</b></div>`).join('')||'<div class="empty">لا توجد بيانات لهذا المسار.</div>'}`};

function opsAggregateCompare(){let sum={cp:0,pp:0,ca:0,pa:0,cs:[],ps:[]};opsTrackStudents().forEach(st=>{let c=opsMonthCompare(st);sum.cp+=c.cur.pages;sum.pp+=c.prev.pages;sum.ca+=c.cur.absence;sum.pa+=c.prev.absence;if(c.cur.recs)sum.cs.push(c.cur.safety);if(c.prev.recs)sum.ps.push(c.prev.safety)});return [['الحفظ / التثبيت',sum.cp,sum.pp,false,' ص'],['الغياب',sum.ca,sum.pa,true,''],['السلامة',sum.cs.length?sum.cs.reduce((a,b)=>a+b,0)/sum.cs.length:0,sum.ps.length?sum.ps.reduce((a,b)=>a+b,0)/sum.ps.length:0,false,'%']]}
function opsReportsAddon(){return `${opsTrackSegment()}<div class="card"><div class="section-head"><h3>هذا الشهر مقابل الشهر الماضي · ${opsTrackLabel()}</h3><button class="mini" onclick="openParentReportsCenter()">تقارير أولياء الأمور</button></div><div class="ops-compare">${opsAggregateCompare().map(([l,a,b,inv,suf])=>{let t=opsTrend(a,b,inv);return `<div><span>${l}</span><b>${fmt(b)}${suf} ← ${fmt(a)}${suf}</b><em class="${t[1]}">${t[0]} ${t[2]}</em></div>`}).join('')}</div></div>`}
const opsBaseReportsPage=reportsPage; reportsPage=function(){return state.profile?.role==='guardian'?opsBaseReportsPage():opsReportsAddon()+opsBaseReportsPage()};

function opsParentPayload(st,period='month'){let to=today(),from=period==='week'?opsDateDaysAgo(6):opsMonthBounds(0).from,recs=opsStudentRecitations(st.id).filter(r=>opsSessionDate(r)>=from&&opsSessionDate(r)<=to&&opsAcceptedRec(r)),atts=opsStudentAttendance(st.id).filter(a=>opsSessionDate(a)>=from&&opsSessionDate(a)<=to),notes=opsStudentNotes(st.id).filter(n=>opsSessionDate(n)>=from&&opsSessionDate(n)<=to&&n.parent_visible!==false&&n.teacher_comment),plan=opsPlanBundle(st),safe=recs.length?recs.reduce((s,r)=>s+opsRecSafety(r),0)/recs.length:0;return {st,period,from,to,core:recs.filter(r=>opsIsCoreRec(r,st)).reduce((s,r)=>s+Number(r.pages_count||0),0),review:recs.filter(r=>['review_near','review_far'].includes(r.activity_type)).reduce((s,r)=>s+Number(r.pages_count||0),0),present:atts.filter(a=>['present','late'].includes(a.status)).length,absent:atts.filter(a=>['absent','excused'].includes(a.status)).length,safe,next:opsNextDutyLabel(st,plan),note:notes[0]?.teacher_comment||'لا توجد ملاحظات',badges:opsBadges(st)}}
function opsEnsureOverlay(id){let e=document.getElementById(id);if(e)return e;e=document.createElement('div');e.id=id;e.className='ops-overlay hidden';document.body.appendChild(e);return e}
function opsCloseOverlay(id){document.getElementById(id)?.classList.add('hidden')}
function opsParentCard(p){return `<div id="opsParentReportCard" class="ops-parent-card"><header><div><small>تطبيق حلقتي</small><h2>تقرير ${p.period==='week'?'أسبوعي':'شهري'}</h2></div><b>${p.from} — ${p.to}</b></header><section class="ops-parent-name"><span>${esc(p.st.full_name)}</span><small>${esc(studentTrackAr[p.st.track_code]||opsTrackLabel(opsStudentProgramTrack(p.st)))}</small></section><div class="ops-parent-kpis"><div><b>${fmt(p.core)}</b><span>${opsStudentProgramTrack(p.st)==='tathbit'?'تثبيت':'حفظ'} / ص</span></div><div><b>${fmt(p.review)}</b><span>مراجعة / ص</span></div><div><b>${p.present}</b><span>حضور</span></div><div><b>${p.absent}</b><span>غياب</span></div><div><b>${p.safe?fmt(p.safe)+'%':'—'}</b><span>V6</span></div></div><section><h3>المقرر القادم</h3><p>${esc(p.next)}</p></section><section><h3>ملاحظة المحفّظ</h3><p>${esc(p.note)}</p></section><div class="ops-badges">${p.badges.map(b=>`<span><i>${b[0]}</i>${esc(b[1])}</span>`).join('')}</div><footer>تم إنشاؤه تلقائيًا — ${today()}</footer></div>`}
function openParentReport(id,period='month'){let st=state.students.find(x=>String(x.id)===String(id));if(!st)return;let e=opsEnsureOverlay('opsParentReportOverlay');e.innerHTML=`<div class="ops-overlay-shell"><div class="ops-overlay-top"><b>تقرير ولي الأمر</b><button onclick="opsCloseOverlay('opsParentReportOverlay')">✕</button></div>${opsParentCard(opsParentPayload(st,period))}<div class="ops-overlay-actions"><button class="btn btn-primary" onclick="exportParentReportImage('${id}','${period}')">صورة / مشاركة</button><button class="btn" onclick="exportParentReportPdf('${id}','${period}')">PDF</button><button class="btn" onclick="shareParentReportText('${id}','${period}')">مشاركة النص</button></div></div>`;e.classList.remove('hidden')}
function openParentReportsCenter(){let e=opsEnsureOverlay('opsParentReportsOverlay');e.innerHTML=`<div class="ops-overlay-shell"><div class="ops-overlay-top"><b>تقارير أولياء الأمور · ${opsTrackLabel()}</b><button onclick="opsCloseOverlay('opsParentReportsOverlay')">✕</button></div><div class="ops-report-students">${opsTrackStudents().map(st=>`<div class="row"><b class="grow">${esc(st.full_name)}</b><button class="mini" onclick="openParentReport('${st.id}','week')">أسبوعي</button><button class="mini" onclick="openParentReport('${st.id}','month')">شهري</button></div>`).join('')}</div></div>`;e.classList.remove('hidden')}
async function opsCaptureParent(id,period){openParentReport(id,period);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await window.HalaqatiLazy.ensureLib('html2canvas');return window.html2canvas($('#opsParentReportCard'),{scale:2,backgroundColor:'#fff',useCORS:true})}
async function exportParentReportImage(id,p='month'){try{let c=await opsCaptureParent(id,p),b64=c.toDataURL('image/png').split(',')[1];await saveOrShareBase64(b64,`halaqati-parent-${id}-${p}-${today()}.png`,'image/png')}catch(e){toast('تعذر إنشاء الصورة: '+e.message)}}
async function exportParentReportPdf(id,p='month'){try{let c=await opsCaptureParent(id,p);await window.HalaqatiLazy.ensureLib('jspdf');let C=window.jspdf?.jsPDF||window.jsPDF,pdf=new C({unit:'mm',format:'a4'}),img=c.toDataURL('image/png'),w=190,h=c.height*190/c.width;pdf.addImage(img,'PNG',10,10,w,Math.min(277,h));await saveOrShareBase64(pdf.output('datauristring').split(',')[1],`halaqati-parent-${id}-${p}-${today()}.pdf`,'application/pdf')}catch(e){toast('تعذر إنشاء PDF: '+e.message)}}
async function shareParentReportText(id,p='month'){let st=state.students.find(x=>String(x.id)===String(id)),x=opsParentPayload(st,p),text=`تقرير ${st.full_name}\n${opsStudentProgramTrack(st)==='tathbit'?'التثبيت':'الحفظ'}: ${fmt(x.core)} ص\nالمراجعة: ${fmt(x.review)} ص\nالحضور: ${x.present} | الغياب: ${x.absent}\nالسلامة: ${x.safe?fmt(x.safe)+'%':'—'}\nالمقرر القادم: ${x.next}\nملاحظة: ${x.note}`;try{if(navigator.share)await navigator.share({title:'تقرير الطالب',text});else await navigator.clipboard.writeText(text),toast('تم نسخ التقرير')}catch(e){}}

function opsQuickStudents(){let se=state.sessions.find(x=>String(x.id)===String(state.opsQuick.sessionId)),sts=opsTrackStudents().filter(s=>!se?.halaqa_id||s.halaqa_id===se.halaqa_id),m=new Map(sts.map(s=>[s.id,opsStudentSignals(s)]));return sts.sort((a,b)=>(m.get(b.id)?.score||0)-(m.get(a.id)?.score||0)||String(a.full_name).localeCompare(String(b.full_name),'ar'))}
function opsQuickRender(){let e=opsEnsureOverlay('opsQuickOverlay'),rows=opsQuickStudents();if(!rows.length){e.innerHTML='<div class="ops-overlay-shell"><div class="empty">لا يوجد طلاب في هذا المسار.</div><button class="btn" onclick="opsCloseOverlay(\'opsQuickOverlay\')">إغلاق</button></div>';e.classList.remove('hidden');return}state.opsQuick.index=Math.max(0,Math.min(rows.length-1,state.opsQuick.index||0));let st=rows[state.opsQuick.index],p=opsPlanBundle(st),done=opsAllRecitations().some(r=>String(r.student_id)===String(st.id)&&opsSessionDate(r)===today()),sig=opsStudentSignals(st);e.innerHTML=`<div class="ops-quick-shell"><div class="ops-quick-top"><button onclick="opsCloseOverlay('opsQuickOverlay')">✕</button><b>التحفيظ السريع · ${state.opsQuick.index+1}/${rows.length}</b><span>${opsTrackLabel()}</span></div><div class="ops-quick-student"><small>${done?'✓ تم تسميعه اليوم':sig.reasons[0]||'جاهز للتسميع'}</small><h1>${esc(st.full_name)}</h1><div class="ops-quick-duty">${esc(p.label)}</div></div><div class="ops-att-toggle"><button class="${state.opsQuick.attendance==='present'?'active':''}" onclick="opsQuickSetAttendance('present')">حاضر</button><button class="${state.opsQuick.attendance==='absent'?'active danger':''}" onclick="opsQuickSetAttendance('absent')">غائب</button></div>${state.opsQuick.attendance==='present'?`<div class="ops-counters"><div><span>الأخطاء</span><button onclick="opsQuickAdjust('mistakes',-1)">−</button><b>${state.opsQuick.mistakes}</b><button onclick="opsQuickAdjust('mistakes',1)">+</button></div><div><span>النقرات</span><button onclick="opsQuickAdjust('prompts',-1)">−</button><b>${state.opsQuick.prompts}</b><button onclick="opsQuickAdjust('prompts',1)">+</button></div></div>`:'<div class="notice">سيُسجل غائبًا، ويعيد المحرك الذكي توزيع المطلوب على الأيام القادمة.</div>'}<div class="ops-quick-actions"><button class="btn" onclick="opsQuickMove(-1)" ${state.opsQuick.index===0?'disabled':''}>السابق</button><button class="btn btn-primary" onclick="opsQuickSave('${st.id}')">${done?'فتح التفاصيل':'حفظ والتالي'}</button><button class="btn" onclick="opsQuickMove(1)" ${state.opsQuick.index===rows.length-1?'disabled':''}>التالي</button></div><button class="btn btn-ghost" onclick="opsQuickOpenDetails('${st.id}')">نموذج التسميع الكامل</button></div>`;e.classList.remove('hidden')}
async function openQuickMemorization(){let se=await ensureTodaySession();if(!se)return;state.opsQuick={sessionId:se.id,index:0,mistakes:0,prompts:0,attendance:'present'};state.sessionView=se.id;if(isLocalSessionId(se.id))state.sessionRoster=cloneJson(state.offlineRosterCache[se.id]||{attendance:[],notes:[],recitations:[]});else try{await loadSessionRosterData(se.id)}catch(e){}opsQuickRender()}
function opsQuickSetAttendance(v){state.opsQuick.attendance=v;opsQuickRender()}
function opsQuickAdjust(k,d){state.opsQuick[k]=Math.max(0,Number(state.opsQuick[k]||0)+Number(d||0));opsQuickRender()}
function opsQuickMove(d){state.opsQuick.index=Math.max(0,state.opsQuick.index+Number(d||0));state.opsQuick.mistakes=0;state.opsQuick.prompts=0;state.opsQuick.attendance='present';opsQuickRender()}
async function opsQuickOpenDetails(id){opsCloseOverlay('opsQuickOverlay');await openDailyForStudent(id,state.opsQuick.sessionId)}
function opsQuickRec(st,b){let a=b.assignment,p=b.plan;if(!a||!p)return null;let first=a.ayahSegments?.[0],last=a.ayahSegments?.at(-1),sp=Number(a.startPage||a.start_page||p.range_start_page)||null,ep=Number(a.endPage||a.end_page||p.range_end_page)||sp,pages=Math.max(.01,Number(a.pages||a.dailyTarget||a.targetPages||(sp&&ep?Math.abs(ep-sp)+1:0))||0),type=p.plan_type==='hifz'?'new_hifz':p.plan_type==='tathbit'?'review_far':p.plan_type==='sard'?'sard':'review_near';return decorateRecForOffline({session_id:state.opsQuick.sessionId,student_id:st.id,activity_type:type,input_method:first?'ayahs':'pages',start_surah:first?.surah||null,start_ayah:first?.startAyah||null,end_surah:last?.surah||null,end_ayah:last?.endAyah||null,start_page:sp,end_page:ep,pages_count:pages,ayahs_count:0,surahs_count:0,mistakes:state.opsQuick.mistakes,prompts:state.opsQuick.prompts,teacher_note:null,selected_surahs:[],selection_data:{mode:first?'ayahs':'pages',smart_plan_id:p.id,smart_plan_type:p.plan_type,smart_plan_date:today(),quick_mode:true},created_by:state.user.id})}
async function opsQuickSave(id){let st=state.students.find(x=>String(x.id)===String(id)),se=state.sessions.find(x=>String(x.id)===String(state.opsQuick.sessionId));if(!st||!se)return;if(opsAllRecitations().some(r=>String(r.student_id)===String(id)&&String(r.session_id)===String(se.id))){opsCloseOverlay('opsQuickOverlay');return openDailyForStudent(id,se.id)}let attendance={session_id:se.id,student_id:id,status:state.opsQuick.attendance,excuse_reason:null,recorded_by:state.user.id},note={session_id:se.id,student_id:id,behavior:'normal',behavior_score:3,teacher_comment:null,homework:null,parent_visible:true,created_by:state.user.id},rows=[];if(state.opsQuick.attendance==='present'){let rec=opsQuickRec(st,opsPlanBundle(st,se.session_date));if(!rec){opsCloseOverlay('opsQuickOverlay');toast('لا يوجد مقرر قابل للتعبئة السريعة.');return openDailyForStudent(id,se.id)}if(rec.pages_count>80)return toast('قيمة غير منطقية: أكثر من 80 صفحة.');rows=[{dbId:null,data:rec}]}saveReportOffline({sessionId:se.id,studentId:id,attendance,note,rows,existingRecIds:[]});state.opsQuick.mistakes=0;state.opsQuick.prompts=0;state.opsQuick.attendance='present';state.opsQuick.index=Math.min(state.opsQuick.index+1,Math.max(0,opsQuickStudents().length-1));opsQuickRender()}

function opsSearchEnsureButton(){let title=$('#pageTitle');if(!title||$('#opsSearchButton'))return;let b=document.createElement('button');b.id='opsSearchButton';b.className='ops-search-button';b.type='button';b.title='بحث شامل';b.setAttribute('aria-label','بحث شامل');b.textContent='بحث';b.onclick=openGlobalSearch;title.insertAdjacentElement('afterend',b)}
function openGlobalSearch(){let e=opsEnsureOverlay('opsSearchOverlay');e.innerHTML=`<div class="ops-search-shell"><div class="ops-search-head"><input id="opsGlobalSearchInput" class="input" placeholder="طالب، جلسة، ملاحظة، خطة أو تقرير…" oninput="opsSearchRender(this.value)"><button onclick="opsCloseOverlay('opsSearchOverlay')">✕</button></div><div id="opsSearchResults"><div class="empty">ابدأ بالكتابة.</div></div></div>`;e.classList.remove('hidden');setTimeout(()=>$('#opsGlobalSearchInput')?.focus(),40)}
function opsSearchRender(q=''){let n=normalizeNameJs(String(q).trim()),box=$('#opsSearchResults');if(!box)return;if(!n)return box.innerHTML='<div class="empty">ابدأ بالكتابة.</div>';let r=[];activeStudents().forEach(st=>{if(normalizeNameJs(`${st.full_name} ${st.notes||''} ${st.program_name||''}`).includes(n)){let last=opsStudentRecitations(st.id)[0];r.push(['طالب',st.full_name,`آخر تسميع: ${last?opsRangeText(last):'—'} · ${opsPlanBundle(st).label}`,`opsSearchOpenStudent('${st.id}')`])}});state.sessions.forEach(s=>{if(normalizeNameJs(`${s.title||''} ${s.session_date} ${sesAr[s.session_type]||''}`).includes(n))r.push(['جلسة',s.title||sesAr[s.session_type],s.session_date,`opsSearchOpenSession('${s.id}')`])});state.opsNotes.forEach(x=>{let t=`${x.teacher_comment||''} ${x.homework||''}`;if(normalizeNameJs(t).includes(n)){let st=state.students.find(s=>s.id===x.student_id);if(st)r.push(['ملاحظة',st.full_name,t.slice(0,100),`opsSearchOpenStudent('${st.id}')`])}});(state.smartPlans||[]).forEach(p=>{let st=state.students.find(s=>s.id===p.student_id);if(normalizeNameJs(`${p.title} ${p.note||''} ${st?.full_name||''}`).includes(n))r.push(['خطة',p.title,st?.full_name||'خطة جماعية',`opsSearchOpenPlan('${p.id}')`])});if(n.includes('تقرير'))r.push(['اختصار','استوديو التقارير','التقارير والمقارنات',"opsCloseOverlay('opsSearchOverlay');go('reports')"]);box.innerHTML=`<div class="ops-search-results">${r.slice(0,40).map(x=>`<button onclick="${x[3]}"><em>${x[0]}</em><span><b>${esc(x[1])}</b><small>${esc(x[2])}</small></span></button>`).join('')||'<div class="empty">لا توجد نتائج.</div>'}</div>`}
function opsSearchOpenStudent(id){opsCloseOverlay('opsSearchOverlay');studentProfile(id)}
async function opsSearchOpenSession(id){opsCloseOverlay('opsSearchOverlay');state.page='sessions';state.sessionView=id;await openSessionRoster(id)}
function opsSearchOpenPlan(id){opsCloseOverlay('opsSearchOverlay');let p=state.smartPlans.find(x=>x.id===id);state.smartPlanSearch=p?.student_id?state.students.find(s=>s.id===p.student_id)?.full_name||'':'';go('plans')}

function opsShowUndo(msg,fn,ms=OPS_DELETE_UNDO_MS){$('#opsUndoBar')?.remove();let e=document.createElement('div');e.id='opsUndoBar';e.className='ops-undo';e.innerHTML=`<span>${esc(msg)}</span><button>تراجع</button>`;document.body.appendChild(e);let live=true,t=setTimeout(()=>{live=false;e.remove()},ms);e.querySelector('button').onclick=()=>{if(!live)return;live=false;clearTimeout(t);e.remove();fn?.()}}
const opsBaseRemoveStudent=removeStudent; removeStudent=async function(id){let st=state.students.find(x=>x.id===id),was=st?.status;await opsBaseRemoveStudent(id);let now=state.students.find(x=>x.id===id);if(st&&was!=='withdrawn'&&now?.status==='withdrawn'){opsAudit('student.withdrawn','student',id,{name:st.full_name});opsShowUndo(`تمت إزالة ${st.full_name}.`,()=>restoreStudent(id),20000)}};
async function opsFinalizeSessionDelete(id){let se=state.sessions.find(x=>String(x.id)===String(id));if(!se)return;delete state.opsPendingSessionDeletes[id];let local=isLocalSessionId(id);if(local||!navigator.onLine||state.offline){removeSessionFromDevice(id,{queueServerDelete:!local});clearDeletedSessionDerivedState();opsAudit('session.deleted','session',id,{offline:true});render();return}try{let {data,error}=await db.from('sessions').delete().eq('id',id).select('id');if(error)throw error;if(!data?.length)throw new Error('لم تسمح الصلاحيات بالحذف');removeSessionFromDevice(id);clearDeletedSessionDerivedState();opsAudit('session.deleted','session',id,{});await loadAll();render()}catch(e){toast('تعذر حذف الجلسة: '+e.message)}}
const opsBaseCancelSession=cancelSession; cancelSession=function(id){if(!roleCanManage())return;let se=state.sessions.find(x=>String(x.id)===String(id));if(!se)return;if(state.opsPendingSessionDeletes[id])return toast('الحذف معلّق');if(!confirm(`حذف جلسة «${se.title||'الجلسة'}»؟ يمكنك التراجع خلال 15 ثانية.`))return;let t=setTimeout(()=>opsFinalizeSessionDelete(id),OPS_DELETE_UNDO_MS);state.opsPendingSessionDeletes[id]={timer:t};opsShowUndo('تم جدولة حذف الجلسة.',()=>{clearTimeout(t);delete state.opsPendingSessionDeletes[id];toast('تم إلغاء الحذف')},OPS_DELETE_UNDO_MS)};

function opsReportSignature(d){return [d.student_id,d.session_id,d.activity_type,d.start_surah||'',d.start_ayah||'',d.end_surah||'',d.end_ayah||'',Number(d.start_page||0).toFixed(2),Number(d.end_page||0).toFixed(2),Number(d.pages_count||0).toFixed(2)].join('|')}
function opsValidateReportForm(){let sid=$('#rpStudent')?.value,seId=$('#rpSession')?.value,se=state.sessions.find(x=>String(x.id)===String(seId)),rows=$$('.rec-row').map(x=>({student_id:sid,session_id:seId,activity_type:x.querySelector('.rType')?.value,start_surah:+x.dataset.startSurah||null,start_ayah:+x.dataset.startAyah||null,end_surah:+x.dataset.endSurah||null,end_ayah:+x.dataset.endAyah||null,start_page:+x.dataset.startPage||null,end_page:+x.dataset.endPage||null,pages_count:+x.dataset.pages||0}));if(rows.some(x=>x.pages_count>80)){toast('رفض الحفظ: أكثر من 80 صفحة في بند واحد.');return false}if(rows.some(x=>x.pages_count>40)&&!confirm('هناك تسميع أكبر من 40 صفحة. هل القيمة صحيحة؟'))return false;let sig=new Set(opsAllRecitations().filter(r=>String(r.student_id)===String(sid)&&String(r.session_id)===String(seId)).map(opsReportSignature));if(!(state.reportExistingRecIds||[]).length&&rows.some(x=>sig.has(opsReportSignature(x)))){toast('تم اكتشاف تسميع مطابق مسجل مسبقًا.');return false}if(se?.session_date&&opsDateDiff(today(),se.session_date)>=7&&!confirm(`هذه جلسة قديمة بتاريخ ${se.session_date}. متابعة؟`))return false;return true}
document.getElementById('reportForm')?.addEventListener('submit',e=>{if(!opsValidateReportForm()){e.preventDefault();e.stopImmediatePropagation()}},true);

async function opsAudit(action,type,id,details={}){let row={id:offlineUuid(),halaqa_id:details.halaqa_id||state.students.find(s=>String(s.id)===String(id))?.halaqa_id||state.sessions.find(s=>String(s.id)===String(id))?.halaqa_id||null,actor_id:state.user?.id||null,action,entity_type:type||'app',entity_id:id?String(id):null,details:{...details,app_version:APP_VERSION_NAME},created_at:new Date().toISOString()};state.opsAudit.unshift(row);state.opsAudit=state.opsAudit.slice(0,500);try{localStorage.setItem(`halaqati_ops_audit_${state.user?.id||'guest'}`,JSON.stringify(state.opsAudit.slice(0,200)))}catch(e){}if(state.demo||!state.networkVerified||state.offline||state.opsAuditAvailable===false)return;try{let {error}=await db.from('halaqati_audit_log').insert(row);if(error&&['42P01','PGRST205'].includes(String(error.code)))state.opsAuditAvailable=false}catch(e){}}
const opsBaseSaveReportOffline=saveReportOffline; saveReportOffline=function(p){let x=opsBaseSaveReportOffline(p);state.opsMetricVersion++;opsAudit('report.saved','student',p.studentId,{session_id:p.sessionId,pages:(p.rows||[]).reduce((s,r)=>s+Number(r.data?.pages_count||0),0)});return x};
const opsBaseSaveMasterLocal=saveMasterLocal; saveMasterLocal=async function(entity,id,obj,opt){let x=await opsBaseSaveMasterLocal(entity,id,obj,opt);state.opsMetricVersion++;opsAudit(`${entity}.saved`,entity,id,{fields:Object.keys(obj||{})});return x};
const opsBaseSaveSmartPlanLocal=saveSmartPlanLocal; saveSmartPlanLocal=function(p,o){let x=opsBaseSaveSmartPlanLocal(p,o);state.opsMetricVersion++;opsAudit('smart_plan.saved','smart_plan',p.id,{student_id:p.student_id,plan_type:p.plan_type,halaqa_id:p.halaqa_id});return x};

const OPS_BACKUP_TABLES=['halaqas','student_categories','students','halaqa_teachers','halaqa_supervisors','sessions','attendance_records','student_daily_notes','recitation_entries','student_goals','monthly_comments','smart_plans','smart_plan_events','announcements','forum_posts','forum_comments','student_points','app_settings'];
async function opsBackupTable(t){let {data,error}=await db.from(t).select('*').limit(20000);if(error)throw new Error(`${t}: ${error.message}`);return data||[]}
async function exportHalaqatiBackup(){if(!roleCanManage())return;if(!navigator.onLine||!state.networkVerified)return toast('النسخة الكاملة تحتاج الإنترنت');let p={format:'halaqati-backup',version:2,app_version:APP_VERSION_NAME,exported_at:new Date().toISOString(),tables:{}};try{toast('جارٍ إنشاء النسخة الاحتياطية…');for(let t of OPS_BACKUP_TABLES)p.tables[t]=await opsBackupTable(t);downloadBlob(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),`Halaqati_Backup_${today()}_${APP_VERSION_NAME}.json`);opsAudit('backup.exported','app',null,{});toast('تم إنشاء النسخة الاحتياطية')}catch(e){toast('فشل النسخ: '+e.message)}}
function chooseHalaqatiBackup(){if(!isOwner())return toast('الاسترجاع لمسؤول النظام فقط');let i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=async()=>{try{await restoreHalaqatiBackup(JSON.parse(await i.files[0].text()))}catch(e){toast('ملف غير صالح: '+e.message)}};i.click()}
async function opsUpsert(t,rows,key='id'){for(let i=0;i<(rows||[]).length;i+=200){let {error}=await db.from(t).upsert(rows.slice(i,i+200),{onConflict:key});if(error)throw new Error(`${t}: ${error.message}`)}}
async function restoreHalaqatiBackup(p){if(!isOwner()||p?.format!=='halaqati-backup')return;if(!navigator.onLine)return toast('الاسترجاع يحتاج الإنترنت');if(!confirm('سيتم دمج بيانات النسخة مع الحالية. كلمات المرور وحسابات Auth غير مشمولة. متابعة؟')||!confirm('تأكيد أخير للاسترجاع؟'))return;let order=[['halaqas','id'],['student_categories','id'],['students','id'],['halaqa_teachers','halaqa_id,teacher_id'],['halaqa_supervisors','halaqa_id,supervisor_id'],['sessions','id'],['attendance_records','id'],['student_daily_notes','id'],['recitation_entries','id'],['student_goals','id'],['monthly_comments','id'],['smart_plans','id'],['smart_plan_events','id'],['announcements','id'],['forum_posts','id'],['forum_comments','id'],['student_points','id'],['app_settings','id']];try{for(let x of order)await opsUpsert(x[0],p.tables?.[x[0]]||[],x[1]);opsAudit('backup.restored','app',null,{source:p.app_version});await loadAll(true);render();toast('تم الاسترجاع بنجاح')}catch(e){toast('توقف الاسترجاع: '+e.message)}}
function opsAuditHtml(){let rows=state.opsAudit.slice(0,50);return `<div class="card"><div class="section-head"><h3>سجل التعديلات</h3><span class="badge">${rows.length}</span></div><div class="ops-audit-list">${rows.map(r=>`<div><b>${esc(r.action)}</b><span>${esc(r.entity_type)} · ${esc(r.entity_id||'—')}</span><small>${String(r.created_at).replace('T',' ').slice(0,16)}</small></div>`).join('')||'<span class="muted">لا توجد تعديلات بعد.</span>'}</div></div>`}
const opsBaseSettingsPage=settingsPage; settingsPage=function(){let b=opsBaseSettingsPage();return b+(roleCanManage()?`<div class="card"><h3>النسخ الاحتياطي والحماية</h3><div class="muted">ملف واحد للطلاب والخطط والجلسات والتسميعات والحضور والإعدادات. لا يتضمن كلمات المرور.</div><div class="actions" style="margin-top:12px"><button class="btn btn-primary" onclick="exportHalaqatiBackup()">تصدير نسخة احتياطية</button>${isOwner()?'<button class="btn" onclick="chooseHalaqatiBackup()">استرجاع نسخة</button>':''}</div></div>${opsAuditHtml()}`:'')};

async function opsLoadOperationalData(force=false){if(state.demo||!state.user||!state.networkVerified||state.offline)return;if(!force&&state.opsLoadedAt&&Date.now()-state.opsLoadedAt<OPS_CACHE_TTL)return;state.opsLoading=true;try{let from=opsDateDaysAgo(OPS_LOOKBACK_DAYS),[a,n]=await Promise.all([db.from('attendance_records').select('id,session_id,student_id,status,excuse_reason,arrival_minutes_late,recorded_by,recorded_at,sessions!inner(session_date,halaqa_id)').gte('sessions.session_date',from).order('recorded_at',{ascending:false}).limit(10000),db.from('student_daily_notes').select('id,session_id,student_id,behavior,behavior_score,teacher_comment,private_comment,homework,parent_visible,created_by,created_at,activity_score,activity_max_score,participation,sessions!inner(session_date,halaqa_id)').gte('sessions.session_date',from).order('created_at',{ascending:false}).limit(10000)]);if(!a.error)state.opsAttendance=a.data||[];if(!n.error)state.opsNotes=n.data||[];try{let au=await db.from('halaqati_audit_log').select('*').order('created_at',{ascending:false}).limit(200);if(au.error){if(['42P01','PGRST205'].includes(String(au.error.code)))state.opsAuditAvailable=false}else state.opsAudit=au.data||state.opsAudit}catch(e){}state.opsLoadedAt=Date.now();state.opsMetricVersion++;cacheSnapshot()}finally{state.opsLoading=false}}
const opsBaseCacheSnapshot=cacheSnapshot; cacheSnapshot=function(){opsBaseCacheSnapshot();let k=cacheKey();if(!k)return;try{let x=readJsonLocal(k,null);if(x){x.ops={attendance:state.opsAttendance,notes:state.opsNotes,audit:state.opsAudit.slice(0,200),loadedAt:state.opsLoadedAt,track:state.opsProgramTrack};localStorage.setItem(k,JSON.stringify(x));state.offlineSnapshotCache=cloneJson(x)}}catch(e){}};
const opsBaseRestoreSnapshot=restoreSnapshot; restoreSnapshot=function(){let ok=opsBaseRestoreSnapshot();if(ok)try{let x=state.offlineSnapshotCache||readJsonLocal(cacheKey(),null),o=x?.ops||{};state.opsAttendance=o.attendance||[];state.opsNotes=o.notes||[];state.opsAudit=o.audit||readJsonLocal(`halaqati_ops_audit_${state.user?.id||'guest'}`,[])||[];state.opsLoadedAt=o.loadedAt||0;state.opsProgramTrack=o.track==='tathbit'?'tathbit':'general_hifz'}catch(e){}return ok};
const opsBaseLoadAll=loadAll; loadAll=async function(force=false){let x=await opsBaseLoadAll(force);await opsLoadOperationalData(force);return x};
const opsBaseRender=render; render=async function(){let x=await opsBaseRender();opsSearchEnsureButton();return x};
window.addEventListener('halaqati:ready',()=>{opsSearchEnsureButton()},{once:true});

/* Track isolation for the smart-plan dashboard without changing the underlying two-plan engine. */
state.opsMetricVersion=state.opsMetricVersion||0;
const opsBasePlansPage=plansPage;
plansPage=function(){if(state.profile?.role==='guardian')return opsBasePlansPage();let baseActive=activeStudents;activeStudents=function(){return baseActive().filter(s=>opsStudentInTrack(s))};try{return opsTrackSegment()+opsBasePlansPage()}finally{activeStudents=baseActive}};
const opsRawSignals=opsStudentSignals; let opsSignalsMemo={key:'',map:new Map()};
opsStudentSignals=function(st){let key=`${today()}|${state.opsMetricVersion}|${state.opsAttendance.length}|${opsAllRecitations().length}|${state.smartPlans?.length||0}`;if(opsSignalsMemo.key!==key){opsSignalsMemo={key,map:new Map()}}if(!opsSignalsMemo.map.has(st.id))opsSignalsMemo.map.set(st.id,opsRawSignals(st));return opsSignalsMemo.map.get(st.id)};
function opsSkeleton(){return `<div class="ops-skeleton"><i></i><i></i><i></i><i></i></div>`}
const opsDashboardHomeRaw=opsDashboardHome; opsDashboardHome=function(){return state.opsLoading?`<div class="hero"><h2>لوحة اليوم</h2><p>جارٍ تحديث مؤشرات الحلقة…</p></div>${opsSkeleton()}`:opsDashboardHomeRaw()};
function opsPeriodReportReady(){let d=new Date(),last=Number(monthEnd(today().slice(0,7)).slice(-2)),day=d.getDay(),date=d.getDate();return day===5||date>=last-2}
const opsDashboardWithReport=opsDashboardHome; opsDashboardHome=function(){let h=opsDashboardWithReport();return h+(opsPeriodReportReady()?`<div class="notice ops-parent-ready"><b>تقارير أولياء الأمور جاهزة</b><br>يمكنك إنشاء بطاقات الأسبوع/الشهر مباشرة من <button class="mini" onclick="openParentReportsCenter()">مركز التقارير</button>.</div>`:'')};


/* Halaqati v2.19.1 — Performance & UX hotfix
   - scheduled-day aware dashboard
   - explicit ayah ranges
   - fast/clear quick memorization
   - warmer/faster parent exports
   - per-render memoization + indexed local reads
   - immediate navigation feedback
*/
state.opsMetricVersion=state.opsMetricVersion||0;
state.opsQuick=state.opsQuick||{sessionId:null,index:0,mistakes:0,prompts:0,attendance:'present'};
state.opsQuick.absenceReason=state.opsQuick.absenceReason||'';

function opsAssignmentKind(a){return {hifz:'حفظ',review:'مراجعة',sard:'سرد',tathbit:'تثبيت',test:'اختبار مرحلي'}[a?.kind]||'مقرر'}
function opsAssignmentText(a){
  if(!a)return 'لا يوجد مقرر اليوم';
  let kind=opsAssignmentKind(a),segs=Array.isArray(a.ayahSegments)?a.ayahSegments.filter(Boolean):[];
  if(segs.length){
    let txt=segs.map(seg=>{
      let name=surahs[Number(seg.surah)-1]||`السورة ${seg.surah}`,
          from=Number(seg.startAyah),to=Number(seg.endAyah??seg.startAyah);
      return `سورة ${name} من آية ${fmt(from)} إلى آية ${fmt(to)}`
    }).join('، ثم ');
    return `${kind}: ${txt}`
  }
  let ss=Number(a.start_surah||a.startSurah),sa=Number(a.start_ayah||a.startAyah),es=Number(a.end_surah||a.endSurah||ss),ea=Number(a.end_ayah||a.endAyah||sa);
  if(ss&&sa){
    let s1=surahs[ss-1]||`السورة ${ss}`,s2=surahs[es-1]||`السورة ${es}`;
    return ss===es?`${kind}: سورة ${s1} من آية ${fmt(sa)} إلى آية ${fmt(ea)}`:`${kind}: سورة ${s1} من آية ${fmt(sa)} إلى سورة ${s2} آية ${fmt(ea)}`
  }
  if(a.startPage||a.start_page){let sp=Number(a.startPage||a.start_page),ep=Number(a.endPage||a.end_page||sp);return `${kind}: ${sp===ep?`صفحة ${fmt(sp)}`:`من صفحة ${fmt(sp)} إلى صفحة ${fmt(ep)}`}`}
  return `${kind}: ${fmt(a.pages||a.dailyTarget||0)} صفحة`
}
const opsV2191PlanBundleBase=opsPlanBundle;
opsPlanBundle=function(st,date=today()){
  let b=opsV2191PlanBundleBase(st,date);
  return {...b,label:b?.assignment?opsAssignmentText(b.assignment):b?.label||'لا توجد خطة فعالة'}
};

function opsPlanDueToday(st,date=today()){
  let b=opsPlanBundle(st,date),p=b.plan,a=b.assignment;
  if(!p||p.status!=='active'||!a)return false;
  if(p.start_date&&date<p.start_date||p.end_date&&date>p.end_date)return false;
  let day=new Date(`${date}T12:00:00`).getDay(),schedule=(p.schedule_weekdays||[]).map(Number),catchUp=p.catch_up_weekday===null||p.catch_up_weekday===undefined?null:Number(p.catch_up_weekday);
  let regular=schedule.includes(day)&&day!==catchUp;
  let catchDue=catchUp===day&&(Number(b.progress?.deficit||b.progress?.behindBy||0)>0||!!a.blockedByRetry);
  let amount=Number(a.pages||a.dailyTarget||a.targetPages||0),hasDuty=amount>0.001||!!a.blockedByRetry||!!a.milestone;
  return hasDuty&&(regular||catchDue)
}

/* One local index per data revision instead of filtering/sorting all recitations for every student. */
let opsV2191Index={key:'',rec:new Map(),att:new Map(),notes:new Map()};
function opsV2191PerfKey(){
  return [state.opsMetricVersion||0,state.opsLoadedAt||0,(state.sessions||[]).length,(state.smartPlans||[]).length,(state.smartPlanRecitations||[]).length,(state.opsAttendance||[]).length,(state.opsNotes||[]).length,(state.sessionRoster?.recitations||[]).length,Object.keys(state.offlineRosterCache||{}).length].join('|')
}
function opsV2191DataIndex(){
  let key=opsV2191PerfKey();if(opsV2191Index.key===key)return opsV2191Index;
  let rec=new Map(),att=new Map(),notes=new Map(),put=(m,row)=>{let k=String(row?.student_id||'');if(!k)return;(m.get(k)||m.set(k,[]).get(k)).push(row)};
  for(let r of opsAllRecitations())put(rec,r);for(let r of state.opsAttendance||[])put(att,r);for(let r of state.opsNotes||[])put(notes,r);
  let sort=x=>x.sort((a,b)=>String(opsSessionDate(b)).localeCompare(String(opsSessionDate(a)))||String(b.created_at||b.recorded_at||'').localeCompare(String(a.created_at||a.recorded_at||'')));
  rec.forEach(sort);att.forEach(sort);notes.forEach(sort);opsV2191Index={key,rec,att,notes};return opsV2191Index
}
opsStudentRecitations=function(id){return opsV2191DataIndex().rec.get(String(id))||[]};
opsStudentAttendance=function(id){return opsV2191DataIndex().att.get(String(id))||[]};
opsStudentNotes=function(id){return opsV2191DataIndex().notes.get(String(id))||[]};
opsStudentSignals=function(st){
  let key=`${today()}|${opsV2191PerfKey()}`;
  if(opsSignalsMemo.key!==key)opsSignalsMemo={key,map:new Map()};
  if(!opsSignalsMemo.map.has(st.id))opsSignalsMemo.map.set(st.id,opsRawSignals(st));
  return opsSignalsMemo.map.get(st.id)
};

function opsV2191WithPlanMemo(fn){
  let own=typeof smartPlanRenderMemo!=='undefined'&&!smartPlanRenderMemo.active;
  if(own)beginSmartPlanRenderMemo();
  try{return fn()}finally{if(own)endSmartPlanRenderMemo()}
}
const opsV2191DashboardBase=opsDashboardHome;
opsDashboardHome=function(){return opsV2191WithPlanMemo(()=>opsV2191DashboardBase())};
const opsV2191SupervisionBase=supervisionPage;
supervisionPage=function(){return opsV2191WithPlanMemo(()=>opsV2191SupervisionBase())};
const opsV2191ProfileHtmlBase=opsStudentProfileHtml;
opsStudentProfileHtml=function(st){return opsV2191WithPlanMemo(()=>opsV2191ProfileHtmlBase(st))};

/* Do not call every student "not recited" on a non-teaching day. */
opsDailyOverview=function(){
  let sts=opsTrackStudents(),date=today(),due=sts.filter(st=>opsPlanDueToday(st,date)),ids=new Set(sts.map(s=>String(s.id))),dueIds=new Set(due.map(s=>String(s.id))),recs=opsAllRecitations().filter(r=>ids.has(String(r.student_id))&&opsSessionDate(r)===date),recited=new Set(recs.map(r=>String(r.student_id))),atts=(state.opsAttendance||[]).filter(a=>ids.has(String(a.student_id))&&opsSessionDate(a)===date),absIds=new Set(atts.filter(a=>['absent','excused'].includes(a.status)).map(a=>String(a.student_id))),signals=sts.map(opsStudentSignals);
  return {scheduled:due.length,notRecited:due.filter(s=>dueIds.has(String(s.id))&&!recited.has(String(s.id))&&!absIds.has(String(s.id))),absent:sts.filter(s=>absIds.has(String(s.id))),behind:signals.filter(x=>x.behind),review:signals.filter(x=>x.needsReview),exceeded:signals.filter(x=>x.exceeded)}
};
const opsV2191DashboardMarkupBase=opsDashboardHome;
opsDashboardHome=function(){return opsV2191WithPlanMemo(()=>{
  let html=opsV2191DashboardMarkupBase(),d=opsDailyOverview();
  if(!d.scheduled)html=html.replace(/<section class="ops-kpi danger"><b>0<\/b><span>لم يسمّع اليوم<\/span>[\s\S]*?<\/section>/,`<section class="ops-kpi neutral"><b>0</b><span>لا يوجد تسميع مقرر اليوم</span><div class="ops-empty-inline">حسب أيام الخطط الذكية الحالية</div></section>`);
  return html
})};

/* Fast session actions: visible tap feedback first, then work. */
function opsActionBusy(label='جارٍ الفتح…'){toast(label);document.body.classList.add('ops-action-busy');setTimeout(()=>document.body.classList.remove('ops-action-busy'),500)}
startTodaySession=async function(){
  if(!roleCanManage())return toast('لا تملك صلاحية فتح جلسة');
  opsActionBusy('جارٍ فتح جلسة اليوم…');
  try{
    let se=await ensureTodaySession();if(!se)return;
    state.page='sessions';state.sessionView=se.id;prepareSessionForOfflineWork?.(se.id);
    state.sessionRoster=cloneJson(state.offlineRosterCache[se.id]||{attendance:[],notes:[],recitations:[]});
    render();
    if(!isLocalSessionId(se.id)&&state.networkVerified&&!state.offline&&navigator.onLine){loadSessionRosterData(se.id).then(()=>{if(state.page==='sessions'&&String(state.sessionView)===String(se.id))render()}).catch(e=>console.warn('today session background refresh',e))}
  }catch(e){console.error(e);toast('تعذر فتح جلسة اليوم: '+(e?.message||e))}
};
openQuickMemorization=async function(){
  if(!roleCanManage())return toast('لا تملك صلاحية التسميع السريع');
  opsActionBusy('جارٍ تجهيز التحفيظ السريع…');
  try{
    let se=await ensureTodaySession();if(!se)return;
    state.opsQuick={sessionId:se.id,index:0,mistakes:0,prompts:0,attendance:'present',absenceReason:''};state.sessionView=se.id;
    state.sessionRoster=cloneJson(state.offlineRosterCache[se.id]||{attendance:[],notes:[],recitations:[]});
    opsQuickRender();
    if(!isLocalSessionId(se.id)&&state.networkVerified&&!state.offline&&navigator.onLine){loadSessionRosterData(se.id).then(()=>{if(!document.getElementById('opsQuickOverlay')?.classList.contains('hidden'))opsQuickRender()}).catch(e=>console.warn('quick mode background refresh',e))}
  }catch(e){console.error(e);toast('تعذر فتح التحفيظ السريع: '+(e?.message||e))}
};

opsQuickSetAttendance=function(v){state.opsQuick.attendance=['present','excused','absent'].includes(v)?v:'present';state.opsQuick.absenceReason=v==='excused'?'غياب بعذر':v==='absent'?'غياب بدون عذر':'';opsQuickRender()};
opsQuickMove=function(d){state.opsQuick.index=Math.max(0,state.opsQuick.index+Number(d||0));state.opsQuick.mistakes=0;state.opsQuick.prompts=0;state.opsQuick.attendance='present';state.opsQuick.absenceReason='';opsQuickRender()};
opsQuickRender=function(){
  let e=opsEnsureOverlay('opsQuickOverlay'),rows=opsQuickStudents();
  if(!rows.length){e.innerHTML='<div class="ops-overlay-shell"><div class="empty">لا يوجد طلاب في هذا المسار.</div><button class="btn" type="button" onclick="opsCloseOverlay(\'opsQuickOverlay\')">إغلاق</button></div>';e.classList.remove('hidden');return}
  state.opsQuick.index=Math.max(0,Math.min(rows.length-1,state.opsQuick.index||0));let st=rows[state.opsQuick.index],p=opsPlanBundle(st),done=opsAllRecitations().some(r=>String(r.student_id)===String(st.id)&&opsSessionDate(r)===today()),sig=opsStudentSignals(st),present=state.opsQuick.attendance==='present';
  e.innerHTML=`<div class="ops-quick-shell"><div class="ops-quick-top"><button type="button" aria-label="إغلاق" onclick="opsCloseOverlay('opsQuickOverlay')">✕</button><b>التحفيظ السريع · ${state.opsQuick.index+1}/${rows.length}</b><span>${opsTrackLabel()}</span></div><div class="ops-quick-student"><span class="ops-quick-status ${done?'done':''}" aria-live="polite">${done?'✓ تمّ التسميع اليوم':esc(sig.reasons[0]||'جاهز للتسميع')}</span><h1>${esc(st.full_name)}</h1><div class="ops-quick-duty">${esc(p.label)}</div></div><div class="ops-att-toggle ops-att-three"><button type="button" class="${present?'active':''}" onclick="opsQuickSetAttendance('present')">✓ حاضر</button><button type="button" class="${state.opsQuick.attendance==='excused'?'active warn':''}" onclick="opsQuickSetAttendance('excused')">غائب بعذر</button><button type="button" class="${state.opsQuick.attendance==='absent'?'active danger':''}" onclick="opsQuickSetAttendance('absent')">غائب بدون عذر</button></div>${present?`<div class="ops-counters"><div><span>الأخطاء</span><button type="button" aria-label="إنقاص الأخطاء" onclick="opsQuickAdjust('mistakes',-1)">−</button><b>${state.opsQuick.mistakes}</b><button type="button" aria-label="زيادة الأخطاء" onclick="opsQuickAdjust('mistakes',1)">+</button></div><div><span>النقرات</span><button type="button" aria-label="إنقاص النقرات" onclick="opsQuickAdjust('prompts',-1)">−</button><b>${state.opsQuick.prompts}</b><button type="button" aria-label="زيادة النقرات" onclick="opsQuickAdjust('prompts',1)">+</button></div></div>`:`<div class="notice">${state.opsQuick.attendance==='excused'?'سيُسجل غائبًا بعذر.':'سيُسجل غائبًا بدون عذر.'} ويعيد المحرك الذكي توزيع المطلوب تلقائيًا.</div>`}<div class="ops-quick-actions"><button class="btn" type="button" onclick="opsQuickMove(-1)" ${state.opsQuick.index===0?'disabled':''}>السابق</button><button class="btn btn-primary ops-recited-confirm" type="button" onclick="opsQuickSave('${st.id}')">${done?'✓ مسمّع اليوم':present?'✓ تمّ التسميع وحفظ':'حفظ الغياب والتالي'}</button><button class="btn" type="button" onclick="opsQuickMove(1)" ${state.opsQuick.index===rows.length-1?'disabled':''}>التالي</button></div><button class="btn btn-ghost" type="button" onclick="opsQuickOpenDetails('${st.id}')">نموذج التسميع الكامل</button></div>`;e.classList.remove('hidden')
};
const opsV2191QuickSaveBase=opsQuickSave;
opsQuickSave=async function(id){
  if(state.opsQuick.attendance==='present')return opsV2191QuickSaveBase(id);
  let st=state.students.find(x=>String(x.id)===String(id)),se=state.sessions.find(x=>String(x.id)===String(state.opsQuick.sessionId));if(!st||!se)return;
  let attendance={session_id:se.id,student_id:id,status:state.opsQuick.attendance,excuse_reason:state.opsQuick.attendance==='excused'?(state.opsQuick.absenceReason||'غياب بعذر'):null,recorded_by:state.user.id},note={session_id:se.id,student_id:id,behavior:'normal',behavior_score:3,teacher_comment:null,homework:null,parent_visible:true,created_by:state.user.id};
  saveReportOffline({sessionId:se.id,studentId:id,attendance,note,rows:[],existingRecIds:[]});state.opsQuick.mistakes=0;state.opsQuick.prompts=0;state.opsQuick.attendance='present';state.opsQuick.absenceReason='';state.opsQuick.index=Math.min(state.opsQuick.index+1,Math.max(0,opsQuickStudents().length-1));opsQuickRender()
};

/* Preload heavy export libraries while the user is reading the card and reuse the rendered card. */
state.opsParentOpenKey=state.opsParentOpenKey||'';state.opsParentExportWarmed=state.opsParentExportWarmed||false;
function opsWarmParentExport(){
  if(state.opsParentExportWarmed)return;state.opsParentExportWarmed=true;
  let warm=()=>Promise.allSettled([window.HalaqatiLazy.ensureLib('html2canvas'),window.HalaqatiLazy.ensureLib('jspdf')]).catch(()=>{});
  if('requestIdleCallback'in window)requestIdleCallback(warm,{timeout:1200});else setTimeout(warm,250)
}
const opsV2191OpenParentBase=openParentReport;
openParentReport=function(id,period='month'){opsV2191OpenParentBase(id,period);state.opsParentOpenKey=`${id}|${period}`;opsWarmParentExport()};
opsCaptureParent=async function(id,period){
  if(state.opsParentOpenKey!==`${id}|${period}`||!$('#opsParentReportCard'))openParentReport(id,period);
  await new Promise(r=>requestAnimationFrame(r));await window.HalaqatiLazy.ensureLib('html2canvas');
  let scale=Math.min(1.35,Math.max(1,Number(window.devicePixelRatio)||1));
  return window.html2canvas($('#opsParentReportCard'),{scale,backgroundColor:'#fff',useCORS:true,logging:false,removeContainer:true})
};
exportParentReportImage=async function(id,p='month'){
  try{opsActionBusy('جارٍ تجهيز الصورة…');let c=await opsCaptureParent(id,p),b64=c.toDataURL('image/jpeg',.92).split(',')[1];await saveOrShareBase64(b64,`halaqati-parent-${id}-${p}-${today()}.jpg`,'image/jpeg')}catch(e){toast('تعذر إنشاء الصورة: '+e.message)}
};
exportParentReportPdf=async function(id,p='month'){
  try{opsActionBusy('جارٍ تجهيز PDF…');let c=await opsCaptureParent(id,p);await window.HalaqatiLazy.ensureLib('jspdf');let C=window.jspdf?.jsPDF||window.jsPDF,pdf=new C({unit:'mm',format:'a4',compress:true}),img=c.toDataURL('image/jpeg',.9),w=190,h=c.height*190/c.width;pdf.addImage(img,'JPEG',10,10,w,Math.min(277,h),undefined,'FAST');await saveOrShareBase64(pdf.output('datauristring').split(',')[1],`halaqati-parent-${id}-${p}-${today()}.pdf`,'application/pdf')}catch(e){toast('تعذر إنشاء PDF: '+e.message)}
};

/* Show instant navigation feedback instead of leaving the old page frozen while JS renders. */
const opsV2191GoBase=go;
go=function(p){
  if(p!=='sessions')state.sessionView=null;state.page=p;toggleDrawer(false);buildNav();setFab();
  let c=$('#content');if(c)c.innerHTML=opsSkeleton();
  requestAnimationFrame(()=>Promise.resolve(render()).then(()=>{let n=$('#content');if(n){n.classList.add('ops-page-enter');setTimeout(()=>n.classList.remove('ops-page-enter'),180)}}).catch(e=>{console.error(e);toast('تعذر فتح الصفحة')}))
};

/* Halaqati v2.19.2 — HQ PDF hotfix
   Keep the v2.19.1 fast preview/image path, but PDF export intentionally uses
   the original high-resolution lossless PNG pipeline. PDF quality has priority
   over export speed and must never be downgraded to JPEG/FAST compression. */
async function opsCaptureParentPdfHQ(id,period){
  if(state.opsParentOpenKey!==`${id}|${period}`||!$('#opsParentReportCard'))openParentReport(id,period);
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  await window.HalaqatiLazy.ensureLib('html2canvas');
  return window.html2canvas($('#opsParentReportCard'),{
    scale:2,
    backgroundColor:'#fff',
    useCORS:true,
    logging:false,
    removeContainer:true
  })
}
exportParentReportPdf=async function(id,p='month'){
  let c=null;
  try{
    opsActionBusy('جارٍ تجهيز PDF عالي الجودة…');
    c=await opsCaptureParentPdfHQ(id,p);
    await window.HalaqatiLazy.ensureLib('jspdf');
    let C=window.jspdf?.jsPDF||window.jsPDF,
        pdf=new C({unit:'mm',format:'a4',compress:false}),
        w=190,
        h=c.height*190/c.width,
        name=`halaqati-parent-${id}-${p}-${today()}.pdf`,
        png=window.HalaqatiPdfMemory?await window.HalaqatiPdfMemory.canvasToPngBytes(c):c.toDataURL('image/png');
    pdf.addImage(png,'PNG',10,10,w,Math.min(277,h),undefined,'NONE');
    if(window.HalaqatiPdfMemory){
      if(!(await window.HalaqatiPdfMemory.savePdfNativeChunked(pdf,name,null)))pdf.save(name)
    }else{
      await saveOrShareBase64(pdf.output('datauristring').split(',')[1],name,'application/pdf')
    }
  }catch(e){toast('تعذر إنشاء PDF: '+e.message)}
  finally{if(c){c.width=1;c.height=1}try{await window.HalaqatiPdfMemory?.yield?.()}catch(_e){}}
};



/* Halaqati v2.19.3 — Quick Memorization flow fix
   - quick mode opens immediately from Today Dashboard
   - one-screen compact mobile layout
   - only Present / Absent in the main flow; absence type is chosen in a popup
   - assignment comes strictly from the Smart Plan engine. If today is off-schedule,
     show the next scheduled Smart Plan assignment instead of inventing one ayah. */
state.opsQuick=state.opsQuick||{};
state.opsQuick.absencePicker=!!state.opsQuick.absencePicker;
state.opsQuick.plannedDate=state.opsQuick.plannedDate||null;

function opsQuickDatePlus(date,days){let d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+Number(days||0));return localDateKey(d)}
function opsQuickWeekday(date){try{return new Intl.DateTimeFormat('ar-EG-u-nu-latn',{weekday:'long'}).format(new Date(`${date}T12:00:00`))}catch{return date}}
function opsQuickAssignmentHasAmount(a){return !!a&&(Number(a.pages||a.dailyTarget||a.targetPages||0)>.001||!!a.blockedByRetry||!!a.milestone||Array.isArray(a.ayahSegments)&&a.ayahSegments.length>0)}
function opsQuickPlanBundle(st,date=today()){
  let now=opsPlanBundle(st,date);
  if(opsPlanDueToday(st,date)&&opsQuickAssignmentHasAmount(now.assignment))return {...now,dueDate:date,dueToday:true};
  /* On a rest day, preview the next real scheduled assignment generated by the same plan engine. */
  for(let i=1;i<=21;i++){
    let next=opsQuickDatePlus(date,i);
    if(!opsPlanDueToday(st,next))continue;
    let b=opsPlanBundle(st,next);
    if(opsQuickAssignmentHasAmount(b.assignment))return {...b,dueDate:next,dueToday:false}
  }
  return {...now,assignment:null,label:'لا يوجد مقرر قريب في الخطة الذكية',dueDate:null,dueToday:false}
}
function opsQuickDutyMarkup(bundle){
  if(!bundle?.assignment)return `<div class="ops-quick-duty ops-quick-duty-empty"><small>الخطة الذكية</small><strong>لا يوجد مقرر حفظ مجدول حاليًا</strong></div>`;
  let head=bundle.dueToday?'مقرر اليوم':`المقرر القادم · ${opsQuickWeekday(bundle.dueDate)} ${bundle.dueDate}`;
  return `<div class="ops-quick-duty"><small>${esc(head)}</small><strong>${esc(opsAssignmentText(bundle.assignment))}</strong></div>`
}
function opsQuickLoadingOverlay(){
  let e=opsEnsureOverlay('opsQuickOverlay');
  e.innerHTML=`<div class="ops-quick-shell ops-quick-loading"><div class="ops-quick-top"><button type="button" aria-label="إغلاق" onclick="opsCloseOverlay('opsQuickOverlay')">✕</button><b>التحفيظ السريع</b><span>${opsTrackLabel()}</span></div><div class="ops-quick-loading-body"><i></i><b>جارٍ تجهيز جلسة اليوم والمقرر الذكي…</b></div></div>`;
  e.classList.remove('hidden')
}

openQuickMemorization=async function(){
  if(!roleCanManage())return toast('لا تملك صلاحية التسميع السريع');
  opsQuickLoadingOverlay();
  try{
    let se=await ensureTodaySession();
    if(!se){opsCloseOverlay('opsQuickOverlay');return}
    state.opsQuick={sessionId:se.id,index:0,mistakes:0,prompts:0,attendance:'present',absenceReason:'',absencePicker:false,plannedDate:null};state.sessionView=se.id;
    state.sessionRoster=cloneJson(state.offlineRosterCache[se.id]||{attendance:[],notes:[],recitations:[]});
    opsQuickRender();
    if(!isLocalSessionId(se.id)&&state.networkVerified&&!state.offline&&navigator.onLine){loadSessionRosterData(se.id).then(()=>{if(!document.getElementById('opsQuickOverlay')?.classList.contains('hidden'))opsQuickRender()}).catch(e=>console.warn('quick mode background refresh',e))}
  }catch(e){console.error(e);opsCloseOverlay('opsQuickOverlay');toast('تعذر فتح التحفيظ السريع: '+(e?.message||e))}
};

opsQuickSetAttendance=function(v){
  if(v==='present'){
    state.opsQuick.attendance='present';state.opsQuick.absenceReason='';state.opsQuick.absencePicker=false;opsQuickRender();return
  }
  if(v==='absent'){state.opsQuick.absencePicker=true;opsQuickRender()}
};
function opsQuickChooseAbsence(v){
  state.opsQuick.attendance=v==='excused'?'excused':'absent';
  state.opsQuick.absenceReason=v==='excused'?'غياب بعذر':'غياب بدون عذر';
  state.opsQuick.absencePicker=false;opsQuickRender()
}
function opsQuickCancelAbsence(){state.opsQuick.absencePicker=false;opsQuickRender()}
opsQuickMove=function(d){state.opsQuick.index=Math.max(0,state.opsQuick.index+Number(d||0));state.opsQuick.mistakes=0;state.opsQuick.prompts=0;state.opsQuick.attendance='present';state.opsQuick.absenceReason='';state.opsQuick.absencePicker=false;state.opsQuick.plannedDate=null;opsQuickRender()};

opsQuickRender=function(){
  let e=opsEnsureOverlay('opsQuickOverlay'),rows=opsQuickStudents();
  if(!rows.length){e.innerHTML='<div class="ops-overlay-shell"><div class="empty">لا يوجد طلاب في هذا المسار.</div><button class="btn" type="button" onclick="opsCloseOverlay(\'opsQuickOverlay\')">إغلاق</button></div>';e.classList.remove('hidden');return}
  state.opsQuick.index=Math.max(0,Math.min(rows.length-1,state.opsQuick.index||0));
  let st=rows[state.opsQuick.index],bundle=opsQuickPlanBundle(st,today()),done=opsAllRecitations().some(r=>String(r.student_id)===String(st.id)&&opsSessionDate(r)===today()),sig=opsStudentSignals(st),present=state.opsQuick.attendance==='present',absent=!present;
  state.opsQuick.plannedDate=bundle.dueDate||null;
  let absenceLabel=state.opsQuick.attendance==='excused'?'غائب · بعذر':state.opsQuick.attendance==='absent'?'غائب · بدون عذر':'غائب';
  e.innerHTML=`<div class="ops-quick-shell"><div class="ops-quick-top"><button type="button" aria-label="إغلاق" onclick="opsCloseOverlay('opsQuickOverlay')">✕</button><b>التحفيظ السريع · ${state.opsQuick.index+1}/${rows.length}</b><span>${opsTrackLabel()}</span></div><div class="ops-quick-student"><span class="ops-quick-status ${done?'done':''}" aria-live="polite">${done?'✓ تمّ التسميع اليوم':esc(sig.reasons[0]||'جاهز للتسميع')}</span><h1>${esc(st.full_name)}</h1>${opsQuickDutyMarkup(bundle)}</div><div class="ops-att-toggle ops-att-compact"><button type="button" class="${present?'active':''}" onclick="opsQuickSetAttendance('present')">✓ حاضر</button><button type="button" class="${absent?'active danger':''}" onclick="opsQuickSetAttendance('absent')">${esc(absenceLabel)}</button></div>${present?`<div class="ops-counters ops-counters-compact"><div><span>الأخطاء</span><button type="button" aria-label="إنقاص الأخطاء" onclick="opsQuickAdjust('mistakes',-1)">−</button><b>${state.opsQuick.mistakes}</b><button type="button" aria-label="زيادة الأخطاء" onclick="opsQuickAdjust('mistakes',1)">+</button></div><div><span>النقرات</span><button type="button" aria-label="إنقاص النقرات" onclick="opsQuickAdjust('prompts',-1)">−</button><b>${state.opsQuick.prompts}</b><button type="button" aria-label="زيادة النقرات" onclick="opsQuickAdjust('prompts',1)">+</button></div></div>`:`<div class="ops-quick-absence-note">${state.opsQuick.attendance==='excused'?'سيُسجل غياب بعذر':'سيُسجل غياب بدون عذر'} · الخطة الذكية تعيد التوزيع تلقائيًا.</div>`}<div class="ops-quick-actions"><button class="btn" type="button" onclick="opsQuickMove(-1)" ${state.opsQuick.index===0?'disabled':''}>السابق</button><button class="btn btn-primary ops-recited-confirm" type="button" onclick="opsQuickSave('${st.id}')">${done?'✓ مسمّع اليوم':present?'✓ تمّ التسميع وحفظ':'حفظ الغياب والتالي'}</button><button class="btn" type="button" onclick="opsQuickMove(1)" ${state.opsQuick.index===rows.length-1?'disabled':''}>التالي</button></div><button class="btn btn-ghost ops-quick-full" type="button" onclick="opsQuickOpenDetails('${st.id}')">نموذج التسميع الكامل</button>${state.opsQuick.absencePicker?`<div class="ops-absence-backdrop" onclick="opsQuickCancelAbsence()"><div class="ops-absence-sheet" onclick="event.stopPropagation()"><b>نوع الغياب</b><button type="button" onclick="opsQuickChooseAbsence('excused')">غائب بعذر</button><button type="button" class="danger" onclick="opsQuickChooseAbsence('absent')">غائب بدون عذر</button><button type="button" class="ghost" onclick="opsQuickCancelAbsence()">إلغاء</button></div></div>`:''}</div>`;
  e.classList.remove('hidden')
};

opsQuickSave=async function(id){
  let st=state.students.find(x=>String(x.id)===String(id)),se=state.sessions.find(x=>String(x.id)===String(state.opsQuick.sessionId));if(!st||!se)return;
  if(opsAllRecitations().some(r=>String(r.student_id)===String(id)&&String(r.session_id)===String(se.id))){opsCloseOverlay('opsQuickOverlay');return openDailyForStudent(id,se.id)}
  let attendance={session_id:se.id,student_id:id,status:state.opsQuick.attendance,excuse_reason:state.opsQuick.attendance==='excused'?(state.opsQuick.absenceReason||'غياب بعذر'):null,recorded_by:state.user.id},note={session_id:se.id,student_id:id,behavior:'normal',behavior_score:3,teacher_comment:null,homework:null,parent_visible:true,created_by:state.user.id},rows=[];
  if(state.opsQuick.attendance==='present'){
    let bundle=opsQuickPlanBundle(st,se.session_date),rec=opsQuickRec(st,bundle);
    if(!rec){toast('لا يوجد مقرر ذكي قابل للتسجيل لهذا الطالب الآن.');return}
    rec.selection_data={...(rec.selection_data||{}),smart_plan_date:bundle.dueDate||se.session_date,smart_plan_actual_session_date:se.session_date,quick_mode:true};
    if(rec.pages_count>80)return toast('قيمة غير منطقية: أكثر من 80 صفحة.');rows=[{dbId:null,data:rec}]
  }
  saveReportOffline({sessionId:se.id,studentId:id,attendance,note,rows,existingRecIds:[]});
  state.opsQuick.mistakes=0;state.opsQuick.prompts=0;state.opsQuick.attendance='present';state.opsQuick.absenceReason='';state.opsQuick.absencePicker=false;state.opsQuick.plannedDate=null;state.opsQuick.index=Math.min(state.opsQuick.index+1,Math.max(0,opsQuickStudents().length-1));opsQuickRender()
};
