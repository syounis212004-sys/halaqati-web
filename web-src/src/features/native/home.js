/* RC27.40 native screens: home — dashboard / guardian home / scope bar are rendered by rc27/dashboard.js and rc27/insights.js with NX;
   this file adds the shell touches the Compose screens have (top-bar title of the guardian home, HalaqaScopeBar face). */
(function(){
  'use strict';
  const isDk=()=>document.documentElement.getAttribute('data-view')==='desktop';
  const mi_=(n,s)=>typeof mi==='function'?mi(n,s):'';

  // ---- HalaqaScopeBar: secondaryContainer pill "الحلقة · name · تغيير ▾" laid over the native <select> ----
  function decorateScope(){
    if(isDk())return;
    const bar=document.querySelector('#content .rc27-scope');if(!bar||bar.dataset.nh==='1')return;
    const sel=bar.querySelector('select');if(!sel)return;
    bar.dataset.nh='1';bar.classList.add('nh-scope');
    const label=()=>sel.options[sel.selectedIndex]?.textContent||'';
    const face=document.createElement('div');face.className='nh-scope-face';face.setAttribute('aria-hidden','true');
    face.innerHTML=`${mi_('Groups',20)}<span class="nh-scope-l">الحلقة</span><b class="nh-scope-n"></b><span class="nh-scope-c">تغيير</span>${mi_('ArrowDropDown',24)}`;
    face.querySelector('.nh-scope-n').textContent=label();
    sel.addEventListener('change',()=>{face.querySelector('.nh-scope-n').textContent=label()});
    bar.insertBefore(face,bar.firstChild);
  }

  // ---- guardian home top bar (AppTopBar title / kicker) ----
  function guardianBar(){
    if(state.page!=='home'||state.profile?.role!=='guardian')return;
    const t=document.getElementById('pageTitle'),k=document.getElementById('roleLabel');
    if(t)t.textContent='اطمئن على رحلته';if(k)k.textContent='ولي الأمر · متابعة الأبناء';
  }

  if(typeof render==='function'){
    const baseRender=render;
    render=async function(){
      const r=await baseRender.apply(this,arguments);
      try{decorateScope();guardianBar()}catch(e){console.warn('native home',e)}
      return r;
    };
  }
  window.addEventListener('halaqati:viewchange',()=>{try{decorateScope()}catch(_e){}});
})();
