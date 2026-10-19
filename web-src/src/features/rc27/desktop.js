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
  function restructureHome(c){
    if(state.page!=='home'||!c||c.querySelector('.dk-home'))return;
    const role=state.profile?.role;
    if(role==='guardian'){return}
    const hero=c.querySelector('.rc27-home-hero')||c.querySelector('.hero');if(!hero)return;
    const kids=[...c.children].filter(n=>!n.classList.contains('rc27-scope'));
    const wrap=document.createElement('div');wrap.className='dk-home';
    const main=document.createElement('div');main.className='dk-main';
    const side=document.createElement('aside');side.className='dk-aside';
    const actions=document.createElement('div');actions.className='dk-hero-actions';
    kids.forEach(n=>{
      if(n.classList.contains('rc27-ins'))side.appendChild(n);
      else if(n.matches('button.rc27-wide'))actions.appendChild(n);
      else main.appendChild(n);
    });
    if(actions.children.length)hero.appendChild(actions);
    wrap.append(main,side);
    if(!side.children.length)wrap.classList.add('dk-solo');
    c.appendChild(wrap);
  }

  // ---------- students table ----------
  const SORT={key:'name',dir:1};
  window.rc27DkSort=function(k){SORT.dir=SORT.key===k?-SORT.dir:1;SORT.key=k;render()};
  function studentsTable(){
    const rows=filteredStudents().slice(),mm=id=>state.monthly.find(x=>x.student_id===id)||{},hq=id=>state.halaqas.find(x=>x.id===id)?.name||'—';
    const val={name:s=>s.full_name,halaqa:s=>hq(s.halaqa_id),hifz:s=>Number(mm(s.id).hifz_pages||0),review:s=>Number(mm(s.id).review_pages||0),sard:s=>Number(mm(s.id).sard_pages||0),absent:s=>Number(mm(s.id).absent_days||0)}[SORT.key];
    if(SORT.key!=='name'||SORT.dir<0)rows.sort((a,b)=>{const x=val(a),y=val(b);return (typeof x==='number'?x-y:String(x).localeCompare(String(y),'ar'))*SORT.dir});
    const th=(k,l)=>`<th class="sortable ${SORT.key===k?'on':''}" onclick="rc27DkSort('${k}')">${l}${SORT.key===k?(SORT.dir>0?' ▲':' ▼'):''}</th>`;
    const manage=canManageStudents(),sel=state.selectionMode&&manage;
    const body=rows.map(st=>{
      const m=mm(st.id),g=state.goals.find(x=>x.student_id===st.id),pct=g&&g.target_hifz_pages?Math.min(100,Math.round(Number(m.hifz_pages||0)/Number(g.target_hifz_pages)*100)):null,removed=st.status==='withdrawn',selected=state.selectedStudents.has(st.id);
      const ic=(t,fn,cls='')=>`<button class="dk-ic ${cls}" title="${t}" aria-label="${t}" onclick="event.stopPropagation();${fn}">${t}</button>`;
      return `<tr class="${selected?'selected':''} ${removed?'removed-card':''}" data-stcard="${st.id}" onclick="studentProfile('${st.id}')">
        ${sel?`<td onclick="event.stopPropagation()"><input class="select-box" type="checkbox" ${selected?'checked':''} onchange="toggleStudentSelection('${st.id}',this.checked)"></td>`:''}
        <td><div class="row">${avatarHtml(st)}<div class="grow"><b>${h(st.full_name)}</b>${isDuplicateStudent(st)?' <span class="badge dup-badge">مكرر</span>':''}<div class="muted">${h(st.guardian_phone||'')}</div></div></div></td>
        <td>${h(hq(st.halaqa_id))}</td><td>${h(categoryName(st))}</td><td>${h(studentTrackAr[st.track_code]||'بدون مسار')}</td>
        <td class="num">${fmt(m.hifz_pages)}</td><td class="num">${fmt(m.review_pages)}</td><td class="num">${fmt(m.sard_pages)}</td><td class="num">${m.absent_days||0}</td>
        <td>${pct==null?'<span class="muted">—</span>':`<div class="dk-pct"><div class="progress"><i style="width:${pct}%"></i></div><b>${pct}%</b></div>`}</td>
        <td><span class="badge">${removed?'مزال':st.status==='active'?'نشط':h(st.status)}</span></td>
        <td class="dk-actions" onclick="event.stopPropagation()">
          ${!removed&&roleCanManage()?`<button class="mini" onclick="openDailyForStudent('${st.id}')">تسميع</button>`:''}
          ${!removed&&roleCanManage()?`<button class="mini" onclick="openPlan('${st.id}')">الخطة</button>`:''}
          ${manage?`<button class="mini" onclick="openStudent('${st.id}')">تعديل</button>`:''}
          ${manage&&!removed?`<button class="mini red" onclick="removeStudent('${st.id}')">إزالة</button>`:''}
          ${manage&&removed?`<button class="mini" onclick="restoreStudent('${st.id}')">استعادة</button>`:''}
          ${isOwner()&&removed?`<button class="mini red" onclick="permanentlyDeleteStudent('${st.id}')">حذف نهائي</button>`:''}
        </td></tr>`;
    }).join('');
    return `<div class="dk-table-wrap"><table class="dk-table"><thead><tr>${sel?'<th></th>':''}${th('name','الطالب')}${th('halaqa','الحلقة')}<th>الفئة</th><th>المسار</th>${th('hifz','حفظ الشهر')}${th('review','مراجعة')}${th('sard','سرد')}${th('absent','غياب')}<th>الخطة</th><th>الحالة</th><th></th></tr></thead><tbody>${body||'<tr><td colspan="12" class="empty">لا يوجد طلاب في هذا العرض.</td></tr>'}</tbody></table></div>`;
  }
  if(typeof studentsPage==='function'){
    const baseStudents=studentsPage;
    studentsPage=function(){
      if(!isDk())return baseStudents.apply(this,arguments);
      let html=baseStudents.apply(this,arguments);
      const idx=['<div class="rc27-hgroup"','<div class="card student-card','<div class="empty">لا يوجد طلاب'].map(k=>html.indexOf(k)).filter(k=>k>=0),cut=idx.length?Math.min(...idx):-1;
      const head=cut>=0?html.slice(0,cut):html,tail=state.selectionMode&&canManageStudents()&&typeof bulkStudentBar==='function'?bulkStudentBar():'';
      return `<div class="dk-students">${head}${studentsTable()}${tail}</div>`;
    };
  }

  // ---------- sessions: list + roster workspace ----------
  if(typeof sessionsPage==='function'){
    const baseSessions=sessionsPage;
    sessionsPage=function(){
      if(!isDk())return baseSessions.apply(this,arguments);
      const keep=state.sessionView;state.sessionView=null;
      let list='';try{list=baseSessions.apply(this,arguments)}finally{state.sessionView=keep}
      const detail=keep?sessionRosterPage(keep):`<div class="empty dk-empty-detail"><b>اختر جلسة من القائمة</b><div class="muted">تظهر هنا قائمة الطلاب والحضور والتسميع.</div></div>`;
      return `<div class="dk-split"><section class="dk-list" aria-label="الجلسات">${list}</section><section class="dk-detail" aria-label="تفاصيل الجلسة">${detail}</section></div>`;
    };
  }
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
