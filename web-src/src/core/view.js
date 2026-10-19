/* Runs before rendering, including OAuth callbacks. Switch views without navigation. */
(function () {
  'use strict';
  const key='halaqati_view_v1',root=document.documentElement;
  const valid=v=>['auto','mobile','desktop'].includes(v);
  try{const q=new URLSearchParams(location.search).get('view');if(valid(q))localStorage.setItem(key,q)}catch(_e){}
  function apply(){
    let pref='auto';try{const saved=localStorage.getItem(key);if(valid(saved))pref=saved}catch(_e){}
    root.setAttribute('data-view-pref',pref);
    root.setAttribute('data-view',pref==='auto'?(window.innerWidth>=1024?'desktop':'mobile'):pref);
    root.setAttribute('data-wide','0');
    window.dispatchEvent?.(new Event('halaqati:viewchange'));
  }
  window.rc27ApplyView=apply;
  window.rc27SetView=function(pref){if(!valid(pref))return;try{localStorage.setItem(key,pref)}catch(_e){}apply();if(typeof render==='function')render()};
  window.addEventListener('resize',apply);apply();
})();
