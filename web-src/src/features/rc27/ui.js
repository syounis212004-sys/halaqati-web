/* Halaqati v2.63.22 — visual identity layer: new drawer, brand, palette defaults, page transitions. */
(function(){
  const ROLE_TITLE={admin:'مسؤول النظام والحلقات',supervisor:'مشرف الحلقات',teacher:'محفّظ الحلقة',guardian:'ولي الأمر'};
  // native drawerGroupOf: 0 الأساسي · 1 المتابعة والإنجاز · 2 التواصل والأدوات · 3 الإدارة · 4 الحساب والنظام
  const GROUPS=[['الأساسي',['home','sessions','students','plans','halaqas']],['المتابعة والإنجاز',['ranking','competition','certificates','reports','supervision','profile']],['التواصل والأدوات',['community','quran','data']],['الإدارة',['users']],['الحساب والنظام',['notifications','sync','settings']]];
  const SYNC_SVG='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7L21 16"/><path d="M16 16h5v5"/></svg>';
  const OFF_SVG='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M5.8 9.3A6 6 0 0 0 7 21h10a4.5 4.5 0 0 0 1.6-.3"/><path d="M9.5 4.6A6 6 0 0 1 17 9.6 4.5 4.5 0 0 1 21 14"/></svg>';
  const esc2=v=>typeof esc==='function'?esc(v):String(v);

  // Palette: native defaults replace the old default pair, user-chosen colors are kept.
  if(typeof applySavedTheme==='function'){
    const baseTheme=applySavedTheme;
    applySavedTheme=function(){
      baseTheme.apply(this,arguments);
      const p=getThemePrefs(),g=state.settings||{},root=document.documentElement;
      const pr=(p.primary||g.primary_color||'').toLowerCase(),ac=(p.accent||g.accent_color||'').toLowerCase();
      const oldPair=(pr===''||pr==='#0d3b2f'||pr==='#155643')&&(ac===''||ac==='#2f8b69');
      if(oldPair){root.style.setProperty('--green','#0B5D4F');root.style.setProperty('--green3','#1B7F6B');document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#0B5D4F')}
    };
  }

  const online=()=>state.networkVerified&&!state.offline;
  function pending(){return typeof readOfflineQueue==='function'?readOfflineQueue().length:0}
  function refreshDrawerHead(){
    const nm=document.getElementById('dhName');if(nm)nm.textContent=state.profile?.full_name||'المستخدم';
    const role=document.getElementById('drawerRole');if(role)role.textContent=ROLE_TITLE[state.profile?.role]||'المستخدم';
    const on=online(),dot=document.getElementById('dhDot'),c=document.getElementById('dhConn');
    if(dot)dot.className='dh-dot '+(on?'on':'off');if(c)c.textContent=on?'متصل':'دون اتصال';
  }
  if(typeof buildNav==='function'){
    const baseBuild=buildNav;
    buildNav=function(){
      const n=document.getElementById('nav');
      if(!n||typeof navItems!=='function')return baseBuild.apply(this,arguments);
      const items=navItems(),map=new Map(items.map(x=>[x[0],String(x[1]).replace(/\s*\(\d+\)$/,'')])),used=new Set,pend=pending(),unread=Number(state.notificationUnread||0);
      map.set('sync',online()?'المزامنة':'دون اتصال');
      const tile=(p,l)=>{
        const active=state.page===p,badge=p==='notifications'?unread:p==='sync'?pend:0,spin=p==='sync'&&online()&&pend>0;
        const icon=p==='sync'?(online()?SYNC_SVG:OFF_SVG):iconFor(p);
        return `<button type="button" class="dtile ${active?'active':''}" ${active?'aria-current="page"':''} onclick="${p==='sync'?"toggleDrawer(false);openSyncStatusDialog()":`go('${p}')`}"><span class="dt-ico ${spin?'rc27-spin':''}">${icon}${badge?`<i class="dt-badge">${badge>99?'99+':badge}</i>`:''}</span><span class="dt-label">${esc2(l)}</span></button>`;
      };
      let html='';
      GROUPS.forEach(([title,keys])=>{const rows=keys.filter(k=>map.has(k));rows.forEach(k=>used.add(k));if(rows.length)html+=`<div class="nav-section">${title}</div><div class="dgrid">${rows.map(k=>tile(k,map.get(k))).join('')}</div>`});
      const rest=items.filter(x=>!used.has(x[0]));if(rest.length)html+=`<div class="nav-section">أخرى</div><div class="dgrid">${rest.map(x=>tile(x[0],map.get(x[0]))).join('')}</div>`;
      n.innerHTML=html;
      if(typeof buildMobileNav==='function')buildMobileNav();
      refreshDrawerHead();
    };
  }
  setInterval(()=>{refreshDrawerHead();if(document.getElementById('drawer')?.classList.contains('open')&&typeof buildNav==='function')buildNav()},4000);

  // RC27.25: pages opened from the side menu (notifications, settings, sync, ...) stack over the page they came from,
  // so Back returns to it instead of the home page. Bottom-bar pages reset the stack.
  const BAR=new Set(['home','sessions','students','plans','ranking','children','achievements']);
  const stack=[];let popping=false;
  if(typeof go==='function'){
    const baseGo=go;
    go=function(p){
      const prev=state.page;
      if(!popping){
        if(BAR.has(p))stack.length=0;
        else if(prev&&prev!==p){stack.push(prev);try{history.pushState({rc27:stack.length},'')}catch(_e){}}
      }
      return baseGo.apply(this,arguments);
    };
    window.addEventListener('popstate',()=>{
      if(!stack.length)return;
      const back=stack.pop();popping=true;
      try{go(back)}finally{popping=false}
    });
  }

})();
