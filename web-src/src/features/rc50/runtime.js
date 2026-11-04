/* Halaqati web 2.86.0 — parity layer with the native app (RC28–RC50).
   Page registry + render wrapper + navigation for the new roles/pages. Loaded last; wraps the classic globals. */
(function(){
  'use strict';
  const RC50=window.RC50={pages:{},cache:{}};
  const e=v=>typeof window.esc==='function'?window.esc(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  RC50.e=e;
  RC50.rpc=async(name,args)=>{
    if(typeof db==='undefined')throw new Error('لا يوجد اتصال بالخادم');
    const {data,error}=await db.rpc(name,args||{});
    if(error)throw new Error(error.message||'تعذر التنفيذ');
    return data;
  };
  const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  RC50.monthLabel=m=>{const p=String(m||'').slice(0,7).split('-');const i=parseInt(p[1],10);return i>=1&&i<=12?`${MONTHS[i-1]} ${p[0]}`:String(m||'')};
  RC50.num=v=>{const n=Number(v);if(!isFinite(n))return '0';return Math.abs(n-Math.round(n))<1e-9?String(Math.round(n)):n.toFixed(1)};
  RC50.score=v=>`<bdi dir="ltr">${RC50.num(v)} / 100</bdi>`;
  RC50.pct=(v,cap)=>{let n=Number(v);if(!isFinite(n))n=0;if(cap!==false)n=Math.min(100,n);return RC50.num(n)+'%'};
  RC50.medal=r=>({1:'🥇',2:'🥈',3:'🥉'}[r]||String(r));
  RC50.cur={ILS:'₪',USD:'$',JOD:'د.أ'};
  RC50.amount=(a,c)=>{if(a==null||a==='')return '';const n=Number(a);if(!isFinite(n))return '';return `${RC50.num(n)} ${RC50.cur[c||'ILS']||'₪'}`};
  RC50.isRole=r=>state?.profile?.role===r;
  RC50.busy=(el,on)=>{if(el){el.disabled=!!on;el.classList.toggle('dn-busy',!!on)}};
  RC50.toast=m=>{try{toast(m)}catch(_e){console.log(m)}};
  RC50.compressImage=file=>new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onerror=()=>rej(new Error('تعذر قراءة الصورة'));
    fr.onload=()=>{const img=new Image();img.onerror=()=>rej(new Error('صورة غير صالحة'));img.onload=()=>{
      const max=1024,k=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
      const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.7))};img.src=fr.result};
    fr.readAsDataURL(file);
  });
  /** Segmented control (iOS style). items=[[value,label]] */
  RC50.seg=(items,cur,fn)=>`<div class="dn-seg" role="tablist">${items.map(([v,l])=>`<button type="button" role="tab" aria-selected="${v===cur}" class="${v===cur?'on':''}" onclick="${fn}('${v}')">${e(l)}</button>`).join('')}</div>`;
  RC50.pills=(items,cur,fn)=>`<div class="dn-pills">${items.map(([v,l])=>`<button type="button" class="${v===cur?'on':''}" onclick="${fn}('${v}')">${e(l)}</button>`).join('')}</div>`;
  RC50.card=(inner,cls)=>`<section class="dn-card ${cls||''}">${inner}</section>`;
  RC50.hero=(title,lines)=>`<section class="dn-hero"><div class="dn-hero-pat"></div><div class="dn-hero-in">${title}${(lines||[]).map(l=>`<p>${l}</p>`).join('')}</div></section>`;
  RC50.tile=(label,value)=>`<div class="dn-tile"><b>${e(value)}</b><span>${e(label)}</span></div>`;
  RC50.bar=(label,value,cap)=>{const n=Math.max(0,Number(value)||0);return `<div class="dn-bar"><div class="dn-bar-l"><span>${e(label)}</span><b>${RC50.pct(n,cap)}${cap===false&&n>100?' · تجاوز الخطة':''}</b></div><div class="dn-bar-t"><i style="width:${Math.min(100,n)}%"></i></div></div>`};
  RC50.skeleton=()=>`<div class="dn-skel"><i></i><i></i><i></i></div>`;
  RC50.empty=t=>`<div class="dn-empty">${e(t)}</div>`;
  RC50.sheet=(id,title,body,footer)=>{if(window.NX&&NX.dialog)return NX.dialog(id,e(title),body,{footer:footer||''});
    let d=document.getElementById(id);if(!d){d=document.createElement('dialog');d.id=id;d.className='rc27-dlg';document.body.appendChild(d)}d.innerHTML=`<h3>${e(title)}</h3>${body}<div class="dn-foot">${footer||''}</div>`;if(!d.open)d.showModal();return d};
  RC50.closeSheet=id=>document.getElementById(id)?.close();
  RC50.btn=(label,fn,kind)=>`<button type="button" class="dn-btn ${kind||''}" onclick="${fn}">${e(label)}</button>`;

  // ---------- roles ----------
  try{if(typeof roleAr==='object'){roleAr.observer='المانح'}}catch(_e){}

  // ---------- page registry ----------
  /** RC50.page(id,{title,roles,render:async()=>html,after?}) */
  RC50.page=(id,def)=>{RC50.pages[id]=def};
  const origRender=window.render;
  window.render=async function(){
    const id=state?.page,role=state?.profile?.role,pg=RC50.pages[id];
    if(role==='observer'&&!pg&&!['notifications','settings','sync'].includes(id)){state.page='home'}
    const cur=RC50.pages[state.page];
    if(cur&&(!cur.roles||cur.roles.includes(role))){
      try{buildNav();setFab()}catch(_e){}
      const t=document.getElementById('pageTitle');if(t)t.textContent=cur.title;
      const box=document.getElementById('content');if(!box)return;
      const token=RC50._tok=(RC50._tok||0)+1;
      box.innerHTML=RC50.skeleton();
      try{const html=await cur.render();if(token!==RC50._tok)return;box.innerHTML=html;cur.after&&cur.after(box)}
      catch(err){console.error(err);if(token===RC50._tok)box.innerHTML=`<div class="dn-card"><div class="dn-empty">${e(err.message||'تعذر التحميل')}</div>${RC50.btn('إعادة المحاولة','render()')}</div>`}
      try{document.getElementById('content')?.scrollTo?.(0,0)}catch(_e){}
      return;
    }
    return origRender.apply(this,arguments);
  };

  // ---------- navigation ----------
  const ICONS={
    donor_awards:'<path d="M8 21h8M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0Z"/><path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4"/>',
    awards:'<path d="M8 21h8M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0Z"/><path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4"/>',
    donor_support:'<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>',
    support:'<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>',
    donor_impact:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    donor_stats:'<path d="M5 20v-9M12 20V4M19 20v-6"/>'
  };
  const origSvg=window.navSvg;
  window.navSvg=function(p){if(ICONS[p])return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[p]}</svg>`;return origSvg(p)};
  window.iconFor=window.navSvg;
  const origNav=window.navItems;
  window.navItems=function(){
    const role=state?.profile?.role;
    if(role==='observer'){
      const unread=state.notificationUnread?` (${state.notificationUnread})`:'';
      return [['home','الرئيسية'],['donor_awards','المكرَّمون'],['donor_support','الدعم'],['donor_impact','أثري'],['donor_stats','الإحصاءات'],['notifications','الإشعارات'+unread],['settings','الإعدادات']];
    }
    const items=origNav.apply(this,arguments);
    if(role==='admin'){
      const out=items.filter(x=>x[0]!=='awards'&&x[0]!=='support'),i=out.findIndex(x=>x[0]==='settings');
      const extra=[['awards','التكريم الشهري'],['support','الدعم والمانحون']];
      if(i<0)out.push(...extra);else out.splice(i,0,...extra);
      return out;
    }
    return items;
  };
  const origMobile=window.mobileNavItems;
  window.mobileNavItems=function(){
    if(state?.profile?.role==='observer')return [['home','الرئيسية'],['donor_awards','المكرَّمون'],['donor_support','الدعم'],['donor_impact','أثري'],['more','المزيد']];
    return origMobile.apply(this,arguments);
  };
  // The donor reads everything through dedicated RPCs: skip the staff table queries that RLS would reject.
  const origLoadAll=window.loadAll;
  window.loadAll=async function(){
    if(state?.profile?.role==='observer'){
      state.networkVerified=true;state.offline=false;
      ['halaqas','students','sessions','announcements','goals','monthly','leaderDaily','leaderMonthly','forum','comments','categories','teachers','profiles'].forEach(k=>{if(!Array.isArray(state[k]))state[k]=[]});
      return;
    }
    return origLoadAll.apply(this,arguments);
  };
})();
