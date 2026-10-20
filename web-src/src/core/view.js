/* Runs before rendering, including OAuth callbacks. Switch views without navigation. */
(function () {
  'use strict';
  const key='halaqati_view_v1',root=document.documentElement;
  const valid=v=>['auto','mobile','desktop'].includes(v);
  try{const q=new URLSearchParams(location.search).get('view');if(valid(q))localStorage.setItem(key,q)}catch(_e){}
  function apply(){
    let pref='auto';try{const saved=localStorage.getItem(key);if(valid(saved))pref=saved}catch(_e){}
    root.setAttribute('data-view-pref',pref);
    const w=window.innerWidth,ua=navigator.userAgent||'',mobileUa=/Mobi|iPhone|iPod|Android.*Mobile/i.test(ua);
    // "Desktop site" on a phone/tablet reports a ~980px viewport and a desktop UA: that must get the desktop workspace too.
    root.setAttribute('data-view',pref==='auto'?((w>=1024||(w>=800&&!mobileUa))?'desktop':'mobile'):pref);
    const meta=document.querySelector('meta[name=viewport]');
    if(meta){const want=(pref==='desktop'&&mobileUa&&Math.min(screen.width,screen.height)<900)?'width=1200':'width=device-width,initial-scale=1';if(meta.getAttribute('content')!==want)meta.setAttribute('content',want)}
    root.setAttribute('data-wide','0');
    window.dispatchEvent?.(new Event('halaqati:viewchange'));
  }
  window.rc27ApplyView=apply;
  window.rc27SetView=function(pref){if(!valid(pref))return;try{localStorage.setItem(key,pref)}catch(_e){}apply();if(typeof render==='function')render()};
  window.addEventListener('resize',apply);apply();
})();
