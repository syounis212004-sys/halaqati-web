/* Halaqati RC27.40 — real desktop experience (html[data-view="desktop"]).
   Not a stretched phone layout: icon-rail sidebar, top bar with global search and scope switcher, a two-column
   dashboard, a students data table, a sessions master/detail workspace, card grids for list pages, wide
   two-column dialogs and keyboard shortcuts. Every action keeps calling the same handlers as the phone UI. */
(function(){
  const root=document.documentElement;
  const isDk=()=>root.getAttribute('data-view')==='desktop';
  const h=v=>typeof esc==='function'?esc(v):String(v==null?'':v);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const RAIL='halaqati_dk_rail_v1';
  const rail=()=>{try{return localStorage.getItem(RAIL)==='1'}catch(_e){return false}};
  function applyRail(){root.setAttribute('data-rail',rail()?'1':'0')}
  window.rc27ToggleRail=function(){try{localStorage.setItem(RAIL,rail()?'0':'1')}catch(_e){}applyRail()};
  applyRail();

  // ---------- sidebar: tooltips + collapse button ----------
  function decorateSidebar(){
    if(!isDk())return;
    $$('#nav .dtile').forEach(b=>{const l=b.querySelector('.dt-label')?.textContent?.trim();if(l)b.title=l});
    const head=document.querySelector('#drawer .drawer-head');
    if(head&&!document.getElementById('dkRailBtn')){
      const b=document.createElement('button');b.id='dkRailBtn';b.type='button';b.className='dk-rail-btn';b.title='طيّ/توسيع القائمة';b.setAttribute('aria-label','طيّ أو توسيع القائمة');
      b.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h16"/></svg>';
      b.onclick=window.rc27ToggleRail;head.appendChild(b);
    }
  }

  // ---------- top bar: wide search + scope switcher ----------
  function decorateTopbar(){
    if(!isDk())return;
    const tb=document.querySelector('#app .topbar');if(!tb)return;
    const sb=document.getElementById('opsSearchButton');
    if(sb&&!sb.dataset.dk){
      sb.dataset.dk='1';sb.classList.add('dk-search');const tt=tb.querySelector('.top-title');if(tt)tt.after(sb);
      sb.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>ابحث عن طالب أو جلسة أو صفحة…</span><kbd>Ctrl K</kbd>';
    }
    let slot=document.getElementById('dkScopeSlot');
    if(!slot){slot=document.createElement('div');slot.id='dkScopeSlot';slot.className='dk-scope-slot';const bell=document.getElementById('notificationBell');tb.insertBefore(slot,sb?sb.nextSibling:bell||null)}
    const c=document.getElementById('content'),bar=c?.querySelector('.rc27-scope');
    slot.innerHTML='';if(bar)slot.appendChild(bar);
    let d=document.getElementById('dkDate');
    if(!d){d=document.createElement('div');d.id='dkDate';d.className='dk-date';tb.insertBefore(d,document.getElementById('notificationBell')||null)}
    d.textContent=new Date().toLocaleDateString('ar',{weekday:'long',day:'numeric',month:'long'});
  }

  // ---------- generic card grids ----------
  const WIDE='table,canvas,textarea,iframe,.cert-layout,.tabs,.seg,.form-grid,.range-pair,.chart,.ops-report,.student-tools';
  function gridify(c){
    if(!c||c.dataset.dkGrid==='0'||false)return;
    const kids=[...c.children];let run=[];
    const flush=()=>{
      if(run.length>=2){
        const g=document.createElement('div');g.className='dk-grid';run[0].before(g);
        run.forEach(n=>{if(n.matches(WIDE)||n.querySelector(WIDE))n.classList.add('dk-span');g.appendChild(n)});
      }
      run=[];
    };
    kids.forEach(n=>{
      if(n.classList?.contains('card')&&!n.classList.contains('dk-keep')&&!n.closest('.dk-split'))run.push(n);else flush();
    });
    flush();
  }

  // ---------- home: main + side column ----------
  // home: composed natively by native/home.js (.nh-home grid: main + side column) — nothing to restructure here.
  function restructureHome(){}

  // ---------- students: moved to src/features/native/students.js (data table + side panel) ----------

  // ---------- sessions: list + roster workspace ----------
  // RC27.40: the master/detail composition now lives in native/sessions.js (sessionsPage renders list + roster itself).
  let autoOpened=false;
  async function autoOpenSession(){
    if(!isDk()||state.page!=='sessions'||state.sessionView||autoOpened)return;
    autoOpened=true;
    const t=typeof todayStr==='function'?todayStr():new Date().toISOString().slice(0,10);
    const rows=(state.sessions||[]).filter(s=>s.status!=='cancelled');
    const pick=rows.find(s=>String(s.session_date).startsWith(t)&&s.status==='open')||rows.find(s=>s.status==='open')||rows.sort((a,b)=>String(b.session_date).localeCompare(String(a.session_date)))[0];
    if(pick&&typeof openSessionRoster==='function'){try{await openSessionRoster(pick.id)}catch(_e){}}
  }
  // selected row highlight in the list
  function markSelected(c){
    const id=state.sessionView;if(!id||!c)return;
    $$('.dk-list .card',c).forEach(n=>{if(n.innerHTML.includes(`'${id}'`)||n.innerHTML.includes(`"${id}"`))n.classList.add('dk-sel')});
  }

  // ---------- main render hook ----------
  if(typeof render==='function'){
    const baseRender=render;
    render=async function(){
      if(state.page!=='sessions')autoOpened=false;
      const r=await baseRender.apply(this,arguments);
      try{
        if(isDk()){
          const c=document.getElementById('content');
          root.setAttribute('data-page',state.page||'');
          decorateSidebar();decorateTopbar();
          restructureHome(c);
          if(state.page==='sessions')markSelected(c);
          if(!['students','sessions'].includes(state.page))gridify(c);
          if(state.page==='home')gridify(c.querySelector('.dk-main'));
          autoOpenSession();
        }
      }catch(e){console.warn('rc27 desktop',e)}
      return r;
    };
  }
  window.addEventListener('halaqati:viewchange',()=>{decorateSidebar();decorateTopbar()});
  setInterval(()=>{if(isDk()){decorateSidebar();decorateTopbar()}},3000);

  // ---------- keyboard ----------
  const NAV=['home','sessions','students','plans','halaqas','ranking','certificates','reports','supervision','community','quran','data'];
  document.addEventListener('keydown',e=>{
    if(!isDk()||!state.profile)return;
    const t=e.target,typing=t&&(t.matches?.('input,textarea,select,[contenteditable]'));
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(typeof openGlobalSearch==='function')openGlobalSearch();return}
    if(typing||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==='/'){e.preventDefault();if(typeof openGlobalSearch==='function')openGlobalSearch();return}
    if(e.key==='['||e.key===']'){window.rc27ToggleRail();return}
  });
  document.addEventListener('keydown',e=>{
    if(!isDk()||!e.altKey||e.ctrlKey||e.metaKey)return;
    const n=Number(e.key);if(!(n>=1&&n<=9))return;
    const items=typeof navItems==='function'?navItems().map(x=>x[0]):NAV,p=items[n-1];
    if(p&&p!=='more'){e.preventDefault();go(p)}
  });
})();
