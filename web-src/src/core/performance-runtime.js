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

const V230_CORE_TIMEOUT=20000;
const V230_SECONDARY_TIMEOUT=20000;
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

// PostgREST caps one response at 1000 rows, so lists that grow with the student count are read in pages.
// shortcut: stats views order by student_id only, so ties may repeat across pages, upgrade to a unique key if rows ever duplicate
const v230PageAll=(mk,size)=>window.HalaqatiData?window.HalaqatiData.result(mk,()=>state.user?.id,size):mk();

/* Student list = every column EXCEPT photo_path: the inline base64 photo is ~91% of the students payload (measured 562 KB of 614 KB for 65 students).
   Photos are carried over from the previous load while updated_at is unchanged and fetched lazily otherwise (v230HydrateStudentPhotos).
   A student whose photo is not known yet has NO photo_path key (unknown), which is different from photo_path:null (known: no photo). */
const V230_STUDENT_COLUMNS='id,full_name,user_id,halaqa_id,primary_teacher_id,date_of_birth,phone,guardian_phone,enrollment_date,status,notes,target_pages_weekly,target_review_pages_weekly,created_at,updated_at,guardian_email,gender,national_id,program_name,school_grade,address,category_id,track_code,withdrawn_at,withdrawn_by,donor_contact_allowed,association_id';
function v230MergeStudentPhotos(prev,next){const by=new Map((prev||[]).map(s=>[s.id,s]));return (next||[]).map(s=>{const p=by.get(s.id);return p&&'photo_path' in p&&p.updated_at===s.updated_at?{...s,photo_path:p.photo_path}:s})}
/* saving a student whose photo is still unknown must leave the column out of the update, never write null over a real photo */
function keepStudentPhoto(old){return old?('photo_path' in old?(old.photo_path||null):undefined):null}
async function v230HydrateStudentPhotos(){
  if(state.demo||!state.networkVerified)return 0;
  /* state.students may be the scoped subset; RC27.master.students holds everyone the account can see: hydrate both (same objects when not scoped) */
  const pool=()=>[...new Set([...(state.students||[]),...((typeof window!=='undefined'&&window.RC27&&window.RC27.master&&window.RC27.master.students)||[])])].filter(s=>s&&!('photo_path' in s));
  const unknown=pool();if(!unknown.length)return 0;
  const ids=[...new Set(unknown.map(s=>s.id))],r=await(ids.length<=40?db.from('students').select('id,photo_path').in('id',ids):db.from('students').select('id,photo_path').not('photo_path','is',null));
  if(!r||r.error||!Array.isArray(r.data))return 0;
  const got=new Map(r.data.map(x=>[x.id,x.photo_path||null])),want=new Set(ids);let n=0;
  for(const s of pool())if(want.has(s.id)){s.photo_path=got.has(s.id)?got.get(s.id):null;n++}
  if(n){try{v230RefreshPhotoUrls()}catch(_e){}cacheSnapshot()}
  return n
}

/* ===== delta sync begin */
/* Incremental core refresh. Needs docs/sql/2026-11-20-delta-sync.sql (rc_change_head / rc_changes_since / rc_visible_ids). Inert while those RPCs are absent
   (switched off for the session on the first "function not found") and when localStorage halaqati_delta === '0' (kill switch). Falls back to the full core load
   whenever there is no cursor, the server asks for a resync, or anything fails. */
const V230_DELTA_STATE={halaqas:'halaqas',students:'students',sessions:'sessions',halaqa_teachers:'halaqaTeachers',halaqa_supervisors:'halaqaSupervisors'};
const V230_DELTA_PK={halaqas:['id'],students:['id'],sessions:['id'],halaqa_teachers:['halaqa_id','teacher_id'],halaqa_supervisors:['halaqa_id','supervisor_id']};
const v230DeltaKey=(t,r)=>V230_DELTA_PK[t].map(c=>r[c]).join(':');
let v230DeltaAbsent=false;
function v230DeltaOn(){if(v230DeltaAbsent)return false;try{if(localStorage.getItem('halaqati_delta')==='0')return false;const a=Number(localStorage.getItem('halaqati_delta_absent_at'))||0;return !(a&&Date.now()-a<21600000)}catch(e){return true}}
function v230DeltaSetAbsent(){v230DeltaAbsent=true;try{localStorage.setItem('halaqati_delta_absent_at',String(Date.now()))}catch(e){}}
const v230DeltaCursorKey=()=>'halaqati_delta_cursor_'+(state.user&&state.user.id);
function v230DeltaMissing(e){return !!e&&(e.code==='PGRST202'||e.code==='42883'||/Could not find the function|does not exist/i.test(e.message||''))}
function v230ApplyDelta(arr,t,upserts,deletes){
  const del=new Set(deletes||[]),up=new Map((upserts||[]).map(r=>[v230DeltaKey(t,r),r])),out=[],used=new Set();
  for(const r of arr||[]){const k=v230DeltaKey(t,r);
    if(up.has(k)){used.add(k);const n=up.get(k);out.push(t==='students'?v230MergeStudentPhotos([r],[n])[0]:n);continue}
    if(!del.has(k))out.push(r)}
  for(const [k,n] of up)if(!used.has(k)&&!del.has(k))out.push(n);
  if(t==='students')out.sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'ar'));
  else if(t==='halaqas')out.sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
  else if(t==='sessions'){out.sort((a,b)=>String(b.session_date||'').localeCompare(String(a.session_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));if(out.length>120)out.length=120}
  return out
}
async function v230DeltaHead(){
  if(!v230DeltaOn()||!state.user)return null;
  const r=await db.rpc('rc_change_head');
  if(r.error){if(v230DeltaMissing(r.error))v230DeltaSetAbsent();return null}
  return Number.isFinite(Number(r.data))?Number(r.data):null
}
/* 'done' | 'need-full' | 'failed' | 'off' */
async function v230DeltaRefresh(){
  if(!v230DeltaOn()||!state.user||!state.networkVerified)return 'off';
  let raw=null;try{raw=localStorage.getItem(v230DeltaCursorKey())}catch(e){}
  if(raw===null||!(Number(raw)>=0))return 'need-full';
  const tables=Object.keys(V230_DELTA_STATE),next={};let cur=Number(raw),changed=new Set();
  for(const t of tables)next[t]=state[V230_DELTA_STATE[t]]||[];
  for(let page=0;page<10;page++){
    const r=await db.rpc('rc_changes_since',{p_cursor:cur,p_tables:tables,p_limit:2000});
    if(r.error){if(v230DeltaMissing(r.error)){v230DeltaSetAbsent();return 'off'}return 'failed'}
    const d=r.data||{};if(d.full_resync)return 'need-full';
    for(const t of tables){const u=d.upserts&&d.upserts[t],x=d.deletes&&d.deletes[t];if((u&&u.length)||(x&&x.length)){next[t]=v230ApplyDelta(next[t],t,u,x);changed.add(t)}}
    if(!Number.isFinite(Number(d.cursor)))return 'failed';cur=Number(d.cursor);
    if(!d.has_more){
      for(const t of changed)state[V230_DELTA_STATE[t]]=next[t];
      try{localStorage.setItem(v230DeltaCursorKey(),String(cur))}catch(e){}
      state.v230LastCoreLoadAt=Date.now();return 'done'}
  }
  return 'need-full'
}
/* Rows the server stopped showing to this account (moved out, unlinked, permission lost) are removed at most every 30 minutes; never with unsent work. */
async function v230DeltaReconcile(){
  if(!v230DeltaOn()||!state.user||!state.networkVerified)return false;
  if(typeof readOfflineQueue==='function'&&readOfflineQueue().length)return false;
  const key='halaqati_delta_recon_'+state.user.id;let last=0;try{last=Number(localStorage.getItem(key))||0}catch(e){}
  if(Date.now()-last<1800000)return false;
  for(const t of Object.keys(V230_DELTA_STATE)){
    const r=await db.rpc('rc_visible_ids',{p_table:t});
    if(r.error){if(v230DeltaMissing(r.error)){v230DeltaSetAbsent();return false}continue}
    const ids=new Set(r.data||[]),cur=state[V230_DELTA_STATE[t]]||[];
    if(!ids.size&&cur.length)continue; /* an empty answer for a non-empty table is not trusted */
    const keep=cur.filter(x=>ids.has(v230DeltaKey(t,x)));if(keep.length!==cur.length)state[V230_DELTA_STATE[t]]=keep
  }
  try{localStorage.setItem(key,String(Date.now()))}catch(e){}
  return true
}
/* ===== delta sync end */

async function v230LoadCoreData(forceNetwork=false){
  let start=v230Now(),online=forceNetwork?true:await internetReachable();
  if(!online){
    if(restoreSnapshot()){state.pendingSync=readOfflineQueue().length;applySavedTheme();updateSyncBadge();v230Mark('coreMs',start);return true}
    state.offline=true;updateSyncBadge();return false
  }
  state.networkVerified=true;state.offline=false;
  let tasks=[
    db.from('halaqas').select('*').order('created_at'),
    v230PageAll(()=>db.from('students').select(V230_STUDENT_COLUMNS).order('full_name').order('id'),100),
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
  v230ApplyArray('halaqas',rows[0]);{const g=v230Good(rows[1]);if(Array.isArray(g))state.students=v230MergeStudentPhotos(state.students,g)}v230ApplyArray('sessions',rows[2]);
  let settings=v230Good(rows[3]);if(settings)state.settings=settings;
  v230ApplyArray('categories',rows[4]);v230ApplyArray('halaqaTeachers',rows[5]);v230ApplyArray('halaqaSupervisors',rows[6]);
  state.pendingSync=readOfflineQueue().length;state.v230LastCoreLoadAt=Date.now();applySavedTheme();updateSyncBadge();v230Mark('coreMs',start);return true
}

async function v230LoadDashboardData(){
  let start=v230Now(),tasks=[
    db.from('announcements').select('*').order('pinned',{ascending:false}).order('publish_at',{ascending:false}).limit(80),
    db.from('student_goals').select('*').gte('period_end',monthStart()).limit(300),
    v230PageAll(()=>db.from('monthly_student_stats').select('*').gte('month_start',monthStart()).order('student_id').order('month_start')),
    v230PageAll(()=>db.from('leaderboard_daily').select('*').eq('period_date',today()).order('student_id')),
    v230PageAll(()=>db.from('leaderboard_monthly').select('*').gte('month_start',monthStart()).order('month_start').order('student_id')),
    db.from('daily_student_summary').select('*').eq('session_date',today()).limit(300),
    db.from('forum_posts').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(80),
    db.from('forum_comments').select('*').order('created_at').limit(500)
  ];
  if(roleCanAdmin())tasks.push(v230PageAll(()=>db.from('profiles').select('id,full_name,email,phone,role,requested_role,approval_status,active,approved_at,rejection_reason,created_at,frozen,avatar_path').order('created_at',{ascending:false}).order('id')));
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
    let start=v230Now();state.photoUrls=state.photoUrls||{};
    /* RC86: photos are stored inline as data URLs (same as the native app) — use them directly, online or offline. */
    let all=((window.RC27&&RC27.master&&RC27.master.students)||state.students||[]),inl=0;
    all.forEach(s=>{if(s&&s.photo_path&&String(s.photo_path).startsWith('data:image/')&&state.photoUrls[s.id]!==s.photo_path){state.photoUrls[s.id]=s.photo_path;v230PhotoMeta.set(s.id,s.photo_path);inl++}});
    if(inl&&$('#app')&&!$('#app').classList.contains('hidden'))v230RenderIfVisible();
    if(state.demo||!state.networkVerified)return;
    let rows=all.filter(s=>s.photo_path&&!String(s.photo_path).startsWith('data:')&&(!state.photoUrls[s.id]||v230PhotoMeta.get(s.id)!==s.photo_path));
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
  /* the select('*') above already shows whether category_id exists; only an empty table needs the extra probe */
  let v217=plans.data?.length?{error:'category_id' in plans.data[0]?null:{message:'category_id غير موجود'}}:await db.from('smart_plans').select('id,category_id').limit(1);
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
      if(!skipCore){
        const mode=await v230DeltaRefresh().catch(()=> 'failed');
        if(mode!=='done'){
          /* read the head BEFORE the full load so no change can fall in the gap; a failed delta keeps the old cursor */
          const head=mode==='failed'?null:await v230DeltaHead().catch(()=>null);
          let ok=await v230LoadCoreData(forceNetwork);if(!ok)return false;
          if(head!=null)try{localStorage.setItem(v230DeltaCursorKey(),String(head))}catch(e){}
        }
        await v230DeltaReconcile().catch(()=>false)
      }
      if(!state.networkVerified||state.offline)return false;
      /* Independent branches run together. v2.20 did these as serial stages. */
      await Promise.allSettled([v230LoadDashboardData(),loadSmartPlanData(),opsLoadOperationalData(forceNetwork),loadRoleExtras()]);
      state.pendingSync=readOfflineQueue().length;state.v230LastFullLoadAt=Date.now();try{localStorage.setItem('halaqati_full_load_'+state.user?.id,String(state.v230LastFullLoadAt))}catch(e){}applySavedTheme();cacheSnapshot();updateSyncBadge();v230HydrateStudentPhotos().catch(e=>console.warn('student photos',e)).finally(()=>loadPhotoUrls());v230Mark('fullLoadMs',start);return true
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
    let res=await withTimeout(db.from('profiles').select('*').eq('id',state.user.id).single(),10000,'profile timeout');if(res.error)throw res.error;if(!res.data)throw new Error('profile missing');
    let wasBlocked=state.profile?.approval_status!=='approved'||!state.profile?.active||(state.profile?.frozen&&state.profile?.role!=='admin');
    state.profile=res.data;saveOfflineAuth(state.user);maybePromptGoogleAccountName();if(state.profile.approval_status!=='approved'||!state.profile.active||(state.profile.frozen&&state.profile.role!=='admin')){showAccessStatus(state.profile);cacheSnapshot();return false}
    if(readOfflineQueue().length){captureSyncSessionDependencies();await syncOfflineQueue({refreshAfter:false});if(readOfflineQueue().length)return false}
    await v230LoadCoreData(true);
    let appHidden=$('#app')?.classList.contains('hidden');if(appHidden){$('#pendingPanel')?.classList.add('hidden');showApp();if(wasBlocked)toast('تم اعتماد الحساب وفتح لوحة ولي الأمر')}else if(renderAfter)await v230RenderIfVisible();
    if(!v230BackgroundRefreshPromise)v230BackgroundRefreshPromise=v230FullLoad(true,{skipCore:true}).then(()=>renderAfter?v230RenderIfVisible():null).finally(()=>{v230BackgroundRefreshPromise=null});
    return true
  }catch(e){/* only a network failure means offline; a permission or code error must not */if(!navigator.onLine||/failed to fetch|network|timeout|abort|load failed/i.test(String(e?.message||e))){state.networkVerified=false;state.offline=true}updateSyncBadge();return false}
};

/* First-ever login no longer waits for reports, photos, plan history and operations history before showing the app. */
boot=async function(user=null){
  state.demo=false;let u=user,verifiedInput=!!user;
  if(!u){try{let r=await withTimeout(db.auth.getSession(),650,'session timeout');u=r?.data?.session?.user||null}catch(e){u=null}}
  if(!u&&!navigator.onLine){u=readOfflineAuth();verifiedInput=false}if(!u)return;
  state.user=u;if(verifiedInput)saveOfflineAuth(u);await prepareOfflineStorageForUser(u.id);
  let cached=restoreSnapshot();
  if(cached&&state.profile){captureSyncSessionDependencies();maybePromptGoogleAccountName();if(state.profile.approval_status!=='approved'||!state.profile.active||(state.profile.frozen&&state.profile.role!=='admin')){showAccessStatus(state.profile);setTimeout(()=>refreshFromServer({renderAfter:true}),80);return}state.fastStarted=true;$('#pendingPanel').classList.add('hidden');showApp();updateSyncBadge();setTimeout(()=>refreshFromServer({renderAfter:true}),60);return}
  if(!(await internetReachable(true)))return toast('لا توجد نسخة محلية بعد. افتح التطبيق مرة واحدة مع الإنترنت لتحميل بيانات حسابك.');
  let res;try{res=await withTimeout(db.from('profiles').select('*').eq('id',u.id).single(),4000,'profile timeout')}catch(e){return toast('تعذر تحميل الحساب حالياً')}
  if(res?.error||!res?.data)return toast('تعذر تحميل الحساب');state.profile=res.data;maybePromptGoogleAccountName();if(state.profile.approval_status!=='approved'||!state.profile.active||(state.profile.frozen&&state.profile.role!=='admin')){showAccessStatus(state.profile);return}
  $('#pendingPanel').classList.add('hidden');state.opsLoading=true;
  try{let ok=await v230LoadCoreData(true);if(!ok)return toast('تعذر تحميل البيانات الأساسية حالياً');showApp();cacheSnapshot()}
  finally{state.opsLoading=false}
  v230BackgroundRefreshPromise=v230FullLoad(true,{skipCore:true}).then(()=>v230RenderIfVisible()).finally(()=>{v230BackgroundRefreshPromise=null});setTimeout(syncOfflineQueue,250)
};

/* Lightweight page rendering metrics for real-device verification without external analytics. */
const v230RenderBase=render;
render=async function(){let start=v230Now();try{return await v230RenderBase()}finally{state.v230Perf.lastRenderMs=Math.round((v230Now()-start)*10)/10;state.v230Perf.lastPage=state.page;state.v230Perf.measuredAt=new Date().toISOString()}};
window.HalaqatiPerformance={version:'2.30.0',metrics:()=>cloneJson(state.v230Perf),refresh:()=>refreshFromServer({renderAfter:true}),fullLoad:()=>loadAll(true)};
