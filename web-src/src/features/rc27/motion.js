/* Halaqati v2.63.22 — motion identity (port of the native HalaqatiMotion / MotionKit / NavMotion).
   Same 19 Lottie scenes drawn from the logo; colors follow the active theme; "الحركة: مخففة" turns everything into still frames. */
(function(){
  const BASE=new URL('./motion/',document.baseURI).href;
  const SCENES={
    splash:[false,1],loading:[true,.35],success:[false,1],empty:[true,.42],empty_people:[true,.25],empty_bell:[true,0],empty_search:[true,.1],empty_doc:[true,.6],
    ambient:[true,0],role_admin:[true,.1],role_supervisor:[true,.35],role_teacher:[true,.1],role_student:[true,.35],role_guardian:[true,.1],
    milestone:[false,1],sync:[true,0],trophy:[true,.4],offline:[true,.5],welcome:[false,1]
  };
  const jsonCache=new Map;
  let lottiePromise=null;
  function prefs(){try{return JSON.parse(localStorage.getItem('halaqati_display_v1')||'{}')}catch(_e){return {}}}
  const reduced=()=>!!prefs().reduceMotion;
  function ensureLottie(){
    if(window.lottie)return Promise.resolve(window.lottie);
    if(!lottiePromise)lottiePromise=new Promise((res,rej)=>{const s=document.createElement('script');s.src=new URL('./core/lottie_light.min.js',document.baseURI).href;s.onload=()=>res(window.lottie);s.onerror=rej;document.head.appendChild(s)});
    return lottiePromise;
  }
  function loadJson(name){
    if(!jsonCache.has(name))jsonCache.set(name,fetch(BASE+'halaqati_'+name+'.json').then(r=>{if(!r.ok)throw new Error(name);return r.json()}));
    return jsonCache.get(name).then(j=>JSON.parse(JSON.stringify(j)));
  }
  // ---- theme colors (native: Primary=primary, Accent=tertiary, OnPrimary=onPrimary; onBand flips them for colored bands)
  const hex=h=>{h=h.replace('#','');if(h.length===3)h=[...h].map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).concat(1)};
  function themeColor(){const v=getComputedStyle(document.documentElement).getPropertyValue('--green').trim();return /^#/.test(v)?v:'#0B5D4F'}
  function palette(onBand){
    const dark=document.body.classList.contains('dark'),primary=dark?'#8FDDBF':themeColor(),onPrimary=dark?'#04281F':'#FFFFFF',tertiary=dark?'#EBC66F':'#7A5200';
    return onBand?{Primary:onPrimary,Accent:'#EBC66F',OnPrimary:primary}:{Primary:primary,Accent:tertiary,OnPrimary:onPrimary};
  }
  function recolor(node,map,mode){
    if(Array.isArray(node)){node.forEach(n=>recolor(n,map,mode));return}
    if(!node||typeof node!=='object')return;
    let m=mode;if(typeof node.nm==='string'&&map[node.nm])m=node.nm;
    if(m&&(node.ty==='st'||(node.ty==='fl'&&m!=='OnPrimary')))node.c={a:0,k:hex(map[m])};
    for(const k in node){const v=node[k];if(v&&typeof v==='object')recolor(v,map,m)}
  }
  function play(el,name,o={}){
    if(!el||!SCENES[name])return null;
    const [loop,rest]=SCENES[name],handle={anim:null,dead:false,destroy(){this.dead=true;try{this.anim&&this.anim.destroy()}catch(_e){}}};
    const rd=reduced();
    Promise.all([ensureLottie(),loadJson(name)]).then(([lottie,data])=>{
      if(handle.dead||!el.isConnected)return;
      recolor(data,palette(!!o.onBand),null);
      const anim=lottie.loadAnimation({container:el,renderer:'svg',loop:loop&&!rd,autoplay:!rd,animationData:data,rendererSettings:{preserveAspectRatio:'xMidYMid meet'}});
      handle.anim=anim;
      if(rd){anim.addEventListener('DOMLoaded',()=>{anim.goToAndStop(Math.round(rest*anim.totalFrames),true);o.onFinished&&o.onFinished()});return}
      if(!loop){let done=false;const fin=()=>{if(!done){done=true;o.onFinished&&o.onFinished()}};anim.addEventListener('enterFrame',e=>{if(e.currentTime/e.totalTime>=(o.finishAt||1))fin()});anim.addEventListener('complete',fin)}
    }).catch(()=>{o.onFinished&&o.onFinished()});
    return handle;
  }
  const box=(cls,name,o={})=>{const d=document.createElement('div');d.className='rc27-lt '+(cls||'');if(o.size){d.style.width=d.style.height=o.size+'px'}play(d,name,o);return d};

  // ---- splash (once per cold start, tap to skip, 3.2s failsafe)
  function runSplash(){
    const sp=document.getElementById('rc27Splash');if(!sp||sp.dataset.started)return;sp.dataset.started='1';
    const hide=()=>{if(sp.dataset.done)return;sp.dataset.done='1';sp.classList.add('out');setTimeout(()=>sp.remove(),240)};
    if(reduced()){sp.remove();return}
    sp.addEventListener('click',hide);setTimeout(hide,3200);
    const slot=sp.querySelector('.rc27-splash-art');if(slot){slot.innerHTML='';play(slot,'splash',{finishAt:.84,onFinished:hide})}
  }

  // ---- moments (saved / success / milestone / welcome): never block touches
  let momentTimer=null;
  function moment(kind){
    document.getElementById('rc27Moment')?.remove();clearTimeout(momentTimer);
    const host=document.createElement('div');host.id='rc27Moment';host.className='rc27-moment '+kind;
    const card=document.createElement('div');card.className='rc27-moment-card';
    if(kind==='saved')card.appendChild(box('','success',{size:84}));
    else if(kind==='success')card.appendChild(box('','success',{size:196}));
    else if(kind==='milestone')card.appendChild(box('','milestone',{size:280}));
    else{card.classList.add('row');card.appendChild(box('','welcome',{size:52}));const t=document.createElement('b');t.textContent='أهلًا بك في حلقاتي';card.appendChild(t)}
    host.appendChild(card);document.body.appendChild(host);
    const ms={saved:1300,success:1700,milestone:2800,welcome:2600}[kind];
    momentTimer=setTimeout(()=>{host.classList.add('out');setTimeout(()=>host.remove(),260)},reduced()?900:ms);
  }
  const API=window.RC27Motion={play,box,moment,saved:()=>moment('saved'),celebrate:()=>moment('success'),milestone:()=>moment('milestone'),welcome:()=>moment('welcome'),reduced};

  // toast → moment mapping (native emits these at the same business events)
  if(typeof toast==='function'){
    const baseToast=toast;
    toast=function(m){
      const r=baseToast.apply(this,arguments),s=String(m||'');
      try{
        if(/تمت أرشفة بيانات الشهادة|تم إصدار الشهادة/.test(s))API.milestone();
        else if(/تم اعتماد الحساب/.test(s)||/^تم رفع الجلسة/.test(s))API.celebrate();
        else if(/^تم حفظ (التقرير|الخطة)/.test(s)||/^تم حفظ الخطة/.test(s))API.saved();
      }catch(_e){}
      return r;
    };
  }
  // welcome once after a fresh sign-in
  document.addEventListener('submit',e=>{if(e.target&&e.target.id==='loginForm')sessionStorage.setItem('rc27_fresh','1')},true);
  if(typeof showApp==='function'){
    const baseShow=showApp;
    showApp=function(){const r=baseShow.apply(this,arguments);if(sessionStorage.getItem('rc27_fresh')){sessionStorage.removeItem('rc27_fresh');setTimeout(API.welcome,500)}return r};
  }

  // ---- page chrome: art in hero, empty states, counters, cascade, name fitting
  const ROLE_SCENE={admin:'role_admin',supervisor:'role_supervisor',teacher:'role_teacher',student:'role_student',guardian:'role_guardian'};
  const TROPHY_PAGES=new Set(['ranking','competition']);
  function emptyScene(text){
    const t=text||'';
    if(t.includes('إشعار'))return 'empty_bell';
    if(/منافس|ترتيب|إنجاز/.test(t))return 'trophy';
    if(/بحث|مطابق|نتائج/.test(t))return 'empty_search';
    if(/شهاد|تقرير|سجل|وثيق/.test(t))return 'empty_doc';
    if(/ولي|حساب|ملفات|طالب|طلاب/.test(t))return 'empty_people';
    return 'empty';
  }
  const counts=new Map;
  let pageKey='',cascadeUntil=0;
  function countUp(el){
    const raw=el.textContent.trim();if(!/^\d{1,6}$/.test(raw))return;
    const key=pageKey+'|'+(el.previousElementSibling?.textContent||el.parentElement?.textContent.slice(0,16)||''),target=Number(raw),prev=counts.get(key);
    counts.set(key,target);
    if(reduced()||prev===target)return;
    const from=prev==null?0:prev,t0=performance.now(),dur=850;
    const step=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=String(Math.round(from+(target-from)*e));if(p<1&&el.isConnected)requestAnimationFrame(step);else el.textContent=String(target)};
    requestAnimationFrame(step);
  }
  function fitNames(root){
    root.querySelectorAll('.student-card .grow > b,.rank-row .grow > b,.card .row .grow > b').forEach(el=>{
      if(el.dataset.fit)return;el.dataset.fit='1';el.classList.add('rc27-name');
      let fs=parseFloat(getComputedStyle(el).fontSize)||15,min=fs*.76;
      for(let i=0;i<8&&el.scrollWidth>el.clientWidth+1&&fs>min;i++){fs-=1;el.style.fontSize=fs+'px'}
    });
  }
  function decorate(c){
    if(!c||!state.profile)return;
    const page=state.page;
    // hero: eastern pattern + account / trophy art
    const hero=c.querySelector('.hero:not([data-rc27])');
    if(hero){
      hero.dataset.rc27='1';hero.classList.add('rc27-hero');
      hero.insertAdjacentElement('afterbegin',box('rc27-ambient','ambient',{onBand:true}));
      const scene=TROPHY_PAGES.has(page)?'trophy':(page==='home'?ROLE_SCENE[state.profile.role]:null);
      if(scene)hero.appendChild(box('rc27-hero-art',scene,{onBand:true,size:68}));
    }
    // empty states
    c.querySelectorAll('.empty:not([data-rc27])').forEach(e=>{e.dataset.rc27='1';const wrap=document.createElement('div');wrap.className='rc27-empty-art';wrap.appendChild(box('',emptyScene(e.textContent),{size:96}));e.prepend(wrap)});
    // counters
    c.querySelectorAll('.stat > b').forEach(countUp);
    // cascade on page entry
    if(performance.now()<cascadeUntil&&!reduced()){
      let i=0;c.querySelectorAll(':scope > .card, :scope > .stat, :scope > .grid > .stat, :scope > .grid > .card, :scope > .hero').forEach(e=>{if(e.dataset.rcIn)return;e.dataset.rcIn='1';e.style.animationDelay=Math.min(i++,8)*45+'ms';e.classList.add('rc27-rise')});
    }
    fitNames(c);
  }
  // ---- directional transitions
  const OVERLAY=new Set(['notifications','settings','quran']);
  let lastPage=null;
  function navKind(){return OVERLAY.has(state.page)?'overlay':'tab'}
  function tabOrder(){try{return mobileNavItems().map(x=>x[0])}catch(_e){return []}}
  function transition(c){
    if(reduced()){c.classList.remove('rc27-enter','rc27-t-start','rc27-t-end','rc27-t-up','rc27-t-detail');return}
    c.classList.remove('rc27-t-start','rc27-t-end','rc27-t-up','rc27-t-detail');void c.offsetWidth;
    if(lastPage!=null&&state.page!==lastPage){
      let cls;
      if(OVERLAY.has(state.page))cls='rc27-t-up';
      else{const o=tabOrder(),f=o.indexOf(lastPage),t=o.indexOf(state.page);cls=(f<0||t<0||t>=f)?'rc27-t-start':'rc27-t-end'}
      c.classList.add(cls);cascadeUntil=performance.now()+500;pageKey=state.page;
    }
    lastPage=state.page;
  }
  window.rc27DetailEnter=function(){const c=document.getElementById('content');if(!c||reduced())return;c.classList.remove('rc27-t-start','rc27-t-end','rc27-t-up','rc27-t-detail');void c.offsetWidth;c.classList.add('rc27-t-detail')};
  if(typeof render==='function'){
    const baseRender=render;
    render=async function(){
      const before=state.page,c=document.getElementById('content');
      if(c&&before!==lastPage)pageKey=before;
      const r=await baseRender.apply(this,arguments);
      try{const c2=document.getElementById('content');if(c2){transition(c2);decorate(c2)}}catch(e){console.warn('rc27 motion',e)}
      return r;
    };
  }
  if(typeof studentProfile==='function'){
    const baseProf=studentProfile;
    studentProfile=function(){const r=baseProf.apply(this,arguments);try{rc27DetailEnter();decorate(document.getElementById('content'))}catch(_e){}return r};
  }
  // decorate content changes made outside render() (async fills) — empty states, counters
  const mo=new MutationObserver(()=>{if(mo._t)return;mo._t=setTimeout(()=>{mo._t=0;try{decorate(document.getElementById('content'))}catch(_e){}},60)});
  window.addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('content');c&&mo.observe(c,{childList:true,subtree:true})});
  if(document.readyState!=='loading'){const c=document.getElementById('content');c&&mo.observe(c,{childList:true,subtree:true})}

  // ---- chrome: bell ring, sync spin, title swap, drawer role art, sync dialog scene
  let lastUnread=0;
  function chromeTick(){
    try{
      const n=Number(state.notificationUnread||0),bell=document.getElementById('notificationBell');
      if(bell&&n>lastUnread&&!reduced()){bell.classList.remove('rc27-ring');void bell.offsetWidth;bell.classList.add('rc27-ring')}
      lastUnread=n;
      const pend=typeof readOfflineQueue==='function'?readOfflineQueue().length:0,sb=document.getElementById('syncBadge');
      if(sb)sb.classList.toggle('rc27-spin',pend>0&&state.networkVerified&&!state.offline&&!reduced());
      const art=document.getElementById('rc27DrawerArt');
      if(art){const scene=ROLE_SCENE[state.profile?.role];if(scene&&art.dataset.scene!==scene){art.dataset.scene=scene;art.innerHTML='';play(art,scene,{onBand:true})}}
    }catch(_e){}
  }
  setInterval(chromeTick,1500);
  const title=document.getElementById('pageTitle');
  if(title)new MutationObserver(()=>{if(reduced())return;title.classList.remove('rc27-swap');void title.offsetWidth;title.classList.add('rc27-swap')}).observe(title,{childList:true,characterData:true,subtree:true});
  if(typeof openSyncStatusDialog==='function'){
    const baseSync=openSyncStatusDialog;
    openSyncStatusDialog=function(){
      const r=baseSync.apply(this,arguments);
      try{
        const d=document.getElementById('syncStatusDlg'),sum=document.getElementById('syncStatusSummary');
        if(d&&sum){d.querySelector('.rc27-sync-art')?.remove();const off=state.offline||!state.networkVerified,pend=readOfflineQueue().length;
          if(off||pend){const w=document.createElement('div');w.className='rc27-sync-art';w.appendChild(box('',off?'offline':'sync',{size:92}));sum.before(w)}}
      }catch(_e){}
      return r;
    };
  }

  // ---- auth screen: slow pattern behind the card, account art on sign-up and on the pending-approval panel
  function authInit(){
    const amb=document.getElementById('rc27AuthAmbient');if(amb&&!amb.dataset.on){amb.dataset.on='1';play(amb,'ambient',{})}
    const sel=document.getElementById('signupRole'),art=document.getElementById('rc27SignupArt');
    if(sel&&art&&!sel.dataset.rc){sel.dataset.rc='1';const upd=()=>{art.innerHTML='';play(art,{guardian:'role_guardian',teacher:'role_teacher',supervisor:'role_supervisor'}[sel.value]||'role_teacher',{})};sel.addEventListener('change',upd);upd()}
    const pr=document.getElementById('pendingRole'),pa=document.getElementById('rc27PendingArt');
    if(pr&&pa&&!pr.dataset.rc){pr.dataset.rc='1';const upd=()=>{const x=pr.textContent||'';const sc=/ولي/.test(x)?'role_guardian':/مشرف/.test(x)?'role_supervisor':/مدير|مسؤول/.test(x)?'role_admin':/طالب/.test(x)?'role_student':'role_teacher';if(pa.dataset.scene!==sc){pa.dataset.scene=sc;pa.innerHTML='';play(pa,sc,{})}};new MutationObserver(upd).observe(pr,{childList:true,characterData:true,subtree:true});upd()}
  }
  document.addEventListener('DOMContentLoaded',authInit);if(document.readyState!=='loading')authInit();
  function pageAmbient(){if(document.getElementById('rc27PageAmbient'))return;const d=document.createElement('div');d.id='rc27PageAmbient';d.setAttribute('aria-hidden','true');document.body.appendChild(d);play(d,'ambient',{})}
  document.addEventListener('DOMContentLoaded',pageAmbient);if(document.readyState!=='loading')pageAmbient();
  window.addEventListener('load',runSplash);
  if(document.readyState==='complete')runSplash();
  document.addEventListener('DOMContentLoaded',runSplash);
})();
