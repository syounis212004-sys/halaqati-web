/* Halaqati v2.14.1 — shared classic runtime foundation. Loaded first; feature files intentionally remain classic scripts so existing global bindings stay compatible. */
const SUPABASE_URL='https://xlxzwucqdtggkfwwqibk.supabase.co';
const SUPABASE_KEY='sb_publishable_VZGYTedRpXfJdswijXoxig_F0Hva8ks';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const OFFICIAL_APP_URL='https://xlxzwucqdtggkfwwqibk.supabase.co/functions/v1/halaqati-reset/';
const GOOGLE_REDIRECT_URL='https://xlxzwucqdtggkfwwqibk.supabase.co/functions/v1/halaqati-app/';
const APP_DEEP_LINK='com.mohammedsamir.halaqati://auth/callback';
const APP_VERSION_NAME='2.63.22';
const APP_VERSION_CODE=26322;
const UPDATE_MANIFEST_URL='https://syounis212004-sys.github.io/halaqati-web/version.json';
let halaqatiUpdateState={checking:false,error:'',info:null,currentVersionName:APP_VERSION_NAME,currentVersionCode:APP_VERSION_CODE,progress:0,message:''};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const localDateKey=(d=new Date())=>`${String(d.getFullYear()).padStart(4,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=()=>localDateKey(new Date());
const monthStart=(ym=null)=>{if(ym&&/^\d{4}-\d{2}$/.test(String(ym)))return `${ym}-01`;let d=new Date();return `${String(d.getFullYear()).padStart(4,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-01`};
const monthEnd=(ym)=>{let [y,m]=String(ym).split('-').map(Number),d=new Date(y,m,0);return localDateKey(d)};
let state={demo:false,user:null,profile:null,page:'home',halaqas:[],students:[],sessions:[],announcements:[],forum:[],comments:[],goals:[],monthly:[],homeMonthly:[],homeSelectedMonth:today().slice(0,7),homeMonthlyLoadedKey:'',leaderDaily:[],leaderMonthly:[],dailySummary:[],users:[],categories:[],halaqaTeachers:[],guardianAccounts:[],guardianDirectory:[],guardianRanksMonth:{},guardianRanksDay:{},guardianRangeRanks:{},guardianRangeDashboards:{},guardianCompetition:{},guardianActivities:{},guardianDashboards:{},guardianTrendDays:7,guardianPeriodMode:'month',guardianPeriodDay:today(),guardianPeriodMonth:today().slice(0,7),guardianPeriodFrom:monthStart(),guardianPeriodTo:today(),guardianChildFilter:'all',guardianAnalyticsUpdatedAt:'',guardianAnalyticsError:'',competitionTrack:'hifz',competitionPeriod:'month',photoUrls:{},settings:null,communityTab:'announcements',announcementFilter:'all',rankTrack:'hifz',rankPeriod:'month',reportTab:'monthly',importRows:[],importHeaders:[],studentSearch:'',studentHalaqa:'all',studentCategory:'all',studentTrack:'all',studentStatus:'active',studentSort:'alpha',selectionMode:false,selectedStudents:new Set(),sessionView:null,sessionSearch:'',sessionSort:'alpha',sessionRoster:{attendance:[],notes:[],recitations:[]},offlineRosterCache:{},reportExistingRecIds:[],offline:false,syncing:false,pendingSync:0,networkVerified:false,lastNetworkCheck:0,fastStarted:false,authNeedsLogin:false,syncIssue:'',syncRecoverySessions:{},offlineStoreReady:false,offlineQueueCache:[],offlineSnapshotCache:null,syncProcessed:0,syncTotal:0,notifications:[],sentNotifications:[],notificationPreferences:null,notificationUnread:0,notificationsLoaded:false,pushState:{permission:'unknown',registered:false}};
const roleAr={admin:'مسؤول النظام والحلقات',supervisor:'مشرف الحلقات',teacher:'محفّظ الحلقة',guardian:'ولي الأمر',student:'طالب (قديم)'};
const studentTrackAr={general_hifz:'مسار الحفظ العام — حفظ + سرد',tathbit:'مسار التثبيت — للخاتمين',sard:'مسار الحفظ العام — حفظ + سرد'};
const assignableStudentTracks={general_hifz:'مسار الحفظ العام — حفظ + سرد',tathbit:'مسار التثبيت — للخاتمين'};
const requestRoleAr={supervisor:'مشرف الحلقات',teacher:'محفّظ الحلقة',guardian:'ولي أمر',admin:'مسؤول النظام والحلقات'};
const sesAr={tasmee:'تسميع',sard:'سرد',review:'مراجعة',test:'اختبار',tajweed:'تجويد',tilawah:'تلاوة',lesson:'جلسة تربوية / تفاعلية',other:'أخرى'};
const attAr={present:'حاضر',absent:'غائب',excused:'بعذر',late:'متأخر'};
const actAr={new_hifz:'حفظ جديد',review_near:'مراجعة قريبة',review_far:'مراجعة بعيدة',sard:'سرد',tilawah:'تلاوة',test:'اختبار'};
const evalAr={excellent:'ممتاز',very_good:'جيد جداً',good:'جيد',repeat:'يحتاج إعادة',not_rated:'غير مقيّم'};
const behAr={excellent:'ممتاز',good:'جيد',normal:'طبيعي',needs_attention:'يحتاج متابعة',warning:'إنذار'};
const categoryAr={daily:'يومي',monthly:'شهري',general:'عام',schedule:'موعد',achievement:'إنجاز',urgent:'عاجل'};
const trackAr={hifz:'الحفظ',review:'المراجعة',sard:'السرد'};
const surahs=['الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال','التوبة','يونس','هود','يوسف','الرعد','إبراهيم','الحجر','النحل','الإسراء','الكهف','مريم','طه','الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء','النمل','القصص','العنكبوت','الروم','لقمان','السجدة','الأحزاب','سبأ','فاطر','يس','الصافات','ص','الزمر','غافر','فصلت','الشورى','الزخرف','الدخان','الجاثية','الأحقاف','محمد','الفتح','الحجرات','ق','الذاريات','الطور','النجم','القمر','الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة','الصف','الجمعة','المنافقون','التغابن','الطلاق','التحريم','الملك','القلم','الحاقة','المعارج','نوح','الجن','المزمل','المدثر','القيامة','الإنسان','المرسلات','النبأ','النازعات','عبس','التكوير','الانفطار','المطففين','الانشقاق','البروج','الطارق','الأعلى','الغاشية','الفجر','البلد','الشمس','الليل','الضحى','الشرح','التين','العلق','القدر','البينة','الزلزلة','العاديات','القارعة','التكاثر','العصر','الهمزة','الفيل','قريش','الماعون','الكوثر','الكافرون','النصر','المسد','الإخلاص','الفلق','الناس'];
const ayahCounts=[7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const juzStarts=[[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],[9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],[29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
const ayahPrefix=(()=>{let a=[0];for(let i=0;i<ayahCounts.length;i++)a.push(a[i]+ayahCounts[i]);return a})();
const globalAyah=(s,a)=>ayahPrefix[s-1]+a;
const fmt=n=>Number(n||0).toLocaleString('ar-EG-u-nu-latn',{maximumFractionDigits:2});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scoringDefaults={mistakePenalty:1,promptPenalty:.5,pointPenaltyWeight:.25,excellentMax:.5,veryGoodMax:1,goodMax:2};
function toast(m){let t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
function stat(l,v){return `<div class="stat"><span>${l}</span><b>${v}</b></div>`}
function evalClass(e){return e==='excellent'?'blue':e==='very_good'?'good':e==='good'?'warn':'red'}
function evalDot(e){return 'eval-'+(e||'repeat')}
function visibleStudents(){return state.students}
function avatarHtml(s,cls='avatar'){let u=state.photoUrls[s.id];return u?`<div class="${cls}"><img src="${u}" alt=""></div>`:`<div class="${cls}">${(s.full_name||'ط')[0]}</div>`}

function cacheKey(){return state.user?.id?`halaqati_v214_cache_${state.user.id}`:null}
function legacyCacheKey(){return state.user?.id?`halaqati_v18_cache_${state.user.id}`:null}
function queueKey(){return state.user?.id?`halaqati_v214_queue_${state.user.id}`:null}
function legacyQueueKey(){return state.user?.id?`halaqati_v18_queue_${state.user.id}`:null}
function sessionMapKey(){return state.user?.id?`halaqati_v214_session_map_${state.user.id}`:null}
function cloneJson(v){return JSON.parse(JSON.stringify(v))}
function offlineUuid(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  let a=new Uint8Array(16);globalThis.crypto?.getRandomValues?.(a);if(!a.some(Boolean))for(let i=0;i<16;i++)a[i]=Math.floor(Math.random()*256);
  a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;let h=[...a].map(x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}
function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}
function isLocalSessionId(id){let s=(state.sessions||[]).find(x=>String(x.id)===String(id));return !!s?._offline||String(id||'').startsWith('offline-')||String(id||'').startsWith('offline-se-')}
function sessionIdForOfflineOp(op){if(!op)return null;if(op.type==='session')return op.localId||op.obj?.id||null;if(op.type==='delete_session')return op.payload?.session_id||null;if(op.type==='attendance'||op.type==='behavior')return op.payload?.session_id||null;if(op.type==='report')return op.payload?.sessionId||op.payload?.attendance?.session_id||op.payload?.note?.session_id||null;return null}
function normalizeOfflineOperation(op,index=0){
  let now=new Date().toISOString(),status=String(op?.status||'pending');if(!['pending','failed','syncing'].includes(status))status='pending';
  let dedupe=op?.dedupeKey||op?.key||`${op?.type||'op'}:${op?.id||offlineUuid()}`;
  return {...cloneJson(op||{}),id:op?.id||offlineUuid(),userId:state.user?.id||op?.userId||'',dedupeKey:dedupe,key:op?.key||dedupe,sessionId:sessionIdForOfflineOp(op),status,attempts:Number(op?.attempts||0),lastError:op?.lastError||'',createdAt:op?.createdAt||now,updatedAt:now,order:Number(op?.order||Date.now()+index)}
}
function readJsonLocal(key,fallback){try{let raw=key&&localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function readOfflineQueue(){if(state.offlineStoreReady)return state.offlineQueueCache||[];let raw=readJsonLocal(queueKey(),null);if(!raw)raw=readJsonLocal(legacyQueueKey(),[]);return Array.isArray(raw)?raw.map(normalizeOfflineOperation):[]}
function persistOfflineQueueAsync(q){let store=window.HalaqatiOfflineStore;if(store?.replaceOperations&&state.user?.id)store.replaceOperations(state.user.id,q).catch(e=>console.warn('IndexedDB outbox write failed',e))}
function writeOfflineQueue(q){let rows=(Array.isArray(q)?q:[]).map(normalizeOfflineOperation);state.offlineQueueCache=rows;state.pendingSync=rows.length;let k=queueKey();try{if(k)localStorage.setItem(k,JSON.stringify(rows))}catch(e){}persistOfflineQueueAsync(rows);updateSyncBadge()}
async function prepareOfflineStorageForUser(userId){
  if(!userId)return false;
  let localQ=readJsonLocal(`halaqati_v214_queue_${userId}`,null);if(!localQ)localQ=readJsonLocal(`halaqati_v18_queue_${userId}`,[]);localQ=Array.isArray(localQ)?localQ.map(normalizeOfflineOperation):[];
  let localSnap=readJsonLocal(`halaqati_v214_cache_${userId}`,null)||readJsonLocal(`halaqati_v18_cache_${userId}`,null);
  let store=window.HalaqatiOfflineStore;
  try{
    if(store?.migrateLegacy){let m=await store.migrateLegacy(userId,{queue:localQ,snapshot:localSnap});state.offlineQueueCache=(m.queue||localQ).map((x,i)=>normalizeOfflineOperation({...x,status:x.status==='syncing'?'pending':x.status},i));state.offlineSnapshotCache=m.snapshot||localSnap||null}
    else{state.offlineQueueCache=localQ;state.offlineSnapshotCache=localSnap||null}
  }catch(e){console.warn('Offline store preparation failed; localStorage fallback active',e);state.offlineQueueCache=localQ;state.offlineSnapshotCache=localSnap||null}
  state.offlineStoreReady=true;writeOfflineQueue(state.offlineQueueCache||[]);return true
}
function readSessionMap(){let k=sessionMapKey();if(!k)return {};try{return JSON.parse(localStorage.getItem(k)||'{}')}catch(e){return {}}}
function writeSessionMap(m){let k=sessionMapKey();if(k)localStorage.setItem(k,JSON.stringify(m))}
function syncRecoveryKey(){return state.user?.id?`halaqati_v214_sync_recovery_${state.user.id}`:null}
function readSyncRecoverySessions(){let k=syncRecoveryKey();if(!k)return {};try{return JSON.parse(localStorage.getItem(k)||'{}')}catch(e){return {}}}
function writeSyncRecoverySessions(m){let k=syncRecoveryKey();if(k)localStorage.setItem(k,JSON.stringify(m||{}));state.syncRecoverySessions=m||{}}
function clearSyncRecoverySessions(){let k=syncRecoveryKey();if(k)localStorage.removeItem(k);state.syncRecoverySessions={}}
function cleanSessionForRecovery(s){if(!s)return null;return {id:isUuid(s.id)?s.id:undefined,halaqa_id:s.halaqa_id,session_date:s.session_date,session_type:s.session_type||'tasmee',title:s.title||null,start_time:s.start_time||null,end_time:s.end_time||null,status:s.status||'open',notes:s.notes||null,activity_data:s.activity_data||{},created_by:s.created_by||state.user?.id||null}}
function captureSyncSessionDependencies(){
  let q=readOfflineQueue();if(!q.length)return;
  let saved=readSyncRecoverySessions();
  for(let op of q){let sid=sessionIdForOfflineOp(op);if(!sid||saved[sid]||op.type==='delete_session')continue;let s=null;if(op.type==='session'&&op.obj)s={...op.obj,id:sid};if(!s)s=(state.sessions||[]).find(x=>String(x.id)===String(sid))||null;if(!s){let snap=state.offlineSnapshotCache||readJsonLocal(cacheKey(),null)||readJsonLocal(legacyCacheKey(),null);s=(snap?.sessions||[]).find(x=>String(x.id)===String(sid))||null}if(s){let clean=cleanSessionForRecovery(s);if(clean?.halaqa_id&&clean?.session_date)saved[sid]=clean}}
  writeSyncRecoverySessions(saved)
}
function findSyncRecoverySession(sid){let saved=readSyncRecoverySessions();if(saved[sid])return saved[sid];let s=(state.sessions||[]).find(x=>String(x.id)===String(sid));if(s)return cleanSessionForRecovery(s);let snap=state.offlineSnapshotCache||readJsonLocal(cacheKey(),null)||readJsonLocal(legacyCacheKey(),null);let x=(snap?.sessions||[]).find(x=>String(x.id)===String(sid));return x?cleanSessionForRecovery(x):null}
function syncMissingDependencyError(message='الجلسة المرتبطة بالبيانات المحلية غير موجودة'){let e=new Error(message);e.code='HALAQATI_SYNC_SESSION_MISSING';return e}
function isSyncDependencyError(e){return String(e?.code||'')==='HALAQATI_SYNC_SESSION_MISSING'}
let syncVerifiedServerSessions=new Set();
async function ensureSyncSessionExists(rawId,map){
  if(!rawId)throw syncMissingDependencyError('بيانات المزامنة لا تحتوي رقم جلسة');let resolved=resolveSessionId(rawId,map),resolvedKey=String(resolved);
  if(resolvedKey.startsWith('offline-')||resolvedKey.startsWith('offline-se-'))throw syncMissingDependencyError('الجلسة المحلية لم تُرفع بعد');
  if(syncVerifiedServerSessions.has(resolvedKey))return resolved;
  let found=await db.from('sessions').select('id,halaqa_id').eq('id',resolved).maybeSingle();if(found.error)throw found.error;if(found.data?.id){syncVerifiedServerSessions.add(String(found.data.id));return resolved}
  let recoverable=isLocalSessionId(rawId)||readOfflineQueue().some(x=>x.type==='session'&&String(x.localId)===String(rawId));let recovery=recoverable?findSyncRecoverySession(rawId):null;if(recovery?.halaqa_id&&recovery?.session_date){let obj={...recovery};if(isUuid(resolved))obj.id=resolved;let rr=await db.from('sessions').upsert(obj,{onConflict:'id'}).select('id').single();if(!rr.error&&rr.data?.id){map[rawId]=rr.data.id;syncVerifiedServerSessions.add(String(rr.data.id));writeSessionMap(map);return rr.data.id}if(rr.error)throw rr.error}
  let e=syncMissingDependencyError('الجلسة المرتبطة بهذه البيانات حُذفت أو لم تعد موجودة على الخادم');e.orphanSessionId=rawId;e.resolvedSessionId=resolved;throw e
}
function ensureOfflineSessionQueued(seId){
  let se=(state.sessions||[]).find(x=>String(x.id)===String(seId));if(!se)return false;let saved=readSyncRecoverySessions(),clean=cleanSessionForRecovery(se);if(clean?.halaqa_id&&clean?.session_date){saved[seId]=clean;writeSyncRecoverySessions(saved)}
  if(!state.offlineRosterCache[seId])state.offlineRosterCache[seId]={attendance:[],notes:[],recitations:[]};
  if(se._offline||String(seId).startsWith('offline-')||String(seId).startsWith('offline-se-')){let q=readOfflineQueue(),exists=q.some(op=>op.type==='session'&&(String(op.localId)===String(seId)||op.dedupeKey===`session:${seId}`));if(!exists&&clean?.halaqa_id&&clean?.session_date){q.unshift(normalizeOfflineOperation({type:'session',key:`session:${seId}`,dedupeKey:`session:${seId}`,localId:seId,obj:{...clean,id:isUuid(seId)?seId:undefined}}));writeOfflineQueue(q)}}
  cacheSnapshot();return true
}
function prepareSessionForOfflineWork(seId){return ensureOfflineSessionQueued(seId)}
async function pruneDeletedSessionOfflineData({silent=false}={}){
  let q=readOfflineQueue();if(!q.length)return 0;let localOfflineIds=new Set((state.sessions||[]).filter(x=>x._offline||String(x.id).startsWith('offline-')||String(x.id).startsWith('offline-se-')).map(x=>String(x.id)));let map=readSessionMap(),serverCandidates=new Set();
  for(let op of q){if(op.type==='delete_session')continue;let sid=sessionIdForOfflineOp(op);if(!sid||op.type==='session')continue;let resolved=resolveSessionId(sid,map);if(!localOfflineIds.has(String(sid))&&!String(resolved).startsWith('offline-'))serverCandidates.add(String(resolved))}
  let serverIds=new Set(),ids=[...serverCandidates];for(let i=0;i<ids.length;i+=100){let r=await db.from('sessions').select('id').in('id',ids.slice(i,i+100));if(r.error){if(isNetworkError(r.error))return 0;throw r.error}for(let x of(r.data||[])){let id=String(x.id);serverIds.add(id);syncVerifiedServerSessions.add(id)}}
  let droppedSessionIds=new Set(),kept=[];for(let op of q){if(op.type==='delete_session'){kept.push(op);continue}let sid=sessionIdForOfflineOp(op);if(op.type==='session'){let localId=String(op.localId||sid||'');if(localId&&localOfflineIds.has(localId))kept.push(op);else if(localId)droppedSessionIds.add(localId);continue}if(!sid){kept.push(op);continue}let raw=String(sid),resolved=String(resolveSessionId(raw,map));if(localOfflineIds.has(raw)||serverIds.has(resolved)){kept.push(op);continue}droppedSessionIds.add(raw);if(resolved!==raw)droppedSessionIds.add(resolved)}
  let removed=q.length-kept.length;if(!removed)return 0;for(let id of droppedSessionIds)delete state.offlineRosterCache[id];let recovery=readSyncRecoverySessions();for(let id of droppedSessionIds)delete recovery[id];writeSyncRecoverySessions(recovery);for(let id of droppedSessionIds)delete map[id];writeSessionMap(map);if(state.sessionView&&droppedSessionIds.has(String(state.sessionView))){state.sessionView=null;state.sessionRoster={attendance:[],notes:[],recitations:[]}}writeOfflineQueue(kept);state.syncIssue='';state.authNeedsLogin=false;cacheSnapshot();if(!silent)toast(`تم حذف ${removed} عملية محلية مرتبطة بجلسة محذوفة`);return removed
}
function discardAllPendingSessionData(){let q=readOfflineQueue();if(!q.length)return toast('لا توجد عمليات معلقة');if(!confirm(`حذف ${q.length} عملية محلية معلقة؟ لن تُرسل إلى الخادم.`))return;writeOfflineQueue([]);state.offlineRosterCache={};state.syncIssue='';state.authNeedsLogin=false;clearSyncRecoverySessions();let mk=sessionMapKey();if(mk)localStorage.removeItem(mk);cacheSnapshot();updateSyncBadge();toast('تم حذف العمليات المحلية المعلقة')}

const OFFLINE_AUTH_KEY='halaqati_v24_last_auth';
function saveOfflineAuth(u){if(!u?.id)return;try{localStorage.setItem(OFFLINE_AUTH_KEY,JSON.stringify({id:u.id,email:u.email||'',lastVerifiedAt:Date.now()}))}catch(e){}}
function readOfflineAuth(){try{let x=JSON.parse(localStorage.getItem(OFFLINE_AUTH_KEY)||'null');if(!x?.id)return null;let age=Date.now()-Number(x.lastVerifiedAt||0);if(age>45*24*60*60*1000)return null;return {id:x.id,email:x.email||''}}catch(e){return null}}
function clearOfflineAuth(){try{localStorage.removeItem(OFFLINE_AUTH_KEY)}catch(e){}}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function withTimeout(promise,ms,label='timeout'){let t;try{return await Promise.race([promise,new Promise((_,rej)=>{t=setTimeout(()=>rej(new Error(label)),ms)})])}finally{clearTimeout(t)}}
async function internetReachable(force=false){
  if(!navigator.onLine){state.networkVerified=false;state.offline=true;return false}
  if(!force&&state.lastNetworkCheck&&Date.now()-state.lastNetworkCheck<5000)return !!state.networkVerified;
  state.lastNetworkCheck=Date.now();
  const check=async(ms)=>{
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),ms);
    try{
      let r=await fetch(SUPABASE_URL+'/auth/v1/health',{method:'GET',cache:'no-store',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY},signal:ctl.signal});
      return !!r.ok
    }finally{clearTimeout(timer)}
  };
  try{
    let ok=false;
    try{ok=await check(3000)}catch(_e){}
    if(!ok&&navigator.onLine){await sleep(250);try{ok=await check(1800)}catch(_e){}}
    state.networkVerified=!!ok;state.offline=!ok;return !!ok
  }catch(e){state.networkVerified=false;state.offline=true;return false}
}
function isNetworkError(e){let m=String(e?.message||e||'').toLowerCase();return !navigator.onLine||!state.networkVerified||m.includes('failed to fetch')||m.includes('network')||m.includes('load failed')||m.includes('timeout')||m.includes('abort')||m.includes('fetch')}
let syncAuthPromise=null;
function isAuthOrRlsError(e){let m=String(e?.message||e||'').toLowerCase(),code=String(e?.code||'');return code==='42501'||m.includes('row-level security')||m.includes('rls')||m.includes('jwt')||m.includes('not authenticated')||m.includes('auth session missing')||m.includes('invalid claim')||m.includes('permission denied')}
function markSyncAuthNeeded(v=true){state.authNeedsLogin=!!v;if(v)state.syncIssue='auth';else if(state.syncIssue==='auth')state.syncIssue='';updateSyncBadge()}
async function ensureServerAuthSession({forceRefresh=false,silent=false}={}){
  if(state.demo)return true;
  if(!state.user)return false;
  if(!navigator.onLine)return false;
  if(!state.networkVerified&&!(await internetReachable(true)))return false;
  if(syncAuthPromise&&!forceRefresh)return await syncAuthPromise;
  let task=(async()=>{
    try{
      let session=null;
      try{
        let g=await withTimeout(db.auth.getSession(),3000,'auth session timeout');
        if(g?.error)throw g.error;
        session=g?.data?.session||null;
      }catch(e){if(isNetworkError(e))return false}
      let expMs=Number(session?.expires_at||0)*1000;
      if(forceRefresh||!session?.user||!session?.access_token||!expMs||expMs<Date.now()+90_000){
        try{
          let rr=await withTimeout(db.auth.refreshSession(),5000,'auth refresh timeout');
          if(!rr?.error&&rr?.data?.session)session=rr.data.session;
          else if(rr?.error&&!String(rr.error?.message||'').toLowerCase().includes('session missing'))throw rr.error;
        }catch(e){if(isNetworkError(e))return false}
      }
      if(!session?.user?.id||!session?.access_token){markSyncAuthNeeded(true);if(!silent)toast('الاتصال عاد، لكن جلسة الدخول تحتاج تجديداً. بياناتك المحلية محفوظة؛ سجّل الدخول مرة واحدة لإكمال المزامنة.');return false}
      if(state.user?.id&&session.user.id!==state.user.id){markSyncAuthNeeded(true);if(!silent)toast('الحساب المتصل لا يطابق صاحب البيانات المحلية. سجّل الدخول بالحساب الصحيح لإكمال المزامنة.');return false}
      let verified=null;
      try{
        let gu=await withTimeout(db.auth.getUser(),4500,'auth verify timeout');
        if(gu?.error)throw gu.error;
        verified=gu?.data?.user||null;
      }catch(e){
        if(isNetworkError(e))return false;
        try{
          let rr=await withTimeout(db.auth.refreshSession(),5000,'auth refresh timeout');
          if(rr?.error)throw rr.error;
          session=rr?.data?.session||session;
          let gu=await withTimeout(db.auth.getUser(),4500,'auth verify timeout');
          if(gu?.error)throw gu.error;
          verified=gu?.data?.user||null;
        }catch(e2){markSyncAuthNeeded(true);if(!silent)toast('تعذر تجديد جلسة الدخول. لم نفقد أي بيانات؛ سجّل الدخول ثم اضغط حالة المزامنة.');return false}
      }
      if(!verified?.id||verified.id!==state.user.id){markSyncAuthNeeded(true);if(!silent)toast('تعذر التحقق من جلسة الحساب. البيانات المحلية ما زالت محفوظة.');return false}
      state.user=verified;saveOfflineAuth(verified);state.authNeedsLogin=false;updateSyncBadge();return true
    }catch(e){
      if(isNetworkError(e))return false;
      markSyncAuthNeeded(true);
      if(!silent)toast('تعذر التحقق من جلسة الدخول. البيانات المحلية محفوظة ولن تُحذف.');
      return false
    }
  })();
  if(!forceRefresh)syncAuthPromise=task;
  try{return await task}finally{if(syncAuthPromise===task)syncAuthPromise=null}
}
async function serverWriteReady(){if(!(await internetReachable()))return false;return await ensureServerAuthSession({silent:true})}
function cacheSnapshot(){
  let k=cacheKey();if(!k||!state.profile)return;
  let snap={savedAt:new Date().toISOString(),profile:state.profile,halaqas:state.halaqas,students:state.students,sessions:state.sessions,announcements:state.announcements,goals:state.goals,monthly:state.monthly,homeMonthly:state.homeMonthly,homeSelectedMonth:state.homeSelectedMonth,homeMonthlyLoadedKey:state.homeMonthlyLoadedKey,leaderDaily:state.leaderDaily,leaderMonthly:state.leaderMonthly,dailySummary:state.dailySummary,forum:state.forum,comments:state.comments,categories:state.categories,halaqaTeachers:state.halaqaTeachers,halaqaSupervisors:state.halaqaSupervisors||[],guardianAccounts:state.guardianAccounts,guardianDirectory:state.guardianDirectory,guardianRanksMonth:state.guardianRanksMonth,guardianRanksDay:state.guardianRanksDay,guardianRangeRanks:state.guardianRangeRanks,guardianRangeDashboards:state.guardianRangeDashboards||{},guardianCompetition:state.guardianCompetition,guardianActivities:state.guardianActivities,guardianDashboards:state.guardianDashboards,guardianTrendDays:state.guardianTrendDays,guardianPeriodMode:state.guardianPeriodMode,guardianPeriodDay:state.guardianPeriodDay,guardianPeriodMonth:state.guardianPeriodMonth,guardianPeriodFrom:state.guardianPeriodFrom,guardianPeriodTo:state.guardianPeriodTo,guardianChildFilter:state.guardianChildFilter,guardianAnalyticsUpdatedAt:state.guardianAnalyticsUpdatedAt,guardianAnalyticsError:state.guardianAnalyticsError,competitionTrack:state.competitionTrack,competitionPeriod:state.competitionPeriod,settings:state.settings,offlineRosterCache:state.offlineRosterCache,notifications:(state.notifications||[]).slice(0,120),notificationPreferences:state.notificationPreferences,notificationUnread:state.notificationUnread};
  state.offlineSnapshotCache=cloneJson(snap);try{localStorage.setItem(k,JSON.stringify(snap))}catch(e){}
  let store=window.HalaqatiOfflineStore;if(store?.putSnapshot&&state.user?.id)store.putSnapshot(state.user.id,snap).catch(e=>console.warn('IndexedDB snapshot write failed',e))
}
function restoreSnapshot(){
  let x=state.offlineSnapshotCache||readJsonLocal(cacheKey(),null)||readJsonLocal(legacyCacheKey(),null);if(!x||!x.profile)return false;
  try{state.profile=x.profile;for(let p of ['halaqas','students','sessions','announcements','goals','monthly','leaderDaily','leaderMonthly','dailySummary','forum','comments','categories','halaqaTeachers','halaqaSupervisors','guardianAccounts','guardianDirectory'])state[p]=x[p]||[];state.homeMonthly=x.homeMonthly||[];state.homeSelectedMonth=x.homeSelectedMonth||today().slice(0,7);state.homeMonthlyLoadedKey=x.homeMonthlyLoadedKey||'';state.guardianRanksMonth=x.guardianRanksMonth||{};state.guardianRanksDay=x.guardianRanksDay||{};state.guardianRangeRanks=x.guardianRangeRanks||{};state.guardianRangeDashboards=x.guardianRangeDashboards||{};state.guardianCompetition=x.guardianCompetition||{};state.guardianActivities=x.guardianActivities||{};state.guardianDashboards=x.guardianDashboards||{};state.guardianTrendDays=Number(x.guardianTrendDays||7);state.guardianPeriodMode=x.guardianPeriodMode||'month';state.guardianPeriodDay=x.guardianPeriodDay||today();state.guardianPeriodMonth=x.guardianPeriodMonth||today().slice(0,7);state.guardianPeriodFrom=x.guardianPeriodFrom||monthStart();state.guardianPeriodTo=x.guardianPeriodTo||today();state.guardianChildFilter=x.guardianChildFilter||'all';state.guardianAnalyticsUpdatedAt=x.guardianAnalyticsUpdatedAt||'';state.guardianAnalyticsError=x.guardianAnalyticsError||'';state.competitionTrack=x.competitionTrack||'hifz';state.competitionPeriod=x.competitionPeriod||'month';state.settings=x.settings||null;state.offlineRosterCache=x.offlineRosterCache||{};state.notifications=x.notifications||[];state.notificationPreferences=x.notificationPreferences||null;state.notificationUnread=Number(x.notificationUnread||state.notifications.filter(n=>!n.read_at).length);state.users=[];state.offline=true;return true}catch(e){return false}
}
function syncQueueStats(q=readOfflineQueue()){let failed=q.filter(x=>x.status==='failed').length,pending=q.filter(x=>x.status!=='failed').length;return {total:q.length,failed,pending}}
function updateSyncBadge(){let b=$('#syncBadge');if(!b)return;let q=readOfflineQueue(),st=syncQueueStats(q);state.pendingSync=q.length;b.className='sync-badge';if(state.syncing){b.classList.add('syncing');b.textContent=`مزامنة ${state.syncProcessed}/${state.syncTotal}`;return}if(state.authNeedsLogin&&q.length){b.classList.add('pending');b.textContent=`تسجيل الدخول للمزامنة · ${q.length}`;return}if(!state.networkVerified||state.offline){b.classList.add('offline');b.textContent=q.length?`بدون نت · ${q.length} محفوظ`:'جاهز دون إنترنت';return}if(st.failed){b.classList.add('pending');b.textContent=`مزامنة ${q.length} · فشل ${st.failed}`;return}if(q.length){b.classList.add('pending');b.textContent=`بانتظار المزامنة ${q.length}`;return}b.textContent='متصل · متزامن'}
function enqueueOffline(op){
  let q=readOfflineQueue(),incoming=normalizeOfflineOperation(op),i=q.findIndex(x=>x.dedupeKey===incoming.dedupeKey||x.key===incoming.key);
  if(i>=0){incoming.id=q[i].id;incoming.createdAt=q[i].createdAt;incoming.order=q[i].order;incoming.attempts=0;incoming.status='pending';incoming.lastError='';q[i]=incoming}else q.push(incoming);
  writeOfflineQueue(q);state.offline=!state.networkVerified;cacheSnapshot();captureSyncSessionDependencies();return incoming
}
function resolveSessionId(id,map=readSessionMap()){return map[id]||id}
function rememberRoster(id){state.offlineRosterCache[id]=cloneJson(state.sessionRoster);cacheSnapshot()}
function offlineNotice(){let st=syncQueueStats();return (!state.networkVerified||state.offline||state.pendingSync)?`<div class="offline-notice"><b>${state.networkVerified?'بيانات محلية بانتظار المزامنة':'وضع العمل دون إنترنت'}</b><br>${state.pendingSync?`${state.pendingSync} عملية محفوظة بأمان في قاعدة الجهاز${st.failed?` · ${st.failed} تحتاج إعادة محاولة`:''}. ستتم المزامنة تلقائياً عند عودة الاتصال.`:'الحلقات والفئات والطلاب والجلسات والحضور والسلوك والتسميع متاحة من النسخة المحلية.'}</div>`:''}
let deferredSyncNotificationQueue=[],deferredSyncNotificationActive=0;
function queueDeferredSyncNotification(task){if(typeof task!=='function')return;deferredSyncNotificationQueue.push(task);drainDeferredSyncNotifications()}
function drainDeferredSyncNotifications(){while(deferredSyncNotificationActive<3&&deferredSyncNotificationQueue.length){let task=deferredSyncNotificationQueue.shift();deferredSyncNotificationActive++;Promise.resolve().then(task).catch(e=>console.warn('deferred sync notification skipped',e)).finally(()=>{deferredSyncNotificationActive--;drainDeferredSyncNotifications()})}}
function localAttendanceSave(sid,seId,status,extra={}){prepareSessionForOfflineWork(seId);let ex=rosterAttendance(sid),data={id:ex?.id||offlineUuid(),session_id:seId,student_id:sid,status,recorded_by:state.user.id,recorded_at:new Date().toISOString(),...extra,_offline:true};if(ex)Object.assign(ex,data);else state.sessionRoster.attendance.push(data);enqueueOffline({type:'attendance',key:`att:${seId}:${sid}`,dedupeKey:`att:${seId}:${sid}`,payload:{session_id:seId,student_id:sid,status,recorded_by:state.user.id,recorded_at:data.recorded_at,...extra}});rememberRoster(seId);return data}
function localBehaviorSave(sid,seId,behavior){prepareSessionForOfflineWork(seId);let ex=rosterNote(sid),data={id:ex?.id||offlineUuid(),session_id:seId,student_id:sid,behavior,behavior_score:behaviorScoreFor(behavior),created_by:state.user.id,parent_visible:true,_offline:true};if(ex)Object.assign(ex,data);else state.sessionRoster.notes.push(data);enqueueOffline({type:'behavior',key:`beh:${seId}:${sid}`,dedupeKey:`beh:${seId}:${sid}`,payload:{session_id:seId,student_id:sid,behavior,behavior_score:data.behavior_score,created_by:state.user.id,parent_visible:true}});rememberRoster(seId);return data}
function normalizeRecitationInputMethod(value,data={}){let v=String(value||'').trim();if(['pages','ayahs','surahs','juz','import'].includes(v))return v;if(Array.isArray(data?.selection_data?.selected_juz)&&data.selection_data.selected_juz.length)return 'juz';if(data?.start_page||data?.end_page)return 'pages';if(Array.isArray(data?.selected_surahs)&&data.selected_surahs.length)return 'surahs';return 'ayahs'}
function recitationLineCountV6(input){let d=input&&typeof input==='object'?input:null,pages=Math.max(0,Number(d?.pages_count??input)||0),keys=d?.selection_data?.qcf_line_keys;if(Array.isArray(keys)&&keys.length)return new Set(keys.map(String)).size;return Math.max(0,pages*15)}
function computeRecitationV6(input,mistakes,prompts){let d=input&&typeof input==='object'?input:null,p=Math.max(0,Number(d?.pages_count??input)||0),m=Math.max(0,Number(d?.mistakes??mistakes)||0),pr=Math.max(0,Number(d?.prompts??prompts)||0),lines=recitationLineCountV6(d||p),units=m+(pr*.5),normalized=lines>0?units*15/lines:0,safety=lines>0?Math.max(0,Math.min(100,100-(normalized*20))):0,ev=lines<=0?'not_rated':safety>=90?'excellent':safety>=80?'very_good':safety>=70?'good':'repeat',points=p<=0?0:Math.max(0,Math.round((p-(units*.25))*100)/100),pp=p>0?units/p:0;return {penalty_units:units,penalty_per_page:pp,safety_percentage:Math.round(safety*10)/10,evaluation:ev,points,scoring_version:'V6'}}
window.computeRecitationV6=computeRecitationV6;
// Compatibility alias for older modules; it now returns V6 results.
function computeRecitationV5(input,mistakes,prompts){return computeRecitationV6(input,mistakes,prompts)}
window.computeRecitationV5=computeRecitationV5;
function decorateRecForOffline(d){return {...d,...computeRecitationV6(d)}}
function saveReportOffline(payload){
  let sid=payload.studentId,seId=payload.sessionId;prepareSessionForOfflineWork(seId);
  payload=cloneJson(payload);payload.rows=(payload.rows||[]).map(rr=>({...rr,dbId:isUuid(rr.dbId)?rr.dbId:offlineUuid()}));
  let at={id:rosterAttendance(sid)?.id||offlineUuid(),...payload.attendance,_offline:true},nt={id:rosterNote(sid)?.id||offlineUuid(),...payload.note,_offline:true};let oldA=rosterAttendance(sid),oldN=rosterNote(sid);if(oldA)Object.assign(oldA,at);else state.sessionRoster.attendance.push(at);if(oldN)Object.assign(oldN,nt);else state.sessionRoster.notes.push(nt);
  state.sessionRoster.recitations=state.sessionRoster.recitations.filter(x=>x.student_id!==sid);payload.rows.forEach(rr=>state.sessionRoster.recitations.push({id:rr.dbId,...decorateRecForOffline(rr.data),_offline:true}));
  enqueueOffline({type:'report',key:`report:${seId}:${sid}`,dedupeKey:`report:${seId}:${sid}`,payload});rememberRoster(seId);toast('تم حفظ التقرير محلياً وسيُرفع تلقائياً')
}
async function syncReportPayload(p,map){
  let seId=await ensureSyncSessionExists(p.sessionId,map),attendance={...p.attendance,session_id:seId},note={...p.note,session_id:seId};
  let a=await db.from('attendance_records').upsert(attendance,{onConflict:'session_id,student_id'});if(a.error)throw a.error;let n=await db.from('student_daily_notes').upsert(note,{onConflict:'session_id,student_id'});if(n.error)throw n.error;
  let kept=(await Promise.all((p.rows||[]).map(async rr=>{let d={...rr.data,session_id:seId};d.input_method=normalizeRecitationInputMethod(d.input_method,d);let rid=isUuid(rr.dbId)?rr.dbId:null;if(rid){d.id=rid;let r=await db.from('recitation_entries').upsert(d,{onConflict:'id'}).select('id').single();if(r.error)throw r.error;return r.data?.id||rid}let r=await db.from('recitation_entries').insert(d).select('id').single();if(r.error)throw r.error;return r.data?.id||null}))).filter(Boolean);
  let removed=(p.existingRecIds||[]).filter(id=>isUuid(id)&&!kept.includes(id));if(removed.length){let r=await db.from('recitation_entries').delete().in('id',removed);if(r.error)throw r.error}
  if(typeof emitDailyReportNotification==='function')queueDeferredSyncNotification(()=>emitDailyReportNotification({...p,sessionId:seId}))
}
async function applyOfflineOperation(op,map){
  if((op.type==='master_upsert'||op.type==='master_delete')&&typeof applyMasterOfflineOperation==='function')return await applyMasterOfflineOperation(op,map);
  if(op.type==='session'){
    let obj={...op.obj};delete obj._offline;if(isUuid(op.localId))obj.id=op.localId;else delete obj.id;
    let r=await db.from('sessions').upsert(obj,{onConflict:'id'}).select().single();
    if(r.error&&String(r.error.code)==='23505'){let ex=await db.from('sessions').select('*').eq('halaqa_id',obj.halaqa_id).eq('session_date',obj.session_date).eq('session_type',obj.session_type).eq('title',obj.title).maybeSingle();if(ex.error)throw ex.error;if(ex.data)r={data:ex.data,error:null}}
    if(r.error)throw r.error;map[op.localId]=r.data.id;syncVerifiedServerSessions.add(String(r.data.id));writeSessionMap(map);let local=state.sessions.find(x=>String(x.id)===String(op.localId));if(local)Object.assign(local,r.data,{_offline:false});if(state.sessionView===op.localId)state.sessionView=r.data.id;if(state.offlineRosterCache[op.localId]&&r.data.id!==op.localId){state.offlineRosterCache[r.data.id]=state.offlineRosterCache[op.localId];delete state.offlineRosterCache[op.localId]}return
  }
  if(op.type==='delete_session'){let id=resolveSessionId(op.payload.session_id,map);let r=await db.from('sessions').delete().eq('id',id);if(r.error)throw r.error;return}
  if(op.type==='attendance'){let seId=await ensureSyncSessionExists(op.payload.session_id,map),p={...op.payload,session_id:seId};let r=await db.from('attendance_records').upsert(p,{onConflict:'session_id,student_id'});if(r.error)throw r.error;if(typeof emitAttendanceNotification==='function')queueDeferredSyncNotification(()=>emitAttendanceNotification(p));return}
  if(op.type==='behavior'){let seId=await ensureSyncSessionExists(op.payload.session_id,map),p={...op.payload,session_id:seId};let r=await db.from('student_daily_notes').upsert(p,{onConflict:'session_id,student_id'});if(r.error)throw r.error;if(typeof emitBehaviorNotification==='function')queueDeferredSyncNotification(()=>emitBehaviorNotification(p));return}
  if(op.type==='report'){await syncReportPayload(op.payload,map);return}
}
function setOfflineOpState(id,patch){let q=readOfflineQueue().map(x=>x.id===id?normalizeOfflineOperation({...x,...patch}):x);writeOfflineQueue(q);return q.find(x=>x.id===id)}
function resetFailedOfflineOperations(){let changed=0,q=readOfflineQueue().map(x=>{if(x.status==='failed'&&!x.conflict){changed++;return normalizeOfflineOperation({...x,status:'pending',attempts:0,lastError:''})}return x});writeOfflineQueue(q);toast(changed?'تم تجهيز العمليات الفاشلة لإعادة المحاولة':'التعارضات تحتاج اختيار النسخة المحلية أو نسخة الخادم');syncOfflineQueue()}
function syncOperationLabel(op){if(typeof masterSyncOperationLabel==='function'){let x=masterSyncOperationLabel(op);if(x)return x}return op.type==='session'?'جلسة':op.type==='delete_session'?'حذف جلسة':op.type==='attendance'?'حضور/غياب':op.type==='behavior'?'سلوك':op.type==='report'?'تسميع وتقرير':'عملية'}
function offlineOperationPriority(op){if(typeof masterOfflinePriority==='function'){let p=masterOfflinePriority(op);if(Number.isFinite(p))return p}return op.type==='session'?40:op.type==='delete_session'?80:60}
function renderSyncStatusDialog(){
  let box=$('#syncStatusBody');if(!box)return;let q=readOfflineQueue(),st=syncQueueStats(q),conflicts=q.filter(x=>x.conflict).length;
  $('#syncStatusSummary').textContent=q.length?`${q.length} عملية · ${st.failed} فشل${conflicts?` · ${conflicts} تعارض`:''} · ${st.pending} بانتظار الرفع`:'لا توجد عمليات معلقة — كل البيانات متزامنة';
  box.innerHTML=q.length?q.slice(0,100).map(op=>`<div class="sync-op-row"><div><b>${esc(syncOperationLabel(op))}</b><small>${esc(op.conflict?'تعارض يحتاج قرار':op.status==='failed'?'فشلت':op.status==='syncing'?'جاري الرفع':'بانتظار المزامنة')}</small></div><span>${op.attempts||0}</span>${op.lastError?`<small class="sync-error">${esc(String(op.lastError).slice(0,220))}</small>`:''}${typeof masterConflictActionHtml==='function'?masterConflictActionHtml(op):''}</div>`).join(''):'<div class="empty">كل البيانات محفوظة على الخادم.</div>';
  let retry=$('#syncRetryFailed');if(retry?.classList?.toggle)retry.classList.toggle('hidden',!q.some(x=>x.status==='failed'&&!x.conflict))
}
function openSyncStatusDialog(){renderSyncStatusDialog();let d=$('#syncStatusDlg');if(d&&!d.open)d.showModal()}
async function syncOfflineQueue({refreshAfter=true}={}){
  if(state.syncing||!state.user)return updateSyncBadge();if(!(await internetReachable(false)))return updateSyncBadge();syncVerifiedServerSessions.clear();let q=readOfflineQueue();if(!q.length){state.offline=false;state.authNeedsLogin=false;state.syncIssue='';clearSyncRecoverySessions();updateSyncBadge();return}
  captureSyncSessionDependencies();if(!(await ensureServerAuthSession({silent:true}))){state.offline=false;state.authNeedsLogin=true;state.syncIssue='auth';updateSyncBadge();openSyncAuthRecovery?.();return}
  await pruneDeletedSessionOfflineData({silent:true});q=readOfflineQueue();if(!q.length){state.offline=false;state.authNeedsLogin=false;state.syncIssue='';clearSyncRecoverySessions();updateSyncBadge();cacheSnapshot();return}
  state.syncing=true;state.offline=false;state.authNeedsLogin=false;state.syncIssue='';state.syncProcessed=0;state.syncTotal=q.length;updateSyncBadge();let map=readSessionMap();
  let ordered=[...q].sort((a,b)=>offlineOperationPriority(a)-offlineOperationPriority(b)||Number(a.order||0)-Number(b.order||0));
  let halted=false;
  for(let op of ordered){
    let current=readOfflineQueue().find(x=>x.id===op.id);if(!current)continue;if(current.status==='failed'&&Number(current.attempts||0)>=3)continue;
    try{
      try{await applyOfflineOperation(current,map)}catch(e){if(isAuthOrRlsError(e)){let ok=await ensureServerAuthSession({forceRefresh:true,silent:true});if(!ok)throw e;await applyOfflineOperation(current,map)}else throw e}
      let left=readOfflineQueue().filter(x=>x.id!==op.id);writeOfflineQueue(left);state.syncProcessed++;updateSyncBadge()
    }catch(e){
      console.error('offline sync operation',current.type,e);
      if(typeof isMasterConflictError==='function'&&isMasterConflictError(e)){setOfflineOpState(op.id,{status:'failed',attempts:Number(current.attempts||0),lastError:String(e?.message||e).slice(0,300),conflict:e.masterConflict||null});state.syncProcessed++;updateSyncBadge();continue}
      if(isNetworkError(e)){setOfflineOpState(op.id,{status:'pending',lastError:'انقطع الاتصال أثناء المزامنة'});halted=true;break}
      if(isAuthOrRlsError(e)){let authOk=await ensureServerAuthSession({forceRefresh:true,silent:true});if(!authOk){state.authNeedsLogin=true;state.syncIssue='auth';setOfflineOpState(op.id,{status:'pending',lastError:'تحتاج جلسة الدخول إلى تجديد'});openSyncAuthRecovery?.();halted=true;break}}
      if(isSyncDependencyError(e)){let sid=sessionIdForOfflineOp(current),recovery=sid&&findSyncRecoverySession(sid);if(!recovery){let doomed=new Set([String(sid||''),String(resolveSessionId(sid,map)||'')]);let left=readOfflineQueue().filter(x=>x.id!==op.id&&!doomed.has(String(sessionIdForOfflineOp(x)||'')));writeOfflineQueue(left);for(let id of doomed)delete state.offlineRosterCache[id];state.syncProcessed++;continue}}
      let attempts=Number(current.attempts||0)+1;setOfflineOpState(op.id,{status:'failed',attempts,lastError:String(e?.message||e).slice(0,300)});state.syncProcessed++;updateSyncBadge();
      // A data-specific failure does not stop unrelated attendance/recitation operations.
      continue
    }
  }
  state.syncing=false;let remaining=readOfflineQueue();if(!remaining.length){state.offline=false;state.authNeedsLogin=false;state.syncIssue='';state.offlineRosterCache={};clearSyncRecoverySessions();let mk=sessionMapKey();if(mk)localStorage.removeItem(mk);toast('تمت مزامنة البيانات المحفوظة بنجاح');if(refreshAfter){if(typeof refreshFromServer==='function')await refreshFromServer({renderAfter:false});else await loadAll(true);if(state.sessionView)await loadSessionRosterData(state.sessionView);render()}}
  else if(!halted){let st=syncQueueStats(remaining);if(st.failed)toast(`اكتملت المزامنة مع ${st.failed} عملية تحتاج إعادة محاولة`)}
  cacheSnapshot();updateSyncBadge();renderSyncStatusDialog()
}

function monthlyPointsForStudent(id){return state.leaderMonthly.filter(x=>x.student_id===id).reduce((a,x)=>a+Number(x.points||0),0)}
function sortStudentsList(rows,mode='alpha'){rows=[...rows];let dateVal=(x,k)=>x[k]?new Date(x[k]+'T00:00:00').getTime():null;return rows.sort((a,b)=>{if(mode==='points')return monthlyPointsForStudent(b.id)-monthlyPointsForStudent(a.id)||a.full_name.localeCompare(b.full_name,'ar');if(mode==='oldest'){let A=dateVal(a,'date_of_birth'),B=dateVal(b,'date_of_birth');return A==null?1:B==null?-1:A-B}if(mode==='youngest'){let A=dateVal(a,'date_of_birth'),B=dateVal(b,'date_of_birth');return A==null?1:B==null?-1:B-A}if(mode==='joined_old'){let A=dateVal(a,'enrollment_date'),B=dateVal(b,'enrollment_date');return A==null?1:B==null?-1:A-B}if(mode==='joined_new'){let A=dateVal(a,'enrollment_date'),B=dateVal(b,'enrollment_date');return A==null?1:B==null?-1:B-A}return a.full_name.localeCompare(b.full_name,'ar')})}
function rankRowFor(studentId,track,period='month'){let src=period==='day'?state.guardianRanksDay:state.guardianRanksMonth;return (src[studentId]||[]).find(x=>x.track===track)||null}



