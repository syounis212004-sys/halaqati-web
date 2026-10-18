/* Halaqati v2.44.0 — startup/session recovery + pull-to-refresh + approval polling. */
applySavedTheme();
const recoveryInUrl=location.hash.includes('type=recovery')||location.search.includes('type=recovery');
db.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>showPasswordRecovery(),0)});

let hfStartupRecoveryBusy=false;

async function hfGetStartupSession(primaryTimeout=3000){
  try{
    let r=await withTimeout(db.auth.getSession(),primaryTimeout,'startup session timeout');
    if(r?.data?.session)return r.data.session;
  }catch(_e){}
  // Android can recreate the WebView just after returning from the print spooler. Give
  // Supabase storage one second chance instead of immediately exposing the login screen.
  try{
    await new Promise(r=>setTimeout(r,120));
    let r=await withTimeout(db.auth.getSession(),1800,'startup session retry timeout');
    return r?.data?.session||null;
  }catch(_e){return null}
}

function hfFreshPrintResume(){
  try{
    let x=readJsonLocal('halaqati_print_resume_v2407',null);
    return !!(x&&Date.now()-Number(x.at||0)<=20*60*1000);
  }catch(_e){return false}
}

async function hfRestoreCachedShell(last,{refreshDelay=180}={}){
  if(!last?.id)return false;
  state.user=last;
  await prepareOfflineStorageForUser(last.id);
  if(!restoreSnapshot())return false;
  captureSyncSessionDependencies();
  state.fastStarted=true;
  showApp();
  // Resolve the real Supabase user in the background, then refresh. This keeps a print-flow
  // activity recreation from flashing or landing on the login page.
  setTimeout(async()=>{
    try{
      let session=await hfGetStartupSession(3500);
      if(session?.user){state.user=session.user;saveOfflineAuth(session.user);state.authNeedsLogin=false}
      if(typeof refreshFromServer==='function')await refreshFromServer({renderAfter:true});
    }catch(_e){}
  },refreshDelay);
  if(typeof cacheRecentSessionRostersForOffline==='function')setTimeout(()=>cacheRecentSessionRostersForOffline(30),1800);
  return true;
}

async function hfStartApplication(){
  if(hfStartupRecoveryBusy)return;
  hfStartupRecoveryBusy=true;
  try{
    if(recoveryInUrl){showPasswordRecovery();return}

    const last=readOfflineAuth();
    // Fast path used only immediately after a native print hand-off. Identity and page were
    // persisted just before opening Android's print UI, so restore them before any network wait.
    if(hfFreshPrintResume()&&last&&await hfRestoreCachedShell(last,{refreshDelay:250}))return;

    const session=await hfGetStartupSession(3000);
    if(session?.user){
      await boot(session.user);
      if(typeof cacheRecentSessionRostersForOffline==='function')setTimeout(()=>cacheRecentSessionRostersForOffline(30),150);
      return;
    }

    // Normal local-first fallback. This is the same trusted offline identity snapshot used by
    // the app elsewhere, but now it is reached after a realistic session-read timeout/retry.
    if(last)await hfRestoreCachedShell(last,{refreshDelay:450});
  }finally{hfStartupRecoveryBusy=false}
}

hfStartApplication();

// If Android resumes the same JS process after the print UI but auth state was temporarily
// cleared by an activity lifecycle edge case, recover the app shell instead of showing login.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible'||state.user||hfStartupRecoveryBusy)return;
  setTimeout(()=>hfStartApplication(),80);
});

setTimeout(()=>ensureQuranLayout(true),900);
setInterval(async()=>{if(state.user&&readOfflineQueue().length&&navigator.onLine&&!state.syncing)await syncOfflineQueue()},8000);

/* v2.44.0 — mobile pull-to-refresh. Works in Capacitor WebView and PWA without relying on browser chrome. */
let hfPullStartY=0,hfPullDistance=0,hfPullTracking=false,hfPullBusy=false;
function hfPullIndicator(){let el=$('#halaqatiPullRefresh');if(el)return el;el=document.createElement('div');el.id='halaqatiPullRefresh';el.className='pull-refresh-indicator';el.setAttribute('aria-live','polite');el.innerHTML='<span>↻</span><b>اسحب للتحديث</b>';document.body.appendChild(el);return el}
function hfPullAtTop(){let sc=document.scrollingElement||document.documentElement;return Number(sc?.scrollTop||0)<=1}
function hfPullAllowed(target){if(!state.user||!hfPullAtTop()||hfPullBusy)return false;if(target?.closest?.('dialog,input,textarea,select,[contenteditable="true"],[data-no-pull-refresh]'))return false;return true}
function hfSetPullVisual(distance,text){let el=hfPullIndicator(),d=Math.max(0,Math.min(96,Number(distance)||0));el.style.setProperty('--pull-distance',`${d}px`);el.classList.toggle('visible',d>4||hfPullBusy);el.querySelector('b').textContent=text||((d>=72)?'اترك للتحديث':'اسحب للتحديث');el.classList.toggle('armed',d>=72)}
async function hfRunPullRefresh(){if(hfPullBusy||!state.user)return;hfPullBusy=true;hfSetPullVisual(72,'جاري تحديث البيانات…');hfPullIndicator().classList.add('refreshing');try{if(readOfflineQueue().length)await syncOfflineQueue({refreshAfter:false});let ok=await refreshFromServer({renderAfter:true});if(ok)toast('تم تحديث البيانات')}catch(e){console.warn('pull refresh failed',e);toast('تعذر التحديث الآن')}finally{hfPullBusy=false;let el=hfPullIndicator();el.classList.remove('refreshing','armed');setTimeout(()=>{hfSetPullVisual(0,'اسحب للتحديث');el.classList.remove('visible')},260)}}
document.addEventListener('touchstart',e=>{if(e.touches?.length!==1||!hfPullAllowed(e.target))return;hfPullStartY=e.touches[0].clientY;hfPullDistance=0;hfPullTracking=true},{passive:true});
document.addEventListener('touchmove',e=>{if(!hfPullTracking||e.touches?.length!==1)return;let dy=e.touches[0].clientY-hfPullStartY;if(dy<=0){hfPullTracking=false;hfSetPullVisual(0);return}hfPullDistance=Math.min(110,dy*.58);hfSetPullVisual(hfPullDistance);if(hfPullDistance>8)e.preventDefault()},{passive:false});
document.addEventListener('touchend',()=>{if(!hfPullTracking)return;let trigger=hfPullDistance>=72;hfPullTracking=false;let d=hfPullDistance;hfPullDistance=0;if(trigger)hfRunPullRefresh();else{hfSetPullVisual(Math.min(d,20));setTimeout(()=>hfSetPullVisual(0),120)}});

// A pending approval is server state and must never remain stuck behind an old local snapshot.
setInterval(()=>{let pending=$('#pendingPanel');if(state.user&&navigator.onLine&&pending&&!pending.classList.contains('hidden')&&!state.syncing)refreshFromServer({renderAfter:true}).catch(()=>{})},12000);

// Service Worker registration moved to src/core/pwa.js in v2.12.

/* ---- migrated from v2.11 legacy runtime ---- */
