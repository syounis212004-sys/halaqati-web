/* Halaqati v2.63.22 — visual identity layer: new drawer, brand, palette defaults, page transitions. */
(function(){
  const ROLE_AR={admin:'مدير النظام',supervisor:'مشرف',teacher:'محفّظ',guardian:'ولي أمر'};
  const SECTIONS=[['الرئيسية',['home','notifications','community']],['العمل اليومي',['sessions','students','plans','halaqas']],['المتابعة والتقارير',['reports','ranking','competition','certificates','supervision','profile']],['أدوات',['quran','data']],['الإدارة',['users','settings']]];
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

  function bell(){const n=Number(state.notificationUnread||0);return n?`🔔<i class="dh-count">${n>99?'99+':n}</i>`:'🔔'}
  function statusText(){
    if(!state.networkVerified||state.offline)return {t:'دون اتصال — البيانات محفوظة على الجهاز',c:'off'};
    const q=typeof readOfflineQueue==='function'?readOfflineQueue().length:0;
    return q?{t:`متصل — ${q} عملية بانتظار المزامنة`,c:'pend'}:{t:'متصل ومتزامن',c:'ok'};
  }
  function refreshDrawerHead(){
    const role=document.getElementById('drawerRole');if(role)role.textContent=ROLE_AR[state.profile?.role]||'';
    const b=document.getElementById('dhBell');if(b)b.innerHTML=bell();
    const s=document.getElementById('dhStatus'),st=statusText();if(s){s.textContent=st.t;s.className='dh-status '+st.c}
  }
  if(typeof buildNav==='function'){
    const baseBuild=buildNav;
    buildNav=function(){
      const n=document.getElementById('nav');
      if(!n||typeof navItems!=='function')return baseBuild.apply(this,arguments);
      const items=navItems(),map=new Map(items.map(x=>[x[0],x[1]])),used=new Set;
      const btn=([p,l])=>`<button type="button" class="${state.page===p?'active':''}" ${state.page===p?'aria-current="page"':''} onclick="go('${p}')"><span class="ico">${iconFor(p)}</span><span>${l}</span></button>`;
      let html='';
      SECTIONS.forEach(([title,keys])=>{const rows=keys.filter(k=>map.has(k)).map(k=>{used.add(k);return [k,map.get(k)]});if(rows.length)html+=`<div class="nav-section">${title}</div>${rows.map(btn).join('')}`});
      const rest=items.filter(x=>!used.has(x[0]));if(rest.length)html+=`<div class="nav-section">أخرى</div>${rest.map(btn).join('')}`;
      n.innerHTML=html;
      if(typeof buildMobileNav==='function')buildMobileNav();
      refreshDrawerHead();
    };
  }
  setInterval(refreshDrawerHead,4000);

  // Directional page transition (slide in from the reading side), disabled by reduced motion.
  if(typeof render==='function'){
    let last=null;
    const baseRender=render;
    render=async function(){
      const r=await baseRender.apply(this,arguments);
      try{
        const c=document.getElementById('content');
        if(c&&state.page!==last){last=state.page;c.classList.remove('rc27-enter');void c.offsetWidth;c.classList.add('rc27-enter')}
      }catch(_e){}
      return r;
    };
  }
})();
