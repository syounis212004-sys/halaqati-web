/* Halaqati web RC114 — «المساهمة» page, mirrors Android ContributeScreen.kt.
   Guardian: «تكفّل بحلقة» (the donor support UI; the SERVER decides which halaqat via rc49_support_cards), «المسابقات» (read-only), «التذكير».
   Teacher / supervisor / admin: «المسابقات» (status summary + open) and «التذكير».
   Shown only to those four roles; the donor and the student never get it. No permission changes: every call is an existing RPC. */
(function(){
  'use strict';
  const R=window.RC50;
  if(!R||!R.contests||!R.reminder||window.__rc114Contribute)return;window.__rc114Contribute=true;
  const e=R.e,role=()=>state?.profile?.role;
  const ROLES=['guardian','teacher','supervisor','admin'];
  const P=R.contribute={tab:null};
  const tabsFor=r=>r==='guardian'?[['sponsor','تكفّل بحلقة'],['contests','المسابقات'],['reminder','التذكير']]:[['contests','المسابقات'],['reminder','التذكير']];
  const current=r=>{const t=tabsFor(r);return t.some(x=>x[0]===P.tab)?P.tab:t[0][0]};
  P.setTab=t=>{P.tab=t;render()};

  const staffTab=async r=>{
    const line=await R.contests.summary(r);
    return `<section class="dn-card"><h3>أنشئ مسابقة لحلقتك</h3>
      <p class="dn-muted">${r==='admin'?'تُعتمد مسابقتك فورًا وتظهر لمحفّظي الحلقة ومشرفيها وأولياء أمور طلابها وطلابها.':'تصل مسابقتك إلى مدير النظام للاعتماد، ثم تظهر لمحفّظي الحلقة ومشرفيها وأولياء أمور طلابها وطلابها.'}</p>
      ${line?`<div class="rc114-notice info" role="status">${e(line)}</div>`:''}
      <div class="dn-actions">${R.btn('فتح المسابقات وإنشاء مسابقة',"go('contests')")}</div></section>`;
  };
  const sponsorTab=async()=>{
    if(typeof R.pledgesHtml!=='function')return R.card(R.empty('الكفالة غير متاحة الآن'));
    const html=await R.pledgesHtml({noSeg:true});
    const bar=`<div class="ch-donorbar">${R.chat&&R.chat.donorOpen?R.btn('محادثة مع المدير','RC50.chat.donorOpen()','tonal'):''}</div>`;
    return html.includes('<!--dn-chat-->')?html.replace('<!--dn-chat-->',()=>bar):bar+html;
  };

  R.page('contribute',{title:'المساهمة',roles:ROLES,render:async()=>{
    const r=role(),tab=current(r),first=String(state?.profile?.full_name||'').trim().split(/\s+/)[0]||'';
    let body;
    try{
      body=tab==='reminder'?R.reminder.panelHtml():tab==='sponsor'?await sponsorTab():r==='guardian'?await R.contests.visibleHtml():await staffTab(r);
    }catch(err){body=R.card(R.empty(err&&err.message||'تعذر التحميل'))+R.btn('إعادة المحاولة','render()')}
    if(tab==='reminder')R.reminder.seen();
    return `<div class="dn-hello">أهلًا بك${first?'، '+e(first):''}</div>${R.seg(tabsFor(r),tab,'RC50.contribute.setTab')}${body}`;
  }});

  // ---------- navigation: only for the four roles ----------
  const HEART='<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>';
  const navBase=window.navItems;
  window.navItems=function(){
    const items=navBase.apply(this,arguments);
    if(ROLES.includes(role())&&!items.some(x=>x[0]==='contribute')){const i=items.findIndex(x=>x[0]==='settings');items.splice(i<0?items.length:i,0,['contribute','المساهمة'])}
    return items;
  };
  const svgBase=window.navSvg;
  window.navSvg=function(p){return p==='contribute'?`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${HEART}</svg>`:svgBase(p)};
  window.iconFor=window.navSvg;
})();
