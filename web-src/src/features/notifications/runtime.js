/* Halaqati v2.15.7 — official Capacitor PushNotifications + guardian notification runtime.
   Push registration uses @capacitor/push-notifications only; no custom Push bridge or FID path. */
const NOTIFY_FUNCTION='halaqati-notify';
let notificationRefreshTimer=null;
let notificationLastRefresh=0;
let pushListenersReady=false;
let pushRegistrationToken='';
let pushActivationPromise=null;
let pushOnlineListenerReady=false;
let pushRegistrationResolver=null;

function canSendNotifications(){return ['admin','supervisor'].includes(state.profile?.role)}
function notificationUnreadCount(){return Number(state.notificationUnread||0)}
function notificationKindAr(kind){return {attendance:'الحضور',recitation:'التسميع',behavior:'السلوك',announcement:'إعلان',achievement:'إنجاز',manual:'إشعار',system:'النظام'}[kind]||'إشعار'}
function notificationKindIcon(kind){return {attendance:'✓',recitation:'۞',behavior:'●',announcement:'◉',achievement:'★',manual:'✦',system:'⚙'}[kind]||'•'}
function notificationDate(v){try{return new Date(v).toLocaleString('ar-EG-u-nu-latn',{dateStyle:'medium',timeStyle:'short'})}catch{return String(v||'')}}

async function invokeNotify(body,{silent=false}={}){
  if(!navigator.onLine||!state.user?.id){if(!silent)toast('الإشعارات تحتاج اتصالاً بالإنترنت');return null}
  try{
    if(!(await ensureServerAuthSession({silent:true})))throw new Error('تعذر التحقق من جلسة الحساب');
    let {data,error}=await db.functions.invoke(NOTIFY_FUNCTION,{body});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    return data||{};
  }catch(e){if(!silent)toast('تعذر تنفيذ الإشعار: '+(e?.message||e));console.warn('notify failed',e);return null}
}

async function refreshNotifications({silent=true}={}){
  if(!state.user?.id||!navigator.onLine)return state.notifications||[];
  try{
    let [mine,sent,prefs]=await Promise.all([
      db.from('notifications').select('*').eq('recipient_id',state.user.id).order('created_at',{ascending:false}).limit(120),
      canSendNotifications()?db.from('notifications').select('*').eq('sender_id',state.user.id).neq('recipient_id',state.user.id).order('created_at',{ascending:false}).limit(80):Promise.resolve({data:[],error:null}),
      db.from('notification_preferences').select('*').eq('user_id',state.user.id).maybeSingle()
    ]);
    if(mine.error)throw mine.error;
    state.notifications=mine.data||[];
    state.sentNotifications=sent?.data||[];
    state.notificationUnread=state.notifications.filter(x=>!x.read_at).length;
    state.notificationPreferences=prefs?.data||{user_id:state.user.id,push_enabled:true,attendance:true,recitation:true,behavior:true,announcements:true,achievements:true};
    state.notificationsLoaded=true;
    notificationLastRefresh=Date.now();
    updateNotificationBadges();
    cacheSnapshot();
    return state.notifications;
  }catch(e){if(!silent)toast('تعذر تحديث الإشعارات');console.warn(e);return state.notifications||[]}
}

function updateNotificationBadges(){
  let n=notificationUnreadCount(),bell=$('#notificationBellCount');if(bell){bell.textContent=n>99?'99+':String(n);bell.classList.toggle('hidden',!n)}
  let nav=$('#navNotificationCount');if(nav){nav.textContent=n>99?'99+':String(n);nav.classList.toggle('hidden',!n)}
}

function notificationCard(n){let unread=!n.read_at,student=state.students.find(x=>x.id===n.student_id);return `<button class="notification-card ${unread?'unread':''}" type="button" onclick="openNotification('${n.id}')"><span class="notification-kind">${notificationKindIcon(n.kind)}</span><span class="grow notification-copy"><b>${esc(n.title)}</b><span>${esc(n.body)}</span><small>${notificationKindAr(n.kind)}${student?` · ${esc(student.full_name)}`:''} · ${notificationDate(n.created_at)}</small></span>${unread?'<i class="unread-dot"></i>':''}</button>`}
function sentNotificationSummary(){if(!canSendNotifications())return '';let rows=state.sentNotifications||[];if(!rows.length)return '<div class="muted">لم تُرسل إشعارات يدوية من هذا الحساب بعد.</div>';let grouped=new Map;rows.forEach(x=>{let k=x.source_key||x.id,g=grouped.get(k)||{...x,count:0,sent:0,errors:0};g.count++;if(x.push_status==='sent')g.sent++;if(x.push_status==='error')g.errors++;grouped.set(k,g)});return [...grouped.values()].slice(0,12).map(x=>`<div class="sent-notification-row"><div class="grow"><b>${esc(x.title)}</b><div class="muted">${notificationDate(x.created_at)} · ${x.count} مستلم</div></div><span class="badge ${x.errors?'red':x.sent?'good':''}">${x.sent?`${x.sent} Push`:'داخل التطبيق'}</span></div>`).join('')}

function notificationsPage(){
  let mine=state.notifications||[],unread=notificationUnreadCount();
  let sender=canSendNotifications()?notificationComposerHtml():'';
  let list=mine.length?mine.map(notificationCard).join(''):'<div class="empty">لا توجد إشعارات حتى الآن.</div>';
  setTimeout(()=>{refreshNotificationTargetOptions();if(navigator.onLine&&(!state.notificationsLoaded||Date.now()-notificationLastRefresh>15000))refreshNotifications({silent:true}).then(()=>{if(state.page==='notifications')render()})},20);
  return `<div class="hero"><h2>الإشعارات</h2><p>التحديثات الخاصة بالحضور والتسميع والسلوك والإعلانات والإنجازات في مكان واحد.</p><div class="notification-hero-row"><span class="badge ${unread?'warn':''}">${unread} غير مقروء</span><button class="mini" onclick="markAllNotificationsRead()">تحديد الكل كمقروء</button></div></div>${sender}<div class="section-head"><h3>مركز الإشعارات</h3><button class="mini" onclick="refreshNotifications({silent:false}).then(render)">تحديث</button></div><div class="notification-list">${list}</div>${canSendNotifications()?`<div class="section-head"><h3>آخر ما أرسلته</h3></div><div class="card">${sentNotificationSummary()}</div>`:''}`
}

function notificationComposerHtml(){let admin=isOwner();return `<div class="card notification-compose"><div class="section-head"><h3>إرسال إشعار</h3><span class="badge blue">${admin?'مسؤول النظام':'مشرف الحلقة'}</span></div><div class="notice">مسؤول النظام يستطيع الإرسال لكل الحلقات أو حلقة/فئة/طالب. المشرف يرسل فقط للحلقات التي يشرف عليها.</div><div class="form-grid" style="margin-top:10px"><label class="field"><span>النطاق</span><select id="ntScope" onchange="refreshNotificationTargetOptions()">${admin?'<option value="all">كل الحلقات</option>':''}<option value="halaqa" ${admin?'':'selected'}>حلقة</option><option value="category">فئة</option><option value="student">طالب</option></select></label><label class="field"><span>المستهدف</span><select id="ntTarget"><option value="">—</option></select></label><label class="field"><span>الجمهور</span><select id="ntAudience"><option value="guardians">أولياء الأمور</option><option value="all">كل المرتبطين</option><option value="teachers">المحفّظون</option></select></label><label class="field"><span>النوع</span><select id="ntKind"><option value="manual">إشعار عام</option><option value="achievement">إنجاز / تهنئة</option></select></label></div><label class="field"><span>العنوان</span><input id="ntTitle" class="input" maxlength="120" placeholder="مثال: تنبيه مهم لأولياء الأمور"></label><label class="field"><span>نص الإشعار</span><textarea id="ntBody" rows="4" maxlength="1200" placeholder="اكتب نص الإشعار"></textarea></label><div class="form-actions"><button id="ntSendBtn" class="btn btn-primary" onclick="sendManualNotification()">إرسال الإشعار</button></div></div>`}

function refreshNotificationTargetOptions(){let scope=$('#ntScope')?.value,target=$('#ntTarget');if(!target)return;if(scope==='all'){target.innerHTML='<option value="">كل الحلقات</option>';target.disabled=true;return}target.disabled=false;let rows=[];if(scope==='halaqa')rows=state.halaqas.map(x=>({id:x.id,label:x.name}));if(scope==='category')rows=state.categories.filter(x=>x.active!==false).map(x=>({id:x.id,label:`${x.name} · ${state.halaqas.find(h=>h.id===x.halaqa_id)?.name||''}`}));if(scope==='student')rows=activeStudents().map(x=>({id:x.id,label:`${x.full_name} · ${state.halaqas.find(h=>h.id===x.halaqa_id)?.name||''}`}));target.innerHTML=rows.length?rows.map(x=>`<option value="${x.id}">${esc(x.label)}</option>`).join(''):'<option value="">لا توجد بيانات</option>'}

async function sendManualNotification(){if(!canSendNotifications())return toast('الإرسال اليدوي لمسؤول النظام أو مشرف الحلقة فقط');let scope=$('#ntScope')?.value||'halaqa',target=scope==='all'?null:$('#ntTarget')?.value,title=$('#ntTitle')?.value.trim(),body=$('#ntBody')?.value.trim(),audience=$('#ntAudience')?.value||'guardians',kind=$('#ntKind')?.value||'manual';if(!title||!body)return toast('اكتب عنوان الإشعار ونصه');if(scope!=='all'&&!target)return toast('اختر المستهدف');let btn=$('#ntSendBtn');if(btn){btn.disabled=true;btn.textContent='جاري الإرسال...'}let res=await invokeNotify({action:'manual',scope,target_id:target,audience,kind,title,body});if(btn){btn.disabled=false;btn.textContent='إرسال الإشعار'}if(!res)return;toast(`تم إنشاء الإشعار لـ ${res.recipients||0} مستلم${res.push_configured?` · Push ${res.push_sent||0}`:' · داخل التطبيق'}`);$('#ntTitle').value='';$('#ntBody').value='';await refreshNotifications({silent:true});render()}

async function markNotificationRead(id){let n=(state.notifications||[]).find(x=>x.id===id);if(!n||n.read_at)return;let now=new Date().toISOString();n.read_at=now;state.notificationUnread=Math.max(0,notificationUnreadCount()-1);updateNotificationBadges();if(navigator.onLine)db.from('notifications').update({read_at:now}).eq('id',id).eq('recipient_id',state.user.id).then(()=>{}).catch(()=>{})}
async function markAllNotificationsRead(){let unread=(state.notifications||[]).filter(x=>!x.read_at);if(!unread.length)return toast('لا توجد إشعارات غير مقروءة');let now=new Date().toISOString();unread.forEach(x=>x.read_at=now);state.notificationUnread=0;updateNotificationBadges();render();if(navigator.onLine){let {error}=await db.from('notifications').update({read_at:now}).eq('recipient_id',state.user.id).is('read_at',null);if(error)console.warn(error)}}
async function openNotification(id){let n=(state.notifications||[]).find(x=>x.id===id);if(!n)return;await markNotificationRead(id);openNotificationDeepLink(n.deep_link||'',n)}
function openNotificationDeepLink(link,n={}){let value=String(link||'');if(value.startsWith('student:')){let id=value.split(':')[1];state.page=state.profile?.role==='guardian'?'profile':'students';render();setTimeout(()=>studentProfile(id),30);return}if(value==='community'){go('community');return}if(value==='notifications'||!value){go('notifications');return}go(value)}

function notificationPreferencesDefaults(){return {user_id:state.user?.id||'',push_enabled:true,attendance:true,recitation:true,behavior:true,announcements:true,achievements:true}}
function notificationSettingsCard(){
  let p={...notificationPreferencesDefaults(),...(state.notificationPreferences||{})},native=isNativeHalaqati(),configured=pushBuildConfigured(),ps=state.pushState||{},status=ps.permission||'unknown';
  let statusText=ps.registered?`مفعّل · الجهاز مسجل${ps.tokenLast4?` · ${ps.tokenLast4}`:''}`:ps.activating?'جارٍ تسجيل الجهاز في FCM…':ps.error?`خطأ FCM: ${ps.error}`:ps.tokenReceived?'تم استلام FCM Token · جار حفظ الجهاز':status==='granted'?'بانتظار تسجيل FCM':status==='denied'?'مرفوض من إعدادات Android':status==='unconfigured'?'Firebase غير مضاف لهذا APK':status==='unavailable'?'إضافة Push الرسمية غير متاحة':status==='prompt'||status==='prompt-with-rationale'?'بانتظار موافقة Android':'بانتظار التحقق';
  return `<div class="card"><h3>الإشعارات</h3><div class="muted">${native?'اسمح بإشعارات الجهاز لتصلك تحديثات الحلقة.':'تظهر تحديثات الحلقة والحضور والتسميع في مركز الإشعارات داخل الموقع.'}</div><div class="settings-row"><div><b>إشعارات الهاتف Push</b><div class="muted">${native?`الحالة: ${esc(statusText)}`:'مركز الإشعارات يعمل على الويب؛ Push الخارجي مخصص لتطبيق الهاتف.'}</div></div><input id="npPush" type="checkbox" ${p.push_enabled?'checked':''} ${native?'':'disabled aria-label="تفعيل إشعارات الخلفية من تطبيق الهاتف"'}></div>${[['npAttendance','attendance','الحضور والغياب','حضور، غياب، بعذر، وتأخر'],['npRecitation','recitation','الحفظ والمراجعة والسرد','نتائج التسميع والتعليقات والواجب'],['npBehavior','behavior','السلوك','تغييرات السلوك والمتابعة'],['npAnnouncements','announcements','الإعلانات','إعلانات الحلقة والإشعارات العامة'],['npAchievements','achievements','الإنجازات','التهاني والإنجازات']].map(([id,k,t,d])=>`<div class="settings-row"><div><b>${t}</b><div class="muted">${d}</div></div><input id="${id}" type="checkbox" ${p[k]?'checked':''}></div>`).join('')}<div class="form-actions"><button class="btn btn-primary" onclick="saveNotificationPreferences()">حفظ تفضيلات الإشعارات</button>${native&&configured?`${ps.error?'<button class="btn btn-soft" onclick="enablePushNotifications(true)">إعادة المحاولة</button>':''}<button class="btn btn-ghost" onclick="sendTestPush()">اختبار الإشعار</button>`:native?'<span class="muted">Push الخارجي غير مفعّل في هذا APK؛ مركز الإشعارات الداخلي يعمل بأمان.</span>':''}</div></div>`
}

async function saveNotificationPreferences(){
  if(!state.user?.id)return;
  let p={user_id:state.user.id,push_enabled:!!$('#npPush')?.checked,attendance:!!$('#npAttendance')?.checked,recitation:!!$('#npRecitation')?.checked,behavior:!!$('#npBehavior')?.checked,announcements:!!$('#npAnnouncements')?.checked,achievements:!!$('#npAchievements')?.checked};
  state.notificationPreferences=p;
  let {error}=await db.from('notification_preferences').upsert(p,{onConflict:'user_id'});
  if(error)return toast('تعذر حفظ تفضيلات الإشعارات: '+error.message);
  toast('تم حفظ تفضيلات الإشعارات');
  if(p.push_enabled&&isNativeHalaqati()&&pushBuildConfigured())setTimeout(()=>enablePushNotifications(false).catch(()=>{}),50);
}

function pushBuildConfigured(){return window.HalaqatiPushConfigured===true}
function officialPushPlugin(){return window.HalaqatiPushNotifications||null}
function refreshPushSettingsUi(){try{if(state.page==='settings'||state.page==='notifications')setTimeout(()=>render(),0)}catch(e){}}

function waitForOfficialRegistration(ms=18000){
  return new Promise(resolve=>{
    let done=false;
    let timer=setTimeout(()=>{if(done)return;done=true;if(pushRegistrationResolver)pushRegistrationResolver=null;resolve(false)},ms);
    pushRegistrationResolver=(ok)=>{if(done)return;done=true;clearTimeout(timer);pushRegistrationResolver=null;resolve(!!ok)};
  });
}
function finishOfficialRegistration(ok){if(pushRegistrationResolver){let fn=pushRegistrationResolver;pushRegistrationResolver=null;try{fn(!!ok)}catch(e){}}}

async function registerPushToken(token){
  token=String(token||'').trim();
  if(!token||!state.user?.id)return false;
  pushRegistrationToken=token;
  state.pushState={...(state.pushState||{}),permission:'granted',tokenReceived:true,registered:false,activating:true,error:''};
  refreshPushSettingsUi();
  let res=await invokeNotify({action:'register_device',push_token:token,platform:window.Capacitor?.getPlatform?.()||'android',app_version:APP_VERSION_NAME},{silent:true});
  if(res){
    state.pushState={...(state.pushState||{}),registered:true,tokenReceived:true,tokenLast4:token.slice(-4),permission:'granted',activating:false,error:''};
    finishOfficialRegistration(true);refreshPushSettingsUi();return true;
  }
  state.pushState={...(state.pushState||{}),registered:false,activating:false,error:navigator.onLine?'تم استلام FCM Token لكن تعذر تسجيل الجهاز في الخادم':'تم استلام FCM Token وسيُحفظ عند عودة الإنترنت'};
  finishOfficialRegistration(false);refreshPushSettingsUi();return false;
}

async function setupOfficialPushListeners(plugin){
  if(pushListenersReady)return true;
  if(!plugin?.addListener)throw new Error('إضافة PushNotifications الرسمية غير متاحة');
  await plugin.addListener('registration',ev=>{
    registerPushToken(ev?.value||'').catch(e=>{
      state.pushState={...(state.pushState||{}),registered:false,activating:false,error:String(e?.message||e)};
      finishOfficialRegistration(false);refreshPushSettingsUi();
    });
  });
  await plugin.addListener('registrationError',err=>{
    let msg=String(err?.error||err?.message||err||'FCM registration failed');
    state.pushState={...(state.pushState||{}),registered:false,activating:false,error:msg};
    finishOfficialRegistration(false);refreshPushSettingsUi();console.warn('FCM registration error',err);
  });
  await plugin.addListener('pushNotificationReceived',async ev=>{
    await refreshNotifications({silent:true});
    updateNotificationBadges();
    if(ev?.title)toast(ev.title);
  });
  await plugin.addListener('pushNotificationActionPerformed',async ev=>{
    let data=ev?.notification?.data||{};
    await refreshNotifications({silent:true});
    openNotificationDeepLink(data.deep_link||'notifications',data);
  });
  pushListenersReady=true;
  return true;
}

async function _enablePushNotifications(userInitiated=false){
  if(!isNativeHalaqati()){if(userInitiated)toast('Push الخارجي متاح داخل تطبيق Android');return false}
  if(!pushBuildConfigured()){state.pushState={permission:'unconfigured',registered:false,activating:false};if(userInitiated)toast('Firebase غير مضاف لهذا الإصدار');refreshPushSettingsUi();return false}
  if(!navigator.onLine){state.pushState={...(state.pushState||{}),registered:false,activating:false,error:'يلزم الإنترنت لتسجيل Push'};if(userInitiated)toast('شغّل الإنترنت ثم أعد المحاولة');refreshPushSettingsUi();return false}
  let plugin=officialPushPlugin();
  if(!plugin){state.pushState={permission:'unavailable',registered:false,activating:false,error:'إضافة PushNotifications الرسمية غير متاحة في APK'};refreshPushSettingsUi();return false}
  try{
    state.pushState={...(state.pushState||{}),activating:true,error:''};refreshPushSettingsUi();
    let perm=await plugin.checkPermissions();
    if(perm?.receive==='prompt'||perm?.receive==='prompt-with-rationale')perm=await plugin.requestPermissions();
    let receive=perm?.receive||'denied';
    state.pushState={...(state.pushState||{}),permission:receive,activating:receive==='granted',error:''};refreshPushSettingsUi();
    if(receive!=='granted'){
      state.pushState={...(state.pushState||{}),registered:false,activating:false,error:receive==='denied'?'إذن الإشعارات مرفوض من Android':'لم يتم منح إذن الإشعارات'};
      if(userInitiated)toast('اسمح بالإشعارات من إعدادات Android');refreshPushSettingsUi();return false;
    }
    await setupOfficialPushListeners(plugin);
    try{await plugin.createChannel?.({id:'halaqati_general',name:'حلقتي',description:'إشعارات الحضور والتسميع والإعلانات',importance:5,visibility:1,vibration:true,sound:'default'})}catch(e){console.warn('Push channel creation skipped',e)}
    let waiter=userInitiated?waitForOfficialRegistration(18000):null;
    await plugin.register();
    if(!userInitiated)return true;
    let ok=await waiter;
    if(!ok&&!state.pushState?.error){state.pushState={...(state.pushState||{}),registered:false,activating:false,error:'لم يصل FCM Token من Firebase خلال المهلة'};refreshPushSettingsUi()}
    return !!ok;
  }catch(e){
    let msg=String(e?.message||e||'تعذر تفعيل Push');
    state.pushState={...(state.pushState||{}),registered:false,activating:false,error:msg};finishOfficialRegistration(false);refreshPushSettingsUi();
    if(userInitiated)toast('تعذر تفعيل Push: '+msg);console.warn('Official Push activation failed',e);return false;
  }
}

function enablePushNotifications(userInitiated=false){
  if(pushActivationPromise)return pushActivationPromise;
  pushActivationPromise=_enablePushNotifications(userInitiated).finally(()=>{pushActivationPromise=null;if(state.pushState?.activating&&!state.pushState?.registered){state.pushState.activating=false;refreshPushSettingsUi()}});
  return pushActivationPromise;
}

async function unregisterPushDevice(){
  let token=pushRegistrationToken;
  if(token&&state.user?.id&&navigator.onLine){try{await invokeNotify({action:'unregister_device',push_token:token},{silent:true})}catch(e){}}
  pushRegistrationToken='';state.pushState={permission:state.pushState?.permission||'unknown',registered:false,activating:false};return true;
}

async function sendTestPush(){
  if(isNativeHalaqati()&&!state.pushState?.registered){
    let ready=await enablePushNotifications(true);
    if(!ready){toast(state.pushState?.error?'Push غير جاهز: '+state.pushState.error:'لم يكتمل تسجيل Push بعد');return}
  }
  let r=await invokeNotify({action:'test_push'});
  if(r)toast(r.push_configured?(r.push_sent?'تم إرسال إشعار الاختبار إلى الهاتف':'تم إنشاء الاختبار لكن لم يصل Push؛ راجع حالة الجهاز'):'مركز الإشعارات يعمل؛ يلزم إكمال إعداد Firebase لتفعيل Push الخارجي');
}

async function initHalaqatiNotifications(){
  if(!state.user?.id||!state.profile)return;
  await refreshNotifications({silent:true});
  if(!state.notificationPreferences)state.notificationPreferences=notificationPreferencesDefaults();
  if(!notificationRefreshTimer)notificationRefreshTimer=setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)refreshNotifications({silent:true})},60000);
  if(pushBuildConfigured()&&state.notificationPreferences?.push_enabled!==false){
    setTimeout(()=>enablePushNotifications(false).catch(e=>console.warn('Automatic official Push init skipped',e)),900);
    if(!pushOnlineListenerReady){window.addEventListener('online',()=>{if(state.user?.id&&state.notificationPreferences?.push_enabled!==false&&!state.pushState?.registered)setTimeout(()=>enablePushNotifications(false).catch(()=>{}),350)});pushOnlineListenerReady=true}
  }else if(isNativeHalaqati()&&!pushBuildConfigured())state.pushState={permission:'unconfigured',registered:false,activating:false};
  updateNotificationBadges();
}

function studentNameForNotification(id){return state.students.find(x=>x.id===id)?.full_name||'الطالب'}
async function emitAttendanceNotification(p){if(!p?.student_id||!p?.session_id)return;let st=studentNameForNotification(p.student_id),status=attAr[p.status]||p.status||'تم تحديث الحضور',extra=p.status==='late'&&p.arrival_minutes_late?` (${p.arrival_minutes_late} دقيقة)`:(p.status==='excused'&&p.excuse_reason?` · ${p.excuse_reason}`:'');await invokeNotify({action:'event_student',kind:'attendance',student_id:p.student_id,session_id:p.session_id,source_key:`attendance:${p.session_id}:${p.student_id}`,title:`الحضور · ${st}`,body:`تم تسجيل ${status}${extra}.`,deep_link:`student:${p.student_id}`,data:{status:p.status||''}},{silent:true})}
async function emitBehaviorNotification(p){if(!p?.student_id||!p?.session_id)return;let st=studentNameForNotification(p.student_id),behavior=behAr[p.behavior]||p.behavior||'تم تحديث السلوك';await invokeNotify({action:'event_student',kind:'behavior',student_id:p.student_id,session_id:p.session_id,source_key:`behavior:${p.session_id}:${p.student_id}`,title:`السلوك · ${st}`,body:`تم تسجيل السلوك: ${behavior}.`,deep_link:`student:${p.student_id}`,data:{behavior:p.behavior||''}},{silent:true})}
function recitationSummary(rows=[]){let groups={new_hifz:0,review:0,sard:0};for(let rr of rows){let d=rr.data||rr,p=Number(d.pages_count||0),a=d.activity_type;if(a==='new_hifz')groups.new_hifz+=p;else if(a==='sard')groups.sard+=p;else if(String(a||'').startsWith('review'))groups.review+=p}let parts=[];if(groups.new_hifz)parts.push(`حفظ ${fmt(groups.new_hifz)} ص`);if(groups.review)parts.push(`مراجعة ${fmt(groups.review)} ص`);if(groups.sard)parts.push(`سرد ${fmt(groups.sard)} ص`);return parts.join(' · ')}
async function emitDailyReportNotification(p){if(!p?.studentId||!p?.sessionId)return;let st=studentNameForNotification(p.studentId),sum=recitationSummary(p.rows||[]),att=attAr[p.attendance?.status]||'',comment=p.note?.teacher_comment||'',homework=p.note?.homework||'',parts=[att?`الحضور: ${att}`:'',sum,comment?`تعليق: ${comment}`:'',homework?`الواجب: ${homework}`:''].filter(Boolean);await invokeNotify({action:'event_student',kind:'recitation',student_id:p.studentId,session_id:p.sessionId,source_key:`report:${p.sessionId}:${p.studentId}`,title:`تقرير اليوم · ${st}`,body:parts.join(' · ')||'تم تحديث التقرير اليومي.',deep_link:`student:${p.studentId}`,data:{attendance:p.attendance?.status||'',summary:sum}},{silent:true});let juz=[...new Set((p.rows||[]).flatMap(rr=>{let d=rr.data||rr;if(d.activity_type!=='new_hifz'||(d.selection_data?.mode||d.input_method)!=='juz')return [];return Array.isArray(d.selection_data?.selected_juz)?d.selection_data.selected_juz:[]}))].map(Number).filter(x=>x>=1&&x<=30).sort((a,b)=>a-b);if(juz.length){let label=juz.length===1?`الجزء ${juz[0]}`:`الأجزاء ${juz.join('، ')}`;await invokeNotify({action:'event_student',kind:'achievement',student_id:p.studentId,session_id:p.sessionId,source_key:`achievement:juz:${p.sessionId}:${p.studentId}:${juz.join('-')}`,title:`إنجاز قرآني · ${st}`,body:`تم تسجيل حفظ ${label}. بارك الله في جهده ووفقه للإتمام والمراجعة.`,deep_link:`student:${p.studentId}`,data:{achievement:'juz',juz}},{silent:true})}}
async function emitAnnouncementNotification(a){if(!a?.id||!canSendNotifications())return;return await invokeNotify({action:'announcement',announcement_id:a.id},{silent:true})}

function guardianNotificationStrip(){let rows=(state.notifications||[]).slice(0,3);if(!rows.length)return `<div class="section-head"><h3>آخر الإشعارات</h3><button class="mini" onclick="go('notifications')">فتح المركز</button></div><div class="empty">لا توجد إشعارات جديدة.</div>`;return `<div class="section-head"><h3>آخر الإشعارات</h3><button class="mini" onclick="go('notifications')">عرض الكل ${notificationUnreadCount()?`(${notificationUnreadCount()})`:''}</button></div><div class="notification-list compact">${rows.map(notificationCard).join('')}</div>`}
