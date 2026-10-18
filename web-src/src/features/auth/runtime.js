/* Halaqati v2.14.0 — authentication/session bootstrap + account-name confirmation. */
function hideAuthForms(){['loginForm','signupForm','forgotPasswordForm','recoveryPasswordForm','pendingPanel'].forEach(id=>$('#'+id)?.classList.add('hidden'))}
function toggleSignup(v){hideAuthForms();$(v?'#signupForm':'#loginForm').classList.remove('hidden')}
function showForgotPassword(v=true){hideAuthForms();if(v){$('#forgotEmail').value=$('#loginEmail')?.value.trim()||'';$('#forgotPasswordForm').classList.remove('hidden')}else $('#loginForm').classList.remove('hidden')}
function showPasswordRecovery(){hideAuthForms();$('#recoveryPasswordForm').classList.remove('hidden')}
let googleSignInBusy=false;
let nativeAuthListenerReady=false;
let syncAuthRecoveryExpectedUserId=null;

function isGoogleAccount(user=state.user){
  let provider=String(user?.app_metadata?.provider||'').toLowerCase();
  if(provider==='google')return true;
  return Array.isArray(user?.identities)&&user.identities.some(x=>String(x?.provider||'').toLowerCase()==='google');
}
function accountNameConfirmed(profile=state.profile){return profile?.preferences?.account_name_confirmed===true}
function openAccountNameDialog(firstLogin=false){
  let dlg=$('#accountNameDlg');if(!dlg)return;
  $('#accountNameDlgTitle').textContent=firstLogin?'تأكيد اسمك الكامل':'تعديل اسم الحساب';
  $('#accountNameNotice').innerHTML=firstLogin
    ? '<b>تم تسجيل الدخول باستخدام Google.</b><br>أكد اسمك الكامل كما تريد أن يظهر لمسؤول الحلقة، حتى يسهل التعرف على حساب ولي الأمر وربطه بالطالب الصحيح.'
    : 'اكتب الاسم الكامل كما تريد أن يظهر داخل حلقتي وفي قوائم الحسابات وأولياء الأمور.';
  $('#accountFullName').value=state.profile?.full_name||state.user?.user_metadata?.full_name||state.user?.user_metadata?.name||'';
  if(!dlg.open)dlg.showModal();
  setTimeout(()=>$('#accountFullName')?.focus(),80);
}
function maybePromptGoogleAccountName(){
  if(!navigator.onLine||!state.profile||!isGoogleAccount()||accountNameConfirmed())return;
  setTimeout(()=>openAccountNameDialog(true),120);
}
async function saveMyAccountName(){
  if(!state.user?.id||!state.profile)return toast('تعذر تحديد الحساب الحالي');
  if(!navigator.onLine)return toast('تعديل الاسم يحتاج اتصالاً بالإنترنت');
  let input=$('#accountFullName'),name=String(input?.value||'').trim().replace(/\s+/g,' ');
  if(name.length<3)return toast('اكتب الاسم الكامل بشكل واضح');
  let btn=$('#accountNameSaveBtn');if(btn){btn.disabled=true;btn.textContent='جاري الحفظ...'}
  try{
    if(!(await ensureServerAuthSession({silent:true})))throw new Error('تعذر التحقق من جلسة الحساب');
    let prefs={...(state.profile.preferences||{}),account_name_confirmed:true,account_name_updated_at:new Date().toISOString()};
    let {data,error}=await db.from('profiles').update({full_name:name,preferences:prefs}).eq('id',state.user.id).select().single();
    if(error)throw error;
    state.profile=data||{...state.profile,full_name:name,preferences:prefs};
    try{await db.auth.updateUser({data:{full_name:name,name}})}catch(e){}
    if(Array.isArray(state.users)){let u=state.users.find(x=>x.id===state.user.id);if(u)u.full_name=name}
    cacheSnapshot();
    $('#userName')&&($('#userName').textContent=name);
    $('#drawerUser')&&($('#drawerUser').textContent=`${name} · ${roleAr[state.profile.role]||state.profile.role}`);
    $('#userAvatar')&&($('#userAvatar').textContent=(name||'ح')[0]);
    try{$('#accountNameDlg')?.close()}catch(e){}
    if(state.page==='settings')render();
    toast('تم حفظ اسم الحساب');
  }catch(e){toast('تعذر حفظ الاسم: '+(e?.message||e))}
  finally{if(btn){btn.disabled=false;btn.textContent='حفظ الاسم'}}
}
function openSyncAuthRecovery(){
  if(!navigator.onLine)return toast('شغّل الإنترنت أولاً لإكمال المزامنة');
  let dlg=$('#syncAuthDlg');if(!dlg)return;
  let last=readOfflineAuth();$('#syncAuthEmail').value=state.user?.email||last?.email||'';$('#syncAuthPassword').value='';
  let count=readOfflineQueue().length;$('#syncAuthCount').textContent=String(count);
  if(!dlg.open)dlg.showModal()
}
async function finishSyncReauth(user){
  let expected=syncAuthRecoveryExpectedUserId||state.user?.id||readOfflineAuth()?.id;
  if(!user?.id)throw new Error('لم يتم إنشاء جلسة دخول صالحة');
  if(expected&&user.id!==expected){try{await db.auth.signOut()}catch(e){}throw new Error('الحساب الذي تم تسجيله لا يطابق صاحب البيانات المحلية. استخدم نفس الحساب السابق.')}
  state.user=user;saveOfflineAuth(user);await prepareOfflineStorageForUser(user.id);state.authNeedsLogin=false;state.syncIssue='';syncAuthRecoveryExpectedUserId=null;
  try{$('#syncAuthDlg')?.close()}catch(e){}
  updateSyncBadge();await syncOfflineQueue({refreshAfter:true});
}
async function syncReauthWithPassword(){
  if(!navigator.onLine)return toast('شغّل الإنترنت أولاً');
  let email=$('#syncAuthEmail').value.trim(),password=$('#syncAuthPassword').value;if(!email||!password)return toast('اكتب البريد وكلمة المرور');
  syncAuthRecoveryExpectedUserId=state.user?.id||readOfflineAuth()?.id||null;
  let btn=$('#syncAuthSubmit');if(btn){btn.disabled=true;btn.textContent='جاري التحقق...'}
  try{let {data,error}=await db.auth.signInWithPassword({email,password});if(error)throw error;await finishSyncReauth(data.user)}catch(e){toast('تعذر تجديد تسجيل الدخول: '+(e?.message||e))}finally{if(btn){btn.disabled=false;btn.textContent='تجديد الدخول والمزامنة'}}
}
async function syncReauthWithGoogle(){syncAuthRecoveryExpectedUserId=state.user?.id||readOfflineAuth()?.id||null;window.__HALAQATI_SYNC_REAUTH__=true;await loginWithGoogle()}
async function handleSyncBadgeClick(){if(state.authNeedsLogin)return openSyncAuthRecovery();openSyncStatusDialog()}

function isNativeHalaqati(){
  return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform==='function' && window.Capacitor.isNativePlatform());
}

function authParamsFromUrl(url){
  try{
    const u=new URL(url);
    const q=new URLSearchParams(u.search||'');
    const h=new URLSearchParams((u.hash||'').replace(/^#/,''));
    const get=k=>h.get(k)||q.get(k);
    return {
      access_token:get('access_token'),
      refresh_token:get('refresh_token'),
      code:get('code'),
      error:get('error'),
      error_code:get('error_code'),
      error_description:get('error_description')
    };
  }catch(e){return {}}
}

async function finishNativeGoogleLogin(url){
  if(!url || !url.startsWith(APP_DEEP_LINK))return false;
  const p=authParamsFromUrl(url);

  try{ await window.Capacitor?.Plugins?.Browser?.close?.(); }catch(e){}

  if(p.error || p.error_code){
    googleSignInBusy=false;
    toast('تعذر تسجيل الدخول باستخدام Google: '+decodeURIComponent(p.error_description||p.error||p.error_code||'خطأ غير معروف'));
    return true;
  }

  try{
    let session=null;

    // Supabase implicit OAuth flow (most common for this app)
    if(p.access_token && p.refresh_token){
      const {data,error}=await db.auth.setSession({
        access_token:p.access_token,
        refresh_token:p.refresh_token
      });
      if(error)throw error;
      session=data?.session;
    }
    // Support PKCE too if Supabase returns an authorization code.
    else if(p.code && db.auth.exchangeCodeForSession){
      const {data,error}=await db.auth.exchangeCodeForSession(p.code);
      if(error)throw error;
      session=data?.session;
    }

    if(!session){
      const {data}=await db.auth.getSession();
      session=data?.session||null;
    }

    if(!session?.user)throw new Error('لم يتم إنشاء جلسة تسجيل الدخول');

    googleSignInBusy=false;
    history.replaceState?.(null,'',location.pathname||'/');
    if(window.__HALAQATI_SYNC_REAUTH__){window.__HALAQATI_SYNC_REAUTH__=false;await finishSyncReauth(session.user);toast('تم تجديد تسجيل الدخول ومزامنة البيانات');}
    else{await boot(session.user);toast('تم تسجيل الدخول باستخدام Google')}
  }catch(err){
    googleSignInBusy=false;
    toast('اكتمل اختيار حساب Google لكن تعذر فتح الجلسة: '+(err?.message||err));
  }
  return true;
}

async function setupNativeAuthDeepLink(){
  if(!isNativeHalaqati() || nativeAuthListenerReady)return;
  const AppPlugin=window.Capacitor?.Plugins?.App;
  if(!AppPlugin)return;

  nativeAuthListenerReady=true;

  try{
    await AppPlugin.addListener('appUrlOpen', async ({url})=>{
      await finishNativeGoogleLogin(url);
    });
  }catch(e){}

  // Handles the case where Android launched the app from the OAuth callback
  // before the JavaScript listener had finished loading.
  try{
    const launch=await AppPlugin.getLaunchUrl();
    if(launch?.url)await finishNativeGoogleLogin(launch.url);
  }catch(e){}
}

async function loginWithGoogle(){
  if(googleSignInBusy)return;
  if(!navigator.onLine)return toast('تسجيل الدخول بحساب Google يحتاج اتصالاً بالإنترنت');

  googleSignInBusy=true;

  try{
    if(isNativeHalaqati()){
      await setupNativeAuthDeepLink();

      const {data,error}=await db.auth.signInWithOAuth({
        provider:'google',
        options:{
          redirectTo:APP_DEEP_LINK,
          skipBrowserRedirect:true,
          queryParams:{prompt:'select_account'}
        }
      });

      if(error)throw error;
      if(!data?.url)throw new Error('لم يتم إنشاء رابط تسجيل الدخول');

      const BrowserPlugin=window.Capacitor?.Plugins?.Browser;
      if(BrowserPlugin?.open){
        await BrowserPlugin.open({
          url:data.url,
          presentationStyle:'popover'
        });
      }else{
        // Fallback if Browser plugin is unavailable.
        location.href=data.url;
      }
      return;
    }

    // Browser/HTML preview fallback.
    const webRedirect=(location.protocol==='http:'||location.protocol==='https:')
      ? (location.origin+location.pathname)
      : GOOGLE_REDIRECT_URL;

    const {error}=await db.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:webRedirect,
        queryParams:{prompt:'select_account'}
      }
    });
    if(error)throw error;

  }catch(err){
    googleSignInBusy=false;
    const msg=String(err?.message||err);
    if(msg.toLowerCase().includes('provider') && msg.toLowerCase().includes('enabled')){
      return toast('Google Provider غير مفعّل في Supabase');
    }
    toast('تعذر تسجيل الدخول باستخدام Google: '+msg);
  }
}

// Register the deep-link handler as soon as the Capacitor bridge is available.
setTimeout(()=>setupNativeAuthDeepLink(),0);

async function login(){let {data,error}=await db.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});if(error)return toast('تعذر تسجيل الدخول: '+error.message);await boot(data.user)}
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();login()});
$('#syncAuthForm')?.addEventListener('submit',e=>{e.preventDefault();syncReauthWithPassword()});
$('#signupForm').addEventListener('submit',async e=>{e.preventDefault();let requested=$('#signupRole').value;let {data,error}=await db.auth.signUp({email:$('#signupEmail').value.trim(),password:$('#signupPassword').value,options:{data:{full_name:$('#signupName').value.trim(),phone:$('#signupPhone').value.trim(),requested_role:requested}}});if(error)return toast(error.message);if(data.session){await boot(data.user)}else{toggleSignup(false);$('#loginEmail').value=$('#signupEmail').value.trim();toast('تم إرسال طلب الحساب. أكد البريد الإلكتروني إن طُلب، ثم انتظر اعتماد المسؤول.')}});
$('#forgotPasswordForm').addEventListener('submit',async e=>{e.preventDefault();let email=$('#forgotEmail').value.trim();if(!email)return toast('اكتب البريد الإلكتروني');let btn=e.submitter;if(btn){btn.disabled=true;btn.textContent='جاري الإرسال...'}let {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:OFFICIAL_APP_URL});if(btn){btn.disabled=false;btn.textContent='إرسال رابط الاسترجاع'}if(error)return toast('تعذر إرسال رابط الاسترجاع: '+error.message);toast('تم إرسال رابط استرجاع كلمة المرور. افحص البريد الوارد والرسائل غير المرغوب فيها.');showForgotPassword(false);$('#loginEmail').value=email});
$('#recoveryPasswordForm').addEventListener('submit',async e=>{e.preventDefault();let p1=$('#recoveryPassword').value,p2=$('#recoveryPassword2').value;if(p1.length<6)return toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل');if(p1!==p2)return toast('كلمتا المرور غير متطابقتين');let {data:{session}}=await db.auth.getSession();if(!session)return toast('رابط الاسترجاع غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً.');let {error}=await db.auth.updateUser({password:p1});if(error)return toast('تعذر تغيير كلمة المرور: '+error.message);toast('تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول بالكلمة الجديدة.');await db.auth.signOut();history.replaceState(null,'',location.pathname);$('#recoveryPassword').value='';$('#recoveryPassword2').value='';toggleSignup(false)});
function showAccessStatus(p){hideAuthForms();$('#pendingPanel').classList.remove('hidden');let rejected=p.approval_status==='rejected',blocked=p.approval_status==='approved'&&!p.active;$('#pendingIcon').textContent=rejected?'!':blocked?'×':'⌛';$('#pendingTitle').textContent=rejected?'لم تتم الموافقة على الحساب':blocked?'الحساب موقوف':'الحساب قيد اعتماد المسؤول';$('#pendingText').textContent=rejected?(p.rejection_reason||'راجع مسؤول النظام لمعرفة سبب رفض الطلب.'):blocked?'تم إيقاف الحساب من إدارة النظام. تواصل مع مسؤول الحلقات.':'تم التحقق من بيانات الدخول، لكن الوصول إلى بيانات الحلقة لن يفتح حتى يحدد مسؤول النظام الصلاحية ويعتمد الحساب.';$('#pendingRole').textContent=requestRoleAr[p.requested_role]||requestRoleAr[p.role]||'ولي أمر'}
async function checkApproval(){if(!navigator.onLine)return toast('شغّل الإنترنت لتحديث حالة الاعتماد');let ok=await refreshFromServer({renderAfter:true});if(!ok&&state.profile?.approval_status!=='approved')toast('لم يتم اعتماد الحساب بعد. سيعيد التطبيق التحقق تلقائياً.');return ok}
async function refreshFromServer({renderAfter=true}={}){
  if(!state.user||!(await internetReachable(true)))return false;
  if(!(await ensureServerAuthSession({silent:true}))){state.offline=false;updateSyncBadge();return false}
  try{
    let res=await withTimeout(db.from('profiles').select('*').eq('id',state.user.id).single(),3500,'profile timeout');
    if(res.error)throw res.error;
    if(!res.data)throw new Error('profile missing');
    state.profile=res.data;
    saveOfflineAuth(state.user);
    maybePromptGoogleAccountName();
    if(state.profile.approval_status!=='approved'||!state.profile.active){showAccessStatus(state.profile);return false}
    if(readOfflineQueue().length){captureSyncSessionDependencies();await syncOfflineQueue({refreshAfter:false});if(readOfflineQueue().length)return false}
    await loadAll(true);
    cacheSnapshot();
    if(renderAfter&&$('#app')&&!$('#app').classList.contains('hidden'))render();
    return true
  }catch(e){state.networkVerified=false;state.offline=true;updateSyncBadge();return false}
}
async function boot(user=null){
  state.demo=false;
  let u=user,verifiedInput=!!user;
  if(!u){try{let r=await withTimeout(db.auth.getSession(),650,'session timeout');u=r?.data?.session?.user||null}catch(e){u=null}}
  if(!u&&!navigator.onLine){u=readOfflineAuth();verifiedInput=false}
  if(!u)return;
  state.user=u;if(verifiedInput)saveOfflineAuth(u);
  await prepareOfflineStorageForUser(u.id);

  // Local-first: restore and paint immediately. No network request is allowed to block the UI.
  let cached=restoreSnapshot();
  if(cached&&state.profile){captureSyncSessionDependencies();
    maybePromptGoogleAccountName();
    if(state.profile.approval_status!=='approved'||!state.profile.active){showAccessStatus(state.profile);setTimeout(()=>refreshFromServer({renderAfter:true}),80);return}
    state.fastStarted=true;
    $('#pendingPanel').classList.add('hidden');
    showApp();
    updateSyncBadge();
    setTimeout(()=>refreshFromServer({renderAfter:true}),60);
    return
  }

  // First ever launch on this device still needs one successful online load.
  if(!(await internetReachable(true)))return toast('لا توجد نسخة محلية بعد. افتح التطبيق مرة واحدة مع الإنترنت لتحميل بيانات حسابك.');
  let res;
  try{res=await withTimeout(db.from('profiles').select('*').eq('id',u.id).single(),4000,'profile timeout')}catch(e){return toast('تعذر تحميل الحساب حالياً')}
  if(res?.error||!res?.data)return toast('تعذر تحميل الحساب');
  state.profile=res.data;
  maybePromptGoogleAccountName();
  if(state.profile.approval_status!=='approved'||!state.profile.active){showAccessStatus(state.profile);return}
  $('#pendingPanel').classList.add('hidden');
  await loadAll(true);showApp();cacheSnapshot();setTimeout(syncOfflineQueue,250)
}
async function logout(){try{if(typeof unregisterPushDevice==='function')await unregisterPushDevice()}catch(e){}try{await db.auth.signOut()}catch(e){}clearOfflineAuth();location.reload()}
function showApp(){$('#auth').classList.add('hidden');$('#app').classList.remove('hidden');$('#roleLabel').textContent=roleAr[state.profile.role]||state.profile.role;$('#userName').textContent=state.profile.full_name;$('#drawerUser').textContent=`${state.profile.full_name} · ${roleAr[state.profile.role]}`;$('#userAvatar').textContent=(state.profile.full_name||'ح')[0];updateSyncBadge();render()}
async function loadRoleExtras(){state.guardianAccounts=[];state.guardianDirectory=[];state.guardianRanksMonth={};state.guardianRanksDay={};state.guardianRangeRanks={};state.guardianCompetition={};state.guardianActivities={};state.guardianAnalyticsError='';if(!state.networkVerified)return;if(roleCanManage()){let g=await db.rpc('list_guardian_accounts');if(!g.error)state.guardianAccounts=g.data||[]}if(state.profile?.role==='guardian'){state.guardianDirectory=[];let children=activeStudents();for(let st of children){let [m,day]=await Promise.all([db.rpc('student_rank_snapshot',{p_student_id:st.id,p_period:'month'}),db.rpc('student_rank_snapshot',{p_student_id:st.id,p_period:'day'})]);state.guardianRanksMonth[st.id]=m.data||[];state.guardianRanksDay[st.id]=day.data||[]}let ids=children.map(x=>x.id);if(ids.length){try{let [sr,nr]=await Promise.all([db.from('sessions').select('id,halaqa_id,session_date,title,session_type,activity_data').eq('session_type','lesson').order('session_date',{ascending:false}).limit(40),db.from('student_daily_notes').select('session_id,student_id,activity_score,activity_max_score,participation,teacher_comment,parent_visible,created_at').in('student_id',ids).eq('parent_visible',true).order('created_at',{ascending:false}).limit(160)]);if(!sr.error&&!nr.error){let sm=new Map((sr.data||[]).map(x=>[String(x.id),x]));for(let note of nr.data||[]){let stid=String(note.student_id),session=sm.get(String(note.session_id));if(session&&!state.guardianActivities[stid])state.guardianActivities[stid]={session,note}}}}catch(e){console.warn('guardian activity summary skipped',e)}};if(typeof loadGuardianDashboardData==='function')await loadGuardianDashboardData({silent:true})}}
async function loadAll(forceNetwork=false){
  let online=forceNetwork?true:await internetReachable();
  if(!online){if(restoreSnapshot()){state.pendingSync=readOfflineQueue().length;applySavedTheme();updateSyncBadge();return}state.offline=true;updateSyncBadge();return}
  state.networkVerified=true;state.offline=false;
  let queries=[db.from('halaqas').select('*').order('created_at'),db.from('students').select('*').order('full_name'),db.from('sessions').select('*').order('session_date',{ascending:false}).limit(120),db.from('announcements').select('*').order('pinned',{ascending:false}).order('publish_at',{ascending:false}).limit(80),db.from('student_goals').select('*').gte('period_end',monthStart()).limit(200),db.from('monthly_student_stats').select('*').gte('month_start',monthStart()),db.from('leaderboard_daily').select('*').eq('period_date',today()),db.from('leaderboard_monthly').select('*').gte('month_start',monthStart()),db.from('daily_student_summary').select('*').eq('session_date',today()).limit(200),db.from('forum_posts').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(80),db.from('forum_comments').select('*').order('created_at').limit(500),db.from('app_settings').select('*').eq('id',1).single(),db.from('student_categories').select('*').order('min_age',{ascending:true,nullsFirst:false}).order('name'),db.from('halaqa_teachers').select('*')];if(roleCanAdmin())queries.push(db.from('profiles').select('id,full_name,email,phone,role,requested_role,approval_status,active,approved_at,rejection_reason,created_at').order('created_at',{ascending:false}));
  let r;
  try{r=await withTimeout(Promise.all(queries),6500,'load timeout')}catch(e){state.networkVerified=false;state.offline=true;if(restoreSnapshot()){updateSyncBadge();return}throw e}
  let critical=r.slice(0,3).find(x=>x.error&&isNetworkError(x.error));if(critical&&restoreSnapshot()){state.networkVerified=false;state.offline=true;state.pendingSync=readOfflineQueue().length;updateSyncBadge();return}
  [state.halaqas,state.students,state.sessions,state.announcements,state.goals,state.monthly,state.leaderDaily,state.leaderMonthly,state.dailySummary,state.forum,state.comments]=r.slice(0,11).map(x=>x.data||[]);if(!state.homeSelectedMonth)state.homeSelectedMonth=today().slice(0,7);if(state.homeSelectedMonth===today().slice(0,7)){state.homeMonthly=[...state.monthly];state.homeMonthlyLoadedKey=state.homeSelectedMonth}state.settings=r[11]?.data||null;state.categories=r[12]?.data||[];state.halaqaTeachers=r[13]?.data||[];state.users=roleCanAdmin()?(r[14]?.data||[]):[];await loadRoleExtras();applySavedTheme();await loadPhotoUrls();state.pendingSync=readOfflineQueue().length;cacheSnapshot();updateSyncBadge()
}
async function loadPhotoUrls(){state.photoUrls={};if(state.demo||!state.networkVerified)return;await Promise.all(state.students.filter(s=>s.photo_path).map(async s=>{let {data}=await db.storage.from('student-photos').createSignedUrl(s.photo_path,3600);if(data?.signedUrl)state.photoUrls[s.id]=data.signedUrl}))}

