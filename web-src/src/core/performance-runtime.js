/* Halaqati v2.30.0 — Performance Core
   Loaded after all feature overrides and before startup.
   Goals:
   - preserve v2.20.0 behavior/UI and all previous fixes
   - first paint from cache/core data without waiting for analytics, plans, photos or ops history
   - parallelize independent Supabase reads instead of sequential feature waterfalls
   - add explicit student filters to RLS-protected high-volume reads
   - avoid repeated photo signing, duplicate loads and repeated smart-plan alert scans
   - keep HQ PDF, offline queue, V6, official Capacitor Push and native plugins untouched
*/

state.v230Hydrating=state.v230Hydrating||false;
state.v230LastFullLoadAt=state.v230LastFullLoadAt||0;
state.v230LastCoreLoadAt=state.v230LastCoreLoadAt||0;
state.v230Perf=state.v230Perf||{};

const V230_CORE_TIMEOUT=5500;
const V230_SECONDARY_TIMEOUT=7000;
let v230FullLoadPromise=null;
let v230BackgroundRefreshPromise=null;
let v230PhotoRefreshPromise=null;
const v230PhotoMeta=new Map();

function v230Now(){return typeof performance!=='undefined'&&performance.now?performance.now():Date.now()}
function v230Idle(fn,timeout=900){
  if(typeof requestIdleCallback==='function')return requestIdleCallback(()=>fn(),{timeout});
  return setTimeout(fn,Math.min(timeout,220));
}
function v230Result(row){return row?.status==='fulfilled'?row.value:null}
function v230Good(row){let x=v230Result(row);return x&&!x.error?x.data:null}
function v230NetworkFailed(row){let x=v230Result(row);return !!(x?.error&&isNetworkError(x.error))||row?.status==='rejected'&&isNetworkError(row.reason)}
function v230ApplyArray(prop,row){let d=v230Good(row);if(Array.isArray(d))state[prop]=d}
function v230Mark(name,start){state.v230Perf[name]=Math.max(0,Math.round((v230Now()-start)*10)/10)}
function v230StudentIds(){return (state.students||[]).map(x=>x?.id).filter(Boolean)}
function v230RenderIfVisible(){if($('#app')&&!$('#app').classList.contains('hidden'))return Promise.resolve(render()).catch(e=>console.warn('v2.30 background render skipped',e))}

async function v230LoadCoreData(forceNetwork=false){
  let start=v230Now(),online=forceNetwork?true:await internetReachable();
  if(!online){
    if(restoreSnapshot()){state.pendingSync=readOfflineQueue().length;applySavedTheme();updateSyncBadge();v230Mark('coreMs',start);return true}
    state.offline=true;updateSyncBadge();return false
  }
  state.networkVerified=true;state.offline=false;
  let tasks=[
    db.from('halaqas').select('*').order('created_at'),
    db.from('students').select('*').order('full_name'),
    db.from('sessions').select('*').order('session_date',{ascending:false}).limit(120),
    db.from('app_settings').select('*').eq('id',1).single(),
    db.from('student_categories').select('*').order('min_age',{ascending:true,nullsFirst:false}).order('name'),
    db.from('halaqa_teachers').select('*'),
    db.from('halaqa_supervisors').select('*')
  ];
  let rows;
  try{rows=await withTimeout(Promise.allSettled(tasks),V230_CORE_TIMEOUT,'v2.30 core timeout')}
  catch(e){
    state.networkVerified=false;state.offline=true;
    if(restoreSnapshot()){state.pendingSync=readOfflineQueue().length;updateSyncBadge();v230Mark('coreMs',start);return true}
    throw e
  }
  if(rows.slice(0,3).some(v230NetworkFailed)){
    state.networkVerified=false;state.offline=true;
    if(restoreSnapshot()){state.pendingSync=readOfflineQueue().length;updateSyncBadge();v230Mark('coreMs',start);return true}
  }
  v230ApplyArray('halaqas',rows[0]);v230ApplyArray('students',rows[1]);v230ApplyArray('sessions',rows[2]);
  let settings=v230Good(rows[3]);if(settings)state.settings=settings;
  v230ApplyArray('categories',rows[4]);v230ApplyArray('halaqaTeachers',rows[5]);v230ApplyArray('halaqaSupervisors',rows[6]);
  state.pendingSync=readOfflineQueue().length;state.v230LastCoreLoadAt=Date.now();applySavedTheme();updateSyncBadge();v230Mark('coreMs',start);return true
}

async function v230LoadDashboardData(){
  let start=v230Now(),tasks=[
    db.from('announcements').select('*').order('pinned',{ascending:false}).order('publish_at',{ascending:false}).limit(80),
    db.from('student_goals').select('*').gte('period_end',monthStart()).limit(300),
    db.from('monthly_student_stats').select('*').gte('month_start',monthStart()),
    db.from('leaderboard_daily').select('*').eq('period_date',today()),
    db.from('leaderboard_monthly').select('*').gte('month_start',monthStart()),
    db.from('daily_student_summary').select('*').eq('session_date',today()).limit(300),
    db.from('forum_posts').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(80),
    db.from('forum_comments').select('*').order('created_at').limit(500)
  ];
  if(roleCanAdmin())tasks.push(db.from('profiles').select('id,full_name,email,phone,role,requested_role,approval_status,active,approved_at,rejection_reason,created_at').order('created_at',{ascending:false}));
  let rows=await withTimeout(Promise.allSettled(tasks),V230_SECONDARY_TIMEOUT,'v2.30 dashboard timeout').catch(()=>[]);
  ['announcements','goals','monthly','leaderDaily','leaderMonthly','dailySummary','forum','comments'].forEach((p,i)=>v230ApplyArray(p,rows[i]));
  if(!state.homeSelectedMonth)state.homeSelectedMonth=today().slice(0,7);
  if(state.homeSelectedMonth===today().slice(0,7)){state.homeMonthly=[...(state.monthly||[])];state.homeMonthlyLoadedKey=state.homeSelectedMonth}
  if(roleCanAdmin()){
    let users=v230Good(rows[8]);if(Array.isArray(users)){state.users=users;state.adminUsersUpdatedAt=new Date().toISOString();state.adminUsersFromCache=false;state.adminUsersError=''}
  }else state.users=[];
  v230Mark('dashboardMs',start);return true
}

/* Replaces the v2.20 role extras loader with the same data, but child rank RPCs run in parallel. */
loadRoleExtras=async function(){
  let start=v230Now();
  state.guardianAccounts=state.guardianAccounts||[];state.guardianDirectory=state.guardianDirectory||[];state.guardianRanksMonth=state.guardianRanksMonth||{};state.guardianRanksDay=state.guardianRanksDay||{};state.guardianRangeRanks=state.guardianRangeRanks||{};state.guardianCompetition=state.guardianCompetition||{};state.guardianActivities=state.guardianActivities||{};state.guardianAnalyticsError='';
  if(!state.networkVerified){v230Mark('roleExtrasMs',start);return}
  if(roleCanManage()){
    try{let g=await withTimeout(db.rpc('list_guardian_accounts'),4500,'guardian accounts timeout');if(!g.error)state.guardianAccounts=g.data||[]}catch(e){console.warn('guardian accounts background load skipped',e)}
  }
  if(state.profile?.role==='guardian'){
    state.guardianDirectory=[];let children=activeStudents(),rankRows=await Promise.all(children.map(async st=>{
      try{let [m,d]=await Promise.all([db.rpc('student_rank_snapshot',{p_student_id:st.id,p_period:'month'}),db.rpc('student_rank_snapshot',{p_student_id:st.id,p_period:'day'})]);return {id:st.id,m:m.data||[],d:d.data||[]}}catch(e){return {id:st.id,m:[],d:[]}}
    }));
    for(let r of rankRows){state.guardianRanksMonth[r.id]=r.m;state.guardianRanksDay[r.id]=r.d}
    let ids=children.map(x=>x.id);if(ids.length){
      try{let [sr,nr]=await Promise.all([
        db.from('sessions').select('id,halaqa_id,session_date,title,session_type,activity_data').eq('session_type','lesson').order('session_date',{ascending:false}).limit(40),
        db.from('student_daily_notes').select('session_id,student_id,activity_score,activity_max_score,participation,teacher_comment,parent_visible,created_at').in('student_id',ids).eq('parent_visible',true).order('created_at',{ascending:false}).limit(160)
      ]);if(!sr.error&&!nr.error){let sm=new Map((sr.data||[]).map(x=>[String(x.id),x]));state.guardianActivities={};for(let note of nr.data||[]){let sid=String(note.student_id),session=sm.get(String(note.session_id));if(session&&!state.guardianActivities[sid])state.guardianActivities[sid]={session,note}}}}catch(e){console.warn('guardian activity summary skipped',e)}
    }
    if(typeof loadGuardianDashboardData==='function')await loadGuardianDashboardData({silent:true});
  }
  v230Mark('roleExtrasMs',start)
};

/* Keep signed URLs alive and refresh only missing/changed photos in small batches during idle time. */
async function v230RefreshPhotoUrls(){
  if(v230PhotoRefreshPromise)return v230PhotoRefreshPromise;
  v230PhotoRefreshPromise=(async()=>{
    let start=v230Now();state.photoUrls=state.photoUrls||{};if(state.demo||!state.networkVerified)return;
    let rows=(state.students||[]).filter(s=>s.photo_path&&(!state.photoUrls[s.id]||v230PhotoMeta.get(s.id)!==s.photo_path));
    for(let i=0;i<rows.length;i+=4){await Promise.all(rows.slice(i,i+4).map(async s=>{try{let {data}=await db.storage.from('student-photos').createSignedUrl(s.photo_path,3600);if(data?.signedUrl){state.photoUrls[s.id]=data.signedUrl;v230PhotoMeta.set(s.id,s.photo_path)}}catch(e){}}));await new Promise(r=>setTimeout(r,0))}
    v230Mark('photosMs',start);if(rows.length&&$('#app')&&!$('#app').classList.contains('hidden'))v230RenderIfVisible()
  })().finally(()=>{v230PhotoRefreshPromise=null});return v230PhotoRefreshPromise
}
loadPhotoUrls=async function(){v230Idle(()=>v230RefreshPhotoUrls(),1200);return state.photoUrls||{}};

/* Smart-plan facts: same semantics, much smaller payload and an explicit student filter so Postgres can use student_id/created_at indexes. */
loadSmartPlanData=async function(){
  if(!state.user?.id||!state.networkVerified)return;let start=v230Now();
  let plans=await db.from('smart_plans').select('*').order('created_at',{ascending:false}).limit(1500);
  if(plans.error){state.smartPlansAvailable=false;state.smartPlanError=plans.error.message||'';if(!smartPlanMigrationMissing(plans.error))console.warn('Smart plans unavailable',plans.error);return}
  let v217=await db.from('smart_plans').select('id,category_id').limit(1);
  if(v217.error){state.smartPlansAvailable=false;state.smartPlanError='ترحيل v2.17 غير مطبق بعد: '+(v217.error.message||'category_id غير موجود');return}
  state.smartPlansAvailable=true;state.smartPlanError='';state.smartPlans=plans.data||[];
  let planIds=state.smartPlans.map(x=>x.id),studentIds=v230StudentIds();
  let eventPromise=planIds.length?db.from('smart_plan_events').select('*').in('plan_id',planIds).order('event_date',{ascending:false}).limit(3000):Promise.resolve({data:[],error:null});
  let recQuery=db.from('recitation_entries').select('id,session_id,student_id,activity_type,start_surah,start_ayah,end_surah,end_ayah,start_page,end_page,pages_count,ayahs_count,surahs_count,mistakes,prompts,score,rating,evaluation,penalty_units,penalty_per_page,points,scoring_version,selection_data,created_at,sessions!inner(session_date,halaqa_id)').order('created_at',{ascending:false}).limit(10000);
  if(studentIds.length)recQuery=recQuery.in('student_id',studentIds);
  let [events,recitations]=await Promise.all([eventPromise,recQuery]);
  if(events.error)console.warn('Smart plan events load skipped',events.error);else state.smartPlanEvents=events.data||[];
  if(recitations.error)console.warn('Smart plan recitations load skipped',recitations.error);else state.smartPlanRecitations=(recitations.data||[]).reverse();
  await runSmartPlanAutoExtensions();
  if(state.sessionView)setTimeout(()=>injectSmartPlanSessionWidgets(state.sessionView),0);
  setTimeout(()=>checkSmartPlanAlerts(),1100);v230Mark('smartPlansMs',start)
};

/* Same operational window, explicit student filter, no nested cache write; the full pipeline commits one snapshot. */
opsLoadOperationalData=async function(force=false){
  if(state.demo||!state.user||!state.networkVerified||state.offline)return;if(!force&&state.opsLoadedAt&&Date.now()-state.opsLoadedAt<OPS_CACHE_TTL)return;
  let start=v230Now();state.opsLoading=true;
  try{
    let from=opsDateDaysAgo(OPS_LOOKBACK_DAYS),ids=v230StudentIds();
    let aq=db.from('attendance_records').select('id,session_id,student_id,status,excuse_reason,arrival_minutes_late,recorded_by,recorded_at,sessions!inner(session_date,halaqa_id)').gte('sessions.session_date',from).order('recorded_at',{ascending:false}).limit(10000);
    let nq=db.from('student_daily_notes').select('id,session_id,student_id,behavior,behavior_score,teacher_comment,private_comment,homework,parent_visible,created_by,created_at,activity_score,activity_max_score,participation,sessions!inner(session_date,halaqa_id)').gte('sessions.session_date',from).order('created_at',{ascending:false}).limit(10000);
    if(ids.length){aq=aq.in('student_id',ids);nq=nq.in('student_id',ids)}
    let [a,n]=await Promise.all([aq,nq]);if(!a.error)state.opsAttendance=a.data||[];if(!n.error)state.opsNotes=n.data||[];
    try{let au=await db.from('halaqati_audit_log').select('id,actor_id,action,entity_type,entity_id,halaqa_id,student_id,session_id,created_at,summary').order('created_at',{ascending:false}).limit(120);if(au.error){if(['42P01','PGRST205'].includes(String(au.error.code)))state.opsAuditAvailable=false}else state.opsAudit=au.data||state.opsAudit}catch(e){}
    state.opsLoadedAt=Date.now();state.opsMetricVersion++;v230Mark('operationsMs',start)
  }finally{state.opsLoading=false}
};

/* Throttle the expensive smart-plan alert scan. Source keys already dedupe notifications server-side;
   this only prevents running the same scan repeatedly while navigating/refreshing. */
const v230AlertBase=checkSmartPlanAlerts;
let v230AlertScanPromise=null;
checkSmartPlanAlerts=async function(){
  if(v230AlertScanPromise)return v230AlertScanPromise;
  let key=`halaqati_v230_alert_scan_${state.user?.id||'anon'}`,last=0;try{last=Number(localStorage.getItem(key)||0)}catch(e){}
  if(last&&Date.now()-last<20*60*1000)return;
  v230AlertScanPromise=Promise.resolve().then(()=>v230AlertBase()).then(x=>{try{localStorage.setItem(key,String(Date.now()))}catch(e){}return x}).finally(()=>{v230AlertScanPromise=null});
  return v230AlertScanPromise
};

async function v230FullLoad(forceNetwork=false,{skipCore=false}={}){
  if(v230FullLoadPromise)return v230FullLoadPromise;
  v230FullLoadPromise=(async()=>{
    let start=v230Now();state.v230Hydrating=true;
    try{
      if(!skipCore){let ok=await v230LoadCoreData(forceNetwork);if(!ok)return false}
      if(!state.networkVerified||state.offline)return false;
      /* Independent branches run together. v2.20 did these as serial stages. */
      await Promise.allSettled([v230LoadDashboardData(),loadSmartPlanData(),opsLoadOperationalData(forceNetwork),loadRoleExtras()]);
      state.pendingSync=readOfflineQueue().length;state.v230LastFullLoadAt=Date.now();applySavedTheme();cacheSnapshot();updateSyncBadge();loadPhotoUrls();v230Mark('fullLoadMs',start);return true
    }finally{state.v230Hydrating=false}
  })().finally(()=>{v230FullLoadPromise=null});return v230FullLoadPromise
}

/* Public loadAll keeps full semantics for CRUD callers, but now uses the parallel pipeline. */
loadAll=async function(forceNetwork=false){return v230FullLoad(forceNetwork)};

/* Background refresh paints core changes quickly and lets analytics/plan history finish without freezing the current screen. */
refreshFromServer=async function({renderAfter=true}={}){
  if(!state.user||!(await internetReachable(true)))return false;
  if(!(await ensureServerAuthSession({silent:true}))){state.offline=false;updateSyncBadge();return false}
  try{
    let res=await withTimeout(db.from('profiles').select('*').eq('id',state.user.id).single(),3500,'profile timeout');if(res.error)throw res.error;if(!res.data)throw new Error('profile missing');
    let wasBlocked=state.profile?.approval_status!=='approved'||!state.profile?.active;
    state.profile=res.data;saveOfflineAuth(state.user);maybePromptGoogleAccountName();if(state.profile.approval_status!=='approved'||!state.profile.active){showAccessStatus(state.profile);cacheSnapshot();return false}
    if(readOfflineQueue().length){captureSyncSessionDependencies();await syncOfflineQueue({refreshAfter:false});if(readOfflineQueue().length)return false}
    await v230LoadCoreData(true);
    let appHidden=$('#app')?.classList.contains('hidden');if(appHidden){$('#pendingPanel')?.classList.add('hidden');showApp();if(wasBlocked)toast('تم اعتماد الحساب وفتح لوحة ولي الأمر')}else if(renderAfter)await v230RenderIfVisible();
    if(!v230BackgroundRefreshPromise)v230BackgroundRefreshPromise=v230FullLoad(true,{skipCore:true}).then(()=>renderAfter?v230RenderIfVisible():null).finally(()=>{v230BackgroundRefreshPromise=null});
    return true
  }catch(e){state.networkVerified=false;state.offline=true;updateSyncBadge();return false}
};

/* First-ever login no longer waits for reports, photos, plan history and operations history before showing the app. */
boot=async function(user=null){
  state.demo=false;let u=user,verifiedInput=!!user;
  if(!u){try{let r=await withTimeout(db.auth.getSession(),650,'session timeout');u=r?.data?.session?.user||null}catch(e){u=null}}
  if(!u&&!navigator.onLine){u=readOfflineAuth();verifiedInput=false}if(!u)return;
  state.user=u;if(verifiedInput)saveOfflineAuth(u);await prepareOfflineStorageForUser(u.id);
  let cached=restoreSnapshot();
  if(cached&&state.profile){captureSyncSessionDependencies();maybePromptGoogleAccountName();if(state.profile.approval_status!=='approved'||!state.profile.active){showAccessStatus(state.profile);setTimeout(()=>refreshFromServer({renderAfter:true}),80);return}state.fastStarted=true;$('#pendingPanel').classList.add('hidden');showApp();updateSyncBadge();setTimeout(()=>refreshFromServer({renderAfter:true}),60);return}
  if(!(await internetReachable(true)))return toast('لا توجد نسخة محلية بعد. افتح التطبيق مرة واحدة مع الإنترنت لتحميل بيانات حسابك.');
  let res;try{res=await withTimeout(db.from('profiles').select('*').eq('id',u.id).single(),4000,'profile timeout')}catch(e){return toast('تعذر تحميل الحساب حالياً')}
  if(res?.error||!res?.data)return toast('تعذر تحميل الحساب');state.profile=res.data;maybePromptGoogleAccountName();if(state.profile.approval_status!=='approved'||!state.profile.active){showAccessStatus(state.profile);return}
  $('#pendingPanel').classList.add('hidden');state.opsLoading=true;
  try{let ok=await v230LoadCoreData(true);if(!ok)return toast('تعذر تحميل البيانات الأساسية حالياً');showApp();cacheSnapshot()}
  finally{state.opsLoading=false}
  v230BackgroundRefreshPromise=v230FullLoad(true,{skipCore:true}).then(()=>v230RenderIfVisible()).finally(()=>{v230BackgroundRefreshPromise=null});setTimeout(syncOfflineQueue,250)
};

/* Lightweight page rendering metrics for real-device verification without external analytics. */
const v230RenderBase=render;
render=async function(){let start=v230Now();try{return await v230RenderBase()}finally{state.v230Perf.lastRenderMs=Math.round((v230Now()-start)*10)/10;state.v230Perf.lastPage=state.page;state.v230Perf.measuredAt=new Date().toISOString()}};
window.HalaqatiPerformance={version:'2.30.0',metrics:()=>cloneJson(state.v230Perf),refresh:()=>refreshFromServer({renderAfter:true}),fullLoad:()=>loadAll(true)};
