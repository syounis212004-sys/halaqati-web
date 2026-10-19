/* RC27.40 native screens: tools — app shell (bottom bar, drawer, top bar, sync banner), sync center, settings,
   import / export and the auth screens. Web twin of HalaqatiApp.kt (MainShell), GoldenShell.kt, Components.kt (AppTopBar,
   SyncBanner), SyncCenterScreen.kt, SettingsScreen + SettingsParitySections.kt, ImportExportScreen and AuthScreens.kt.
   Classic script: replaces the legacy global page functions after the legacy / RC27 layers. */
(function(){
  'use strict';
  const NX=window.NX;
  if(!NX)return;
  const NT=window.NT=window.NT||{};
  const h=NX.h,ic=NX.icon;
  const q=s=>document.querySelector(s);
  const root=document.documentElement;
  const isDk=()=>root.getAttribute('data-view')==='desktop';
  const reduced=()=>{try{return !!JSON.parse(localStorage.getItem('halaqati_display_v1')||'{}').reduceMotion}catch(_e){return false}};
  const role=()=>state.profile&&state.profile.role;
  const online=()=>!!(state.networkVerified&&!state.offline);
  const queue=()=>{try{return readOfflineQueue()}catch(_e){return []}};
  const pendingCount=()=>queue().length;
  const blockedCount=()=>queue().filter(x=>x.status==='failed').length;
  const progMode=()=>{try{return typeof rc27Scope==='function'&&rc27Scope().kind==='program'}catch(_e){return false}};
  const ROLE_TITLE={admin:'مسؤول النظام والحلقات',supervisor:'مشرف الحلقات',teacher:'محفّظ الحلقة',guardian:'ولي الأمر'};
  const roleTitle=r=>ROLE_TITLE[r]||'المستخدم';
  const navIcon=k=>(typeof navSvg==='function'?navSvg(k):'');
  const tryDo=fn=>{try{return fn()}catch(e){console.warn('tools',e)}};

  /* =====================================================================================================
     1. BOTTOM BAR  (RoleNavigationPolicy.bottom + GoldenBottomBar)
     ===================================================================================================== */
  mobileNavItems=function(){
    if(role()==='guardian')return [['home','الرئيسية'],['profile','أبنائي'],['ranking','الإنجازات'],['more','المزيد']];
    return [['home','الرئيسية'],['sessions','الجلسات'],['students','الطلاب'],progMode()?['ranking','الترتيب والإحصائيات']:['plans','الخطط'],['more','المزيد']];
  };
  buildMobileNav=function(){
    const n=q('#mobileNav');if(!n)return;
    const items=mobileNavItems(),core=new Set(items.filter(x=>x[0]!=='more').map(x=>x[0])),drawerOpen=!!q('#drawer')?.classList.contains('open');
    const sig=items.map(x=>x[0]).join()+'|'+state.page+'|'+drawerOpen+'|'+role();
    if(n.dataset.sig===sig)return;n.dataset.sig=sig;
    n.classList.add('nt-bar');
    n.innerHTML=items.map(([p,l])=>{
      const sel=p==='more'?(drawerOpen||!core.has(state.page)):state.page===p,act=p==='more'?'toggleDrawer(true)':`go('${p}')`;
      return `<div class="nt-tab-cell"><button type="button" class="nt-tab ${sel?'on':''}" aria-label="${h(l)}" ${sel?'aria-current="page"':''} onclick="${act}"><span class="nt-tab-ic">${navIcon(p)}</span><span class="nt-tab-l">${h(l)}</span></button></div>`;
    }).join('');
  };
  if(typeof toggleDrawer==='function'){
    const baseToggle=toggleDrawer;
    toggleDrawer=function(){const r=baseToggle.apply(this,arguments);tryDo(()=>{const n=q('#mobileNav');if(n)n.dataset.sig='';buildMobileNav()});return r};
  }

  /* =====================================================================================================
     2. DRAWER  (GoldenDrawerContent: header, grouped rows, footer)  — no sync row, exactly like drawerItems()
     ===================================================================================================== */
  const GROUP_TITLES=['الأساسي','المتابعة والإنجاز','التواصل والأدوات','الإدارة','الحساب والنظام'];
  const GROUP_OF={home:0,sessions:0,students:0,plans:0,halaqas:0,ranking:1,competition:1,certificates:1,reports:1,supervision:1,profile:1,community:2,quran:2,data:2,notifications:4,settings:4};
  const ROLE_SCENE={admin:'role_admin',supervisor:'role_supervisor',teacher:'role_teacher',guardian:'role_guardian'};
  function drawerHead(){
    tryDo(()=>{
      const nm=q('#dhName');if(nm)nm.textContent=state.profile?.full_name||'المستخدم';
      const rl=q('#drawerRole');if(rl)rl.textContent=roleTitle(role());
      const on=online(),dot=q('#dhDot'),c=q('#dhConn');
      if(dot)dot.className='dh-dot '+(on?'on':'off');if(c)c.textContent=on?'متصل':'دون اتصال';
      const x=q('.drawer-close');if(x&&!x.dataset.nt){x.dataset.nt='1';x.innerHTML=ic('Close',24)}
      const lo=q('.drawer-logout');if(lo&&!lo.dataset.nt){lo.dataset.nt='1';lo.innerHTML=ic('Logout',20)+'<span>تسجيل الخروج</span>';lo.setAttribute('onclick','NT.logout()')}
      const art=q('#rc27DrawerArt'),sc=ROLE_SCENE[role()];
      if(art&&sc&&art.dataset.scene!==sc&&window.RC27Motion){art.dataset.scene=sc;art.innerHTML='';window.RC27Motion.play(art,sc,{onBand:false})}
    });
  }
  buildNav=function(){
    const n=q('#nav');if(!n||typeof navItems!=='function')return;
    const unread=Number(state.notificationUnread||0);
    const groups=new Map();
    navItems().forEach(x=>{const p=x[0],l=String(x[1]).replace(/\s*\(\d+\)$/,''),g=GROUP_OF[p]==null?3:GROUP_OF[p];if(!groups.has(g))groups.set(g,[]);groups.get(g).push([p,l])});
    let html='';
    [...groups.keys()].sort((a,b)=>a-b).forEach(g=>{
      html+=`<div class="nav-section">${GROUP_TITLES[g]}</div><div class="dgrid">${groups.get(g).map(([p,l])=>{
        const act=state.page===p,badge=p==='notifications'?unread:0,bt=badge>99?'99+':badge;
        return `<button type="button" class="dtile ${act?'active':''}" ${act?'aria-current="page"':''} title="${h(l)}" onclick="go('${p}')"><span class="dt-ico">${navIcon(p)}${badge?`<i class="dt-badge">${bt}</i>`:''}</span><span class="dt-label">${h(l)}</span>${badge?`<i class="nt-dbadge">${bt}</i>`:''}</button>`;
      }).join('')}</div>`;
    });
    if(n.dataset.html!==html){n.dataset.html=html;n.innerHTML=html}
    buildMobileNav();drawerHead();
  };
  NT.logout=function(){
    const p=pendingCount(),b=blockedCount();
    if(typeof toggleDrawer==='function')toggleDrawer(false);
    if(p+b>0){
      NX.dialog('ntLogoutDlg','هناك بيانات لم تُرفع بعد',`<p class="nx-confirm-text">يوجد ${p-b} عمليات بانتظار المزامنة و${b} عمليات تحتاج مراجعة. ستبقى محفوظة ومربوطة بهذا الحساب فقط، ولن تُرسل بحساب آخر. الأفضل المزامنة قبل الخروج إذا كان الاتصال متاحًا.</p>`,{cls:'nx-small-dlg',footer:`${NX.btn('البقاء ومحاولة المزامنة',{kind:'text',onclick:"NX.closeDialog('ntLogoutDlg');tryNtSync()"})}${NX.btn('الخروج مع الاحتفاظ محليًا',{kind:'danger',onclick:"NX.closeDialog('ntLogoutDlg');logout()"})}`});
    }else logout();
  };
  window.tryNtSync=function(){try{syncOfflineQueue()}catch(_e){}};

  /* =====================================================================================================
     3. TOP BAR  (AppTopBar: kicker + title at START; refresh, notifications, sync tile, menu at END)
     ===================================================================================================== */
  const NO_REFRESH=new Set(['settings','quran']);
  function chromeInit(){
    const tb=q('#app .topbar');if(!tb||tb.dataset.nt)return;tb.dataset.nt='1';
    const menu=tb.querySelector('.menu-btn');if(menu)menu.innerHTML=ic('Menu',24);
    const bell=q('#notificationBell');
    if(bell){const cnt=q('#notificationBellCount');bell.innerHTML=navIcon('notifications');if(cnt)bell.appendChild(cnt)}
    if(!q('#ntRefresh')){
      const r=document.createElement('button');r.type='button';r.id='ntRefresh';r.className='nt-refresh';r.title='تحديث';r.setAttribute('aria-label','تحديث');r.innerHTML=ic('Refresh',24);r.onclick=()=>NT.refresh(r);
      (bell||tb.lastElementChild).before(r);
    }
    if(!q('#ntBanner')){const b=document.createElement('div');b.id='ntBanner';b.className='nt-banner-slot';tb.after(b)}
  }
  NT.refresh=async function(btn){
    if(NT._rf)return;NT._rf=1;btn&&btn.classList.add('spin');
    try{
      if(typeof refreshFromServer==='function')await refreshFromServer({renderAfter:true});
      else{await loadAll(true);await render()}
    }catch(e){console.warn(e)}finally{NT._rf=0;btn&&btn.classList.remove('spin')}
  };
  let lastSync=0,wasSyncing=false;
  function syncTile(){
    const b=q('#syncBadge');if(!b)return;
    const on=online(),n=pendingCount(),busy=!!state.syncing,show=!on||n>0||busy,spin=on&&(n>0||busy)&&!reduced();
    const sig=[show,on,n,spin].join();
    if(b.dataset.sig===sig&&b.classList.contains('nt-sync'))return;b.dataset.sig=sig;
    b.className='sync-badge nt-sync'+(on?'':' off')+(spin?' spin':'');
    b.style.display=show?'':'none';
    b.innerHTML=ic(on?'Sync':'CloudOff',22)+(n>0?`<i class="nt-bdg">${n>99?99:n}</i>`:'');
    const lbl=on?'عمليات بانتظار المزامنة':'دون اتصال — العمل محفوظ محليًا';b.title=lbl;b.setAttribute('aria-label',lbl);
  }
  function syncBanner(){
    const slot=q('#ntBanner');if(!slot)return;
    const on=online(),n=pendingCount(),bl=blockedCount(),authIssue=!!state.authNeedsLogin&&n>0;
    let html='';
    if(authIssue){
      html=`<div class="nt-banner err">${ic('ErrorOutline',20)}<span>تحتاج جلسة الدخول إلى تجديد لإكمال مزامنة ${n} عملية محفوظة</span><button type="button" onclick="handleSyncBadgeClick()">التفاصيل</button></div>`;
    }else if(bl>0){
      html=`<div class="nt-banner ${on?'ok':'warn'}">${ic(on?'Sync':'CloudOff',20)}<span>هناك ${bl} عمليات تحتاج مراجعة، و${n-bl} بانتظار الرفع</span><button type="button" onclick="openSyncStatusDialog()">التفاصيل</button>${on&&n-bl>0?'<button type="button" onclick="tryNtSync()">مزامنة</button>':''}</div>`;
    }
    if(slot.dataset.html!==html){slot.dataset.html=html;slot.innerHTML=html}
  }
  function chromeTick(){
    tryDo(()=>{
      chromeInit();syncTile();syncBanner();
      if(wasSyncing&&!state.syncing&&pendingCount()===0)lastSync=Date.now();
      wasSyncing=!!state.syncing;
      const r=q('#ntRefresh');if(r){const hide=NO_REFRESH.has(state.page)||(state.page==='home'&&role()==='guardian');r.style.display=hide?'none':''}
    });
  }
  if(typeof updateSyncBadge==='function'){
    const baseUSB=updateSyncBadge;
    updateSyncBadge=function(){const r=baseUSB.apply(this,arguments);const b=q('#syncBadge');if(b)b.dataset.sig='';chromeTick();return r};
  }
  setInterval(chromeTick,1500);

  if(typeof render==='function'){
    const baseRender=render;
    render=async function(){
      const t0=performance.now(),r=await baseRender.apply(this,arguments);
      tryDo(()=>{
        NT.diag=NT.diag||{};NT.diag['عرض الصفحة']=Math.round(performance.now()-t0);
        const g=role()==='guardian',t=q('#pageTitle'),k=q('#roleLabel');
        if(t){
          if(g&&state.page==='reports')t.textContent='تقارير أولياء الأمور';
          if(g&&state.page==='home')t.textContent='اطمئن على رحلته';
        }
        if(k)k.textContent=(g&&state.page==='home')?'ولي الأمر · متابعة الأبناء':roleTitle(role());
        const n=q('#mobileNav');if(n)n.dataset.sig='';buildMobileNav();chromeTick();
      });
      return r;
    };
  }
  if(typeof loadAll==='function'){
    const baseLoad=loadAll;
    loadAll=async function(){const t0=performance.now();try{return await baseLoad.apply(this,arguments)}finally{NT.diag=NT.diag||{};NT.diag['تحميل البيانات']=Math.round(performance.now()-t0)}};
  }
  document.addEventListener('DOMContentLoaded',chromeInit);if(document.readyState!=='loading')chromeInit();

  /* =====================================================================================================
     4. SYNC CENTER  (SyncCenterScreen) — shown in the sync dialog opened from the top-bar sync tile
     ===================================================================================================== */
  const SYNC_RES={attendance:'الحضور',behavior:'ملاحظات الطالب',report:'التسميع',session:'الجلسات',delete_session:'الجلسات',master_upsert:'البيانات الأساسية',master_delete:'البيانات الأساسية'};
  const opAr=op=>op.type==='delete_session'||op.type==='master_delete'?'حذف':op.type==='session'&&op.intent==='edit'?'تعديل':op.type==='master_upsert'?(op.intent==='create'?'إضافة':'تعديل'):'إضافة';
  function opLabel(op){let l='';try{l=typeof syncOperationLabel==='function'?syncOperationLabel(op):''}catch(_e){}return `${opAr(op)} · ${SYNC_RES[op.type]||l||'بيانات'}`}
  function simplifyError(e){
    const c=String(e||'').replace(/\\n/g,' ').replace(/\s+/g,' ').trim();
    if(/row-level security|RLS/i.test(c))return 'رفضت صلاحيات قاعدة البيانات هذه العملية. أعد فتح الحساب أو تحقق من صلاحية الدور وربط الحلقة/الطالب ثم أعد المحاولة.';
    if(/violates check constraint/i.test(c))return 'إحدى القيم لا تطابق قواعد البيانات المسموح بها. افتح السجل وصحح القيمة قبل إعادة المحاولة.';
    if(/duplicate/i.test(c))return 'يوجد سجل مطابق بالفعل في الخادم. حدّث البيانات ثم أعد المحاولة إذا لزم.';
    return c.length>280?c.slice(0,280)+'…':c;
  }
  function simplifyTransient(e){
    const c=String(e||'').replace(/\s+/g,' ').trim();
    if(/timeout|timed out/i.test(c))return 'انتهت مهلة الاتصال';
    if(/resolve host|hostname|Failed to fetch/i.test(c))return 'تعذر الوصول إلى الخادم';
    if(/network|connection|انقطع/i.test(c))return 'اتصال الشبكة غير مستقر';
    return c.length>180?c.slice(0,180)+'…':(c||'تعذر الرفع مؤقتًا');
  }
  const fmtTime=ms=>{if(!ms)return '—';const d=new Date(ms);if(isNaN(d))return '—';const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
  function syncBody(){
    const q0=queue(),on=online(),blockedN=q0.filter(x=>x.status==='failed').length,pendingN=q0.length-blockedN,busy=!!state.syncing;
    const metric=(t,v)=>`<div class="nx-metric nt-sm"><span>${t}</span><b>${v}</b></div>`;
    let h0=`<div class="nt-sync-top">${NX.iconBtn('Refresh',{title:'تحديث',onclick:'NT.syncRefresh()'})}</div>`;
    if(typeof loadAll==='function'&&false)h0='';
    h0+=`<div class="nx-metrics" style="--cols:3">${metric('الاتصال',on?'متصل':'غير متصل')}${metric('معلّق',pendingN)}${metric('يحتاج مراجعة',blockedN)}</div>`;
    const last=lastSync?`آخر مزامنة: <bdi dir="ltr">${fmtTime(lastSync)}</bdi>`:'لم تُسجل مزامنة ناجحة في هذه الجلسة';
    let card=`<div class="nt-sync-state"><span class="nt-sync-ic">${ic(on?'CloudDone':'CloudOff',24)}</span><div class="nx-grow"><b>${on?'Supabase متاح':'أنت تعمل دون اتصال'}</b><small class="nx-muted">${last}</small></div>${NX.btn(busy?'جارٍ…':'مزامنة',{icon:busy?'':'Sync',onclick:'tryNtSync()',disabled:!on||busy})}</div>`;
    if(!on||busy)card+=`<div class="nt-sync-art" id="ntSyncArt" data-scene="${on?'sync':'offline'}"></div>`;
    if(!on&&pendingN>0)card+=`<div class="nt-warn-box">تم حفظ ${pendingN} تغييرات محليًا على هذا الجهاز. لن تضيع عند إغلاق الشاشة، وستُرفع تلقائيًا بعد عودة الاتصال.</div>`;
    if(state.authNeedsLogin&&q0.length)card+=`${NX.notice('تحتاج جلسة الدخول إلى تجديد قبل رفع العمليات المحفوظة.','warning')}${NX.btn('تجديد الدخول',{kind:'outlined',full:true,icon:'Lock',onclick:'openSyncAuthRecovery()'})}`;
    if(blockedN>0)card+=`<p class="nt-err-text">العمليات المحجوبة لا تُحذف تلقائيًا لأنها قد تحتوي على خطأ صلاحيات RLS أو بيانات غير صالحة. راجع الخطأ ثم أعد المحاولة أو احذف العملية يدويًا.</p>${NX.btn('إعادة محاولة كل العمليات المحجوبة',{kind:'outlined',full:true,icon:'Replay',onclick:'resetFailedOfflineOperations()',disabled:!on||busy})}`;
    h0+=`<div class="nx-card nx-emph nt-sync-card">${card}</div>`;
    if(!q0.length)h0+=NX.empty('لا توجد عمليات معلقة — البيانات متزامنة',{icon:'CloudDone'});
    else h0+=`<div class="nx-stack-s">${q0.slice(0,100).map(op=>{
      const blk=op.status==='failed',conf=!!op.conflict,created=Date.parse(op.createdAt)||op.createdAt||0;
      const pill=NX.pill(conf?'تعارض':blk?'مراجعة':op.status==='syncing'?'جارٍ الرفع':'بانتظار الرفع',blk?'danger':'info',{icon:blk?'WarningAmber':'Schedule'});
      let x=`<div class="nx-row"><span class="nt-op-ic ${blk?'bad':''}">${ic(blk?'ErrorOutline':'CloudUpload',22)}</span><div class="nx-grow"><b>${h(opLabel(op))}</b><small class="nx-muted">المحاولات: ${op.attempts||0} · <bdi dir="ltr">${fmtTime(typeof created==='number'?created:0)}</bdi></small></div>${pill}</div>`;
      if(blk&&op.lastError)x+=`<div class="nt-err-box">${h(simplifyError(op.lastError))}</div>`;
      if(!blk&&op.attempts>0&&op.lastError)x+=`<div class="nt-warn-box">آخر محاولة: ${h(simplifyTransient(op.lastError))} · ستتم إعادة المحاولة تلقائيًا</div>`;
      if(conf)x+=`<p class="nx-muted nt-small">تم العثور على تعديل أحدث في الخادم. اختر صراحة أي نسخة تريد اعتمادها؛ لن يحذف التطبيق أي نسخة تلقائيًا.</p><div class="nx-row nx-wrap">${NX.btn('اعتماد تعديلي',{onclick:`resolveMasterConflict('${op.id}','local')`})}${NX.btn('نسخة الخادم',{kind:'outlined',onclick:`resolveMasterConflict('${op.id}','server')`})}</div>`;
      else if(blk)x+=`<div class="nx-row nx-wrap">${NX.btn('إعادة المحاولة',{kind:'outlined',icon:'Refresh',onclick:`NT.syncRetry('${op.id}')`})}${NX.btn('حذف العملية',{kind:'text',icon:'DeleteOutline',onclick:`NT.syncDiscard('${op.id}')`})}</div>`;
      return NX.card(x,{cls:'nx-emph nt-op'});
    }).join('')}</div>`;
    return h0;
  }
  function paintSync(openIt){
    const d=q('#syncStatusDlg');if(!d)return;
    if(!d.open&&!openIt)return;
    const prev=d.querySelector('.nx-dlg-content'),top=prev?prev.scrollTop:0;
    NX.dialog('syncStatusDlg','مركز المزامنة',syncBody(),{cls:'nt-sync-dlg'});
    const c=d.querySelector('.nx-dlg-content');if(c)c.scrollTop=top;
    const art=q('#ntSyncArt');if(art&&window.RC27Motion&&!art.dataset.on){art.dataset.on='1';window.RC27Motion.play(art,art.dataset.scene,{})}
  }
  renderSyncStatusDialog=function(){paintSync(false)};
  openSyncStatusDialog=function(){paintSync(true)};
  NT.syncRefresh=function(){paintSync(false)};
  NT.syncRetry=function(id){
    try{const qq=readOfflineQueue().map(x=>x.id===id?normalizeOfflineOperation({...x,status:'pending',attempts:0,lastError:''}):x);writeOfflineQueue(qq)}catch(e){console.warn(e)}
    tryNtSync();paintSync(false);
  };
  NT.syncDiscard=function(id){
    NX.confirm('حذف العملية','سيتم حذف هذه العملية المحفوظة محليًا نهائيًا ولن تُرفع إلى الخادم.','حذف',()=>{
      try{writeOfflineQueue(readOfflineQueue().filter(x=>x.id!==id));updateSyncBadge()}catch(e){console.warn(e)}
      paintSync(true);
    },{danger:true});
  };
  window.addEventListener('online',()=>setTimeout(()=>paintSync(false),400));
  window.addEventListener('offline',()=>setTimeout(()=>paintSync(false),400));

  /* =====================================================================================================
     5. SETTINGS  (SettingsScreen + SettingsParitySections)
     ===================================================================================================== */
  const THEME_KEY='halaqati_theme_v4',HOME_KEY='halaqati_home_style';
  const readJ=(k)=>{try{return JSON.parse(localStorage.getItem(k)||'{}')||{}}catch(_e){return {}}};
  const themeP=()=>readJ(THEME_KEY),dispP=()=>readJ('halaqati_display_v1');
  const sysDark=()=>{try{return matchMedia('(prefers-color-scheme: dark)').matches}catch(_e){return false}};
  const themeMode=()=>{const p=themeP();return p.mode||(p.dark?'dark':'light')};
  const effDark=()=>{const m=themeMode();return m==='system'?sysDark():m==='dark'};
  const homeStyle=()=>{try{return localStorage.getItem(HOME_KEY)||'modern'}catch(_e){return 'modern'}};
  window.NXHomeStyle=homeStyle;
  const PRESETS=[['#0B5D4F','#1B7F6B','أخضر حلقاتي'],['#3B4929','#5B7A3A','زيتوني الشعار'],['#12345B','#2D6CDF','الأزرق'],['#5A3825','#AD744F','البني'],['#342B5F','#765BC4','البنفسجي']];
  if(typeof applySavedTheme==='function'){
    const baseTheme=applySavedTheme;
    applySavedTheme=function(){
      baseTheme.apply(this,arguments);
      if(themeP().mode==='system')document.body.classList.toggle('dark',sysDark());
    };
    try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(themeP().mode==='system')applySavedTheme()})}catch(_e){}
  }
  NT.setTheme=function(mode){
    const p=themeP();p.mode=mode;p.dark=mode==='system'?sysDark():mode==='dark';
    try{localStorage.setItem(THEME_KEY,JSON.stringify(p))}catch(_e){}
    applySavedTheme();render();
  };
  NT.setPreset=function(i){
    const pr=PRESETS[i];if(!pr)return;const p=themeP();p.primary=pr[0];p.accent=pr[1];
    try{localStorage.setItem(THEME_KEY,JSON.stringify(p))}catch(_e){}
    applySavedTheme();render();
  };
  NT.setDensity=v=>rc27SetPref('density',v);
  NT.setMotion=v=>rc27SetPref('reduceMotion',v==='reduced');
  NT.setHome=function(v){try{localStorage.setItem(HOME_KEY,v)}catch(_e){}window.dispatchEvent(new CustomEvent('halaqati:homestyle',{detail:v}));render()};
  NT.resetAppearance=function(){
    try{localStorage.removeItem(THEME_KEY);localStorage.removeItem(HOME_KEY);localStorage.setItem('halaqati_display_v1',JSON.stringify({density:'comfortable',reduceMotion:false}))}catch(_e){}
    applySavedTheme();rc27SetPref('density','comfortable');
  };

  const sec=t=>`<h3 class="nt-sec">${t}</h3>`;
  const ncard=(inner,cls='')=>`<div class="nx-card nt-card ${cls}">${inner}</div>`;
  const li=(icon,title,sub,trail='')=>`<div class="nt-li"><span class="nt-li-ic">${ic(icon,24)}</span><div class="nx-grow"><b>${title}</b>${sub?`<small>${sub}</small>`:''}</div>${trail}</div>`;
  const eq=items=>`<div class="nt-eq" style="--n:${items.length}">${items.map(i=>NX.chip(i.label,{selected:i.on,onclick:i.fn,check:false})).join('')}</div>`;
  const isNative=()=>typeof isNativeHalaqati==='function'&&isNativeHalaqati();

  // ---- account name card (AccountNameSettingsCard)
  NT.nameEdit=function(v){NT.nameEditing=!!v;render()};
  NT.nameSave=async function(){await saveMyAccountName();NT.nameEditing=false;render()};
  function nameCard(){
    const p=state.profile||{},email=p.email||state.user?.email||'';
    const head=li('Badge','اسم الحساب','الاسم الذي يظهر للمسؤولين وأولياء الأمور والمحفظين.');
    const body=NT.nameEditing
      ?`${NX.field('الاسم الكامل',{id:'accountFullName',value:p.full_name||'',required:true})}<div class="nx-row">${NX.btn('حفظ',{id:'accountNameSaveBtn',onclick:'NT.nameSave()'})}${NX.btn('إلغاء',{kind:'outlined',onclick:'NT.nameEdit(false)'})}</div>`
      :`<div class="nx-row"><div class="nx-grow"><b class="nt-t-m">${h(p.full_name||'—')}</b><small class="nx-muted nt-block">${h(email)}</small></div>${NX.btn('تعديل الاسم الكامل',{kind:'outlined',small:true,onclick:'NT.nameEdit(true)'})}</div>`;
    return ncard(`<div class="nx-stack-s">${head}${body}</div>`,'nt-outline');
  }

  // ---- app update card (AppUpdateSettingsCard) ; also used by the legacy refreshUpdateCard()
  NT.webUpd=NT.webUpd||{state:'idle'};
  NT.checkWebUpdate=async function(){
    NT.webUpd.state='checking';refreshUpdateCard();
    try{
      const reg=navigator.serviceWorker?await navigator.serviceWorker.getRegistration():null;
      if(reg)await reg.update();
      NT.webUpd.reg=reg;
      NT.webUpd.state=(reg&&(reg.waiting||reg.installing))?'available':'latest';
    }catch(e){NT.webUpd.state='error';NT.webUpd.msg=e?.message||String(e)}
    refreshUpdateCard();
  };
  NT.applyWebUpdate=function(){
    if(window.halaqatiHasPendingWork?.())return toast('احفظ التعديلات وأكمل المزامنة قبل التحديث');
    const w=NT.webUpd.reg?.waiting;if(w)w.postMessage({type:'SKIP_WAITING'});
    setTimeout(()=>location.reload(),400);
  };
  function updateBody(){
    const native=isNative();
    let state0='idle',title='تحديث التطبيق',sub='',icon='SystemUpdate',notes=[],extra='',buttons='',busy=false;
    if(native){
      const u=halaqatiUpdateState||{},info=u.info,avail=info&&Number(info.versionCode||0)>Number(u.currentVersionCode||APP_VERSION_CODE);
      const cur=u.currentVersionName||APP_VERSION_NAME;
      sub=`الإصدار الحالي ${h(cur)}`;
      if(u.checking){title='جاري فحص التحديثات…';busy=true}
      else if(u.error){title='تعذر فحص التحديث';extra=NX.notice(h(u.error),'warning')}
      else if(info&&avail){
        title=`يتوفر تحديث ${h(info.versionName||'')}`;icon='SystemUpdateAlt';sub=`${h(cur)}  ←  ${h(info.versionName||'')}`;
        try{notes=normalizeUpdateNotes(info.notes).slice(0,5)}catch(_e){}
        if(u.message)extra=`<small class="nt-block"><b>${h(u.message)}</b></small>${NX.progress(u.progress||0)}`;
        buttons=NX.btn(u.progress>0&&u.progress<100?'جارٍ التنزيل…':'تنزيل التحديث',{icon:'Download',full:true,onclick:'downloadAndInstallUpdate()',disabled:u.progress>0&&u.progress<100});
      }else if(info){title='أنت على أحدث إصدار';icon='Verified'}
      const lbl=u.checking?'جارٍ الفحص…':info?'إعادة الفحص':'فحص الآن';
      buttons+=`<div class="nx-row">${NX.btn(lbl,{kind:'outlined',full:true,onclick:'checkForAppUpdate()',disabled:u.checking})}</div>`;
    }else{
      const w=NT.webUpd,ver=window.HALAQATI_WEB_VERSION||'';
      sub=`الإصدار الحالي ${h(ver)} · نسخة الويب`;
      if(w.state==='checking'){title='جاري فحص التحديثات…';busy=true}
      else if(w.state==='latest'){title='أنت على أحدث إصدار';icon='Verified'}
      else if(w.state==='available'){title='يتوفر تحديث جديد';icon='SystemUpdateAlt';extra=NX.notice('احفظ عملك وأكمل المزامنة قبل تطبيق التحديث.','info');buttons=NX.btn('تحديث الآن',{icon:'Download',full:true,onclick:'NT.applyWebUpdate()'})}
      else if(w.state==='error'){title='تعذر فحص التحديث';extra=NX.notice(h(w.msg||''),'warning')}
      buttons+=NX.btn(w.state==='idle'?'فحص الآن':'إعادة الفحص',{kind:'outlined',full:true,onclick:'NT.checkWebUpdate()',disabled:w.state==='checking'});
    }
    const notesHtml=notes.length?`<div class="nt-notes"><b>ما الجديد</b>${notes.map(n=>`<span>• ${h(n)}</span>`).join('')}</div>`:'';
    return `<div class="nx-row nt-upd-head"><span class="nt-upd-ic">${busy?'<i class="nt-spinner"></i>':ic(icon,24)}</span><div class="nx-grow"><b class="nt-t-m">${title}</b><small class="nx-muted nt-block">${sub}</small></div></div>${notesHtml}${extra}${buttons}`;
  }
  updateInfoHtml=function(){return `<div class="nx-stack-s">${updateBody()}</div>`};

  // ---- admin backup card (BackupSettingsCard)
  function backupCard(){
    if(role()!=='admin')return '';
    return ncard(`<div class="nx-stack-s"><b class="nt-t-m">نسخة احتياطية كاملة</b><p class="nt-p">تحفظ كل بيانات الحلقات (الطلاب، الجلسات، التسميع، الخطط، الشهادات…) في ملف zip تختار مكانه. يحتوي بيانات طلاب وأولياء أمور فاحفظه في مكان آمن ولا ترسله لأحد. يُنصح بنسخة أسبوعية.</p>${NX.btn('إنشاء نسخة احتياطية الآن',{full:true,onclick:'rc27Backup(this)'})}<div class="nx-row nx-wrap">${typeof exportHalaqatiBackup==='function'?NX.btn('تصدير JSON',{kind:'text',small:true,onclick:'exportHalaqatiBackup()'}):''}${typeof chooseHalaqatiBackup==='function'?NX.btn('استرجاع نسخة',{kind:'text',small:true,onclick:'chooseHalaqatiBackup()'}):''}${typeof rc27OpenDeletedSessions==='function'?NX.btn('الجلسات المحذوفة',{kind:'text',small:true,onclick:'rc27OpenDeletedSessions()'}):''}</div></div>`,'nt-elev');
  }
  // ---- V6 scoring card (V6ScoringSettingsCard)
  function v6Card(){
    const band=(l,r)=>`<div class="nt-band"><b>${l}</b><small><bdi dir="ltr">${r}</bdi></small></div>`;
    return ncard(`<div class="nx-stack-s"><b class="nt-t-m">معيار جودة التسميع V6</b><p class="nt-p">الخطأ = 1 · التلقين = 0.5 · تطبيع على 15 سطرًا حسب السطور المسمعة فعليًا.</p><div class="nt-bands">${band('ممتاز','90–100%')}${band('جيد جدًا','80–&lt;90%')}${band('جيد','70–&lt;80%')}${band('يحتاج إعادة','&lt;70%')}</div></div>`,'nt-outline');
  }
  // ---- appearance (المظهر)
  function appearanceCard(){
    const mode=themeMode(),d=dispP(),p=themeP(),pr=String(p.primary||PRESETS[0][0]).toLowerCase(),ac=String(p.accent||PRESETS[0][1]).toLowerCase();
    const dens=d.density==='compact'?'compact':d.density==='balanced'?'balanced':'comfortable';
    const lbl=t=>`<div class="nt-lbl">${t}</div>`;
    return sec('المظهر')+ncard(`<div class="nx-stack">
      <div class="nt-sw"><div class="nx-grow"><b>الوضع الداكن</b><small>اتبع النظام أو اختر الوضع المناسب</small></div><input type="checkbox" class="nx-switch" ${effDark()?'checked':''} onchange="NT.setTheme(this.checked?'dark':'light')" aria-label="الوضع الداكن"></div>
      ${eq([{label:'النظام',on:mode==='system',fn:"NT.setTheme('system')"},{label:'فاتح',on:mode==='light',fn:"NT.setTheme('light')"},{label:'داكن',on:mode==='dark',fn:"NT.setTheme('dark')"}])}
      ${lbl('ألوان حلقتي')}
      <div class="nt-presets">${PRESETS.map((x,i)=>{const sel=pr===x[0].toLowerCase()&&ac===x[1].toLowerCase();return `<button type="button" class="nt-preset ${sel?'on':''}" onclick="NT.setPreset(${i})" aria-pressed="${sel}"><span class="nt-dots"><i style="background:${x[0]}"></i><i style="background:${x[1]}"></i></span><small>${x[2]}</small></button>`}).join('')}</div>
      ${lbl('كثافة الواجهة')}${eq([{label:'مريح',on:dens==='comfortable',fn:"NT.setDensity('comfortable')"},{label:'متوازن',on:dens==='balanced',fn:"NT.setDensity('balanced')"},{label:'مضغوط',on:dens==='compact',fn:"NT.setDensity('compact')"}])}
      ${lbl('مظهر الرئيسية')}${eq([{label:'بطاقات حديثة',on:homeStyle()==='modern',fn:"NT.setHome('modern')"},{label:'لوحة مختصرة',on:homeStyle()==='compact',fn:"NT.setHome('compact')"}])}
      ${lbl('الحركة')}${eq([{label:'عادية',on:!d.reduceMotion,fn:"NT.setMotion('normal')"},{label:'مخففة',on:!!d.reduceMotion,fn:"NT.setMotion('reduced')"}])}
      ${NX.btn('إعادة ضبط المظهر',{kind:'outlined',full:true,onclick:'NT.resetAppearance()'})}
    </div>`,'nt-outline');
  }
  // ---- web version (install + view mode) — web only
  function webCard(){
    if(isNative())return '';
    const cur=root.getAttribute('data-view-pref')||'auto';
    const inst=window.matchMedia&&matchMedia('(display-mode: standalone)').matches;
    return sec('نسخة الموقع')+ncard(`<div class="nx-stack"><p class="nt-p">اختر شكل العرض: نسخة الجوال (شريط سفلي وقائمة منزلقة) أو نسخة سطح المكتب (قائمة جانبية ثابتة ومحتوى أعرض). تلقائي يختار حسب عرض الشاشة.</p>${eq([{label:'تلقائي',on:cur==='auto',fn:"rc27SetView('auto')"},{label:'الجوال',on:cur==='mobile',fn:"rc27SetView('mobile')"},{label:'سطح المكتب',on:cur==='desktop',fn:"rc27SetView('desktop')"}])}${typeof halaqatiInstall==='function'?li('InstallMobile',inst?'حلقاتي مثبت على هذا الجهاز':'حلقاتي على جهازك','نفس الحسابات والبيانات على الجوال والكمبيوتر.',inst?'':NX.btn(window.halaqatiCanPromptInstall&&window.halaqatiCanPromptInstall()?'تثبيت حلقاتي':'طريقة التثبيت',{kind:'outlined',small:true,onclick:'halaqatiInstall()'})):''}<p id="pwaInstallHelp" class="nt-p" hidden></p></div>`,'nt-outline');
  }
  // ---- diagnostics (التشخيص)
  function diagCard(){
    const d=NT.diag||{},rows=Object.entries(d).slice(0,12);
    return sec('التشخيص')+ncard(`<div class="nx-stack-s"><p class="nt-p">أزمنة التحميل الأخيرة (بالملّي ثانية). أي رقم فوق 1500 يعني أن هذه العملية بطيئة.</p>${rows.length?rows.map(([k,v])=>`<div class="nx-row nx-between"><span>${h(k)}</span><b class="${v>1500?'nt-bad':''}">${v} م.ث</b></div>`).join(''):'<p>لا توجد قياسات بعد. افتح الخطط أو الجلسات ثم عد إلى هنا.</p>'}${NX.btn('تحديث القياسات',{kind:'outlined',full:true,onclick:'render()'})}</div>`,'nt-outline');
  }
  // ---- account & security
  NT.pwdOpen=function(){
    NX.dialog('ntPwdDlg','تغيير كلمة المرور',`<div class="nx-stack">${NX.field('كلمة المرور الجديدة',{id:'ntPw1',type:'password',oninput:'NT.pwdInput()'})}${NX.field('تأكيد كلمة المرور',{id:'ntPw2',type:'password',oninput:'NT.pwdInput()'})}<small id="ntPwHint" class="nx-muted">6 أحرف على الأقل</small></div>`,{cls:'nx-small-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ntPwdDlg')"})}${NX.btn('حفظ',{id:'ntPwSave',onclick:'NT.pwdSave()',disabled:true})}`});
  };
  NT.pwdInput=function(){
    const a=q('#ntPw1')?.value||'',b=q('#ntPw2')?.value||'',bad=b.length>0&&a!==b,hint=q('#ntPwHint');
    if(hint){hint.textContent=bad?'كلمتا المرور غير متطابقتين':'6 أحرف على الأقل';hint.style.color=bad?'var(--danger)':''}
    const s=q('#ntPwSave');if(s)s.disabled=!(a.length>=6&&a===b);
  };
  NT.pwdSave=async function(){
    const a=q('#ntPw1')?.value||'',s=q('#ntPwSave');if(s){s.disabled=true;s.querySelector('span').textContent='جارٍ الحفظ…'}
    const {error}=await db.auth.updateUser({password:a});
    if(error){if(s){s.disabled=false;s.querySelector('span').textContent='حفظ'}NT.pwdMsg=['warning',error.message||'تعذر تغيير كلمة المرور'];toast('تعذر تغيير كلمة المرور: '+error.message);return}
    NT.pwdMsg=['success','تم تغيير كلمة المرور'];NX.closeDialog('ntPwdDlg');render();
  };
  function securityCard(){
    const m=NT.pwdMsg;
    return sec('الحساب والأمان')+ncard(`<div class="nx-stack-s">${li('LockReset','تغيير كلمة المرور','تحديث كلمة مرور الحساب مباشرة')}${NX.btn('تغيير كلمة المرور',{kind:'outlined',full:true,onclick:'NT.pwdOpen()'})}${m?NX.notice(h(m[1]),m[0]):''}</div>`,'nt-outline');
  }
  // ---- sync & notifications
  NT.prefsOpen=function(){
    const p={...(typeof notificationPreferencesDefaults==='function'?notificationPreferencesDefaults():{}),...(state.notificationPreferences||{})};
    const rows=[['npPush','push_enabled','الإشعارات الفورية','تشغيل أو إيقاف Push على هذا الحساب'],['npAttendance','attendance','الحضور والغياب','تنبيهات الحضور والتأخر والغياب'],['npRecitation','recitation','التسميع','نتائج الحفظ والمراجعة والسرد'],['npBehavior','behavior','السلوك والمتابعة','ملاحظات السلوك والمتابعة اليومية'],['npAnnouncements','announcements','الإعلانات','إعلانات الحلقة والمواعيد'],['npAchievements','achievements','الإنجازات','الشهادات والإنجازات']];
    NX.dialog('ntPrefsDlg','تفضيلات الإشعارات',`<div class="nx-stack-s">${rows.map(([id,k,t,d])=>`<div class="nt-sw"><div class="nx-grow"><b>${t}</b><small>${d}</small></div><input type="checkbox" class="nx-switch" id="${id}" ${p[k]!==false?'checked':''} aria-label="${t}"></div>`).join('')}<small class="nx-muted">إيقاف نوع معيّن لا يحذف الإشعارات الموجودة داخل التطبيق؛ بل يضبط التفضيلات المستخدمة عند الإرسال.</small></div>`,{cls:'nx-small-dlg',footer:`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('ntPrefsDlg')"})}${NX.btn('حفظ',{onclick:'NT.prefsSave()'})}`});
  };
  NT.prefsSave=async function(){await saveNotificationPreferences();NX.closeDialog('ntPrefsDlg');NT.prefMsg='تم حفظ تفضيلات الإشعارات';render()};
  function syncNotifCard(){
    const p=pendingCount(),b=blockedCount(),native=isNative(),ps=state.pushState||{};
    const enabled=native?(ps.permission==='granted'||ps.registered):true;
    const sub=native?(ps.registered?'مسموح بها على هذا الجهاز':ps.error?('خطأ: '+h(ps.error)):ps.permission==='denied'?'موقوفة من إعدادات Android':'بانتظار تفعيل الإشعارات'):'تظهر تحديثات الحلقة والحضور والتسميع في مركز الإشعارات داخل الموقع';
    return sec('المزامنة والإشعارات')+ncard(`<div class="nx-stack">
      ${li('Sync','المزامنة',p+b===0?'البيانات المحلية متزامنة لهذا الحساب':`معلّق: ${p-b} · يحتاج مراجعة: ${b} · معزول حسب الحساب`,NX.btn('الحالة',{kind:'text',small:true,onclick:'openSyncStatusDialog()'}))}
      <hr class="nx-divider">
      ${li(enabled?'NotificationsActive':'NotificationsOff',native?'إشعارات Android':'الإشعارات',sub,NX.pill(enabled?'مفعلة':'موقوفة',enabled?'success':'warning'))}
      ${NX.btn('تفضيلات إشعارات الحساب',{kind:'outlined',full:true,onclick:'NT.prefsOpen()'})}
      ${NT.prefMsg?NX.notice(h(NT.prefMsg),'success'):''}
      ${native&&typeof sendTestPush==='function'?`<div class="nx-row">${ps.error?NX.btn('إعادة المحاولة',{kind:'outlined',onclick:'enablePushNotifications(true)',cls:'nx-grow'}):''}${NX.btn('اختبار Push',{onclick:'sendTestPush()',cls:'nx-grow',disabled:!online()})}</div>`:''}
    </div>`,'nt-outline');
  }
  function auditCard(){
    if(!(typeof roleCanManage==='function'&&roleCanManage())||!(state.opsAudit||[]).length)return '';
    const rows=state.opsAudit.slice(0,10);
    return sec('سجل التعديلات')+ncard(`<div class="nx-stack-s">${rows.map(r=>`<div class="nt-audit"><b>${h(r.action)}</b><small>${h(r.entity_type)} · ${h(String(r.created_at).replace('T',' ').slice(0,16))}</small></div>`).join('')}</div>`,'nt-outline');
  }

  settingsPage=function(){
    const p=state.profile||{},email=p.email||state.user?.email||'';
    const hero=`<div class="nt-shero"><span class="nt-shero-ic">${ic('AccountCircle',30)}</span><div class="nx-grow"><b>${h(p.full_name||'—')}</b><small>${h(roleTitle(p.role))} · ${h(email)}</small></div></div>`;
    const left=`${nameCard()}${ncard(`<div id="updateCardStatus">${updateInfoHtml()}</div>`,'nt-elev')}${backupCard()}${v6Card()}`;
    const right=`${appearanceCard()}${webCard()}${diagCard()}${securityCard()}${syncNotifCard()}${auditCard()}`;
    const ver=isNative()&&typeof APP_VERSION_NAME!=='undefined'?APP_VERSION_NAME:(window.HALAQATI_WEB_VERSION||'');
    return `<div class="nt-settings">${hero}<div class="nt-col">${left}</div><div class="nt-col">${right}</div><div class="nt-foot">${li('Info','الإصدار',`Halaqati Official ${h(ver)} · Designed by Dr. Mohammed Samir`)}${NX.btn('تسجيل الخروج',{kind:'danger-solid',full:true,onclick:'NT.logout()',cls:'nt-logout'})}</div></div>`;
  };

  /* =====================================================================================================
     6. IMPORT / EXPORT  (ImportExportScreen + ImportRules + NativeStudentExport entry points)
     ===================================================================================================== */
  const LATIN=v=>String(v==null?'':v).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
  const IR={
    dec(v){const r=LATIN(v).trim();if(!r)return null;if(r.includes(',')&&r.includes('.'))return null;const s=r.replace(',','.');if(!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s))return null;const n=Number(s);return isFinite(n)?n:null},
    int(v){const d=IR.dec(v);return d==null||d%1!==0?null:d},
    date(v){
      const raw=LATIN(v).trim();if(!raw)return null;
      const ser=IR.dec(raw);
      if(ser!=null&&ser>=1&&ser<=100000&&ser%1===0){const d=new Date(Date.UTC(1899,11,30)+ser*86400000);return isNaN(d)?null:d.toISOString().slice(0,10)}
      let m=raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/),y,mo,d;
      if(m){y=+m[1];mo=+m[2];d=+m[3]}else{m=raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);if(!m)return null;d=+m[1];mo=+m[2];y=+m[3]}
      const t=new Date(Date.UTC(y,mo-1,d));return t.getUTCFullYear()===y&&t.getUTCMonth()===mo-1&&t.getUTCDate()===d?t.toISOString().slice(0,10):null;
    },
    month(v){
      const raw=LATIN(v).trim();if(!raw)return null;
      let m=raw.match(/^(\d{4})-(\d{2})/);if(m&&+m[2]>=1&&+m[2]<=12)return `${m[1]}-${m[2]}`;
      const d=IR.date(raw);return d?d.slice(0,7):null;
    },
    activity(v){
      const raw=String(v||'').trim();if(!raw)return null;
      const n=raw.toLowerCase().replace(/[أإآ]/g,'ا');
      if(n==='new_hifz'||n==='hifz'||n.includes('حفظ'))return 'new_hifz';
      if(n==='sard'||n.includes('سرد'))return 'sard';
      if(n==='review_far'||n.includes('بعيد'))return 'review_far';
      if(n==='review_near'||n.startsWith('review')||n.includes('مراج')||n.includes('تثبيت'))return 'review_near';
      if(n==='test'||n.includes('اختبار'))return 'test';
      if(n==='tilawah'||n.includes('تلاو'))return 'tilawah';
      return null;
    },
    track(v){
      const raw=String(v||'').trim();if(!raw)return 'general_hifz';
      const n=raw.toLowerCase().replace(/[أإآ]/g,'ا').replace(/\s+/g,' ');
      if(n==='general_hifz'||n==='hifz'||n==='general hifz'||n==='general-hifz'||n.includes('الحفظ العام')||n==='حفظ'||n==='سرد'||n==='sard')return 'general_hifz';
      if(n==='tathbit'||n.includes('تثبيت'))return 'tathbit';
      return null;
    },
    page:v=>v==null||(v>=1&&v<=604),
    VALID:'valid',SKIP:'skip',INVALID:'invalid'
  };
  const FIELDS={
    students:[['fullName','اسم الطالب',true,['اسم الطالب','الاسم','full name','full_name','name']],['track','المسار',false,['المسار','track','track_code']],['category','الفئة',false,['الفئة','category']],['gender','الجنس',false,['الجنس','gender']],['nationalId','رقم الهوية',false,['رقم الهوية','الهوية','national id','national_id']],['dateOfBirth','تاريخ الميلاد',false,['تاريخ الميلاد','date of birth','date_of_birth','birth']],['schoolGrade','المرحلة الدراسية',false,['المرحلة الدراسية','الصف','school grade','school_grade','grade','المرحلة']],['guardianEmail','بريد ولي الأمر',false,['بريد ولي الأمر','guardian email','guardian_email']],['guardianPhone','جوال ولي الأمر',false,['جوال ولي الأمر','هاتف ولي الأمر','guardian phone','guardian_phone']],['address','العنوان',false,['العنوان','address']]],
    recitations:[['student','الطالب',true,['اسم الطالب','الطالب','student','student name','name']],['date','التاريخ',true,['التاريخ','تاريخ التسميع','date','session date']],['type','نوع التسميع',true,['النوع','نوع التسميع','activity','activity type','type']],['pages','عدد الصفحات',true,['الصفحات','عدد الصفحات','pages','pages count','pages_count']],['mistakes','الأخطاء',false,['الأخطاء','عدد الأخطاء','mistakes']],['prompts','التلقين',false,['التلقين','التلميحات','النقرات','prompts']],['startPage','صفحة البداية',false,['صفحة البداية','start page','start_page']],['endPage','صفحة النهاية',false,['صفحة النهاية','end page','end_page']],['note','الملاحظة',false,['الملاحظة','ملاحظة','note','teacher note']]],
    plans:[['student','الطالب',true,['اسم الطالب','الطالب','student','student name','name']],['month','الشهر',true,['الشهر','month','month start','period start','period_start']],['hifz','هدف الحفظ',false,['هدف الحفظ','حفظ','target hifz','target_hifz_pages']],['review','هدف المراجعة',false,['هدف المراجعة','مراجعة','target review','target_review_pages']],['sard','هدف السرد',false,['هدف السرد','سرد','target sard','target_sard_pages']],['expectedDays','أيام الحضور المتوقعة',false,['أيام الحضور','الايام المتوقعة','أيام التسميع','expected days','expected_session_days']],['note','الملاحظة',false,['الملاحظة','ملاحظة','note']]]
  };
  const KIND_LABEL={students:'الطلاب',recitations:'تسميعات سابقة',plans:'الأهداف الشهرية'};
  const normH=v=>String(v==null?'':v).trim().toLowerCase().replace(/[أإآ]/g,'ا').replace(/[^a-z0-9؀-ۿ]+/g,' ').replace(/\s+/g,' ').trim();
  function detect(kind,headers){
    const nh=headers.map(normH),m={};
    FIELDS[kind].forEach(([k,,,names])=>{
      const idx=nh.findIndex(x=>x&&names.some(w=>{const n=normH(w);return x===n||x.includes(n)}));
      m[k]=idx<0?null:idx;
    });
    return m;
  }
  const IM=NT.im={kind:'students',halaqa:'',headers:[],rows:[],fileName:'',status:'',maps:{},paste:false,manual:'',importing:false,res:null};
  const cell=(row,i)=>i==null?'':String(row[i]==null?'':row[i]);
  function disposition(row,kind,m){
    if(kind==='students'){
      if(m.fullName==null)return IR.INVALID;
      if(cell(row,m.fullName).trim().length<2)return IR.SKIP;
      if(IR.track(cell(row,m.track))==null)return IR.INVALID;
      const dob=cell(row,m.dateOfBirth);if(dob.trim()&&!IR.date(dob))return IR.INVALID;
      return IR.VALID;
    }
    if(kind==='recitations'){
      if(m.student==null||m.date==null||m.type==null||m.pages==null)return IR.INVALID;
      if(!cell(row,m.student).trim())return IR.SKIP;
      if(!IR.date(cell(row,m.date)))return IR.INVALID;
      const act=IR.activity(cell(row,m.type));if(!act)return IR.INVALID;
      const pages=IR.dec(cell(row,m.pages));if(pages==null||pages<=0||pages>604)return IR.INVALID;
      const mis=cell(row,m.mistakes).trim()?IR.int(cell(row,m.mistakes)):0,pr=cell(row,m.prompts).trim()?IR.int(cell(row,m.prompts)):0;
      if(mis==null||pr==null||mis<0||pr<0)return IR.INVALID;
      const sp=cell(row,m.startPage).trim()?IR.int(cell(row,m.startPage)):null,ep=cell(row,m.endPage).trim()?IR.int(cell(row,m.endPage)):null;
      if((cell(row,m.startPage).trim()&&sp==null)||(cell(row,m.endPage).trim()&&ep==null))return IR.INVALID;
      if(!IR.page(sp)||!IR.page(ep)||(sp!=null&&ep!=null&&sp>ep))return IR.INVALID;
      return IR.VALID;
    }
    if(m.student==null||m.month==null||[m.hifz,m.review,m.sard].every(x=>x==null))return IR.INVALID;
    if(!cell(row,m.student).trim())return IR.SKIP;
    if(!IR.month(cell(row,m.month)))return IR.INVALID;
    const goal=r=>r.trim()?IR.dec(r):0;
    const hf=goal(cell(row,m.hifz)),rv=goal(cell(row,m.review)),sd=goal(cell(row,m.sard));
    if(hf==null||rv==null||sd==null)return IR.INVALID;
    const dd=cell(row,m.expectedDays).trim()?IR.int(cell(row,m.expectedDays)):20;
    if(dd==null)return IR.INVALID;
    if([hf,rv,sd].some(x=>x<0||x>604)||dd<1||dd>31)return IR.INVALID;
    return IR.VALID;
  }
  const preflight=()=>{
    const m=IM.maps[IM.kind]||{},r={valid:0,skipped:0,invalid:0},kinds=IM.rows.map(x=>disposition(x,IM.kind,m));
    kinds.forEach(k=>{if(k===IR.VALID)r.valid++;else if(k===IR.SKIP)r.skipped++;else r.invalid++});
    r.list=kinds;return r;
  };
  function loadTable(headers,rows,fileName,msg){
    IM.headers=headers;IM.rows=rows;IM.fileName=fileName;IM.res=null;
    IM.maps={students:detect('students',headers),recitations:detect('recitations',headers),plans:detect('plans',headers)};
    IM.status=msg||(rows.length?`تمت القراءة: ${rows.length} صف. راجع الأعمدة والبيانات قبل الاعتماد.`:'لم يتم العثور على صفوف قابلة للقراءة');
  }
  function parseText(text){
    const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);if(lines.length<2)return null;
    const first=lines[0],delim=first.includes('\t')?'\t':first.includes('|')?'|':first.includes(';')?';':first.includes(',')?',':null;
    if(!delim)return null;
    const split=l=>l.split(delim).map(x=>x.trim());
    const headers=split(first);return {headers,rows:lines.slice(1).map(l=>{const c=split(l);while(c.length<headers.length)c.push('');return c})};
  }
  NT.imPickFile=function(){
    const i=document.createElement('input');i.type='file';i.accept='.xlsx,.xls,.csv,.txt,.docx,.pdf,image/*';
    i.onchange=()=>NT.imReadFile(i.files&&i.files[0]);i.click();
  };
  NT.imReadFile=async function(file){
    if(!file)return;
    IM.status='جاري قراءة الملف…';NT.imStatus();
    try{
      state.importRows=[];
      const inp=q('#importFile');
      try{if(inp&&window.DataTransfer){const dt=new DataTransfer();dt.items.add(file);inp.files=dt.files}}catch(_e){}
      if(/\.txt$/i.test(file.name)){const t=parseText(await file.text());if(!t)throw new Error('النص لا يحتوي جدولًا صالحًا');loadTable(t.headers,t.rows,file.name)}
      else{
        await readImportFile(file);
        const objs=state.importRows||[];
        if(!objs.length)throw new Error('لم يتم العثور على صفوف قابلة للقراءة');
        const headers=[];objs.forEach(o=>Object.keys(o).forEach(k=>{if(!headers.includes(k))headers.push(k)}));
        loadTable(headers,objs.map(o=>headers.map(k=>o[k]==null?'':String(o[k]))),file.name);
      }
    }catch(e){IM.headers=[];IM.rows=[];IM.status='تعذر القراءة الآمنة: '+(e&&e.message||'خطأ')}
    render();
  };
  NT.imAnalyze=function(){
    const t=parseText(IM.manual);
    if(!t){IM.headers=[];IM.rows=[];IM.status='النص لا يحتوي جدولًا صالحًا';render();return}
    loadTable(t.headers,t.rows,`manual-reviewed-${new Date().toISOString().slice(0,10)}.txt`,'تم تحليل النص يدويًا. راجع المعاينة ثم اعتمد.');render();
  };
  NT.imStatus=function(msg){if(msg!=null)IM.status=msg;const e=q('#ntImStatus');if(e)e.textContent=IM.status;else if(state.page==='data')render()};
  NT.imKind=k=>{IM.kind=k;IM.res=null;render()};
  NT.imHalaqa=v=>{IM.halaqa=v};
  NT.imTogglePaste=()=>{IM.paste=!IM.paste;render()};
  NT.imManual=v=>{IM.manual=v;const b=q('#ntImAnalyze');if(b)b.disabled=!String(v).trim()};
  NT.imExport=async function(kind){
    try{
      if(kind==='excel'){await exportStudentsExcel();NT.imStatus('تم تصدير الطلاب Excel')}
      else if(kind==='word'){await exportStudentsWord();NT.imStatus('تم تصدير الطلاب Word')}
      else if(typeof openStudentsPdfPreview==='function')openStudentsPdfPreview();
    }catch(e){NT.imStatus('تعذر التصدير: '+(e&&e.message||'خطأ'))}
  };
  NT.imBackup=async function(){try{await exportHalaqatiBackup();NT.imStatus('تم إنشاء النسخة الاحتياطية')}catch(e){NT.imStatus(e&&e.message||'تعذر إنشاء النسخة الاحتياطية')}};
  NT.imTemplate=()=>{try{downloadImportTemplate(IM.kind==='recitations'?'recitations':IM.kind)}catch(e){console.warn(e)}};
  // ---- column mapping editor (ModalBottomSheet)
  NT.imMapOpen=function(){
    const m=IM.maps[IM.kind]||{},opts=[{value:'',label:'غير محدد'}].concat(IM.headers.map((x,i)=>({value:String(i),label:x||`عمود ${i+1}`})));
    const fields=FIELDS[IM.kind].map(([k,label,req])=>NX.select(req?`${label} *`:label,opts,{value:m[k]==null?'':String(m[k]),onchange:`NT.imMapSet('${k}',this.value)`})).join('');
    NX.dialog('ntImMapDlg','ربط الأعمدة يدويًا',`<p class="nt-p">اختر العمود الصحيح لكل حقل. الحقول المعلّمة بـ * مطلوبة للاعتماد.</p><div class="nt-map-grid">${fields}</div>`,{cls:'nt-map-dlg',footer:`${NX.btn('اكتشاف تلقائي',{kind:'outlined',onclick:'NT.imMapAuto()'})}${NX.btn('تم',{onclick:"NX.closeDialog('ntImMapDlg')"})}`});
  };
  NT.imMapSet=function(k,v){IM.maps[IM.kind][k]=v===''?null:Number(v);IM.res=null;render()};
  NT.imMapAuto=function(){IM.maps[IM.kind]=detect(IM.kind,IM.headers);render();NT.imMapOpen()};
  // ---- commit (reuses commitImport() so data behaviour, duplicate rules and the import job log stay identical)
  function canonicalRows(kind,m,list){
    const out=[];
    IM.rows.forEach((row,i)=>{
      if(list[i]!==IR.VALID)return;const c=k=>cell(row,m[k]).trim();let o;
      if(kind==='students')o={'الاسم':c('fullName'),'الجنس':c('gender'),'رقم الهوية':c('nationalId'),'تاريخ الميلاد':IR.date(c('dateOfBirth'))||'','الفئة':c('category'),'المسار':IR.track(c('track'))==='tathbit'?'مسار التثبيت':'مسار الحفظ العام','المرحلة':c('schoolGrade'),'بريد ولي الأمر':c('guardianEmail'),'جوال ولي الأمر':c('guardianPhone')};
      else if(kind==='recitations')o={'الطالب':c('student'),'التاريخ':IR.date(c('date')),'النوع':c('type'),'الصفحات':IR.dec(c('pages')),'الأخطاء':IR.int(c('mistakes'))||0,'النقرات':IR.int(c('prompts'))||0,'ملاحظة':c('note')};
      else o={'الطالب':c('student'),'الشهر':IR.month(c('month')),'هدف الحفظ':IR.dec(c('hifz'))||0,'هدف المراجعة':IR.dec(c('review'))||0,'هدف السرد':IR.dec(c('sard'))||0,'أيام التسميع':c('expectedDays')?IR.int(c('expectedDays')):20};
      out.push(o);
    });
    return out;
  }
  NT.imCommit=async function(){
    if(IM.importing)return;
    const kind=IM.kind,m=IM.maps[kind]||{},pf=preflight();
    if(!IM.halaqa){IM.status='اختر الحلقة المستهدفة';return render()}
    IM.importing=true;IM.res=null;render();
    let rows=canonicalRows(kind,m,pf.list),skippedDup=0;
    if(kind==='students'){
      const seen=new Set(activeStudents().filter(s=>s.halaqa_id===IM.halaqa).map(s=>normalizeNameJs(s.full_name))),keep=[];
      rows.forEach(r=>{const k=normalizeNameJs(r['الاسم']);if(seen.has(k)){skippedDup++;return}seen.add(k);keep.push(r)});rows=keep;
    }
    const realConfirm=window.confirm,realToast=window.toast;let captured='';
    try{
      if(rows.length){
        state.importRows=rows;
        const k=q('#importKind');if(k)k.value=kind==='recitations'?'recitations':kind;
        const hs=q('#importHalaqa');if(hs){fillHalaqas(hs);hs.value=IM.halaqa}
        window.confirm=()=>true;window.toast=function(msg){captured=String(msg||'');return realToast.apply(this,arguments)};
        await commitImport();
      }
      const mm=captured.match(/(\d+)\s*ناجح\D+(\d+)\s*فشل/),ok=mm?+mm[1]:0,fail=mm?+mm[2]:(rows.length?rows.length:0);
      IM.res={imported:ok,skipped:pf.skipped+skippedDup,failed:fail+pf.invalid};
      IM.status=`تم الاعتماد: ${IM.res.imported} مضاف/محدّث · ${IM.res.skipped} مكرر/متجاوز · ${IM.res.failed} فشل`;
    }catch(e){IM.status=e&&e.message||'تعذر اعتماد الاستيراد'}
    finally{window.confirm=realConfirm;window.toast=realToast;IM.importing=false;state.importRows=[]}
    render();
  };

  function badge(label,value){return `<div class="nt-badge2"><b>${value}</b><span>${label}</span></div>`}
  dataPage=function(){
    const role0=role(),canImport=typeof canManageStudents==='function'&&canManageStudents(),adv=typeof roleCanAdmin==='function'&&roleCanAdmin();
    const halaqas=(state.halaqas||[]).filter(x=>x.active!==false).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
    if(!IM.halaqa||!halaqas.some(x=>x.id===IM.halaqa))IM.halaqa=halaqas[0]?.id||'';
    if(!adv)IM.kind='students';
    const m=IM.maps[IM.kind]||{},hasPrev=IM.headers.length>0&&IM.rows.length>0,pf=hasPrev?preflight():null;
    const hero=NX.hero('الاستيراد والتصدير','تصدير بيانات الطلاب الأساسية واستيراد البيانات مع مرحلة مراجعة قبل الحفظ.',{});
    const exp=`${NX.section('تصدير بيانات الطلاب')}<div class="nt-grid2">${NX.btn('Excel',{kind:'outlined',icon:'TableView',full:true,onclick:"NT.imExport('excel')"})}${NX.btn('Word',{kind:'outlined',icon:'Description',full:true,onclick:"NT.imExport('word')"})}${NX.btn('PDF',{kind:'outlined',icon:'PictureAsPdf',full:true,onclick:"NT.imExport('pdf')"})}</div>`;
    const kinds=adv?['students','recitations','plans']:['students'];
    let imp='';
    if(canImport){
      imp+=`<div class="nt-lbl">نوع الاستيراد</div><div class="nt-grid3">${kinds.map(k=>NX.chip(KIND_LABEL[k],{selected:IM.kind===k,check:false,onclick:`NT.imKind('${k}')`,cls:'nx-full'})).join('')}</div>`;
      imp+=`<div class="nt-lbl">الحلقة المستهدفة</div>${halaqas.length?NX.select('الحلقة المستهدفة',halaqas.map(x=>({value:x.id,label:x.name||'حلقة'})),{value:IM.halaqa,onchange:'NT.imHalaqa(this.value)'}):'<p class="nt-bad">لا توجد حلقة مفعلة متاحة لهذا الحساب</p>'}`;
    }
    const acts=[];if(canImport){acts.push(NX.btn('اختيار ملف',{kind:'outlined',icon:'UploadFile',full:true,onclick:'NT.imPickFile()'}));acts.push(NX.btn('لصق بيانات',{kind:'outlined',icon:'ContentPaste',full:true,onclick:'NT.imTogglePaste()'}))}
    if(typeof exportHalaqatiBackup==='function'&&typeof roleCanManage==='function'&&roleCanManage())acts.push(NX.btn('نسخة احتياطية',{kind:'outlined',icon:'Download',full:true,onclick:'NT.imBackup()'}));
    imp+=`<div class="nt-grid2">${acts.join('')}</div>`;
    imp+=`<div class="nt-info">لا يتم حفظ أي صف أثناء المعاينة. CSV/TXT وXLSX وDOCX تُحلل محليًا. PDF والصور لا تُعتمد عبر OCR تلقائي؛ استخرج النص بأداة موثوقة ثم الصقه هنا وراجعه قبل الحفظ.</div>`;
    if(canImport)imp+=`<div class="nx-row nx-wrap">${NX.btn('تنزيل نموذج Excel',{kind:'text',small:true,icon:'Download',onclick:'NT.imTemplate()'})}</div>`;
    if(IM.paste&&canImport)imp+=`${NX.field('نص جدولي تمت مراجعته',{html:`<textarea id="ntImManual" rows="6" oninput="NT.imManual(this.value)">${h(IM.manual)}</textarea>`,hint:'يدعم Tab أو فاصلة أو فاصلة منقوطة أو |. أول سطر يجب أن يحتوي أسماء الأعمدة.'})}${NX.btn('تحليل النص للمعاينة',{full:true,id:'ntImAnalyze',onclick:'NT.imAnalyze()',disabled:!IM.manual.trim()})}`;
    imp+=`<p id="ntImStatus" class="nt-status">${h(IM.status)}</p>`;
    let prev='';
    if(hasPrev){
      const detected=FIELDS[IM.kind].filter(([k])=>m[k]!=null).map(([k,l])=>`${l}: ${h(IM.headers[m[k]])}`);
      const required=FIELDS[IM.kind].filter(f=>f[2]),missing=required.filter(([k])=>m[k]==null);
      let summary;
      if(IM.kind==='students')summary=['الاسم: '+(m.fullName!=null?h(IM.headers[m.fullName]):'غير مكتشف'),m.track!=null?'المسار: '+h(IM.headers[m.track]):'',m.category!=null?'الفئة: '+h(IM.headers[m.category]):'',m.guardianPhone!=null?'جوال ولي الأمر: '+h(IM.headers[m.guardianPhone]):''].filter(Boolean).join(' · ');
      else summary=required.map(([k,l])=>`${l}: ${m[k]!=null?h(IM.headers[m[k]]):'غير مكتشف'}`).join(' · ');
      const optionalOk=IM.kind!=='plans'||[m.hifz,m.review,m.sard].some(x=>x!=null);
      const valid=!missing.length&&optionalOk;
      const commitLabel={students:'اعتماد الطلاب بعد المراجعة',recitations:'اعتماد التسميعات بعد المراجعة',plans:'اعتماد الأهداف الشهرية بعد المراجعة'}[IM.kind];
      const note=IM.kind==='recitations'?'اعتماد التسميعات القديمة يتطلب اتصالًا بالإنترنت حتى يتم ربط كل صف بجلسة صحيحة ومنع التكرار. التقييم والنقاط تُعاد حسابها بمحرك V6 نفسه.':IM.kind==='plans'?'أهداف الحفظ/المراجعة/السرد تُحدّث في student_goals ولا تُنشئ Smart Plan جديدة.':'';
      prev=`<div class="nx-card nx-emph nt-prev"><div class="nx-row"><span class="nt-prev-ic">${ic('TableView',24)}</span><div class="nx-grow"><b>${h(IM.fileName||'معاينة الملف')}</b><small class="nx-muted nt-block">${IM.rows.length} صف بيانات · ${IM.headers.length} عمود</small></div></div>
        <div class="nt-lbl">الأعمدة المكتشفة</div><p class="nt-p">${IM.headers.map(h).join(' | ')}</p>
        ${NX.btn('تعديل ربط الأعمدة',{kind:'outlined',full:true,icon:'Tune',onclick:'NT.imMapOpen()'})}
        <div class="nt-lbl">فحص ما قبل الاعتماد</div><div class="nt-grid3">${badge('صالح',pf.valid)}${badge('سيتجاوز',pf.skipped)}${badge('يحتاج تصحيح',pf.invalid)}</div>
        ${pf.invalid>0?NX.notice(`يوجد ${pf.invalid} صف غير صالح بنيويًا. لن يتم تحويل القيم المجهولة أو السالبة إلى بيانات صحيحة تلقائيًا.`,'warning'):''}
        <p class="nt-p ${valid?'':'nt-bad'}">${summary||detected.join(' · ')}</p>${note?`<p class="nt-p">${note}</p>`:''}
        ${NX.btn(IM.importing?'جاري الاعتماد…':commitLabel,{full:true,icon:IM.importing?'':'CheckCircle',onclick:'NT.imCommit()',disabled:IM.importing||!valid||!IM.halaqa||!pf.valid})}
        ${IM.res&&IM.res.imported+IM.res.failed+IM.res.skipped>0?`<div class="nt-grid3">${badge('مضاف/محدّث',IM.res.imported)}${badge('متجاوز',IM.res.skipped)}${badge('فشل',IM.res.failed)}</div>`:''}</div>`;
      const pill=k=>k===IR.VALID?NX.pill('صالح','success'):k===IR.SKIP?NX.pill('سيتجاوز','info'):NX.pill('يحتاج تصحيح','warning');
      const cards=IM.rows.slice(0,40).map((r,i)=>NX.card(`<div class="nx-row nx-between"><span class="nt-rown">صف ${i+2}</span>${pill(pf.list[i])}</div><p class="nt-rowtxt">${r.map(h).join(' | ')}</p>`,{cls:'nx-emph nt-rowcard'})).join('');
      const table=`<div class="nt-tbl-wrap"><table class="nt-tbl"><thead><tr><th>#</th>${IM.headers.map(x=>`<th>${h(x)}</th>`).join('')}<th>الحالة</th></tr></thead><tbody>${IM.rows.slice(0,100).map((r,i)=>`<tr class="${pf.list[i]}"><td>${i+2}</td>${IM.headers.map((_,j)=>`<td>${h(cell(r,j))}</td>`).join('')}<td>${pill(pf.list[i])}</td></tr>`).join('')}</tbody></table></div>`;
      prev+=`<div class="nt-rows-phone">${cards}</div><div class="nt-rows-desk">${table}</div>${IM.rows.length>(isDk()?100:40)?`<p class="nt-p">يتم عرض أول ${isDk()?100:40} صف فقط في المعاينة. الاعتماد يعالج جميع الصفوف.</p>`:''}`;
    }
    return `<div class="nt-data">${hero}<div class="nt-im-grid"><div class="nt-im-side"><div class="nx-stack">${exp}${imp}</div></div><div class="nt-im-main">${prev||(isDk()?`<div class="nt-im-empty">${NX.empty('اختر ملفًا أو الصق بيانات لعرض المعاينة وفحص الأعمدة هنا.',{icon:'UploadFile'})}</div>`:'')}</div></div></div>`;
  };

  /* =====================================================================================================
     7. AUTH  (AuthScreen, PendingApprovalScreen, PasswordRecoveryScreen) — markup/look only, auth logic untouched
     ===================================================================================================== */
  const field=(id,label,icon,type,extra='')=>`<label class="nt-af"><span class="nt-af-l">${label}</span><span class="nt-af-box">${ic(icon,20)}<input class="nt-af-in" id="${id}" type="${type}" ${extra}></span></label>`;
  function authInit(){
    const sec0=q('#auth');if(!sec0||sec0.dataset.nt)return;
    const card=sec0.querySelector('.auth-card');if(!card)return;sec0.dataset.nt='1';sec0.classList.add('nt-auth');
    const old=q('#rc27AuthAmbient');if(old){old.dataset.on='1';old.style.display='none'}
    const keep={login:q('#loginForm'),signup:q('#signupForm'),forgot:q('#forgotPasswordForm'),rec:q('#recoveryPasswordForm'),pend:q('#pendingPanel')};
    // brand band
    const band=document.createElement('div');band.className='nt-auth-band';
    band.innerHTML=`<div class="nt-auth-amb" id="ntAuthAmb"></div><div class="nt-auth-logo"><img src="./brand/logo.svg" alt="شعار حلقاتي" width="104" height="104"></div><h1>حلقاتي</h1><p class="nt-b1">أدوات متابعة القرآن الكريم</p><p class="nt-b2">الحلقات · التسميع · الخطط · ولي الأمر</p>`;
    sec0.insertBefore(band,card);
    if(window.RC27Motion)window.RC27Motion.play(band.querySelector('#ntAuthAmb'),'ambient',{onBand:true});
    // clean card
    card.querySelectorAll(':scope > .auth-logo, :scope > h1, :scope > p, :scope > div[style*="text-align"], :scope > .auth-rule, :scope > .designer').forEach(n=>n.remove());
    const head=document.createElement('div');head.id='ntAuthHead';head.className='nt-auth-head';card.prepend(head);
    const msg=document.createElement('div');msg.id='ntAuthMsg';head.after(msg);
    // login
    keep.login.innerHTML=`${field('loginEmail','البريد الإلكتروني','Email','email','autocomplete="email" required')}${field('loginPassword','كلمة المرور','Lock','password','autocomplete="current-password" required minlength="6"')}
      <button class="nx-btn nx-filled nx-full nt-act" type="submit" id="ntLoginBtn"><span>دخول</span></button>
      <button class="nx-btn nx-outlined nx-full nt-act" type="button" onclick="loginWithGoogle()"><span class="nt-g">G</span><span>الدخول بحساب Google</span></button>
      <button class="nx-btn nx-text nt-center" type="button" onclick="showForgotPassword(true)"><span>نسيت كلمة المرور؟</span></button>
      <button class="nx-btn nx-text nt-center" type="button" onclick="toggleSignup(true)"><span>إنشاء حساب جديد</span></button>`;
    // sign up (keep #signupRole select for the logic + art)
    keep.signup.innerHTML=`<p class="nt-p">إنشاء الحساب لا يمنح الصلاحية مباشرة؛ ينتظر اعتماد المسؤول.</p>${field('signupName','الاسم الكامل','Person','text','autocomplete="name" required')}${field('signupPhone','رقم الجوال','Phone','tel','inputmode="tel" autocomplete="tel"')}
      <div class="nt-roles" role="group">${[['guardian','ولي أمر'],['teacher','محفّظ الحلقة'],['supervisor','مشرف الحلقات']].map(([v,l])=>`<button type="button" class="nx-chip ${v==='guardian'?'on':''}" data-role="${v}" onclick="NT.authRole('${v}')"><span>${l}</span></button>`).join('')}</div>
      <select id="signupRole" hidden><option value="guardian">ولي أمر</option><option value="teacher">محفّظ الحلقة</option><option value="supervisor">مشرف الحلقات</option></select>
      <div class="rc27-signup-art nt-roleart" id="rc27SignupArt"></div>
      ${field('signupEmail','البريد الإلكتروني','Email','email','autocomplete="email" required')}${field('signupPassword','كلمة المرور','Lock','password','minlength="6" autocomplete="new-password" required')}
      <button class="nx-btn nx-filled nx-full nt-act" type="submit"><span>إرسال طلب إنشاء الحساب</span></button>
      <button class="nx-btn nx-text nt-center" type="button" onclick="toggleSignup(false)"><span>لدي حساب بالفعل</span></button>`;
    keep.forgot.innerHTML=`<p class="nt-p">اكتب البريد الإلكتروني المسجل، وسيصلك رابط استعادة كلمة المرور على بريدك الإلكتروني.</p>${field('forgotEmail','البريد الإلكتروني','Email','email','autocomplete="email" required')}
      <button class="nx-btn nx-filled nx-full nt-act" type="submit"><span>إرسال الرابط</span></button>
      <button class="nx-btn nx-text nt-center" type="button" onclick="showForgotPassword(false)"><span>إلغاء</span></button>`;
    keep.rec.innerHTML=`<p class="nt-p">اكتب كلمة المرور الجديدة مرتين. بعد نجاح التغيير يمكنك تسجيل الدخول بالكلمة الجديدة.</p>${field('recoveryPassword','كلمة المرور الجديدة','Lock','password','minlength="6" autocomplete="new-password" required')}${field('recoveryPassword2','تأكيد كلمة المرور','Lock','password','minlength="6" autocomplete="new-password" required')}
      <button class="nx-btn nx-filled nx-full nt-act" type="submit"><span>حفظ كلمة المرور</span></button>`;
    // pending approval (ids kept for showAccessStatus / motion.js)
    keep.pend.className='nt-pending hidden';
    keep.pend.innerHTML=`<h2 id="pendingTitle">الحساب قيد اعتماد المسؤول</h2><div class="rc27-pending-art nt-roleart" id="rc27PendingArt"></div><div id="pendingIcon" hidden></div><b id="ntPendName"></b><p class="nt-p">نوع الحساب المطلوب: <b id="pendingRole">—</b></p><p id="pendingText" class="nt-p"></p>
      ${NX.btn('تحديث حالة الاعتماد',{full:true,onclick:'checkApproval()'})}${NX.btn('تعديل الاسم الكامل',{kind:'outlined',full:true,onclick:'openAccountNameDialog(false)'})}${NX.btn('تسجيل الخروج',{kind:'text',onclick:'logout()'})}`;
    // credits
    const cr=document.createElement('div');cr.className='nt-credits';
    cr.innerHTML=`<div>${ic('Handyman',16)}<b>صُنع بأيدٍ شرقية</b></div><div class="m">${ic('LocationOn',16)}<span>الشرقية — خانيونس</span></div><div class="m s">${ic('Brush',15)}<span dir="ltr">Designed by : Dr. Mohammed Samir Abu Younis</span></div>`;
    card.after(cr);
    const upd=()=>{
      const vis=id=>q('#'+id)&&!q('#'+id).classList.contains('hidden');
      const mode=vis('signupForm')?'s':vis('forgotPasswordForm')?'f':vis('recoveryPasswordForm')?'r':vis('pendingPanel')?'p':'l';
      const T={l:['أهلًا بك في حلقاتي','رحلة القرآن، أقرب إليك. استخدم حسابك للوصول إلى الحلقة.'],s:['إنشاء حساب','أدخل بياناتك وسيظهر طلبك لمسؤول الحلقة للاعتماد.'],f:['استرجاع كلمة المرور',''],r:['تعيين كلمة مرور جديدة',''],p:['','']}[mode];
      head.innerHTML=T[0]?`<h2>${T[0]}</h2>${T[1]?`<p>${T[1]}</p>`:''}`:'';
      sec0.dataset.mode=mode;
      const nm=q('#ntPendName');if(nm&&state.profile)nm.textContent=state.profile.full_name||'';
    };
    new MutationObserver(upd).observe(card,{attributes:true,subtree:true,attributeFilter:['class']});upd();
    // login button enabled like the app (email + password >= 6)
    const M=window.RC27Motion;
    if(M){
      const sel=q('#signupRole'),art=q('#rc27SignupArt'),pr=q('#pendingRole'),pa=q('#rc27PendingArt');
      const sUpd=()=>{art.innerHTML='';M.play(art,{guardian:'role_guardian',teacher:'role_teacher',supervisor:'role_supervisor'}[sel.value]||'role_teacher',{})};
      sel.addEventListener('change',sUpd);sUpd();
      const pUpd=()=>{const x=pr.textContent||'',sc=/ولي/.test(x)?'role_guardian':/مشرف/.test(x)?'role_supervisor':/مدير|مسؤول/.test(x)?'role_admin':'role_teacher';if(pa.dataset.scene!==sc){pa.dataset.scene=sc;pa.innerHTML='';M.play(pa,sc,{})}};
      new MutationObserver(pUpd).observe(pr,{childList:true,characterData:true,subtree:true});pUpd();
    }
    const chk=()=>{const b=q('#ntLoginBtn');if(b)b.disabled=!(q('#loginEmail').value.trim()&&q('#loginPassword').value.length>=6)};
    ['loginEmail','loginPassword'].forEach(i=>q('#'+i).addEventListener('input',chk));chk();
    // errors from toast() are mirrored into the card for the auth screen
    if(typeof toast==='function'&&!toast.__nt){
      const bt=toast;toast=function(m){const r=bt.apply(this,arguments);try{if(!q('#auth').classList.contains('hidden')){const box=q('#ntAuthMsg');const s=String(m||''),k=/^(تعذر|خطأ|كلمة|اكتب|Invalid|invalid)/.test(s)||/غير/.test(s)?'error':'success';box.innerHTML=`<div class="nx-notice nx-s-${k==='error'?'error':'success'}">${h(s)}</div>`}}catch(_e){}return r};
      toast.__nt=1;
    }
  }
  NT.authRole=function(v){
    const s=q('#signupRole');if(!s)return;s.value=v;s.dispatchEvent(new Event('change'));
    document.querySelectorAll('.nt-roles .nx-chip').forEach(b=>b.classList.toggle('on',b.dataset.role===v));
  };
  document.addEventListener('DOMContentLoaded',authInit);if(document.readyState!=='loading')authInit();
  // the legacy markup may be (re)built after this script on a slow boot
  setTimeout(authInit,300);

  /* =====================================================================================================
     8. DESKTOP chrome — rail keyboard hint + sidebar polish hooks (styles in native-tools.css)
     ===================================================================================================== */
  function dkChrome(){
    if(!isDk())return;
    tryDo(()=>{
      const head=q('#drawer .drawer-head');
      if(head&&!head.dataset.ntdk){head.dataset.ntdk='1'}
    });
  }
  setInterval(dkChrome,3000);
})();
