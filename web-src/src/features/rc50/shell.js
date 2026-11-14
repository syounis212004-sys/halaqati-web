/* Halaqati web 2.86.0 — native RC40–RC42 shell: smart "+" bottom bar (Home · Sessions · + · Announcements · More),
   quick-add sheet, and a shortcuts grid on the staff home. */
(function(){
  'use strict';
  const R=window.RC50,e=R.e;
  const STAFF=['admin','supervisor','teacher'];
  const isStaff=()=>STAFF.includes(state?.profile?.role);
  const origMobile=window.mobileNavItems;
  window.mobileNavItems=function(){
    if(isStaff())return [['home','الرئيسية'],['sessions','الجلسات'],['add','جلسة جديدة'],['community','الإعلانات'],['more','المزيد']];
    return origMobile.apply(this,arguments);
  };
  const origBuild=window.buildMobileNav;
  window.buildMobileNav=function(){
    if(!isStaff())return origBuild.apply(this,arguments);
    const n=document.getElementById('mobileNav');if(!n)return;
    const items=window.mobileNavItems(),core=new Set(items.filter(x=>x[0]!=='more'&&x[0]!=='add').map(x=>x[0])),moreActive=!core.has(state.page);
    n.innerHTML=items.map(([p,l])=>{
      if(p==='add')return `<button type="button" class="dn-plus" aria-label="${e(l)}" onclick="RC50.quickAdd()"><span>+</span></button>`;
      const active=p==='more'?moreActive:state.page===p,action=p==='more'?'toggleDrawer(true)':`go('${p}')`;
      return `<button type="button" class="${active?'active':''}" aria-label="${e(l)}" ${active?'aria-current="page"':''} onclick="${action}"><span class="mobile-nav-icon">${navSvg(p)}</span><span>${e(l)}</span></button>`;
    }).join('');
  };
  R.quickAdd=()=>{
    const role=state?.profile?.role,rows=[
      ['جلسة جديدة','تسجيل جلسة وفتحها','openSession()'],['جلسة اليوم','فتح أو بدء جلسة اليوم','startTodaySession()'],
      ['طالب جديد','إضافة طالب','openStudent()'],['إعلان جديد','نشر إعلان للحلقة','openAnnouncement()'],['تحفيظ سريع','تسجيل تسميعة بسرعة','openQuickMemorization()']
    ].filter(([t,,f])=>{const fn=f.replace('()','');return typeof window[fn]==='function'&&!((t==='طالب جديد')&&role==='teacher'&&typeof canManageStudents==='function'&&!canManageStudents())});
    R.sheet('dnQuick','إضافة سريعة',`<div class="dn-quick">${rows.map(([t,s,f])=>`<button type="button" class="dn-quick-i" onclick="RC50.closeSheet('dnQuick');setTimeout(()=>{${f}},120)"><b>${e(t)}</b><small>${e(s)}</small></button>`).join('')}</div>`);
  };
  // ---------- staff home: shortcuts grid ----------
  const TILES=[['students','الطلاب','#1B7F6B'],['plans','الخطط','#B8861B'],['sessions','الجلسات','#2F6FB3'],['reports','التقارير','#C2554B'],['ranking','الترتيب','#B8861B'],['quran','المصحف','#6B5BB3']];
  const grid=()=>{
    const tiles=TILES.slice();if(state.profile?.role==='admin'){tiles.push(['awards','التكريم','#B8861B'],['support','الدعم','#C2554B'])}
    return `<section class="dn-short"><h3>اختصارات</h3><div class="dn-short-g">${tiles.map(([p,l,c])=>`<button type="button" onclick="go('${p}')" style="--c:${c}"><span class="dn-short-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${(navSvg(p).match(/<svg[^>]*>([\s\S]*)<\/svg>/)||[])[1]||''}</svg></span><b>${e(l)}</b></button>`).join('')}</div></section>`;
  };
  const baseHome=window.homePage;
  if(typeof baseHome==='function')window.homePage=function(){
    const r=baseHome.apply(this,arguments);
    if(!isStaff()||typeof r!=='string'||['admin','teacher'].includes(state?.profile?.role))return r;/* RC86: staff home has the app's own «الوصول السريع» */
    const i=r.indexOf('</section>');
    return i>=0&&i<1800?r.slice(0,i+10)+grid()+r.slice(i+10):grid()+r;
  };
})();
