/* Halaqati RC27.40 native screens: sessions — web twin of SessionsScreen / GoldenSessionCard / NewSessionDialog /
   EditSessionDialog / DeletedSessionsDialog / QuickMemorizationScreen (CoreScreens.kt). See docs/NATIVE_PORT_BRIEF.md.
   Replaces sessionsPage(), sessionCards(), openSession()/editSessionData(), the deleted-sessions dialog and the quick
   memorization overlay renderer. Data behaviour stays in the legacy handlers (openSessionRoster, saveSessionOfflineFirst,
   setSessionArchived, HalaqatiSessionServer, opsQuickSave …). */
(function(){'use strict';
  if(typeof window.NX==='undefined'||typeof sessionsPage!=='function')return;
  const h=NX.h,ic=NX.icon;
  const q=id=>document.getElementById(id);
  const isDk=()=>document.documentElement.getAttribute('data-view')==='desktop';
  const manage=()=>typeof roleCanManage==='function'&&roleCanManage();
  const isAdmin=()=>state.profile?.role==='admin';
  const todayKey=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);
  const NS=window.NS_SESSIONS={archived:false,q:'',type:'all',months:{},msg:null,msgKind:'info',scroll:null,deleted:{rows:[],loading:false,msg:null,busy:null}};

  // ---------- rules (sessionTypeAr, SessionWorkflowRules, MonthKey/MonthGrouping) ----------
  const TYPE_AR={tasmee:'تسميع',sard:'سرد',review:'مراجعة',test:'اختبار',tajweed:'التلاوة والتجويد',tilawah:'التلاوة والتجويد',lesson:'نشاط تربوي',other:'أخرى'};
  const typeAr=t=>TYPE_AR[t]||t||'';
  window.sessionTypeAr=typeAr;
  const MANUAL_TYPES=['tasmee','sard','review','test','tilawah','lesson','other'];
  const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const monthKey=iso=>{const t=String(iso||'').trim();if(t.length<7||t[4]!=='-')return null;const y=+t.slice(0,4),m=+t.slice(5,7);return(m>=1&&m<=12&&y>=1900)?{y,m}:null};
  const mkNum=k=>k?k.y*12+k.m:0;
  const mkStr=k=>k?`${k.y}-${String(k.m).padStart(2,'0')}`:'undated';
  const mkLabel=k=>k?`${MONTHS[k.m-1]} ${k.y}`:'بدون تاريخ';
  function groupByMonth(rows){
    const b=new Map;rows.forEach(s=>{const k=mkStr(monthKey(s.session_date));(b.get(k)||b.set(k,[]).get(k)).push(s)});
    return [...b.entries()].map(([k,items])=>({key:k,mk:k==='undated'?null:{y:+k.slice(0,4),m:+k.slice(5)},items})).sort((a,b)=>(b.mk?mkNum(b.mk):-1)-(a.mk?mkNum(a.mk):-1));
  }
  function defaultOpen(groups){
    const t=monthKey(todayKey())||{y:2026,m:1},prev=t.m<=1?{y:t.y-1,m:12}:{y:t.y,m:t.m-1};
    const open=new Set(groups.filter(g=>g.mk&&(mkNum(g.mk)===mkNum(t)||mkNum(g.mk)===mkNum(prev))).map(g=>g.key));
    if(open.size)return open;
    const dated=groups.filter(g=>g.mk);return dated.length?new Set([dated[0].key]):new Set();
  }

  // ---------- data helpers ----------
  const isArch=s=>!!(s?.activity_data&&s.activity_data.archived);
  const scope=()=>{try{if(typeof rc27Scope==='function')return rc27Scope()}catch(_e){}return{selectedId:null,overview:false,switcher:false,mixed:false,kind:'regular',hs:state.halaqas||[]}};
  const allHalaqas=()=>(window.RC27&&RC27.master&&RC27.master.halaqas)||state.halaqas||[];
  const activeHalaqas=()=>allHalaqas().filter(x=>x.active!==false&&!x.archived_at);
  const hq=id=>allHalaqas().find(x=>x.id===id);
  const isProg=x=>!!x&&!!x.halaqa_type&&x.halaqa_type!=='regular';
  const masterStudents=()=>(window.RC27&&RC27.master&&RC27.master.students)||state.students||[];
  const masterSessions=()=>(window.RC27&&RC27.master&&RC27.master.sessions)||state.sessions||[];
  const statusAr=s=>isArch(s)?'مؤرشفة':s.status==='open'?'مفتوحة':s.status==='closed'?'مرفوعة':s.status==='cancelled'?'ملغاة':s.status||'';
  const cardTitle=s=>(s.title&&String(s.title).trim())||`جلسة اليوم — ${typeAr(s.session_type)}`;
  const sortRows=rows=>rows.slice().sort((a,b)=>String(b.session_date||'').localeCompare(String(a.session_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
  function visibleRows(){
    let rows=(state.sessions||[]).filter(s=>NS.archived?isArch(s):!isArch(s));
    if(isDk()){
      if(NS.type!=='all')rows=rows.filter(s=>NS.type==='tilawah'?['tilawah','tajweed'].includes(s.session_type):s.session_type===NS.type);
      const n=String(NS.q||'').trim().toLowerCase();
      if(n)rows=rows.filter(s=>[cardTitle(s),s.session_date,typeAr(s.session_type),s.notes,hq(s.halaqa_id)?.name,statusAr(s)].join(' ').toLowerCase().includes(n));
    }
    return sortRows(rows);
  }
  const unassignedCount=()=>masterStudents().filter(s=>s.status==='active'&&!s.halaqa_id).length;
  const sessionRef=id=>(state.sessions||[]).find(x=>String(x.id)===String(id));

  const dlg=(...a)=>{const d=NX.dialog(...a);setTimeout(()=>{try{const f=document.activeElement;if(f&&d.contains(f)&&f.tagName==='BUTTON')f.blur()}catch(_e){}},0);return d};

  // ---------- feedback ----------
  function say(text,kind){
    NS.msg=text||null;NS.msgKind=kind||(String(text||'').startsWith('تم')?'success':'error');
    const slot=q('nsMsg');if(slot)slot.innerHTML=NS.msg?NX.notice(h(NS.msg),NS.msgKind):'';
    if(text&&typeof toast==='function')toast(text);
  }
  const fail=(e,fallback)=>say((e&&e.message)||fallback,'error');
  const afterChange=async(force)=>{try{if(typeof clearDeletedSessionDerivedState==='function')clearDeletedSessionDerivedState()}catch(_e){}try{await loadAll(!!force)}catch(_e){}render()};

  // ---------- GoldenSessionCard ----------
  function cardHtml(s,o={}){
    const arch=isArch(s),canManage=manage(),sel=String(state.sessionView||'')===String(s.id)&&isDk();
    const act=(typeof sessionActivitySummaryHtml==='function'&&s.session_type==='lesson')?sessionActivitySummaryHtml(s):'';
    const sub=[s.session_date,typeAr(s.session_type),statusAr(s)];
    if(o.showHalaqa){const n=hq(s.halaqa_id)?.name;if(n)sub.push(n)}
    const items=[
      {label:'تعديل بيانات الجلسة',icon:'Edit',onclick:()=>openSession(s.id)},
      {label:'استعادة الجلسة',icon:'Restore',hidden:!arch,onclick:()=>nsArchive(s.id,false)},
      {label:'رفع الجلسة وإنهاؤها',icon:'CloudUpload',hidden:arch||s.status!=='open',onclick:()=>nsUpload(s.id)},
      {label:'نسخ للموعد القادم',icon:'ContentCopy',hidden:!(s.session_type==='lesson'&&['weekly','biweekly'].includes((s.activity_data||{}).recurrence)),onclick:()=>typeof duplicateActivitySession==='function'&&duplicateActivitySession(s.id)},
      {label:'أرشفة الجلسة',icon:'Archive',hidden:arch,onclick:()=>nsArchive(s.id,true)},
      {label:'إلغاء الجلسة',icon:'Cancel',hidden:arch||s.status==='cancelled',onclick:()=>nsCancel(s.id)},
      {label:'حذف الجلسة',icon:'Delete',danger:true,onclick:()=>nsAskDelete(s.id)},
    ];
    const navIc=(window.RC27_ICONS&&RC27_ICONS.sessions)||ic('EventNote',34);
    return `<div class="ns-card ${arch?'is-arch':''} ${s.status==='cancelled'?'is-cancel':''} ${sel?'sel':''}" role="button" tabindex="0" data-id="${h(s.id)}" onclick="nsOpen('${h(s.id)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();nsOpen('${h(s.id)}')}">
      <span class="ns-card-ic">${navIc}</span>
      <div class="ns-card-t"><b>${h(cardTitle(s))}</b><span class="ns-card-sub">${h(sub.filter(Boolean).join(' · '))}${s._offline?` ${NX.pill('محفوظ محلياً','warning')}`:''}</span>${act?`<span class="ns-card-act">${act}</span>`:''}${s.notes&&String(s.notes).trim()?`<span class="ns-card-notes">${h(s.notes)}</span>`:''}</div>
      ${arch?'':`<span class="ns-chev" aria-label="فتح الجلسة">${ic('ChevronLeft',28)}</span>`}
      ${canManage?NX.kebab(items,{title:'خيارات الجلسة',cls:'ns-kebab'}):''}
    </div>`;
  }
  window.nsOpen=function(id){
    const s=sessionRef(id);if(!s)return;
    if(isArch(s)){if(manage())openSession(id);return}
    if(isDk()){const m=document.querySelector('.ns-master-scroll');NS.scroll=m?m.scrollTop:null}
    openSessionRoster(id);
  };

  // legacy callers (sessionCards(rows)) now get native cards too
  window.sessionCards=function(rows){
    const list=rows||state.sessions||[];
    if(!list.length)return NX.empty('لا توجد جلسات في هذه الحلقة حتى الآن',{icon:'EventBusy'});
    return list.map(s=>cardHtml(s)).join('');
  };
  try{sessionCards=window.sessionCards}catch(_e){}

  // ---------- list body ----------
  function monthGroupsHtml(rows,showHalaqa){
    const groups=groupByMonth(rows),sid=scope().selectedId||'all',def=defaultOpen(groups);
    return groups.map(g=>{
      const k=sid+':'+NS.archived+':'+g.key,open=NS.months[k]!=null?NS.months[k]:def.has(g.key);
      return `<section class="ns-month-grp">
        <button type="button" class="ns-month ${open?'open':''}" aria-expanded="${open}" onclick="nsToggleMonth(this,'${h(k)}')"><b>${h(mkLabel(g.mk))}</b><span>${g.items.length} جلسة</span><i class="e-more">${ic('ExpandMore',22)}</i><i class="e-less">${ic('ExpandLess',22)}</i></button>
        <div class="ns-month-body" ${open?'':'hidden'}>${g.items.map(s=>cardHtml(s,{showHalaqa})).join('')}</div></section>`;
    }).join('');
  }
  window.nsToggleMonth=function(btn,key){
    const open=!btn.classList.contains('open');NS.months[key]=open;
    btn.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open));
    const body=btn.nextElementSibling;if(body)body.hidden=!open;
  };
  function overviewHtml(){
    const e=scope(),t=todayKey();
    const hs=activeHalaqas().filter(x=>!e.mixed||isProg(x)===(e.kind==='program'));
    const sessions=masterSessions().filter(s=>!isArch(s)),stus=masterStudents().filter(s=>s.status==='active'),mem=(window.RC27&&RC27.memberships)||[];
    if(!hs.length)return NX.empty('لا توجد جلسات في هذه الحلقة حتى الآن',{icon:'EventBusy'});
    return `<div class="ns-overview">${hs.map(x=>{
      const mine=sessions.filter(s=>s.halaqa_id===x.id),own=stus.filter(s=>s.halaqa_id===x.id).map(s=>s.id),extra=mem.filter(m=>m.halaqa_id===x.id&&m.status==='active').map(m=>m.student_id);
      const cnt=new Set([...own,...extra]).size,today1=mine.some(s=>String(s.session_date).startsWith(t)),last=mine.map(s=>s.session_date).filter(Boolean).sort().at(-1);
      return `<div class="ns-ov" role="button" tabindex="0" onclick="rc27SelectScope('${h(x.id)}')" onkeydown="if(event.key==='Enter')rc27SelectScope('${h(x.id)}')">
        <div class="ns-ov-head"><b>${h(x.name||'حلقة')}</b><span class="ns-ov-pill ${today1?'on':''}">${today1?'جلسة اليوم مفتوحة':'لا جلسة اليوم'}</span></div>
        <div class="ns-ov-stats"><span>${cnt} طالب</span><span>${mine.length} جلسة</span><span class="mut">${last?`آخر جلسة ${h(last)}`:'لا جلسات بعد'}</span></div></div>`}).join('')}</div>`;
  }
  function listHtml(){
    const e=scope();
    if(!state.sessions?.length&&state.syncing)return NX.skeleton(3);
    if(e.overview&&!NS.archived)return overviewHtml();
    const rows=visibleRows();
    if(!rows.length){
      const filtered=isDk()&&(NS.q||NS.type!=='all');
      return NX.empty(filtered?'لا توجد جلسات مطابقة':NS.archived?'لا توجد جلسات مؤرشفة':'لا توجد جلسات في هذه الحلقة حتى الآن',{icon:filtered?'SearchOff':'EventBusy'});
    }
    return `<div class="ns-groups">${monthGroupsHtml(rows,!e.selectedId)}</div>`;
  }

  // ---------- header / action row ----------
  function syncBanner(){
    const out=[];
    if(!state.networkVerified||state.offline)out.push(NX.notice('<b>وضع العمل دون إنترنت</b><br>الحلقات والفئات والطلاب والجلسات والحضور والسلوك والتسميع متاحة من النسخة المحلية.','warning'));
    if(state.pendingSync){let f=0;try{f=syncQueueStats().failed||0}catch(_e){}out.push(NX.notice(`<b>بيانات محلية بانتظار المزامنة</b><br>${state.pendingSync} عملية محفوظة بأمان في قاعدة الجهاز${f?` · ${f} تحتاج إعادة محاولة`:''}. ستتم المزامنة تلقائياً عند عودة الاتصال.`,'info'))}
    return out.length?`<div class="ns-banners">${out.join('')}</div>`:'';
  }
  function topBar(){
    return `<div class="ns-top"><div class="ns-top-t"><small>الجلسات اليومية · سجل اللقاءات اليومية</small><h2>الجلسات</h2></div>
      ${state.pendingSync?`<span class="ns-pend" title="عمليات بانتظار المزامنة">${ic('Sync',16)}${state.pendingSync}</span>`:''}
      ${NX.iconBtn('Refresh',{title:'تحديث',onclick:'nsRefresh()',cls:'ns-refresh'})}</div>`;
  }
  window.nsRefresh=async function(){
    const b=document.querySelector('.ns-refresh');if(b)b.classList.add('spin');
    try{await loadAll(true)}catch(_e){}render();
  };
  function actionRow(){
    if(!manage())return '';
    const n=unassignedCount();
    return `<div class="ns-actions">
      <button type="button" class="nx-btn nx-filled ns-start" onclick="nsStartToday()">${ic('PlayArrow',24)}<span>ابدأ جلسة اليوم</span></button>
      <button type="button" class="ns-tools-btn" onclick="nsTools()" title="أدوات الجلسات" aria-label="أدوات الجلسات">${ic('Tune',24)}${n>0?`<i class="nx-badge">${n}</i>`:''}</button></div>`;
  }
  function scopeChip(){
    const e=scope(),name=hq(e.selectedId)?.name||'كل الحلقات';
    return `<button type="button" class="ns-scopechip" onclick="nsTools()">${ic('Groups',18)}<span>${h(name)} · ${NS.archived?'الأرشيف':'الجلسات الحالية'}</span>${ic('ArrowDropDown',24)}</button>`;
  }
  function desktopFilters(){
    const chips=[['all','الكل'],...MANUAL_TYPES.map(t=>[t,typeAr(t)])];
    return `${NX.search(NS.q,'بحث في الجلسات',{id:'nsSearch',oninput:'nsSearch(this.value)',cls:'ns-search'})}
      <div class="ns-typechips">${NX.chips(chips.map(([k,l])=>({label:h(l),selected:NS.type===k,check:false,onclick:`nsType('${k}')`})))}</div>`;
  }
  window.nsSearch=function(v){NS.q=v;const l=q('nsList');if(l)l.innerHTML=listHtml();const c=q('nsCount');if(c)c.textContent=countText()};
  window.nsType=function(t){NS.type=t;render()};
  const countText=()=>{const n=visibleRows().length;return`${n} جلسة`};
  function deskStats(){
    const t=todayKey(),rows=(state.sessions||[]).filter(s=>!isArch(s)),ym=t.slice(0,7);
    return NX.metrics([
      NX.metric('جلسات اليوم',rows.filter(s=>String(s.session_date).startsWith(t)&&s.status!=='cancelled').length,{icon:'Today'}),
      NX.metric('مفتوحة',rows.filter(s=>s.status==='open').length,{icon:'PlayCircle'}),
      NX.metric('هذا الشهر',rows.filter(s=>String(s.session_date).startsWith(ym)&&s.status!=='cancelled').length,{icon:'CalendarMonth'}),
    ],3);
  }
  function emptyDetail(){
    return `<div class="ns-empty-detail">${NX.empty('اختر جلسة من القائمة لعرض قائمة الطلاب والحضور والتسميع.',{icon:'TouchApp'})}</div>`;
  }

  // ---------- sessionsPage ----------
  sessionsPage=function(){
    const sv=state.sessionView;
    if(sv&&!isDk())return sessionRosterPage(sv);
    const msg=`<div id="nsMsg">${NS.msg?NX.notice(h(NS.msg),NS.msgKind):''}</div>`;NS.msg=null;
    if(!isDk()){
      return `<div class="ns-page">${syncBanner()}${topBar()}${actionRow()}${manage()?scopeChip():''}${msg}<div id="nsList">${listHtml()}</div></div>`;
    }
    const detail=sv?sessionRosterPage(sv):emptyDetail();
    return `<div class="ns-page ns-desk"><aside class="ns-master" aria-label="الجلسات">
        <div class="ns-master-head">${topBar()}${actionRow()}${manage()?scopeChip():''}${deskStats()}${desktopFilters()}<div class="ns-count" id="nsCount">${countText()}</div>${msg}</div>
        <div class="ns-master-scroll"><div id="nsList">${listHtml()}</div></div></aside>
      <section class="ns-detail" aria-label="تفاصيل الجلسة">${syncBanner()}${detail}</section></div>`;
  };
  // restore the master list scroll position after a re-render (desktop)
  if(typeof render==='function'){
    const baseRender=render;
    render=async function(){
      const r=await baseRender.apply(this,arguments);
      try{
        if(state.page==='sessions'&&isDk()){
          const m=document.querySelector('.ns-master-scroll');
          if(m){
            if(NS.scroll!=null){m.scrollTop=NS.scroll;NS.scroll=null}
            else{const sel=m.querySelector('.ns-card.sel');if(sel&&!NS.seen){NS.seen=true;sel.scrollIntoView({block:'center'})}}
          }
        }else NS.seen=false;
      }catch(_e){}
      return r;
    };
  }

  // ---------- tools sheet (ModalBottomSheet "أدوات الجلسات") ----------
  window.nsTools=function(){
    const e=scope(),n=unassignedCount(),sw=e.switcher&&!isDk();
    const scopeBar=sw?`<button type="button" class="ns-scopebar" onclick="nsPickScope()">${ic('Groups',20)}<small>الحلقة</small><b>${h(hq(e.selectedId)?.name||'كل الحلقات')}</b><em>تغيير</em>${ic('ArrowDropDown',24)}</button>`:'';
    const kinds=(!e.selectedId&&e.mixed)?NX.chips([{label:'الحلقات',selected:e.kind!=='program',check:false,onclick:"NX.closeDialog('nsTools');rc27SelectKind('regular')"},{label:'البرامج',selected:e.kind==='program',check:false,onclick:"NX.closeDialog('nsTools');rc27SelectKind('program')"}]):'';
    const body=`${scopeBar}${kinds}
      <div class="ns-seg">${[[false,'الجلسات الحالية'],[true,'الأرشيف']].map(([v,l])=>`<button type="button" class="${NS.archived===v?'on':''}" onclick="nsSetArchived(${v})">${l}</button>`).join('')}</div>
      ${NX.btn('جلسة مخصصة',{kind:'tonal',icon:'Add',full:true,cls:'ns-act52',onclick:"NX.closeDialog('nsTools');openSession()"})}
      ${isAdmin()?NX.btn('الجلسات المحذوفة (استعادة)',{kind:'outlined',icon:'RestoreFromTrash',full:true,cls:'ns-act52',onclick:"NX.closeDialog('nsTools');nsOpenDeleted()"}):''}
      ${NS.archived?`<p class="ns-hint">الجلسات المؤرشفة محفوظة ويمكن تعديل بياناتها أو استعادتها دون فقد سجلها.</p>`:''}
      ${n>0?NX.notice(`يوجد ${n} طالب نشط غير مربوط بحلقة. لن يظهروا في أي جلسة حتى يتم ربطهم من بيانات الطالب.`,'warning'):''}`;
    dlg('nsTools','أدوات الجلسات',body,{cls:'ns-sheet'});
  };
  window.nsSetArchived=function(v){NS.archived=!!v;NX.closeDialog('nsTools');render()};
  window.nsPickScope=function(){
    const e=scope(),opts=[{id:'',name:'كل الحلقات'},...e.hs.map(x=>({id:x.id,name:x.name||'حلقة'}))];
    NX.closeDialog('nsTools');
    dlg('nsPick','اختر الحلقة',`<div class="ns-picklist">${opts.map(o=>`<button type="button" class="${(e.selectedId||'')===o.id?'on':''}" onclick="NX.closeDialog('nsPick');rc27SelectScope('${h(o.id)}')">${h(o.name)}${(e.selectedId||'')===o.id?ic('Check',20):''}</button>`).join('')}</div>`,{cls:'ns-sheet'});
  };

  // ---------- today's session (openToday / openTodayFor) ----------
  function defaultTypeFor(x){
    const sp=x?.program_specialization;
    if(sp==='tathbit')return 'review';
    if(['tilawah','tajweed_theory','tajweed_applied','noorani','ijazah','qiraat','reading_support','teacher_training'].includes(sp))return 'tilawah';
    if(['hifz','intensive_hifz','selected_surahs'].includes(sp))return 'tasmee';
    return ['tajweed','tilawah','training'].includes(x?.halaqa_type)?'tilawah':'tasmee';
  }
  window.nsStartToday=function(){
    if(!manage())return;
    const hs=activeHalaqas(),sid=scope().selectedId;
    if(sid)return nsOpenTodayFor(sid);
    if(!hs.length)return say('لا توجد حلقة مفعلة لفتح جلسة اليوم','error');
    if(hs.length===1)return nsOpenTodayFor(hs[0].id);
    const body=`${hs.length>10?NX.search('', 'بحث عن حلقة',{oninput:"nsFilterPick(this.value)"}):''}<div class="ns-picklist" id="nsPickList">${hs.map(x=>`<button type="button" data-n="${h(x.name||'')}" onclick="NX.closeDialog('nsPick');nsOpenTodayFor('${h(x.id)}')">${h(x.name||'حلقة')}</button>`).join('')}</div>`;
    dlg('nsPick','اختر الحلقة لجلسة اليوم',body,{cls:'ns-sheet'});
  };
  window.nsFilterPick=function(v){const n=String(v||'').trim();document.querySelectorAll('#nsPickList button').forEach(b=>{b.hidden=!!n&&!(b.dataset.n||'').includes(n)})};
  window.nsOpenTodayFor=async function(hid){
    try{
      const x=hq(hid),type=defaultTypeFor(x),t=todayKey();
      let se=(masterSessions().concat(state.sessions||[])).find(s=>s.halaqa_id===hid&&String(s.session_date).slice(0,10)===t&&s.session_type===type&&s.status!=='cancelled'&&!isArch(s));
      if(!se){
        const id=typeof offlineUuid==='function'?offlineUuid():'offline-se-'+Date.now();
        se={id,halaqa_id:hid,session_date:t,session_type:type,title:null,status:'open',created_by:state.user?.id||null,created_at:new Date().toISOString(),_offline:true,activity_data:{quick_start:true}};
        state.offlineRosterCache=state.offlineRosterCache||{};state.offlineRosterCache[id]={attendance:[],notes:[],recitations:[]};
        saveSessionOfflineFirst(se);
      }
      NS.archived=false;say(null);
      await openSessionRoster(se.id);
    }catch(e){fail(e,'تعذر فتح جلسة اليوم')}
  };

  // ---------- per-card actions ----------
  window.nsArchive=function(id,v){return typeof setSessionArchived==='function'?setSessionArchived(id,v):null};
  window.nsUpload=function(id){return typeof uploadSession==='function'?uploadSession(id):null};
  window.nsCancel=function(id){
    const se=sessionRef(id);if(!se||!manage())return;
    try{se.status='cancelled';saveSessionOfflineFirst(se);say('تم إلغاء الجلسة','success')}catch(e){fail(e,'تعذر إلغاء الجلسة')}
  };
  window.nsAskDelete=function(id){
    const se=sessionRef(id);if(!se)return;
    NX.confirm('حذف الجلسة','سيتم حذف الجلسة وتسميعاتها وحضورها وملاحظاتها فورًا. استخدم الأرشفة بدل الحذف إذا كنت تريد الاحتفاظ بالسجل التاريخي.','حذف',()=>nsDelete(id),{danger:true});
  };
  async function nsDelete(id){
    if(!manage())return;const se=sessionRef(id);if(!se)return;
    const local=isLocalSessionId(id);
    try{
      if(local||!navigator.onLine||state.offline){
        removeSessionFromDevice(id,{queueServerDelete:!local});clearDeletedSessionDerivedState();
        say(local?'تم حذف الجلسة المحلية وجميع بياناتها':'تم حذف الجلسة على الجهاز وسيُؤكد الحذف تلقائياً عند عودة الإنترنت','success');render();
        if(navigator.onLine)setTimeout(()=>syncOfflineQueue({refreshAfter:false}),30);return;
      }
      try{
        const {data,error}=await db.from('sessions').delete().eq('id',id).select('id');
        if(error)throw error;if(!data?.length)throw new Error('لم تسمح الصلاحيات بحذف الجلسة');
        removeSessionFromDevice(id);clearDeletedSessionDerivedState();await loadAll();say('تم حذف الجلسة','success');render();
      }catch(e){
        if(typeof isNetworkError==='function'&&isNetworkError(e)){removeSessionFromDevice(id,{queueServerDelete:true});clearDeletedSessionDerivedState();say('انقطع الاتصال؛ تم حفظ طلب حذف الجلسة وسيكتمل تلقائياً','success');render()}
        else throw e;
      }
    }catch(e){fail(e,'تعذر حذف الجلسة')}
  }
  window.cancelSession=function(id){nsAskDelete(id)};

  // ---------- New / Edit session dialogs ----------
  const ACT_TYPES=[['story','قصة تربوية'],['awareness','توعية'],['quiz','مسابقة وأسئلة'],['mixed','لقاء متنوع']];
  const RECUR=[['once','مرة واحدة'],['weekly','أسبوعياً'],['biweekly','كل أسبوعين']];
  let DLG={id:null,type:'tasmee',prefill:null};
  const hqOptions=(se)=>activeHalaqas().concat(se&&!activeHalaqas().some(x=>x.id===se.halaqa_id)&&hq(se.halaqa_id)?[hq(se.halaqa_id)]:[]).map(x=>({value:x.id,label:x.name||'حلقة'}));
  function typeGrid(sel,hid){
    const prog=isProg(hq(hid));
    return MANUAL_TYPES.map(t=>{
      const hide=prog?['tasmee','sard','review'].includes(t):t==='tilawah';
      return `<button type="button" class="nx-chip ${sel===t?'on':''}" data-t="${t}" ${hide?'hidden':''} onclick="nsPickType('${t}')"><span>${h(typeAr(t))}</span></button>`;
    }).join('');
  }
  window.nsPickType=function(t){
    DLG.type=t;document.querySelectorAll('#nsTypeGrid .nx-chip').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
    const a=q('nsActivity');if(a)a.hidden=t!=='lesson';
  };
  window.nsHalaqaChanged=function(){
    const hid=q('nsHq')?.value,prog=isProg(hq(hid));
    document.querySelectorAll('#nsTypeGrid .nx-chip').forEach(b=>{b.hidden=prog?['tasmee','sard','review'].includes(b.dataset.t):b.dataset.t==='tilawah'});
    if(!DLG.id&&['tajweed','tilawah','training','course'].includes(hq(hid)?.halaqa_type))DLG.type='tilawah';
    const cur=document.querySelector(`#nsTypeGrid .nx-chip[data-t="${DLG.type}"]`);
    if(!cur||cur.hidden){const ok=[...document.querySelectorAll('#nsTypeGrid .nx-chip')].find(b=>!b.hidden);if(ok)DLG.type=ok.dataset.t}
    nsPickType(DLG.type);
  };
  function activityFields(ad){
    ad=ad||{};
    return `<div id="nsActivity" class="ns-activity" ${DLG.type==='lesson'?'':'hidden'}>
      ${NX.notice('جلسة تربوية / تفاعلية: لا تُنشئ مقررات حفظ ولا تعتبر الطالب غير مسمّع. استخدمها للقصة والتوعية والمسابقات والتفاعل.','info')}
      ${NX.select('نوع النشاط',ACT_TYPES.map(([v,l])=>({value:v,label:l})),{id:'nsActType',value:ad.activity_type||'story'})}
      ${NX.field('قيمة الأسبوع',{id:'nsWeekly',value:ad.weekly_value||'',placeholder:'مثال: الصدق، الصلاة، بر الوالدين'})}
      <div class="ns-two">${NX.field('عدد أسئلة المسابقة',{id:'nsQuizQ',type:'number',min:0,max:100,value:String(ad.quiz_questions||0),inputmode:'numeric'})}${NX.field('الدرجة القصوى',{id:'nsQuizMax',type:'number',min:0,max:100,value:String(ad.quiz_max||10),inputmode:'numeric'})}</div>
      ${NX.select('التكرار',RECUR.map(([v,l])=>({value:v,label:l})),{id:'nsRecur',value:ad.recurrence||'once'})}
      ${NX.field('أسئلة المسابقة',{html:`<textarea id="nsQuestions" rows="4" placeholder="كل سؤال في سطر: السؤال | الإجابة | النقاط">${h(typeof activityQuestionsText==='function'?activityQuestionsText(ad):'')}</textarea>`})}
      ${NX.field('محاور اللقاء / ملخص القصة',{html:`<textarea id="nsActSummary" rows="3" placeholder="المحاور والقيم والأسئلة الرئيسية">${h(ad.summary||'')}</textarea>`})}</div>`;
  }
  function readActivity(){
    const questions=typeof parseActivityQuestionsText==='function'?parseActivityQuestionsText(q('nsQuestions')?.value||''):[],manual=+q('nsQuizQ')?.value||0,pts=questions.reduce((s,x)=>s+(Number(x.points)||0),0);
    return{activity_type:q('nsActType').value,weekly_value:q('nsWeekly').value.trim()||null,questions,quiz_questions:questions.length||manual,quiz_max:+q('nsQuizMax').value||pts||10,recurrence:q('nsRecur').value,summary:q('nsActSummary').value.trim()||null};
  }
  /** openSession(id?) — New/Edit dialog. prefill: {halaqa_id,session_date,session_type,title,notes,activity_data} for "copy to next". */
  openSession=function(id,prefill){
    if(typeof id==='object'&&id!==null){prefill=id;id=null}
    if(!activeHalaqas().length&&!(state.halaqas||[]).length)return typeof setupFirstHalaqa==='function'?setupFirstHalaqa():undefined;
    const se=id?sessionRef(id):null;if(id&&!se)return say('الجلسة غير موجودة','error');
    const src=se||prefill||null,opts=hqOptions(se),first=opts[0]?.value||'';
    const hid=src?.halaqa_id||(scope().selectedId&&opts.some(o=>o.value===scope().selectedId)?scope().selectedId:first);
    let type=src?.session_type||'tasmee';if(type==='tajweed')type='tilawah';
    if(!src&&['tajweed','tilawah','training','course'].includes(hq(hid)?.halaqa_type))type='tilawah';
    DLG={id:se?se.id:null,type};
    const arch=se&&isArch(se),title=se?(arch?'تعديل جلسة مؤرشفة':'تعديل بيانات الجلسة'):'جلسة جديدة';
    const body=`<form id="nsSessForm" class="ns-form" onsubmit="event.preventDefault();nsSaveSession()">
      ${NX.select('الحلقة',opts,{id:'nsHq',value:hid,onchange:'nsHalaqaChanged()'})}
      ${NX.field('تاريخ الجلسة',{id:'nsDate',type:'date',value:src?.session_date||todayKey(),required:true})}
      ${se?'':NX.field('العنوان (اختياري)',{id:'nsTitle',value:src?.title||''})}
      <div class="ns-typeblock"><div class="ns-lbl">نوع الجلسة</div><div class="nx-chips wrap" id="nsTypeGrid">${typeGrid(type,hid)}</div></div>
      ${se?NX.field('عنوان الجلسة',{id:'nsTitle',value:se.title||''}):''}
      ${se||src?.notes?NX.field('ملاحظات الجلسة',{html:`<textarea id="nsNotes" rows="3">${h(src?.notes||'')}</textarea>`}):''}
      ${activityFields(src?.activity_data)}
      ${se?NX.notice('إذا غيّرت تاريخ الجلسة، يعيد النظام ربط التسميعات بالخطة والمرحلة الصحيحة وتحديث أرشيف الشهر والشارات.','info'):''}
      <button type="submit" hidden></button></form>`;
    const footer=`${NX.btn('إلغاء',{kind:'text',onclick:"NX.closeDialog('nsSess')"})}${NX.btn(se?'حفظ التعديلات':'حفظ وفتح',{id:'nsSaveBtn',onclick:'nsSaveSession()'})}`;
    dlg('nsSess',title,body,{footer,cls:'ns-sessdlg'});
    nsHalaqaChanged();
  };
  editSessionData=function(id){openSession(id)};
  window.nsSaveSession=async function(){
    const hid=q('nsHq')?.value;if(!hid)return say('اختر الحلقة','error');
    const date=q('nsDate')?.value||todayKey(),type=DLG.type||'tasmee',title=(q('nsTitle')?.value||'').trim(),notes=(q('nsNotes')?.value||'').trim();
    const btn=q('nsSaveBtn');
    const lesson=type==='lesson';
    if(DLG.id){
      const se=sessionRef(DLG.id);if(!se)return say('الجلسة غير موجودة','error');
      if(!navigator.onLine||state.offline)return say('تعديل تاريخ أو بيانات جلسة يحتاج اتصالًا لحماية الخطط والشارات','error');
      const base={halaqa_id:hid,session_date:date,session_type:type,title:title||null,notes:notes||null,activity_data:lesson?readActivity():(se.activity_data||{})};
      if(btn)btn.disabled=true;
      try{
        const row=await window.HalaqatiSessionServer.save(db,{intent:'edit',localId:se.id,obj:{...se,...base}});
        Object.assign(se,row);NX.closeDialog('nsSess');
        say('تم تعديل بيانات الجلسة وتحديث ارتباطها بالخطط الشهرية','success');await afterChange(false);
      }catch(e){fail(e,'تعذر تعديل بيانات الجلسة')}finally{if(btn)btn.disabled=false}
      return;
    }
    const obj={halaqa_id:hid,session_date:date,session_type:type,title:title||null,notes:notes||null,activity_data:lesson?readActivity():{},status:'open',created_by:state.user?.id};
    // one non-cancelled session per halaqa / day / type (SessionWorkflowRules.dailySessionKey) — reopen it instead of duplicating
    const dup=(state.sessions||[]).find(s=>s.halaqa_id===hid&&String(s.session_date).slice(0,10)===date&&s.session_type===type&&s.status!=='cancelled'&&!isArch(s));
    if(dup){NX.closeDialog('nsSess');NS.archived=false;await openSessionRoster(dup.id);return}
    NX.closeDialog('nsSess');NS.archived=false;
    if(state.demo){const data={...obj,id:'se'+Date.now()};state.sessions.unshift(data);state.sessionView=data.id;state.sessionRoster={attendance:[],notes:[],recitations:[]};return render()}
    const localId=offlineUuid(),data={...obj,id:localId,_offline:true};
    enqueueOffline({type:'session',key:'session:'+localId,dedupeKey:'session:'+localId,localId,intent:'create',obj:{...obj,id:localId}});
    state.offlineRosterCache[localId]={attendance:[],notes:[],recitations:[]};state.sessions.unshift(data);
    state.sessionView=data.id;state.sessionRoster={attendance:[],notes:[],recitations:[]};cacheSnapshot();render();
    if(navigator.onLine)setTimeout(()=>syncOfflineQueue({refreshAfter:false}),30);
  };
  // "copy to next appointment" (educational activity) now prefills the native dialog
  window.duplicateActivitySession=function(id){
    if(!manage())return;const se=sessionRef(id);if(!se||se.session_type!=='lesson')return;
    const next=typeof nextActivitySessionDate==='function'?nextActivitySessionDate(se):'';
    if(!next)return say('هذه الجلسة غير مضبوطة كتكرار أسبوعي أو كل أسبوعين','error');
    openSession(null,{halaqa_id:se.halaqa_id,session_date:next,session_type:'lesson',title:se.title||'',notes:se.notes||'',activity_data:se.activity_data||{}});
  };
  try{duplicateActivitySession=window.duplicateActivitySession}catch(_e){}

  // ---------- DeletedSessionsDialog ----------
  const dlen=a=>Array.isArray(a)?a.length:0;
  function deletedBody(){
    const D=NS.deleted;
    let list;
    if(D.loading)list=NX.skeleton(2);
    else if(!D.rows.length&&!D.msg)list='<p class="nx-confirm-text">لا توجد جلسات محذوفة.</p>';
    else list=`<div class="ns-del-list">${D.rows.map(r=>{
      const s=r.session_row||{},nm=hq(s.halaqa_id)?.name||'حلقة',restored=!!r.restored_at;
      return `<div class="ns-del"><b>${h(nm)} · ${h(s.session_date||'')}</b><small>تسميع ${dlen(r.recitation_entries)} · حضور ${dlen(r.attendance_records)} · ملاحظات ${dlen(r.student_daily_notes)} · حُذفت ${h(String(r.deleted_at||'').slice(0,16).replace('T',' '))}</small>
        ${restored?'<span class="ns-del-ok">تمت استعادتها</span>':NX.btn(D.busy===r.id?'جارٍ الاستعادة…':'استعادة الجلسة',{kind:'filled',disabled:!!D.busy,onclick:`nsRestoreDeleted('${h(r.id)}')`,cls:'ns-del-btn'})}</div>`}).join('')}</div>`;
    return `<p class="ns-hint">كل جلسة حُذفت وفيها بيانات تُحفظ هنا. الاستعادة تعيد الجلسة وتسميعها وحضورها وملاحظاتها.</p>${D.msg?`<p class="ns-del-err">${h(D.msg)}</p>`:''}${list}`;
  }
  function paintDeleted(){dlg('nsDeleted','الجلسات المحذوفة',deletedBody(),{footer:NX.btn('إغلاق',{kind:'text',onclick:"NX.closeDialog('nsDeleted')"}),cls:'ns-sheet'})}
  async function loadDeleted(){
    const D=NS.deleted;D.loading=true;paintDeleted();
    try{
      const {data,error}=await db.from('deleted_session_snapshots').select('id,session_id,deleted_at,restored_at,session_row,recitation_entries,attendance_records,student_daily_notes').order('deleted_at',{ascending:false}).limit(100);
      if(error)throw error;D.rows=data||[];D.msg=null;
    }catch(e){D.msg='تعذر قراءة الجلسات المحذوفة. تأكد من الاتصال ومن تشغيل ملف SQL الخاص بالنسخة. ('+((e&&e.message)||'')+')'}
    D.loading=false;paintDeleted();
  }
  window.nsOpenDeleted=function(){if(!isAdmin())return;NS.deleted.rows=[];NS.deleted.msg=null;NS.deleted.busy=null;loadDeleted()};
  window.nsRestoreDeleted=async function(id){
    const D=NS.deleted;D.busy=id;paintDeleted();
    try{
      const {error}=await db.rpc('rc25_restore_deleted_session',{p_snapshot_id:id});if(error)throw error;
      try{await loadAll(true)}catch(_e){}
      say('تمت استعادة الجلسة','success');
    }catch(e){D.msg=(e&&e.message)||'تعذرت الاستعادة'}
    D.busy=null;await loadDeleted();
    if(state.page==='sessions'){const l=q('nsList');if(l)l.innerHTML=listHtml()}
  };
  window.rc27OpenDeletedSessions=window.nsOpenDeleted;
  window.rc27RestoreSession=function(id){return window.nsRestoreDeleted(id)};

  // ---------- QuickMemorizationScreen (#opsQuickOverlay) ----------
  const qs=()=>state.opsQuick||(state.opsQuick={});
  function counter(label,key){
    const v=qs()[key]||0,lab=h(label);
    return `<div class="ns-counter"><span>${lab}</span><div><button type="button" class="nx-iconbtn" aria-label="إنقاص ${lab}" onclick="opsQuickAdjust('${key}',-1)">${ic('Remove',24)}</button><b>${v}</b><button type="button" class="nx-iconbtn" aria-label="زيادة ${lab}" onclick="opsQuickAdjust('${key}',1)">${ic('Add',24)}</button></div></div>`;
  }
  const healthKind=hl=>hl==='blue'?'info':hl==='green'?'success':hl==='yellow'?'warning':hl==='red'?'danger':'neutral';
  window.nsQuickTrack=function(t){state.opsProgramTrack=t==='tathbit'?'tathbit':'general_hifz';state.reportTrack=state.opsProgramTrack;const Q=qs();Q.index=0;Q.mistakes=0;Q.prompts=0;Q.attendance='present';Q.absenceReason='';Q.msg=null;opsQuickRender()};
  window.nsQuickAtt=function(v){const Q=qs();Q.attendance=v;Q.absenceReason=v==='excused'?'غياب بعذر':v==='absent'?'غياب بدون عذر':'';Q.absencePicker=false;opsQuickRender()};
  const quickShell=(inner)=>`<div class="ns-quick"><header class="ns-qhead"><h2>التحفيظ السريع</h2>${NX.iconBtn('Close',{title:'إغلاق',onclick:"opsCloseOverlay('opsQuickOverlay')"})}</header>${inner}</div>`;
  opsQuickRender=function(){
    const e=opsEnsureOverlay('opsQuickOverlay');e.classList.add('ns-qo');e.classList.remove('hidden');
    const Q=qs(),tr=state.opsProgramTrack==='tathbit'?'tathbit':'general_hifz';
    const chips=NX.chips([{label:'الحفظ العام',selected:tr==='general_hifz',check:false,onclick:"nsQuickTrack('general_hifz')"},{label:'التثبيت',selected:tr==='tathbit',check:false,onclick:"nsQuickTrack('tathbit')"}],{});
    const rows=opsQuickStudents();
    if(!rows.length){e.innerHTML=quickShell(`<div class="ns-qtracks">${chips}</div>${NX.empty('لا يوجد طلاب نشطون في هذا المسار',{icon:'GroupOff'})}`);return}
    Q.index=Math.max(0,Math.min(rows.length-1,Q.index||0));
    const st=rows[Q.index],bundle=opsQuickPlanBundle(st,todayKey()),a=bundle?.assignment,pr=bundle?.progress;
    const done=opsAllRecitations().some(r=>String(r.student_id)===String(st.id)&&opsSessionDate(r)===todayKey());
    const hasAmount=typeof opsQuickAssignmentHasAmount==='function'?opsQuickAssignmentHasAmount(a):!!a;
    const duty=hasAmount?`${opsAssignmentText(a)}`:'لا يوجد مقرر ذكي قابل للتسجيل الآن';
    const head=bundle?.dueToday&&hasAmount?'مقرر اليوم':hasAmount&&bundle?.dueDate?`المقرر القادم · ${bundle.dueDate}`:'الخطة الذكية';
    const att=Q.attendance||'present',present=att==='present';
    const last=Q.index>=rows.length-1,saving=!!Q.saving;
    const saveLabel=saving?'جارٍ الحفظ…':done?'✓ مسمّع اليوم':present?'تمّ التسميع وحفظ':'حفظ الغياب والتالي';
    const canSave=!saving&&(done||!present||hasAmount);
    e.innerHTML=quickShell(`<div class="ns-qtracks">${chips}</div>
      <div class="ns-qbody">
        <div class="ns-qidx">الطالب ${Q.index+1} من ${rows.length}</div>
        <div class="ns-qcard">
          ${NX.pill(h(pr?.healthLabel||'بدون خطة'),healthKind(pr?.health||'green'))}
          <h1>${h(st.full_name)}</h1>
          ${done?NX.pill('تمّ التسميع اليوم','success',{icon:'CheckCircle'}):''}
          <div class="ns-qduty"><small>${h(head)}</small><b>${h(duty)}</b></div>
        </div>
        <div class="ns-qatt">
          <button type="button" class="nx-btn ${present?'nx-filled':'nx-tonal'}" onclick="nsQuickAtt('present')">${ic('Check',18)}<span>حاضر</span></button>
          <button type="button" class="nx-btn ${att==='absent'?'ns-err':'nx-tonal'}" onclick="nsQuickAtt('absent')"><span>غائب</span></button>
          <button type="button" class="nx-btn nx-outlined ${att==='excused'?'on':''}" onclick="nsQuickAtt('excused')"><span>بعذر</span></button>
        </div>
        ${present?`<div class="ns-qcounters">${counter('الأخطاء','mistakes')}${counter('التلقين','prompts')}</div>`:NX.notice(att==='excused'?'سيُسجل غياب بعذر وتعيد الخطة توزيع الورد.':'سيُسجل غياب بدون عذر وتعيد الخطة توزيع الورد.','warning')}
        ${Q.msg?NX.notice(h(Q.msg),Q.msgKind||'info'):''}
        <div class="ns-qnav">
          <button type="button" class="nx-btn nx-outlined ns-qprev" onclick="opsQuickMove(-1)" ${Q.index<=0||saving?'disabled':''}><span>السابق</span></button>
          <button type="button" class="nx-btn nx-filled ns-qsave" onclick="opsQuickSave('${h(st.id)}')" ${canSave?'':'disabled'}><span>${saveLabel}</span></button>
          <button type="button" class="nx-btn nx-outlined ns-qnext" onclick="opsQuickMove(1)" ${last||saving?'disabled':''}><span>التالي</span></button>
        </div>
        ${NX.btn('نموذج التسميع الكامل',{kind:'outlined',full:true,cls:'ns-qfull',onclick:`opsQuickOpenDetails('${h(st.id)}')`})}
      </div>`);
  };
  // keep the pending-save message ("تم حفظ التسميع محليًا") like the Compose screen
  if(typeof opsQuickSave==='function'){
    const baseSave=opsQuickSave;
    opsQuickSave=async function(id){
      const Q=qs(),att=Q.attendance||'present';let failed=null;const baseToast=window.toast;
      Q.saving=true;Q.msg=null;opsQuickRender();
      window.toast=function(m){failed=m;return baseToast.apply(this,arguments)};
      try{await baseSave.call(this,id)}catch(err){failed=(err&&err.message)||'تعذر الحفظ'}
      finally{window.toast=baseToast;Q.saving=false}
      if(!document.getElementById('opsQuickOverlay')||document.getElementById('opsQuickOverlay').classList.contains('hidden'))return;
      Q.msg=failed||(att==='present'?'تم حفظ التسميع محليًا':'تم حفظ الغياب محليًا');Q.msgKind=failed?'error':'success';
      opsQuickRender();
    };
  }
  if(typeof opsQuickMove==='function'){
    const baseMove=opsQuickMove;
    opsQuickMove=function(d){qs().msg=null;return baseMove.apply(this,arguments)};
  }
  // status/segment wrappers from the ops + live layers are replaced by the native screen (no legacy launch card)
})();
