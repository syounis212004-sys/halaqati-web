/* Halaqati web 2.89.11 — one motion system (parity with the native app's shared-axis navigation).
   - one transition per page change (View Transitions API when available, the older slide as fallback)
   - re-rendering the SAME page never replays an entrance animation and keeps the scroll position
   - respects the OS "reduce motion" setting and the in-app "الحركة: مخففة" switch */
(function(){
  if(window.__rc54Motion)return;window.__rc54Motion=true;
  const root=document.documentElement;
  const reduced=()=>{
    try{
      if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return true;
      return !!JSON.parse(localStorage.getItem('halaqati_display_v1')||'{}').reduceMotion;
    }catch(_e){return false}
  };
  const canVT=typeof document.startViewTransition==='function';
  const OVERLAY=new Set(['notifications','settings','quran']);
  let prevPage=null;

  function direction(from,to){
    if(OVERLAY.has(to))return 'up';
    try{
      const o=mobileNavItems().map(x=>x[0]),f=o.indexOf(from),t=o.indexOf(to);
      return (f<0||t<0||t>=f)?'start':'end';
    }catch(_e){return 'start'}
  }

  // resolves as soon as #content receives its new markup, or after `cap` ms (never freeze the screen on slow pages)
  function contentChanged(cap){
    return new Promise(res=>{
      const c=document.getElementById('content');if(!c)return res();
      const mo=new MutationObserver(()=>{mo.disconnect();res()});
      mo.observe(c,{childList:true});
      setTimeout(()=>{mo.disconnect();res()},cap);
    });
  }

  if(typeof render!=='function')return;
  const baseRender=render;
  render=async function(){
    const args=arguments,page=state.page,same=prevPage===page,y=window.scrollY;
    let result;
    if(!same&&prevPage!=null&&canVT&&!reduced()&&!document.hidden&&document.getElementById('content')){
      root.dataset.vt=direction(prevPage,page);root.classList.add('vt-active');
      let err=null,work=null;
      const run=()=>{work=baseRender.apply(null,args).then(r=>{result=r},e=>{err=e});return work};
      try{
        // the render must start INSIDE the callback so the browser has already captured the old page
        const t=document.startViewTransition(()=>{const w=run();return Promise.race([contentChanged(320),w])});
        t.finished.catch(()=>{}).finally(()=>{root.classList.remove('vt-active');delete root.dataset.vt});
        await t.updateCallbackDone.catch(()=>{});
      }catch(_e){/* browser refused the transition */}
      if(!work)run();
      // a slow page keeps rendering after the transition started: callers must still see a finished render
      await work;
      if(err){root.classList.remove('vt-active');delete root.dataset.vt;throw err}
    }else{
      result=await baseRender.apply(this,args);
    }
    prevPage=page;
    if(same){
      // same page re-rendered (data refresh, chip toggle…): keep the reader where they were
      const y2=window.scrollY;if(Math.abs(y2-y)>2)window.scrollTo(0,y);
    }
    return result;
  };
})();
